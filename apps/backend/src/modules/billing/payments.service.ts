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
  type UpdateEInvoiceInput,
} from '@marketplace/shared';
import {
  Prisma,
  type BillingOrderStatus,
  type MockBillingOrder,
} from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { OutboxService } from '../outbox/outbox.service';
import { SettingsService } from '../../common/settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from './credits.service';
import { CHECKOUT_EXPIRES_MINUTES, StripeService, type CreateCheckoutSessionInput } from './stripe.service';
import { randomUUID } from 'node:crypto';
import { loadIdempotentCheckpoint, lockIdempotentOperation, saveIdempotentCheckpoint, saveIdempotentResult } from '../../common/idempotency/idempotent-operation';
import { SubscriptionsService } from './subscriptions.service';
import { BillingReadinessService } from './billing-readiness.service';
import { withDeletedRecords } from '../../infra/prisma/soft-delete';
import { billingManagerIds } from './billing-recipients';
import { SETTING_BANK_TRANSFER_EXPIRY_DAYS, transferExpiresAt } from './bank-transfer.constants';
import { VAT_RATE_DEFAULT, VAT_RATE_SETTING, buildAmounts, priceWithVat } from './vat';

export const SUBSCRIPTION_DAYS = 30;

// E-admin-platform-58: codul planului (subscription_plans.code); campul DTO ramane `planTier`
type Tier = string;

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
    private readonly outbox: OutboxService,
    private readonly readiness: BillingReadinessService,
  ) {}

  // E-admin-platform-58: + TVA/total calculate ca pe comanda (buildAmounts, Decimal half-up)
  async listPackages(): Promise<CreditPackageDto[]> {
    const [rows, vatRate] = await Promise.all([
      this.prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { credits: 'asc' },
      }),
      this.vatRate(),
    ]);
    return rows.map((p) => ({ id: p.id, credits: p.credits, priceRon: p.priceRon, ...priceWithVat(p.priceRon, vatRate) }));
  }

  async listOrders(companyId: string): Promise<BillingOrderDto[]> {
    const [rows, tiers, expiryDays] = await Promise.all([
      this.prisma.mockBillingOrder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
      this.planCodes(),
      this.bankTransferExpiryDays(),
    ]);
    return rows.map((o) => this.toDto(o, o.planId ? (tiers.get(o.planId) ?? null) : null, expiryDays));
  }

  // E-company-24: zilele pana la anularea automata a comenzilor prin transfer (0 = oprit)
  async bankTransferExpiryDays(): Promise<number> {
    const days = await this.settings.getNumber(SETTING_BANK_TRANSFER_EXPIRY_DAYS, 0);
    return Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  }

  // Instructiuni de plata pentru firma: transfer bancar DOAR cand Stripe e dezactivat
  // (altfel datele bancare nu se expun — plata se face prin Checkout). E-admin-platform-4:
  // nici cand datele fiscale sunt incomplete/placeholder (IBAN-ul de exemplu nu se afiseaza).
  async getPaymentInstructions(): Promise<PaymentInstructionsDto> {
    const [vatRate, readiness] = await Promise.all([this.vatRate(), this.readiness.check()]);
    const stripeEnabled = this.stripe.isEnabled();
    const { seller } = readiness;
    return {
      stripeEnabled,
      stripeMode: this.stripe.mode(),
      billingReady: readiness.ready,
      vatRate,
      bankTransfer:
        !stripeEnabled && readiness.ready ? { sellerName: seller.name, cui: seller.cui, iban: seller.iban } : null,
    };
  }

  private async vatRate(): Promise<number> {
    return this.settings.getNumber(VAT_RATE_SETTING, VAT_RATE_DEFAULT);
  }

  // Sume pe Decimal: TVA calculat pe baza (nu extras din total), rotunjire half-up la 2 zecimale.
  // E-admin-platform-58: logica e in billing/vat.ts (comuna cu listele de planuri/pachete).
  private buildAmounts(baseRon: number, vatRate: number) {
    return buildAmounts(baseRon, vatRate);
  }

  async purchaseCredits(companyId: string, userId: string, input: PurchaseCreditsInput): Promise<PurchaseResultDto> {
    await this.readiness.assertReady(); // aparare in adancime (garda HTTP acopera deja)
    const recovered = await this.recoverPurchase(companyId, userId);
    if (recovered) return recovered;
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: input.creditPackageId } });
    if (!pkg || !pkg.isActive) {
      throw new HttpException(
        { code: ERROR_CODES.CREDIT_PACKAGE_INACTIVE, message: 'Credit package not available' },
        409,
      );
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(pkg.priceRon, vatRate);
    const order = await this.createPendingOrder({
      data: {
        companyId,
        orderType: 'CREDIT_PACKAGE',
        creditPackageId: pkg.id,
        credits: pkg.credits,
        baseAmountRon: a.base,
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: a.vat,
        totalRon: a.total,
        testMode: this.stripe.mode() === 'test',
      },
    });
    return this.attachCheckout(order, userId, null);
  }

  async purchaseSubscription(
    companyId: string,
    userId: string,
    input: PurchaseSubscriptionInput,
  ): Promise<PurchaseResultDto> {
    await this.readiness.assertReady();
    const recovered = await this.recoverPurchase(companyId, userId);
    if (recovered) return recovered;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    }
    // E-admin-platform-58: planul de 0 lei nu se cumpara (Stripe nu incaseaza 0, iar o factura de
    // 0 lei ar consuma un numar din serie) — il acorda adminul sau trial_plan. Inainte de comanda.
    if (plan.priceRon === 0) {
      throw new HttpException(
        { code: ERROR_CODES.PLAN_NOT_PURCHASABLE, message: 'Free plans are activated by an administrator' },
        409,
      );
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(plan.priceRon, vatRate);
    const order = await this.createPendingOrder({
      data: {
        companyId,
        orderType: 'SUBSCRIPTION',
        planId: plan.id,
        credits: plan.includedCredits,
        baseAmountRon: a.base,
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: a.vat,
        totalRon: a.total,
        testMode: this.stripe.mode() === 'test',
      },
    });
    return this.attachCheckout(order, userId, plan.code);
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
    const tier = order.planId ? ((await this.planCodes()).get(order.planId) ?? null) : null;
    return this.attachCheckout(order, userId, tier);
  }

  private async recoverPurchase(companyId: string, userId: string): Promise<PurchaseResultDto | null> {
    const order = await runTx(this.prisma, 'write', async (tx) => {
      await lockIdempotentOperation(tx);
      const checkpoint = await loadIdempotentCheckpoint(tx);
      if (typeof checkpoint?.orderId !== 'string') return null;
      const existing = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: checkpoint.orderId } });
      if (existing.companyId !== companyId) throw new NotFoundException();
      return existing;
    });
    if (!order) return null;
    const tier = order.planId ? ((await this.planCodes()).get(order.planId) ?? null) : null;
    return this.attachCheckout(order, userId, tier);
  }

  private async createPendingOrder(args: Prisma.MockBillingOrderCreateArgs): Promise<MockBillingOrder> {
    return runTx(this.prisma, 'write', async (tx) => {
      await lockIdempotentOperation(tx);
      const checkpoint = await loadIdempotentCheckpoint(tx);
      if (typeof checkpoint?.orderId === 'string') return tx.mockBillingOrder.findUniqueOrThrow({ where: { id: checkpoint.orderId } });
      const order = await tx.mockBillingOrder.create(args);
      await saveIdempotentCheckpoint(tx, { orderId: order.id });
      if (!this.stripe.isEnabled()) {
        const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
        await this.outbox.record(tx, `payment.pending:${order.id}`, 'payment.pending', {
          orderId: order.id, companyId: order.companyId, orderType: order.orderType,
        }, admins.map((admin) => admin.id));
        // E-company-24: firma primeste datele de plata + proforma (payload doar cu id-uri;
        // suma/IBAN/referinta se rehidrateaza la livrare in BillingDocumentsService)
        const managers = await billingManagerIds(tx, order.companyId);
        await this.outbox.record(tx, `payment.transfer_instructions:${order.id}`, 'payment.transfer_instructions', {
          orderId: order.id, companyId: order.companyId, orderType: order.orderType,
        }, managers);
      }
      return order;
    });
  }

  private async attachCheckout(order: MockBillingOrder, userId: string, tier: Tier | null): Promise<PurchaseResultDto> {
    if (!this.stripe.isEnabled() || order.status !== 'PENDING') {
      const expiryDays = this.stripe.isEnabled() ? 0 : await this.bankTransferExpiryDays();
      const result = { order: this.toDto(order, tier, expiryDays), checkoutUrl: null };
      await runTx(this.prisma, 'write', async (tx) => { await lockIdempotentOperation(tx); await saveIdempotentResult(tx, result); });
      return result;
    }

    let expiredSessionId: string | null = null;
    if (order.stripeSessionId) {
      const current = await this.stripe.retrieveCheckoutSession(order.stripeSessionId);
      if (current.status === 'open' && current.url) {
        return runTx(this.prisma, 'write', async (tx) => {
          await lockIdempotentOperation(tx);
          const fresh = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: order.id } });
          const result = { order: this.toDto(fresh, tier), checkoutUrl: fresh.status === 'PENDING' ? current.url : null };
          await saveIdempotentResult(tx, result);
          return result;
        });
      }
      if (current.status !== 'expired') throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Payment is awaiting confirmation; do not start another checkout' }, 409);
      expiredSessionId = current.id;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, languagePreference: true },
    });
    const locale = user?.languagePreference === 'EN' ? 'en' : 'ro';
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN').replace(/\/+$/, '');
    const wallet = `${origin}/${locale}/marketplace/wallet`;
    const isCredits = order.orderType === 'CREDIT_PACKAGE';
    const description =
      locale === 'en'
        ? isCredits
          ? `Cozy Home — ${order.credits} marketplace credits package`
          : `Cozy Home — ${tier ?? ''} subscription, ${SUBSCRIPTION_DAYS} days (${order.credits ?? 0} credits included)`
        : isCredits
          ? `Cozy Home — pachet ${order.credits} credite marketplace`
          : `Cozy Home — abonament ${tier ?? ''} ${SUBSCRIPTION_DAYS} zile (${order.credits ?? 0} credite incluse)`;

    const candidate = {
      orderId: order.id,
      companyId: order.companyId,
      amountRon: order.totalRon.toString(),
      description: description.replace(/\s+/g, ' ').trim(),
      locale,
      customerEmail: user?.email ?? null,
      successUrl: `${wallet}?payment=success&order=${order.id}`,
      cancelUrl: `${wallet}?payment=cancelled&order=${order.id}`,
      idempotencyKey: `checkout-${order.id}-${randomUUID()}`,
      expiresAt: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRES_MINUTES * 60,
      createdAt: Math.floor(Date.now() / 1000),
      previousSessionId: expiredSessionId,
    };
    const attempt = await runTx(this.prisma, 'write', async (tx) => {
      await lockIdempotentOperation(tx);
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${order.id} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: order.id } });
      if (fresh.status !== 'PENDING') throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Order is no longer pending' }, 409);
      const previous = fresh.stripeCheckoutAttempt;
      if (previous) {
        const saved = previous as unknown as typeof candidate;
        if (!expiredSessionId || fresh.stripeSessionId !== expiredSessionId || saved.previousSessionId === expiredSessionId) return saved;
      }
      await tx.mockBillingOrder.update({ where: { id: order.id }, data: { stripeCheckoutAttempt: candidate } });
      return candidate;
    });
    // Nu relansa o incercare necunoscuta dupa fereastra de deduplicare Stripe.
    if (Date.now() / 1000 > (attempt.createdAt ?? attempt.expiresAt - CHECKOUT_EXPIRES_MINUTES * 60) + 23 * 60 * 60) throw new HttpException({ code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Checkout outcome requires reconciliation before another attempt' }, 503);
    const session = await this.stripe.createCheckoutSession({ ...attempt, amountRon: new Prisma.Decimal(attempt.amountRon) } as CreateCheckoutSessionInput);
    return runTx(this.prisma, 'write', async (tx) => {
      await lockIdempotentOperation(tx);
      const updated = await tx.mockBillingOrder.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
      const result = { order: this.toDto(updated, tier), checkoutUrl: updated.status === 'PENDING' ? session.url : null };
      await saveIdempotentResult(tx, result);
      return result;
    });
  }

  // 3.7 — confirmare plata (source: stripe | admin | webhook). Emite factura + livreaza beneficiul.
  // Race-safe: tranzitia PENDING→CONFIRMED e un updateMany conditionat in tranzactie (a doua
  // confirmare concurenta → 409 PAYMENT_ALREADY_CONFIRMED), iar numarul de factura se aloca
  // sub pg_advisory_xact_lock per serie (fara goluri, fara P2002).
  // E-admin-platform-54: ordinea in tranzactie = lock rand → updateMany PENDING→CONFIRMED →
  // lock firma → beneficiu (credite/abonament) → lock serie → MAX()+1 → numar + data emiterii → outbox.
  // Lock-ul seriei (comun tuturor firmelor) se tine doar pe numerotare, nu pe beneficiu;
  // totul ramane intr-o singura tranzactie (rollback complet la eroare).
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
    const expectedSessionId = existing.stripeSessionId;
    const unresolvedCheckout = (order: MockBillingOrder) => {
      const attempt = order.stripeCheckoutAttempt as Prisma.JsonObject | null;
      return attempt && (!order.stripeSessionId || attempt.previousSessionId === order.stripeSessionId);
    };
    // E-admin-platform-4: nicio factura cu date fiscale placeholder/invalide — 503 pentru orice
    // sursa (webhook-ul e reincercat de Stripe dupa completarea datelor). Verificat INAINTE de
    // expirarea sesiunii Stripe, ca un 503 sa nu anuleze checkout-ul firmei.
    const seller = await this.readiness.assertReady();
    // Transferul manual nu lasa in paralel o sesiune Stripe care mai poate incasa bani.
    if (source === 'admin') {
      if (unresolvedCheckout(existing)) throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Checkout outcome must be reconciled before manual confirmation' }, 409);
      if (expectedSessionId) await this.stripe.ensureSessionExpired(expectedSessionId);
    }
    const series = await this.settings.getString('invoice_series', 'MM');
    // comenzile Stripe test nu consuma numar din seria fiscala (si nu au cumparator pe factura)
    const testMode = existing.testMode;
    const buyer = testMode ? null : await this.buyerSnapshot(existing.companyId);
    const plan =
      existing.orderType === 'SUBSCRIPTION' && existing.planId
        ? await this.prisma.subscriptionPlan.findUnique({ where: { id: existing.planId } })
        : null;

    // E-admin-platform-54: destinatarii evenimentului se citesc INAINTE de tranzactie — nu mai
    // tin lock-ul seriei de factura ocupat cu un round-trip cross-region.
    // E-company-24: doar OWNER/MANAGER (angajatii nu vad comenzi/facturi).
    const managers = await billingManagerIds(this.prisma, existing.companyId);

    // Profil write (READ COMMITTED), NU Serializable: numarul de factura = MAX()+1 sub advisory
    // lock; sub snapshot isolation un confirm care asteapta lock-ul ar citi un MAX vechi.
    const updated = await runTx(this.prisma, 'write', async (tx) => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${orderId} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (source === 'admin' && (unresolvedCheckout(fresh) || fresh.stripeSessionId !== expectedSessionId)) throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Checkout changed during manual confirmation; check its state and retry' }, 409);
      const now = new Date();
      const testInvoice: Prisma.MockBillingOrderUpdateManyMutationInput = testMode
        ? { invoiceSeries: null, invoiceNumber: null, sellerSnapshot: undefined, eInvoiceStatus: 'NOT_REQUIRED' }
        : {};
      const res = await tx.mockBillingOrder.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
          paidAt: extra.paidAt ?? now,
          paymentSource: source,
          stripePaymentIntentId: extra.stripePaymentIntentId ?? undefined,
          ...testInvoice,
        },
      });
      if (res.count === 0) {
        throw new HttpException(
          { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already processed' },
          409,
        );
      }
      // livrare beneficiu — inainte de lock-ul seriei, ca fereastra lock-ului sa acopere doar numerotarea.
      // Lock per firma: doua confirmari pe aceeasi firma nu se mai serializeaza pe seria de factura,
      // deci crearea portofelului / extinderea abonamentului trebuie serializate aici (altfel
      // upsert concurent pe company_credit_wallets → P2002). Ordinea lock-urilor e mereu
      // rand → firma → serie, fara deadlock.
      const companyLockKey = `billing-company:${fresh.companyId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyLockKey}))`;
      // E-company-19: perioada facturata = cele 30 de zile adaugate de grantOrExtend
      let period: { servicePeriodStart?: Date; servicePeriodEnd?: Date } = {};
      if (fresh.orderType === 'CREDIT_PACKAGE' && fresh.credits) {
        await this.credits.grant(fresh.companyId, fresh.credits, 'CREDIT_PURCHASE', tx);
      } else if (fresh.orderType === 'SUBSCRIPTION' && fresh.planId) {
        const sub = await this.subscriptions.grantOrExtend(fresh.companyId, fresh.planId, SUBSCRIPTION_DAYS, tx);
        period = {
          servicePeriodStart: new Date(sub.expiresAt.getTime() - SUBSCRIPTION_DAYS * 86_400_000),
          servicePeriodEnd: sub.expiresAt,
        };
        if (fresh.credits) {
          await this.credits.grant(fresh.companyId, fresh.credits, 'SUBSCRIPTION_CREDITS', tx);
        }
      }
      let order: MockBillingOrder;
      if (testMode) {
        order = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
      } else {
        // lock per serie: serializeaza alocarea numarului (4.17 — secventa dedicata per serie)
        const lockKey = `invoice:${series}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const agg = await tx.mockBillingOrder.aggregate({
          where: { invoiceSeries: series, invoiceNumber: { not: null } },
          _max: { invoiceNumber: true },
        });
        const invoiceNumber = (agg._max.invoiceNumber ?? 0) + 1;
        // data emiterii se stampileaza DUPA lock: ordinea numerelor = ordinea datelor (4.17)
        const stamp = new Date();
        order = await tx.mockBillingOrder.update({
          where: { id: orderId },
          data: {
            invoiceSeries: series,
            invoiceNumber,
            sellerSnapshot: seller as unknown as Prisma.InputJsonValue,
            buyerSnapshot: (buyer ?? undefined) as Prisma.InputJsonValue | undefined,
            ...period,
            eInvoiceStatus: 'PENDING',
            confirmedAt: stamp,
            paidAt: extra.paidAt ?? stamp,
          },
        });
      }
      await this.outbox.record(tx, `payment.confirmed:${order.id}`, 'payment.confirmed', {
        orderId: order.id, companyId: order.companyId, orderType: order.orderType,
        invoiceSeries: order.invoiceSeries, invoiceNumber: order.invoiceNumber,
      }, managers);
      return order;
    });
    return this.toDto(updated, plan?.code ?? null);
  }

  // Cumparatorul de pe factura, inghetat la emitere (docs/03 4.17). Firma stearsa ramane
  // citibila pentru o factura emisa.
  // snapshot v2 (E-company-19): cui fara prefix + isVatPayer (prefixul RO salvat = platitor declarat)
  private async buyerSnapshot(companyId: string): Promise<{ name: string; cui: string; regCom: string; address: string; isVatPayer: boolean } | null> {
    const company = await withDeletedRecords('ISSUED_INVOICE', () =>
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, cui: true, regComNumber: true, addressText: true, isVatPayer: true },
      }),
    );
    if (!company) return null;
    const cui = (company.cui ?? '').trim().toUpperCase();
    return {
      name: company.name,
      cui: cui.replace(/^RO/, ''),
      regCom: company.regComNumber,
      address: company.addressText,
      isVatPayer: company.isVatPayer === true || /^RO/.test(cui),
    };
  }

  // Anulare comanda PENDING (admin sau sesiune Stripe expirata). Idempotent pe CANCELLED;
  // CONFIRMED → 409 (nu se anuleaza o factura emisa — 4.17, storno post-MVP).
  async cancel(orderId: string, source: 'admin' | 'stripe'): Promise<BillingOrderDto> {
    const existing = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    }
    const tier = existing.planId ? ((await this.planCodes()).get(existing.planId) ?? null) : null;
    if (existing.status === 'CANCELLED') return this.toDto(existing, tier);
    const unresolved = (order: MockBillingOrder) => {
      const attempt = order.stripeCheckoutAttempt as Prisma.JsonObject | null;
      return attempt && (!order.stripeSessionId || attempt.previousSessionId === order.stripeSessionId);
    };
    if (unresolved(existing)) throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Checkout outcome must be reconciled before cancellation' }, 409);
    if (source === 'admin' && existing.stripeSessionId) await this.stripe.ensureSessionExpired(existing.stripeSessionId);
    const order = await runTx(this.prisma, 'write', async (tx) => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${orderId} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (unresolved(fresh) || fresh.stripeSessionId !== existing.stripeSessionId) throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Checkout changed during cancellation; retry after checking its state' }, 409);
      const res = await tx.mockBillingOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (res.count === 0) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already confirmed' },
        409,
      );
    }
      return tx.mockBillingOrder.findUniqueOrThrow({ where: { id: orderId } });
    });
    return this.toDto(order, tier);
  }

  // Webhook Stripe — dedup pe event.id (stripe_events), evenimente necunoscute ignorate.
  // Erorile de procesare se propaga (500) ca Stripe sa reincerce; evenimentul se inregistreaza
  // DOAR dupa procesare reusita.
  async handleStripeEvent(event: Stripe.Event): Promise<{ received: true; handled: string }> {
    // E-admin-platform-4: live/test amestecat → 400, evenimentul NU se inregistreaza
    this.stripe.assertEventMode(event);
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
    const expected = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    // sesiune live pe o comanda test (sau invers) → 400, fara factura
    if (expected && (session.currency !== 'ron' || session.amount_total !== StripeService.toMinorUnits(expected.totalRon) || session.metadata?.companyId !== expected.companyId || session.livemode === expected.testMode)) {
      throw new HttpException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Payment amount, currency, company or mode does not match the order' }, 400);
    }
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
      if (err instanceof HttpException && err.getStatus() === 503) {
        // date fiscale incomplete: Stripe reincearca webhook-ul (pana la 3 zile)
        this.logger.error(`Plata Stripe ${session.id} pentru comanda ${orderId} neconfirmata: datele de facturare nu sunt configurate`);
      }
      throw err;
    }
  }

  private async expireFromStripeSession(session: Stripe.Checkout.Session): Promise<string> {
    const orderId = this.orderIdOf(session);
    if (!orderId) return 'no_order';
    return runTx(this.prisma, 'write', async (tx) => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.mockBillingOrder.findUnique({ where: { id: orderId } });
      if (!order || order.status !== 'PENDING') return 'ignored';
      const attempt = order.stripeCheckoutAttempt as Prisma.JsonObject | null;
      // Nu anula o sesiune noua aflata intre checkpoint si persistenta ID-ului Stripe.
      if (order.stripeSessionId !== session.id || attempt?.previousSessionId === session.id) return 'superseded';
      const changed = await tx.mockBillingOrder.updateMany({ where: { id: orderId, status: 'PENDING', stripeSessionId: session.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      return changed.count ? 'cancelled' : 'ignored';
    });
  }

  async adminList(status?: BillingOrderStatus): Promise<AdminBillingOrderItemDto[]> {
    const [rows, tiers] = await Promise.all([
      this.prisma.mockBillingOrder.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { name: true } } },
        take: 300,
      }),
      this.planCodes(),
    ]);
    return rows.map((o) => this.toAdminItem(o, o.company.name, o.planId ? (tiers.get(o.planId) ?? null) : null));
  }

  // E-admin-platform-4 — ruta manuala e-Factura: adminul inregistreaza ce a facut contabilul in
  // SPV. Tranzitiile sunt libere (corectarea greselilor); fiecare e auditata.
  async updateEInvoice(orderId: string, dto: UpdateEInvoiceInput): Promise<AdminBillingOrderItemDto> {
    const order = await this.prisma.mockBillingOrder.findUnique({
      where: { id: orderId },
      include: { company: { select: { name: true } } },
    });
    if (!order) {
      throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    }
    if (order.status !== 'CONFIRMED' || order.testMode || order.invoiceNumber === null) {
      throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Order has no fiscal invoice' }, 409);
    }
    if ((dto.status === 'UPLOADED' || dto.status === 'VALIDATED') && !dto.anafUploadId) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'anafUploadId is required for UPLOADED/VALIDATED' },
        400,
      );
    }
    const reset = dto.status === 'PENDING';
    const updated = await this.prisma.mockBillingOrder.update({
      where: { id: orderId },
      data: {
        eInvoiceStatus: dto.status,
        anafUploadId: dto.anafUploadId ?? (reset ? null : order.anafUploadId),
        anafDownloadId: dto.anafDownloadId ?? (reset ? null : order.anafDownloadId),
        eInvoiceUpdatedAt: new Date(),
      },
    });
    const tier = updated.planId ? ((await this.planCodes()).get(updated.planId) ?? null) : null;
    return this.toAdminItem(updated, order.company.name, tier);
  }

  private eInvoiceStatusOf(o: MockBillingOrder): AdminBillingOrderItemDto['eInvoiceStatus'] {
    // confirmata de un slot vechi (fara coloana) → tot "de raportat"; confirmata fara numar
    // fiscal (date demo vechi) → nu exista factura de raportat
    if (o.eInvoiceStatus === null && o.status === 'CONFIRMED') {
      return o.invoiceNumber !== null ? 'PENDING' : 'NOT_REQUIRED';
    }
    return o.eInvoiceStatus;
  }

  private toAdminItem(o: MockBillingOrder, companyName: string, planTier: Tier | null): AdminBillingOrderItemDto {
    return {
      id: o.id,
      companyId: o.companyId,
      companyName,
      orderType: o.orderType,
      status: o.status,
      credits: o.credits,
      planTier,
      baseAmountRon: Number(o.baseAmountRon),
      vatRate: Number(o.vatRate),
      vatAmountRon: Number(o.vatAmountRon),
      totalRon: Number(o.totalRon),
      paymentSource: o.paymentSource,
      hasStripeSession: !!o.stripeSessionId,
      invoiceLabel: this.invoiceLabel(o),
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
      testMode: o.testMode,
      eInvoiceStatus: this.eInvoiceStatusOf(o),
      anafUploadId: o.anafUploadId,
      anafDownloadId: o.anafDownloadId,
      eInvoiceUpdatedAt: o.eInvoiceUpdatedAt?.toISOString() ?? null,
      paymentClaimedAt: o.paymentClaimedAt?.toISOString() ?? null,
    };
  }

  async getOrderForCompany(companyId: string, orderId: string): Promise<MockBillingOrder> {
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.companyId !== companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Order not found' });
    }
    return order;
  }

  private async planCodes(): Promise<Map<string, Tier>> {
    const plans = await this.prisma.subscriptionPlan.findMany({ select: { id: true, code: true } });
    return new Map(plans.map((p) => [p.id, p.code]));
  }

  private invoiceLabel(o: MockBillingOrder): string | null {
    return o.invoiceSeries && o.invoiceNumber !== null ? `${o.invoiceSeries}-${o.invoiceNumber}` : null;
  }

  toDto(o: MockBillingOrder, planTier: Tier | null = null, expiryDays = 0): BillingOrderDto {
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
      testMode: o.testMode,
      paymentClaimedAt: o.paymentClaimedAt?.toISOString() ?? null,
      transferExpiresAt: transferExpiresAt(o, expiryDays)?.toISOString() ?? null,
    };
  }
}
