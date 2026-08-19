import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions.service';
import type { CreditsService } from './credits.service';
import type { StripeService } from './stripe.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SettingsService } from '../../common/settings/settings.service';
import type { AuditService } from '../audit/audit.service';
import type { ConfigService } from '@nestjs/config';

// L0-D — plati Stripe + confirmare race-safe + abonament prelungit.

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function baseOrder(over: Partial<any> = {}) {
  return {
    id: ORDER_ID,
    companyId: 'c1',
    orderType: 'CREDIT_PACKAGE',
    status: 'PENDING',
    planId: null,
    creditPackageId: 'pkg1',
    credits: 10,
    baseAmountRon: new Prisma.Decimal('100.00'),
    vatRate: new Prisma.Decimal('21.00'),
    vatAmountRon: new Prisma.Decimal('21.00'),
    totalRon: new Prisma.Decimal('121.00'),
    invoiceSeries: null,
    invoiceNumber: null,
    sellerSnapshot: null,
    paymentSource: null,
    confirmedAt: null,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-08-19T10:00:00Z'),
    ...over,
  };
}

// Prisma mock: un "rand" de comanda in memorie + tx care opereaza pe el (updateMany conditionat).
function makePrisma(order: any | null, opts: { activeSub?: any } = {}) {
  const state = { order, sub: opts.activeSub ?? null, createdSub: null as any, events: new Set<string>() };
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    mockBillingOrder: {
      aggregate: jest.fn().mockResolvedValue({ _max: { invoiceNumber: 41 } }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (state.order && state.order.id === where.id && state.order.status === where.status) {
          Object.assign(state.order, data);
          return { count: 1 };
        }
        return { count: 0 };
      }),
      findUniqueOrThrow: jest.fn(async () => state.order),
    },
    subscription: {
      findFirst: jest.fn(async () => state.sub),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(state.sub, data);
        return state.sub;
      }),
      create: jest.fn(async ({ data }: any) => {
        state.createdSub = { id: 'sub-new', ...data };
        return state.createdSub;
      }),
    },
  };
  const prisma: any = {
    state,
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    mockBillingOrder: {
      findUnique: jest.fn(async () => state.order),
      findUniqueOrThrow: jest.fn(async () => state.order),
      updateMany: tx.mockBillingOrder.updateMany,
      update: jest.fn(async ({ data }: any) => {
        Object.assign(state.order, data);
        return state.order;
      }),
      create: jest.fn(async ({ data }: any) => {
        state.order = baseOrder({ ...data });
        return state.order;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    subscriptionPlan: {
      findUnique: jest.fn().mockResolvedValue({ id: 'plan-gold', tier: 'GOLD', priceRon: 399, includedCredits: 50, isActive: true, marketplaceGatingDelayMin: 0 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'plan-gold', tier: 'GOLD' }]),
    },
    creditPackage: {
      findUnique: jest.fn().mockResolvedValue({ id: 'pkg1', credits: 10, priceRon: 100, isActive: true }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'firma@demo.ro', languagePreference: 'RO' }),
    },
    stripeEvent: {
      findUnique: jest.fn(async ({ where }: any) => (state.events.has(where.id) ? { id: where.id } : null)),
      create: jest.fn(async ({ data }: any) => {
        state.events.add(data.id);
        return data;
      }),
    },
  };
  return prisma;
}

const settings = {
  getString: jest.fn(async (_k: string, fb: string) => fb),
  getNumber: jest.fn(async (_k: string, fb: number) => fb),
  getInt: jest.fn(async (_k: string, fb: number) => fb),
  getBool: jest.fn(async (_k: string, fb: boolean) => fb),
} as unknown as SettingsService;

function makeStripe(enabled: boolean) {
  return {
    isEnabled: jest.fn(() => enabled),
    createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    expireSession: jest.fn().mockResolvedValue(undefined),
  } as unknown as StripeService & { createCheckoutSession: jest.Mock; expireSession: jest.Mock };
}

const config = { getOrThrow: jest.fn(() => 'https://app.cozyhome.ro/') } as unknown as ConfigService;

