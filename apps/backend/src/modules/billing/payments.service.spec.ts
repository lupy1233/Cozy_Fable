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
import type { BillingReadinessService } from './billing-readiness.service';
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
    stripeCheckoutAttempt: null,
    stripePaymentIntentId: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-08-19T10:00:00Z'),
    testMode: false,
    buyerSnapshot: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    eInvoiceStatus: null,
    anafUploadId: null,
    anafDownloadId: null,
    eInvoiceUpdatedAt: null,
    paymentClaimedAt: null,
    transferReminderSentAt: null,
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
      findUnique: jest.fn().mockResolvedValue({ id: 'plan-gold', tier: 'GOLD', code: 'GOLD', priceRon: 399, includedCredits: 50, isActive: true, marketplaceGatingDelayMin: 0 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'plan-gold', tier: 'GOLD', code: 'GOLD' }]),
    },
    creditPackage: {
      findUnique: jest.fn().mockResolvedValue({ id: 'pkg1', credits: 10, priceRon: 100, isActive: true }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'firma@demo.ro', languagePreference: 'RO' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]),
    },
    companyMember: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'owner-1' }]),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Mobila Demo SRL', cui: 'RO40298306', regComNumber: 'J12/3/2020', addressText: 'Cluj', isVatPayer: false }),
    },
    stripeEvent: {
      findUnique: jest.fn(async ({ where }: any) => (state.events.has(where.id) ? { id: where.id } : null)),
      create: jest.fn(async ({ data }: any) => {
        state.events.add(data.id);
        return data;
      }),
    },
  };
  tx.mockBillingOrder.create = prisma.mockBillingOrder.create;
  tx.mockBillingOrder.findUnique = prisma.mockBillingOrder.findUnique;
  tx.mockBillingOrder.update = prisma.mockBillingOrder.update;
  tx.user = prisma.user;
  tx.companyMember = prisma.companyMember;
  return prisma;
}

const settings = {
  getString: jest.fn(async (_k: string, fb: string) => fb),
  getNumber: jest.fn(async (_k: string, fb: number) => fb),
  getInt: jest.fn(async (_k: string, fb: number) => fb),
  getBool: jest.fn(async (_k: string, fb: boolean) => fb),
} as unknown as SettingsService;

// mode: live implicit cand Stripe e activ (comenzi fiscale); 'test' → comenzi fara numar.
function makeStripe(enabled: boolean, mode: 'live' | 'test' | null = enabled ? 'live' : null) {
  return {
    isEnabled: jest.fn(() => enabled),
    mode: jest.fn(() => mode),
    assertEventMode: jest.fn((event: Stripe.Event) => {
      if (mode && event.livemode !== (mode === 'live')) {
        throw new HttpException({ code: 'VALIDATION_ERROR', message: 'Event mode does not match the configured Stripe key' }, 400);
      }
    }),
    createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    retrieveCheckoutSession: jest.fn().mockImplementation(async (id: string) => ({ id, status: 'open', url: `https://checkout.stripe.com/c/pay/${id}` })),
    expireSession: jest.fn().mockResolvedValue(undefined),
    ensureSessionExpired: jest.fn().mockResolvedValue(undefined),
  } as unknown as StripeService & { createCheckoutSession: jest.Mock; expireSession: jest.Mock; retrieveCheckoutSession: jest.Mock; ensureSessionExpired: jest.Mock; assertEventMode: jest.Mock };
}

const config = { getOrThrow: jest.fn(() => 'https://app.cozyhome.ro/') } as unknown as ConfigService;

const VALID_SELLER = {
  name: 'Firma Reala SRL',
  cui: 'RO12345674',
  regCom: 'J40/1/2026',
  address: 'Str. Reala 1, Bucuresti',
  iban: 'RO08TEST0000000000000001',
};

function makeReadiness() {
  return {
    assertReady: jest.fn().mockResolvedValue(VALID_SELLER),
    check: jest.fn().mockResolvedValue({ ready: true, problems: [], seller: VALID_SELLER }),
  };
}

function build(prisma: any, stripe: any, readiness: any = makeReadiness()) {
  const credits = { grant: jest.fn().mockResolvedValue(undefined), ensureWallet: jest.fn() } as unknown as CreditsService & { grant: jest.Mock };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService & { log: jest.Mock };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) } as any;
  const subscriptions = new SubscriptionsService(prisma as PrismaService, settings, credits);
  const service = new PaymentsService(prisma as PrismaService, settings, credits, subscriptions, stripe, config, audit, outbox, readiness as BillingReadinessService);
  return { service, credits, audit, subscriptions, outbox, readiness };
}

