import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ERROR_CODES,
  type AdminBillingOrderItemDto,
  type BillingOrderDto,
  type CreditPackageDto,
  type PaymentInstructionsDto,
  type PaymentSource,
  type PurchaseCreditsInput,
  type PurchaseResultDto,
  type PurchaseSubscriptionInput,
} from '@marketplace/shared';
import {
  Prisma,
  type BillingOrderStatus,
  type MockBillingOrder,
  type SubscriptionPlanTier,
} from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

export const SUBSCRIPTION_DAYS = 30;

type Tier = SubscriptionPlanTier;

// 4.16/4.17/3.7 + L0-D — achizitie credite/abonament → comanda PENDING (+ sesiune Stripe
// Checkout daca Stripe e activ); la confirmare (stripe webhook / admin) se emite factura
// (serie+numar secvential sub lock, TVA snapshot) + grant credite / activare-prelungire abonament.
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async listPackages(): Promise<CreditPackageDto[]> {
    const rows = await this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    });
    return rows.map((p) => ({ id: p.id, credits: p.credits, priceRon: p.priceRon }));
  }

  async listOrders(companyId: string): Promise<BillingOrderDto[]> {
    const [rows, tiers] = await Promise.all([
      this.prisma.mockBillingOrder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
      this.planTiers(),
    ]);
    return rows.map((o) => this.toDto(o, o.planId ? (tiers.get(o.planId) ?? null) : null));
  }

  // Instructiuni de plata pentru firma: transfer bancar DOAR cand Stripe e dezactivat
  // (altfel datele bancare nu se expun — plata se face prin Checkout).
  async getPaymentInstructions(): Promise<PaymentInstructionsDto> {
    const vatRate = await this.vatRate();
    if (this.stripe.isEnabled()) return { stripeEnabled: true, vatRate, bankTransfer: null };
    return {
      stripeEnabled: false,
      vatRate,
      bankTransfer: {
        sellerName: await this.settings.getString('seller_name', ''),
        cui: await this.settings.getString('seller_cui', ''),
        iban: await this.settings.getString('seller_iban', ''),
      },
    };
  }

  private async vatRate(): Promise<number> {
    return this.settings.getNumber('vat_rate', 21);
  }

  // Sume pe Decimal: TVA calculat pe baza (nu extras din total), rotunjire half-up la 2 zecimale.
  private buildAmounts(baseRon: number, vatRate: number) {
    const base = new Prisma.Decimal(baseRon).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const vat = base.mul(vatRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { base, vat, total: base.add(vat) };
  }

  async purchaseCredits(companyId: string, userId: string, input: PurchaseCreditsInput): Promise<PurchaseResultDto> {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: input.creditPackageId } });
    if (!pkg || !pkg.isActive) {
      throw new HttpException(
        { code: ERROR_CODES.CREDIT_PACKAGE_INACTIVE, message: 'Credit package not available' },
        409,
      );
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(pkg.priceRon, vatRate);
    const order = await this.prisma.mockBillingOrder.create({
      data: {
        companyId,
        orderType: 'CREDIT_PACKAGE',
        creditPackageId: pkg.id,
        credits: pkg.credits,
        baseAmountRon: a.base,
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: a.vat,
        totalRon: a.total,
      },
    });
    return this.attachCheckout(order, userId, null);
  }

  async purchaseSubscription(
    companyId: string,
    userId: string,
    input: PurchaseSubscriptionInput,
  ): Promise<PurchaseResultDto> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(plan.priceRon, vatRate);
    const order = await this.prisma.mockBillingOrder.create({
      data: {
        companyId,
        orderType: 'SUBSCRIPTION',
        planId: plan.id,
        credits: plan.includedCredits,
        baseAmountRon: a.base,
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: a.vat,
        totalRon: a.total,
      },
    });
    return this.attachCheckout(order, userId, plan.tier);
  }

  // "Continua plata": re-creeaza sesiunea Checkout pentru o comanda PENDING (cea veche e
  // expirata best-effort, ca sa nu existe doua linkuri de plata pentru aceeasi comanda).
  async createCheckout(companyId: string, userId: string, orderId: string): Promise<PurchaseResultDto> {
    const order = await this.getOrderForCompany(companyId, orderId);
    if (order.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Order is not pending' },
        409,
      );
    }
    const tier = order.planId ? ((await this.planTiers()).get(order.planId) ?? null) : null;
    if (!this.stripe.isEnabled()) return { order: this.toDto(order, tier), checkoutUrl: null };
    if (order.stripeSessionId) await this.stripe.expireSession(order.stripeSessionId);
    return this.attachCheckout(order, userId, tier);
  }

  private async attachCheckout(order: MockBillingOrder, userId: string, tier: Tier | null): Promise<PurchaseResultDto> {
    if (!this.stripe.isEnabled()) return { order: this.toDto(order, tier), checkoutUrl: null };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, languagePreference: true },
    });
    const locale = user?.languagePreference === 'EN' ? 'en' : 'ro';
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN').replace(/\/+$/, '');
    const wallet = `${origin}/${locale}/marketplace/wallet`;
    const description =
      order.orderType === 'CREDIT_PACKAGE'
        ? `Cozy Home — pachet ${order.credits} credite marketplace`
        : `Cozy Home — abonament ${tier ?? ''} ${SUBSCRIPTION_DAYS} zile (${order.credits ?? 0} credite incluse)`;

    const session = await this.stripe.createCheckoutSession({
      orderId: order.id,
      companyId: order.companyId,
      amountRon: order.totalRon,
      description: description.replace(/\s+/g, ' ').trim(),
      customerEmail: user?.email ?? null,
      successUrl: `${wallet}?payment=success&order=${order.id}`,
      cancelUrl: `${wallet}?payment=cancelled&order=${order.id}`,
    });
    const updated = await this.prisma.mockBillingOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    return { order: this.toDto(updated, tier), checkoutUrl: session.url };
  }

  // 3.7 — confirmare plata (source: stripe | admin | webhook). Emite factura + livreaza beneficiul.
  // Race-safe: tranzitia PENDING→CONFIRMED e un updateMany conditionat in tranzactie (a doua
  // confirmare concurenta → 409 PAYMENT_ALREADY_CONFIRMED), iar numarul de factura se aloca
  // sub pg_advisory_xact_lock per serie (fara goluri, fara P2002).
  async confirm(
    orderId: string,
    source: PaymentSource,
    extra: { stripePaymentIntentId?: string | null; paidAt?: Date } = {},
  ): Promise<BillingOrderDto> {
    const existing = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    }
    if (existing.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already processed' },
        409,
      );
    }
    const series = await this.settings.getString('invoice_series', 'MM');
    const seller = {
      name: await this.settings.getString('seller_name', 'Marketplace Mobilier SRL'),
      cui: await this.settings.getString('seller_cui', ''),
      regCom: await this.settings.getString('seller_reg_com', ''),
      address: await this.settings.getString('seller_address', ''),
      iban: await this.settings.getString('seller_iban', ''),
    };
    const plan =
      existing.orderType === 'SUBSCRIPTION' && existing.planId
        ? await this.prisma.subscriptionPlan.findUnique({ where: { id: existing.planId } })
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      // lock per serie: serializeaza alocarea numarului (4.17 — secventa dedicata per serie)
      const lockKey = `invoice:${series}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const agg = await tx.mockBillingOrder.aggregate({
        where: { invoiceSeries: series, invoiceNumber: { not: null } },
        _max: { invoiceNumber: true },
      });
      const invoiceNumber = (agg._max.invoiceNumber ?? 0) + 1;
      const now = new Date();
      const res = await tx.mockBillingOrder.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
          paidAt: extra.paidAt ?? now,
          paymentSource: source,
          stripePaymentIntentId: extra.stripePaymentIntentId ?? undefined,
          invoiceSeries: series,
          invoiceNumber,
          sellerSnapshot: seller as unknown as Prisma.InputJsonValue,
        },
      });
      if (res.count === 0) {
        throw new HttpException(
          { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already processed' },
          409,
        );
      }
      const order = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
      // livrare beneficiu
      if (order.orderType === 'CREDIT_PACKAGE' && order.credits) {
        await this.credits.grant(order.companyId, order.credits, 'CREDIT_PURCHASE', tx);
      } else if (order.orderType === 'SUBSCRIPTION' && order.planId) {
        await this.subscriptions.grantOrExtend(order.companyId, order.planId, SUBSCRIPTION_DAYS, tx);
        if (order.credits) {
          await this.credits.grant(order.companyId, order.credits, 'SUBSCRIPTION_CREDITS', tx);
        }
      }
      return order;
    });
    return this.toDto(updated, plan?.tier ?? null);
  }

  // Anulare comanda PENDING (admin sau sesiune Stripe expirata). Idempotent pe CANCELLED;
  // CONFIRMED → 409 (nu se anuleaza o factura emisa — 4.17, storno post-MVP).
  async cancel(orderId: string, source: 'admin' | 'stripe'): Promise<BillingOrderDto> {
    const existing = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    }
    const tier = existing.planId ? ((await this.planTiers()).get(existing.planId) ?? null) : null;
    if (existing.status === 'CANCELLED') return this.toDto(existing, tier);
    const res = await this.prisma.mockBillingOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (res.count === 0) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already confirmed' },
        409,
      );
    }
    if (source === 'admin' && existing.stripeSessionId) {
      await this.stripe.expireSession(existing.stripeSessionId);
    }
    const order = await this.prisma.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
    return this.toDto(order, tier);
  }

  // Webhook Stripe — dedup pe event.id (stripe_events), evenimente necunoscute ignorate.
  // Erorile de procesare se propaga (500) ca Stripe sa reincerce; evenimentul se inregistreaza
  // DOAR dupa procesare reusita.
  async handleStripeEvent(event: Stripe.Event): Promise<{ received: true; handled: string }> {
    const seen = await this.prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (seen) return { received: true, handled: 'duplicate' };

    let handled = 'ignored';
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        handled =
          session.payment_status === 'paid'
            ? await this.confirmFromStripeSession(session)
            : 'unpaid';
        break;
      }
      case 'checkout.session.expired': {
        handled = await this.expireFromStripeSession(event.data.object);
        break;
      }
      default:
        break;
    }
    // P2002 la dublura concurenta — ignorat (procesarea e oricum idempotenta pe comanda)
    await this.prisma.stripeEvent.create({ data: { id: event.id, type: event.type } }).catch(() => undefined);
    return { received: true, handled };
  }

  private orderIdOf(session: Stripe.Checkout.Session): string | null {
    return session.metadata?.orderId ?? session.client_reference_id ?? null;
  }

  private async confirmFromStripeSession(session: Stripe.Checkout.Session): Promise<string> {
    const orderId = this.orderIdOf(session);
    if (!orderId) {
      this.logger.error(`Stripe session ${session.id} platita fara orderId in metadata`);
      return 'no_order';
    }
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
    try {
      const dto = await this.confirm(orderId, 'stripe', { stripePaymentIntentId: paymentIntentId, paidAt: new Date() });
      // 3.9 — confirmarea prin webhook se auditeaza ca si cea de admin (fara user)
      await this.audit.log({
        action: 'PAYMENT_CONFIRMED',
        entityType: 'mock_billing_order',
        entityId: orderId,
        userAgent: 'stripe-webhook',
        after: { ...dto, stripeSessionId: session.id, paymentIntentId },
      });
      return 'confirmed';
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 409) {
        // deja confirmata (retry Stripe / confirmare admin intre timp). Daca sesiunea platita
        // nu e cea curenta a comenzii, e posibila o plata dubla → de verificat manual.
        const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
        if (order && order.stripeSessionId !== session.id) {
          this.logger.error(
            `Plata dubla posibila: comanda ${orderId} deja ${order.status}, sesiune platita ${session.id} != ${order.stripeSessionId}`,
          );
          return 'already_confirmed_other_session';
        }
        return 'already_confirmed';
      }
      if (err instanceof NotFoundException) {
        this.logger.error(`Stripe session ${session.id} platita pentru comanda inexistenta ${orderId}`);
        return 'order_not_found';
      }
      throw err;
    }
  }

  private async expireFromStripeSession(session: Stripe.Checkout.Session): Promise<string> {
    const orderId = this.orderIdOf(session);
    if (!orderId) return 'no_order';
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PENDING') return 'ignored';
    // firma a cerut intre timp un link nou → sesiunea expirata nu mai e cea curenta
    if (order.stripeSessionId && order.stripeSessionId !== session.id) return 'superseded';
    await this.cancel(orderId, 'stripe');
    return 'cancelled';
  }

  async adminList(status?: BillingOrderStatus): Promise<AdminBillingOrderItemDto[]> {
    const [rows, tiers] = await Promise.all([
      this.prisma.mockBillingOrder.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { name: true } } },
        take: 300,
      }),
      this.planTiers(),
    ]);
    return rows.map((o) => ({
      id: o.id,
      companyId: o.companyId,
      companyName: o.company.name,
      orderType: o.orderType,
      status: o.status,
      credits: o.credits,
      planTier: o.planId ? (tiers.get(o.planId) ?? null) : null,
      baseAmountRon: Number(o.baseAmountRon),
      vatRate: Number(o.vatRate),
      vatAmountRon: Number(o.vatAmountRon),
      totalRon: Number(o.totalRon),
      paymentSource: o.paymentSource,
      hasStripeSession: !!o.stripeSessionId,
      invoiceLabel: this.invoiceLabel(o),
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
    }));
  }

  async getOrderForCompany(companyId: string, orderId: string): Promise<MockBillingOrder> {
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.companyId !== companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Order not found' });
    }
    return order;
  }

  private async planTiers(): Promise<Map<string, Tier>> {
    const plans = await this.prisma.subscriptionPlan.findMany({ select: { id: true, tier: true } });
    return new Map(plans.map((p) => [p.id, p.tier]));
  }

  private invoiceLabel(o: MockBillingOrder): string | null {
    return o.invoiceSeries && o.invoiceNumber !== null ? `${o.invoiceSeries}-${o.invoiceNumber}` : null;
  }

  toDto(o: MockBillingOrder, planTier: Tier | null = null): BillingOrderDto {
    return {
      id: o.id,
      orderType: o.orderType,
      status: o.status,
      planTier,
      credits: o.credits,
      baseAmountRon: Number(o.baseAmountRon),
      vatRate: Number(o.vatRate),
      vatAmountRon: Number(o.vatAmountRon),
      totalRon: Number(o.totalRon),
      invoiceSeries: o.invoiceSeries,
      invoiceNumber: o.invoiceNumber,
      invoiceLabel: this.invoiceLabel(o),
      paymentSource: o.paymentSource,
      hasStripeSession: !!o.stripeSessionId,
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
    };
  }
}