function build(prisma: any, stripe: any) {
  const credits = { grant: jest.fn().mockResolvedValue(undefined), ensureWallet: jest.fn() } as unknown as CreditsService & { grant: jest.Mock };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService & { log: jest.Mock };
  const subscriptions = new SubscriptionsService(prisma as PrismaService, settings, credits);
  const service = new PaymentsService(prisma as PrismaService, settings, credits, subscriptions, stripe, config, audit);
  return { service, credits, audit, subscriptions };
}

function completedEvent(over: Partial<Stripe.Checkout.Session> = {}, type: string = 'checkout.session.completed', id = 'evt_1'): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_123',
        client_reference_id: ORDER_ID,
        metadata: { orderId: ORDER_ID, companyId: 'c1' },
        ...over,
      },
    },
  } as unknown as Stripe.Event;
}

describe('PaymentsService — purchase', () => {
  it('fara Stripe: comanda PENDING + checkoutUrl null (transfer bancar)', async () => {
    const prisma = makePrisma(null);
    const stripe = makeStripe(false);
    const { service } = build(prisma, stripe);
    const res = await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    expect(res.checkoutUrl).toBeNull();
    expect(res.order.status).toBe('PENDING');
    expect(res.order.totalRon).toBe(121);
    expect(res.order.hasStripeSession).toBe(false);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('cu Stripe: creeaza sesiunea Checkout cu totalul CU TVA in bani si salveaza stripe_session_id', async () => {
    const prisma = makePrisma(null);
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    const res = await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    expect(res.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
    expect(res.order.hasStripeSession).toBe(true);
    const call = stripe.createCheckoutSession.mock.calls[0][0];
    expect(call.amountRon.toString()).toBe('121');
    expect(call.successUrl).toBe(`https://app.cozyhome.ro/ro/marketplace/wallet?payment=success&order=${ORDER_ID}`);
    expect(call.cancelUrl).toContain('payment=cancelled');
    expect(prisma.mockBillingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeSessionId: 'cs_test_1' } }),
    );
  });

  it('createCheckout re-creeaza sesiunea (expira pe cea veche) doar pentru PENDING', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_old' }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    const res = await service.createCheckout('c1', 'u1', ORDER_ID);
    expect(stripe.expireSession).toHaveBeenCalledWith('cs_old');
    expect(res.checkoutUrl).toContain('cs_test_1');

    prisma.state.order.status = 'CANCELLED';
    await expect(service.createCheckout('c1', 'u1', ORDER_ID)).rejects.toMatchObject({ status: 409 });
  });
});