function completedEvent(over: Partial<Stripe.Checkout.Session> = {}, type: string = 'checkout.session.completed', id = 'evt_1'): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        livemode: true,
        payment_status: 'paid',
        amount_total: 12100,
        currency: 'ron',
        payment_intent: 'pi_123',
        client_reference_id: ORDER_ID,
        metadata: { orderId: ORDER_ID, companyId: 'c1' },
        ...over,
      },
    },
    livemode: over.livemode ?? true,
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

  it('E-company-24: fara Stripe → payment.pending (admini) + payment.transfer_instructions (doar OWNER/MANAGER)', async () => {
    const prisma = makePrisma(null);
    const { service, outbox } = build(prisma, makeStripe(false));
    const res = await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    expect(res.order.paymentClaimedAt).toBeNull();
    expect(res.order.transferExpiresAt).toBeNull(); // bank_transfer_expiry_days = 0 (oprit)
    const types = outbox.record.mock.calls.map((c: any[]) => c[2]);
    expect(types).toEqual(['payment.pending', 'payment.transfer_instructions']);
    const [, key, , payload, targets] = outbox.record.mock.calls[1];
    expect(key).toBe(`payment.transfer_instructions:${ORDER_ID}`);
    expect(payload).toEqual({ orderId: ORDER_ID, companyId: 'c1', orderType: 'CREDIT_PACKAGE' });
    expect(targets).toEqual(['owner-1']);
    expect(outbox.record.mock.calls[0][4]).toEqual(['admin-1']);
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] }, user: { deletedAt: null, blockedAt: null } },
    }));
  });

  it('E-company-24: cu Stripe → nici payment.pending, nici payment.transfer_instructions', async () => {
    const prisma = makePrisma(null);
    const { service, outbox } = build(prisma, makeStripe(true));
    await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('E-company-24: transferExpiresAt = created_at + N zile doar pe comenzile prin transfer nemarcate', async () => {
    const prisma = makePrisma(null);
    const { service } = build(prisma, makeStripe(false));
    const bank = baseOrder();
    expect(service.toDto(bank as any, null, 3).transferExpiresAt).toBe('2026-08-22T10:00:00.000Z');
    expect(service.toDto(bank as any, null, 0).transferExpiresAt).toBeNull();
    expect(service.toDto(baseOrder({ paymentClaimedAt: new Date() }) as any, null, 3).transferExpiresAt).toBeNull();
    expect(service.toDto(baseOrder({ stripeSessionId: 'cs_1' }) as any, null, 3).transferExpiresAt).toBeNull();
    expect(service.toDto(baseOrder({ stripeCheckoutAttempt: { idempotencyKey: 'k' } }) as any, null, 3).transferExpiresAt).toBeNull();
    expect(service.toDto(baseOrder({ status: 'CONFIRMED' }) as any, null, 3).transferExpiresAt).toBeNull();
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
    expect(call.locale).toBe('ro');
    expect(call.description).toContain('credite marketplace');
    expect(prisma.mockBillingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeSessionId: 'cs_test_1' } }),
    );
  });

  it('cu Stripe: utilizator EN → locale en, descriere EN si URL-uri /en/', async () => {
    const prisma = makePrisma(null);
    prisma.user.findUnique.mockResolvedValue({ email: 'firma@demo.ro', languagePreference: 'EN' });
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    const call = stripe.createCheckoutSession.mock.calls[0][0];
    expect(call.locale).toBe('en');
    expect(call.successUrl).toContain('/en/marketplace/wallet');
    expect(call.description).toContain('marketplace credits package');
  });

  it('createCheckout resumes the same open session and refuses terminal orders', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_old' }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    const res = await service.createCheckout('c1', 'u1', ORDER_ID);
    expect(stripe.expireSession).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(res.checkoutUrl).toContain('cs_old');

    prisma.state.order.status = 'CANCELLED';
    await expect(service.createCheckout('c1', 'u1', ORDER_ID)).rejects.toMatchObject({ status: 409 });
  });

  it('persists identical provider parameters across a timeout before the session ID is written', async () => {
    const prisma = makePrisma(baseOrder());
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    stripe.createCheckoutSession.mockRejectedValueOnce(new Error('Timeout after provider acceptance'));
    await expect(service.createCheckout('c1', 'u1', ORDER_ID)).rejects.toThrow('Timeout');
    expect(prisma.state.order.stripeCheckoutAttempt.idempotencyKey).toBeTruthy();
    const first = stripe.createCheckoutSession.mock.calls[0][0];
    await service.createCheckout('c1', 'u1', ORDER_ID);
    expect(stripe.createCheckoutSession.mock.calls[1][0]).toEqual(first);
    expect(prisma.mockBillingOrder.create).not.toHaveBeenCalled();
  });

  it('never opens another checkout for a completed provider session awaiting its webhook', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_complete' }));
    const stripe = makeStripe(true);
    stripe.retrieveCheckoutSession.mockResolvedValue({ id: 'cs_complete', status: 'complete', url: null });
    const { service } = build(prisma, stripe);
    await expect(service.createCheckout('c1', 'u1', ORDER_ID)).rejects.toMatchObject({ status: 409 });
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });
  it('does not return a cached open checkout URL after concurrent cancellation', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_open' }));
    const stripe = makeStripe(true);
    stripe.retrieveCheckoutSession.mockImplementation(async () => {
      prisma.state.order.status = 'CANCELLED';
      return { id: 'cs_open', status: 'open', url: 'https://checkout.stripe.com/stale' };
    });
    const { service } = build(prisma, stripe);
    const result = await service.createCheckout('c1', 'u1', ORDER_ID);
    expect(result.order.status).toBe('CANCELLED');
    expect(result.checkoutUrl).toBeNull();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });
  it('refuses unknown attempts outside the fixed deduplication safety window', async () => {
    const prisma = makePrisma(baseOrder({ stripeCheckoutAttempt: { createdAt: Math.floor(Date.now() / 1000) - 24 * 3600, expiresAt: Math.floor(Date.now() / 1000) + 3600, idempotencyKey: 'old' } }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    await expect(service.createCheckout('c1', 'u1', ORDER_ID)).rejects.toMatchObject({ status: 503 });
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
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

  it('E-company-24: payment.confirmed tinteste doar OWNER/MANAGER (conturi active)', async () => {
    const prisma = makePrisma(baseOrder());
    prisma.companyMember.findMany.mockResolvedValue([{ userId: 'owner-1' }, { userId: 'mgr-1' }]);
    const { service, outbox } = build(prisma, makeStripe(false));
    await service.confirm(ORDER_ID, 'admin');
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] }, user: { deletedAt: null, blockedAt: null } },
    }));
    const call = outbox.record.mock.calls.find((c: any[]) => c[2] === 'payment.confirmed');
    expect(call[4]).toEqual(['owner-1', 'mgr-1']);
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
  it.each([null, 'cs_previous'])('blocks cancellation of an unresolved provider attempt (%s)', async (stripeSessionId) => {
    const prisma = makePrisma(baseOrder({ stripeSessionId, stripeCheckoutAttempt: { previousSessionId: stripeSessionId } }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    await expect(service.cancel(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(stripe.ensureSessionExpired).not.toHaveBeenCalled();
    expect(prisma.tx.mockBillingOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });
  it('leaves the order pending when provider expiration fails', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_open' }));
    const stripe = makeStripe(true);
    stripe.ensureSessionExpired.mockRejectedValue(new HttpException('Provider unavailable', 502));
    const { service } = build(prisma, stripe);
    await expect(service.cancel(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 502 });
    expect(prisma.tx.mockBillingOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });
  it('rechecks an attempt created concurrently while expiring the prior session', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_old' }));
    const stripe = makeStripe(true);
    stripe.ensureSessionExpired.mockImplementation(async () => {
      prisma.state.order.stripeCheckoutAttempt = { previousSessionId: 'cs_old' };
    });
    const { service } = build(prisma, stripe);
    await expect(service.cancel(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(prisma.tx.mockBillingOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });
  it('PENDING → CANCELLED (admin expira sesiunea Stripe); CANCELLED idempotent; CONFIRMED → 409', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_x' }));
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    const dto = await service.cancel(ORDER_ID, 'admin');
    expect(dto.status).toBe('CANCELLED');
    expect(stripe.ensureSessionExpired).toHaveBeenCalledWith('cs_x');
    // idempotent
    expect((await service.cancel(ORDER_ID, 'admin')).status).toBe('CANCELLED');
    prisma.state.order.status = 'CONFIRMED';
    await expect(service.cancel(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
  });
});

describe('PaymentsService — manual confirmation checkout safety', () => {
  it('expires a known checkout before manual confirmation', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_open' }));
    const stripe = makeStripe(true);
    const { service, credits } = build(prisma, stripe);
    await service.confirm(ORDER_ID, 'admin');
    expect(stripe.ensureSessionExpired).toHaveBeenCalledWith('cs_open');
    expect(credits.grant).toHaveBeenCalledTimes(1);
  });
  it('does not confirm or grant when provider expiration fails', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_open' }));
    const stripe = makeStripe(true);
    stripe.ensureSessionExpired.mockRejectedValue(new Error('provider unavailable'));
    const { service, credits } = build(prisma, stripe);
    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toThrow('provider unavailable');
    expect(credits.grant).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });
  it.each([null, 'cs_old'])('refuses unresolved attempts before manual confirmation (%s)', async (stripeSessionId) => {
    const prisma = makePrisma(baseOrder({ stripeSessionId, stripeCheckoutAttempt: { previousSessionId: stripeSessionId } }));
    const { service, credits } = build(prisma, makeStripe(true));
    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(credits.grant).not.toHaveBeenCalled();
  });
  it('rechecks checkout identity under lock after provider I/O', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_old' }));
    const stripe = makeStripe(true);
    stripe.ensureSessionExpired.mockImplementation(async () => { prisma.state.order.stripeSessionId = 'cs_new'; });
    const { service, credits } = build(prisma, stripe);
    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(credits.grant).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });
});

describe('PaymentsService — webhook Stripe', () => {
  it.each([
    { amount_total: 12099 },
    { currency: 'eur' },
    { metadata: { orderId: ORDER_ID, companyId: 'another-company' } },
  ])('rejects mismatched payment identity or amount without granting benefits: %j', async (over) => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1' }));
    const { service, credits, outbox } = build(prisma, makeStripe(true));
    await expect(service.handleStripeEvent(completedEvent(over))).rejects.toMatchObject({ status: 400 });
    expect(credits.grant).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
    expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
  });
  it('does not cancel a replacement attempt whose new session ID is not yet persisted', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1', stripeCheckoutAttempt: { previousSessionId: 'cs_test_1' } }));
    const { service } = build(prisma, makeStripe(true));
    const result = await service.handleStripeEvent(completedEvent({ payment_status: 'unpaid' }, 'checkout.session.expired', 'evt_old'));
    expect(result.handled).toBe('superseded');
    expect(prisma.state.order.status).toBe('PENDING');
    expect(prisma.tx.mockBillingOrder.updateMany).not.toHaveBeenCalled();
  });
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
    const res = await service.handleStripeEvent({ id: 'evt_x', type: 'payment_intent.created', livemode: true, data: { object: {} } } as unknown as Stripe.Event);
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

// E-admin-platform-4 — date fiscale reale obligatorii, comenzi Stripe test fara numar fiscal,
// cumparator inghetat, e-Factura (ruta manuala).
describe('PaymentsService — billing readiness, test mode, e-Factura', () => {
  const notReady = () => {
    const readiness = makeReadiness();
    readiness.assertReady.mockRejectedValue(new HttpException({ code: 'BILLING_NOT_CONFIGURED', message: 'Billing details are not configured' }, 503));
    readiness.check.mockResolvedValue({ ready: false, problems: [{ field: 'iban', reason: 'PLACEHOLDER' }], seller: { ...VALID_SELLER, iban: 'RO49AAAA1B31007593840000' } });
    return readiness;
  };

  it('confirm cu date fiscale incomplete → 503 BILLING_NOT_CONFIGURED; nimic confirmat, sesiunea Stripe nu e expirata', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_open' }));
    const stripe = makeStripe(true);
    const { service, credits } = build(prisma, stripe, notReady());
    await expect(service.confirm(ORDER_ID, 'admin')).rejects.toMatchObject({ status: 503, response: { code: 'BILLING_NOT_CONFIGURED' } });
    expect(prisma.tx.mockBillingOrder.updateMany).not.toHaveBeenCalled();
    expect(credits.grant).not.toHaveBeenCalled();
    expect(stripe.ensureSessionExpired).not.toHaveBeenCalled();
    expect(prisma.state.order.status).toBe('PENDING');
  });

  it('comanda Stripe test → CONFIRMED fara numar fiscal (NOT_REQUIRED), beneficiul se acorda', async () => {
    const prisma = makePrisma(baseOrder({ testMode: true }));
    const { service, credits } = build(prisma, makeStripe(true, 'test'));
    const dto = await service.confirm(ORDER_ID, 'stripe', { stripePaymentIntentId: 'pi_t' });
    expect(dto.status).toBe('CONFIRMED');
    expect(dto.invoiceNumber).toBeNull();
    expect(dto.invoiceLabel).toBeNull();
    expect(dto.testMode).toBe(true);
    expect(prisma.state.order.eInvoiceStatus).toBe('NOT_REQUIRED');
    expect(prisma.tx.mockBillingOrder.aggregate).not.toHaveBeenCalled();
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
    expect(credits.grant).toHaveBeenCalledWith('c1', 10, 'CREDIT_PURCHASE', prisma.tx);
  });

  it('comanda live → numar fiscal + seller normalizat + cumparator inghetat + e-Factura PENDING', async () => {
    const prisma = makePrisma(baseOrder());
    prisma.company.findUnique.mockResolvedValue({ name: 'Mobila Demo SRL', cui: 'RO40298306', regComNumber: 'J12/3/2020', addressText: 'Cluj', isVatPayer: false });
    const { service } = build(prisma, makeStripe(false));
    const dto = await service.confirm(ORDER_ID, 'admin');
    expect(dto.invoiceLabel).toBe('MM-42');
    expect(prisma.state.order.invoiceNumber).toBe(42);
    expect(prisma.state.order.eInvoiceStatus).toBe('PENDING');
    expect(prisma.state.order.sellerSnapshot).toEqual(VALID_SELLER);
    // snapshot v2 (E-company-19): cui fara prefix; prefixul RO salvat = platitor TVA declarat
    expect(prisma.state.order.buyerSnapshot).toEqual({ name: 'Mobila Demo SRL', cui: '40298306', regCom: 'J12/3/2020', address: 'Cluj', isVatPayer: true });
    // pachet de credite: fara perioada de serviciu
    expect(prisma.state.order.servicePeriodStart).toBeNull();
    expect(prisma.state.order.servicePeriodEnd).toBeNull();
  });

  it('E-company-19: firma neplatitoare de TVA → snapshot cu isVatPayer false si cui neschimbat', async () => {
    const prisma = makePrisma(baseOrder());
    prisma.company.findUnique.mockResolvedValue({ name: 'Mica Firma SRL', cui: '12345678', regComNumber: 'J22/1/2021', addressText: 'Iasi', isVatPayer: false });
    const { service } = build(prisma, makeStripe(false));
    await service.confirm(ORDER_ID, 'admin');
    expect(prisma.state.order.buyerSnapshot).toEqual({ name: 'Mica Firma SRL', cui: '12345678', regCom: 'J22/1/2021', address: 'Iasi', isVatPayer: false });
  });

  it('E-company-19: abonament confirmat → perioada serviciului = noul expires_at minus 30 zile', async () => {
    const prisma = makePrisma(baseOrder({ orderType: 'SUBSCRIPTION', planId: 'plan-gold', credits: 50 }));
    const { service } = build(prisma, makeStripe(false));
    await service.confirm(ORDER_ID, 'admin');
    const expiresAt: Date = prisma.state.createdSub.expiresAt;
    expect(prisma.state.order.servicePeriodEnd).toEqual(expiresAt);
    expect((prisma.state.order.servicePeriodEnd as Date).getTime() - (prisma.state.order.servicePeriodStart as Date).getTime()).toBe(30 * 86_400_000);
  });

  it('E-company-19: comanda test (fara factura) nu primeste perioada de serviciu', async () => {
    const prisma = makePrisma(baseOrder({ orderType: 'SUBSCRIPTION', planId: 'plan-gold', credits: 50, testMode: true }));
    const { service } = build(prisma, makeStripe(true, 'test'));
    await service.confirm(ORDER_ID, 'stripe', { stripePaymentIntentId: 'pi_t' });
    expect(prisma.state.order.servicePeriodStart).toBeNull();
    expect(prisma.state.order.servicePeriodEnd).toBeNull();
  });

  it('webhook cu livemode diferit de cheie → 400, evenimentul nu e inregistrat', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1' }));
    const { service, credits } = build(prisma, makeStripe(true, 'live'));
    await expect(service.handleStripeEvent(completedEvent({ livemode: false }))).rejects.toMatchObject({ status: 400 });
    expect(prisma.stripeEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('sesiune test platita pentru o comanda live → 400 (mode mismatch)', async () => {
    const prisma = makePrisma(baseOrder({ stripeSessionId: 'cs_test_1', testMode: false }));
    const stripe = makeStripe(true, 'live');
    stripe.assertEventMode.mockImplementation(() => undefined);
    const { service } = build(prisma, stripe);
    await expect(service.handleStripeEvent(completedEvent({ livemode: false }))).rejects.toMatchObject({ status: 400 });
    expect(prisma.state.order.status).toBe('PENDING');
  });

  it('instructiuni de plata: Stripe dezactivat + date incomplete → fara IBAN, billingReady false', async () => {
    const prisma = makePrisma(null);
    const { service } = build(prisma, makeStripe(false), notReady());
    const res = await service.getPaymentInstructions();
    expect(res).toEqual({ stripeEnabled: false, stripeMode: null, billingReady: false, vatRate: 21, bankTransfer: null });
  });

  it('instructiuni de plata: date complete → IBAN normalizat pentru transfer', async () => {
    const { service } = build(makePrisma(null), makeStripe(false));
    const res = await service.getPaymentInstructions();
    expect(res.bankTransfer).toEqual({ sellerName: VALID_SELLER.name, cui: VALID_SELLER.cui, iban: VALID_SELLER.iban });
    expect(res.billingReady).toBe(true);
  });

  it('achizitie cu cheie Stripe test → comanda testMode true; date incomplete → 503 fara comanda', async () => {
    const prisma = makePrisma(null);
    const { service } = build(prisma, makeStripe(true, 'test'));
    await service.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' });
    expect(prisma.mockBillingOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ testMode: true }) }));

    const prisma2 = makePrisma(null);
    const { service: s2 } = build(prisma2, makeStripe(false), notReady());
    await expect(s2.purchaseCredits('c1', 'u1', { creditPackageId: 'pkg1' })).rejects.toMatchObject({ status: 503 });
    expect(prisma2.mockBillingOrder.create).not.toHaveBeenCalled();
  });

  it('updateEInvoice: UPLOADED fara index → 400; comanda test → 409; valid → stare + moment salvat', async () => {
    const confirmed = { status: 'CONFIRMED', invoiceSeries: 'MM', invoiceNumber: 7, eInvoiceStatus: 'PENDING', company: { name: 'Mobila Demo SRL' } };
    const prisma = makePrisma(baseOrder(confirmed));
    const { service } = build(prisma, makeStripe(false));
    await expect(service.updateEInvoice(ORDER_ID, { status: 'UPLOADED' })).rejects.toMatchObject({ status: 400 });

    const res = await service.updateEInvoice(ORDER_ID, { status: 'UPLOADED', anafUploadId: '5001234567' });
    expect(res.eInvoiceStatus).toBe('UPLOADED');
    expect(res.anafUploadId).toBe('5001234567');
    expect(res.eInvoiceUpdatedAt).not.toBeNull();
    expect(res.companyName).toBe('Mobila Demo SRL');

    // revenire la PENDING sterge indexurile
    const reset = await service.updateEInvoice(ORDER_ID, { status: 'PENDING' });
    expect(reset.anafUploadId).toBeNull();

    const testPrisma = makePrisma(baseOrder({ ...confirmed, testMode: true, invoiceSeries: null, invoiceNumber: null, eInvoiceStatus: 'NOT_REQUIRED' }));
    const { service: s2 } = build(testPrisma, makeStripe(true, 'test'));
    await expect(s2.updateEInvoice(ORDER_ID, { status: 'UPLOADED', anafUploadId: '1' })).rejects.toMatchObject({ status: 409 });
  });

  it('adminList: confirmata cu numar dar fara stare (slot vechi) → PENDING', async () => {
    const prisma = makePrisma(null);
    prisma.mockBillingOrder.findMany.mockResolvedValue([baseOrder({ status: 'CONFIRMED', invoiceSeries: 'MM', invoiceNumber: 3, company: { name: 'X' } })]);
    const { service } = build(prisma, makeStripe(false));
    const [item] = await service.adminList();
    expect(item.eInvoiceStatus).toBe('PENDING');
    expect(item.testMode).toBe(false);
  });

  it('adminList: confirmata fara numar fiscal si fara stare (date demo vechi) → NOT_REQUIRED, nu null', async () => {
    const prisma = makePrisma(null);
    prisma.mockBillingOrder.findMany.mockResolvedValue([baseOrder({ status: 'CONFIRMED', invoiceSeries: 'MM', invoiceNumber: null, company: { name: 'X' } })]);
    const { service } = build(prisma, makeStripe(false));
    const [item] = await service.adminList();
    expect(item.eInvoiceStatus).toBe('NOT_REQUIRED');
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

// E-admin-platform-58: plan de 0 lei necumparabil + totaluri cu TVA calculate in backend
describe('PaymentsService — planuri ca date (E-admin-platform-58)', () => {
  it('plan de 0 lei → 409 PLAN_NOT_PURCHASABLE, fara comanda si fara Stripe', async () => {
    const prisma = makePrisma(null);
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-free', tier: null, code: 'TEST_FREE', priceRon: 0, includedCredits: 0, isActive: true, marketplaceGatingDelayMin: 60 });
    const stripe = makeStripe(true);
    const { service } = build(prisma, stripe);
    await expect(service.purchaseSubscription('c1', 'u1', { planId: 'plan-free' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PLAN_NOT_PURCHASABLE' },
    });
    expect(prisma.mockBillingOrder.create).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('plan platit → comanda cu planTier = codul planului', async () => {
    const prisma = makePrisma(null);
    const { service } = build(prisma, makeStripe(false));
    const res = await service.purchaseSubscription('c1', 'u1', { planId: 'plan-gold' });
    expect(res.order.planTier).toBe('GOLD');
    expect(res.order.totalRon).toBe(482.79);
  });

  it('listPackages: TVA si total pe Decimal half-up (149 → 31,29 / 180,29; 399 → 83,79 / 482,79)', async () => {
    const prisma = makePrisma(null);
    prisma.creditPackage.findMany = jest.fn().mockResolvedValue([
      { id: 'p1', credits: 15, priceRon: 149, isActive: true },
      { id: 'p2', credits: 50, priceRon: 399, isActive: true },
    ]);
    const { service } = build(prisma, makeStripe(false));
    await expect(service.listPackages()).resolves.toEqual([
      { id: 'p1', credits: 15, priceRon: 149, vatRate: 21, vatRon: 31.29, totalRon: 180.29 },
      { id: 'p2', credits: 50, priceRon: 399, vatRate: 21, vatRon: 83.79, totalRon: 482.79 },
    ]);
  });

  it('listPlans: cod, nume, isFree, functii si totaluri cu TVA', async () => {
    const prisma = makePrisma(null);
    prisma.subscriptionPlan.findMany = jest.fn().mockResolvedValue([
      { id: 'plan-free', code: 'TEST_FREE', tier: null, nameRo: 'Gratuit', nameEn: null, priceRon: 0, includedCredits: 0, marketplaceGatingDelayMin: 60, features: [] },
      { id: 'plan-silver', code: 'SILVER', tier: 'SILVER', nameRo: null, nameEn: null, priceRon: 149, includedCredits: 15, marketplaceGatingDelayMin: 60, features: [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }] },
      { id: 'plan-platinum', code: 'PLATINUM', tier: 'PLATINUM', nameRo: null, nameEn: null, priceRon: 899, includedCredits: 120, marketplaceGatingDelayMin: 0, features: [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }] },
    ]);
    const { subscriptions } = build(prisma, makeStripe(false));
    const plans = await subscriptions.listPlans();
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({ where: { isActive: true }, include: { features: true }, orderBy: { priceRon: 'asc' } });
    expect(plans[0]).toEqual({
      id: 'plan-free', tier: 'TEST_FREE', nameRo: 'Gratuit', nameEn: null, priceRon: 0, isFree: true,
      vatRate: 21, vatRon: 0, totalRon: 0, includedCredits: 0, gatingDelayMinutes: 60,
      features: { MARKETPLACE_ACCESS: { enabled: false, limit: null } },
    });
    expect(plans[1]).toMatchObject({ tier: 'SILVER', isFree: false, vatRon: 31.29, totalRon: 180.29, features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } } });
    expect(plans[2]).toMatchObject({ tier: 'PLATINUM', vatRon: 188.79, totalRon: 1087.79 });
  });
});