describe('PaymentsService — confirm (race-safe, factura sub lock)', () => {
  it('confirma o singura data: a doua confirmare → 409 PAYMENT_ALREADY_CONFIRMED; creditele acordate o data', async () => {
    const prisma = makePrisma(baseOrder());
    const { service, credits } = build(prisma, makeStripe(true));
    const dto = await service.confirm(ORDER_ID, 'stripe', { stripePaymentIntentId: 'pi_1' });
    expect(dto.status).toBe('CONFIRMED');
    expect(dto.invoiceLabel).toBe('MM-42');
    expect(dto.paymentSource).toBe('stripe');
    expect(prisma.tx.$executeRaw).toHaveBeenCalled(); // advisory lock per serie
    expect(credits.grant).toHaveBeenCalledWith('c1', 10, 'CREDIT_PURCHASE', prisma.tx);

    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(credits.grant).toHaveBeenCalledTimes(1);
  });

  it('race: doua confirmari care trec de pre-check — a doua pica pe updateMany count=0 (409) si nu livreaza', async () => {
    const prisma = makePrisma(baseOrder());
    const { service, credits } = build(prisma, makeStripe(true));
    // simulam ca ambele au citit PENDING: findUnique intoarce un snapshot PENDING mereu
    const snapshot = baseOrder();
    prisma.mockBillingOrder.findUnique.mockResolvedValue(snapshot);
    const first = service.confirm(ORDER_ID, 'admin');
    const second = service.confirm(ORDER_ID, 'stripe');
    const results = await Promise.allSettled([first, second]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const ko = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(ko[0].reason).toBeInstanceOf(HttpException);
    expect(ko[0].reason.status).toBe(409);
    expect(credits.grant).toHaveBeenCalledTimes(1);
  });

  it('comanda inexistenta → 404 PAYMENT_NOT_FOUND', async () => {
    const prisma = makePrisma(null);
    const { service } = build(prisma, makeStripe(false));
    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('abonament: fara abonament activ → rand nou 30 zile + creditele planului', async () => {
    const prisma = makePrisma(baseOrder({ orderType: 'SUBSCRIPTION', planId: 'plan-gold', credits: 50 }));
    const { service, credits } = build(prisma, makeStripe(false));
    const dto = await service.confirm(ORDER_ID, 'admin');
    expect(dto.planTier).toBe('GOLD');
    expect(prisma.tx.subscription.create).toHaveBeenCalled();
    const created = prisma.state.createdSub;
    const days = (created.expiresAt.getTime() - created.startedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(credits.grant).toHaveBeenCalledWith('c1', 50, 'SUBSCRIPTION_CREDITS', prisma.tx);
  });

  it('abonament cumparat in timpul unuia activ → PRELUNGIRE pe acelasi rand (zilele ramase se pastreaza)', async () => {
    const now = Date.now();
    const activeExpires = new Date(now + 10 * 86_400_000);
    const activeSub = { id: 'sub-1', companyId: 'c1', planId: 'plan-gold', status: 'ACTIVE', isTrial: true, expiresAt: activeExpires };
    const prisma = makePrisma(baseOrder({ orderType: 'SUBSCRIPTION', planId: 'plan-gold', credits: 50 }), { activeSub });
    const { service } = build(prisma, makeStripe(false));
    await service.confirm(ORDER_ID, 'stripe');
    expect(prisma.tx.subscription.create).not.toHaveBeenCalled();
    expect(prisma.tx.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' }, data: expect.objectContaining({ isTrial: false, planId: 'plan-gold' }) }),
    );
    const newExpires: Date = prisma.state.sub.expiresAt;
    expect(Math.round((newExpires.getTime() - activeExpires.getTime()) / 86_400_000)).toBe(30);
  });
});

describe('PaymentsService — cancel', () => {
  it('PENDING → CANCELLED (admin expira sesiunea Stripe); CANCELLED idempotent; CONFIRMED → 409', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_x' }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    const dto = await service.cancel(ORDER_ID, 'admin');
    expect(dto.status).toBe('CANCELLED');
    expect(stripe.expireSession).toHaveBeenCalledWith('cs_x');
    // idempotent
    expect((await service.cancel(ORDER_ID, 'admin')).status).toBe('CANCELLED');
    prisma.state.order.status = 'CONFIRMED';
    await expect(service.cancel(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
  });
});

describe('PaymentsService — webhook Stripe', () => {
  it('checkout.session.completed (paid) → confirm source=stripe + audit + payment_intent salvat', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1' }));
    const { service, audit } = build(prisma, makeStripe(true));
    const res = await service.handleStripeEvent(completedEvent());
    expect(res).toEqual({ received: true, handled: 'confirmed' });
    expect(prisma.state.order.status).toBe('CONFIRMED');
    expect(prisma.state.order.paymentSource).toBe('stripe');
    expect(prisma.state.order.stripePaymentIntentId).toBe('pi_123');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_CONFIRMED', entityId: ORDER_ID }));
    expect(prisma.stripeEvent.create).toHaveBeenCalledWith({ data: { id: 'evt_1', type: 'checkout.session.completed' } });
  });

  it('acelasi event.id a doua oara → duplicate (fara reprocesare); retry cu alt id pe comanda confirmata → already_confirmed', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1' }));
    const { service, credits } = build(prisma, makeStripe(true));
    await service.handleStripeEvent(completedEvent());
    expect(await service.handleStripeEvent(completedEvent())).toEqual({ received: true, handled: 'duplicate' });
    expect(await service.handleStripeEvent(completedEvent({}, 'checkout.session.completed', 'evt_2'))).toEqual({
      received: true,
      handled: 'already_confirmed',
    });
    expect(credits.grant).toHaveBeenCalledTimes(1);
  });

  it('completed cu payment_status unpaid → nu confirma', async () => {
    const prisma = makePrisma(baseOrder());
    const { service } = build(prisma, makeStripe(true));
    const res = await service.handleStripeEvent(completedEvent({ payment_status: 'unpaid' }));
    expect(res.handled).toBe('unpaid');
    expect(prisma.state.order.status).toBe('PENDING');
  });

  it('checkout.session.expired → CANCELLED daca PENDING si sesiunea e cea curenta; altfel superseded/ignored', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1' }));
    const { service } = build(prisma, makeStripe(true));
    const res = await service.handleStripeEvent(completedEvent({ payment_status: 'unpaid' }, 'checkout.session.expired', 'evt_exp'));
    expect(res.handled).toBe('cancelled');
    expect(prisma.state.order.status).toBe('CANCELLED');

    // alta comanda, cu sesiune re-creata intre timp
    const prisma2 = makePrisma(baseOrder({ stripeSessionId: 'cs_newer' }));
    const { service: s2 } = build(prisma2, makeStripe(true));
    const res2 = await s2.handleStripeEvent(completedEvent({ payment_status: 'unpaid' }, 'checkout.session.expired', 'evt_exp2'));
    expect(res2.handled).toBe('superseded');
    expect(prisma2.state.order.status).toBe('PENDING');
  });

  it('eveniment necunoscut → ignorat (200), dar inregistrat', async () => {
    const prisma = makePrisma(baseOrder());
    const { service } = build(prisma, makeStripe(true));
    const res = await service.handleStripeEvent({ id: 'evt_x', type: 'payment_intent.created', data: { object: {} } } as unknown as Stripe.Event);
    expect(res).toEqual({ received: true, handled: 'ignored' });
    expect(prisma.stripeEvent.create).toHaveBeenCalled();
  });

  it('eroare de procesare → se propaga (500 → Stripe reincearca) si evenimentul NU e inregistrat', async () => {
    const prisma = makePrisma(baseOrder());
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    const { service } = build(prisma, makeStripe(true));
    await expect(service.handleStripeEvent(completedEvent())).rejects.toThrow('db down');
    expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsService — admin grant', () => {
  it('grant fara abonament activ → rand nou cu N zile; includeCredits=true → creditele planului', async () => {
    const prisma = makePrisma(null);
    prisma.company = { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Firma SRL' }) };
    const { subscriptions, credits } = build(prisma, makeStripe(false));
    const res = await subscriptions.adminGrant({ companyId: 'c1', planId: 'plan-gold', days: 15, includeCredits: true });
    expect(res.tier).toBe('GOLD');
    expect(res.companyName).toBe('Firma SRL');
    expect(res.daysLeft).toBe(15);
    expect(credits.grant).toHaveBeenCalledWith('c1', 50, 'SUBSCRIPTION_CREDITS', prisma.tx);
  });

  it('grant peste un abonament activ → prelungeste randul activ cu N zile de la expirarea curenta', async () => {
    const activeExpires = new Date(Date.now() + 5 * 86_400_000);
    const activeSub = { id: 'sub-1', companyId: 'c1', planId: 'plan-gold', status: 'ACTIVE', isTrial: true, startedAt: new Date(), expiresAt: activeExpires };
    const prisma = makePrisma(null, { activeSub });
    prisma.company = { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Firma SRL' }) };
    const { subscriptions, credits } = build(prisma, makeStripe(false));
    const res = await subscriptions.adminGrant({ companyId: 'c1', planId: 'plan-gold', days: 30, includeCredits: false });
    expect(prisma.tx.subscription.create).not.toHaveBeenCalled();
    expect(res.daysLeft).toBe(35);
    expect(res.isTrial).toBe(false);
    expect(credits.grant).not.toHaveBeenCalled();
  });
});
