import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type BillingOrderDto } from '@marketplace/shared';
import { Prisma, type MockBillingOrder } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { SettingsService } from '../../common/settings/settings.service';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { OutboxService } from '../outbox/outbox.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from './payments.service';
import { billingManagerIds } from './billing-recipients';
import {
  SETTING_BANK_TRANSFER_EXPIRY_DAYS,
  SETTING_BANK_TRANSFER_REMINDER_DAYS,
  isBankOrder,
} from './bank-transfer.constants';

export { isBankOrder } from './bank-transfer.constants';

const DAY_MS = 86_400_000;
// un lot per rulare (orar); restul se ia la rularea urmatoare
const SWEEP_BATCH = 200;

// E-company-24 — comenzile platite prin transfer bancar (Stripe oprit, D-L0-1):
// "Am platit" (firma anunta adminii) + reminder si anulare automata dupa N zile calendaristice
// de la created_at. N vine din system_settings (0 = oprit, DECIZIE NECESARA PO). Comenzile
// marcate "Am platit" nu se mai amintesc si nu se anuleaza automat.
// Race-safe cu confirm()/cancel() din admin: toate trec prin FOR UPDATE pe rand +
// updateMany conditionat pe PENDING, deci exact o parte castiga.
@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  // "Am platit": marcaj setat o singura data (idempotent pe stare + eventKey) + clopotel admini.
  async markPaid(companyId: string, orderId: string): Promise<BillingOrderDto> {
    const order = await runTx(this.prisma, 'write', async (tx) => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${orderId} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUnique({ where: { id: orderId } });
      if (!fresh || fresh.companyId !== companyId) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Order not found' });
      }
      if (!isBankOrder(fresh)) {
        throw new HttpException(
          { code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Order is not awaiting a bank transfer' },
          409,
        );
      }
      if (fresh.paymentClaimedAt) return fresh;
      const updated = await tx.mockBillingOrder.update({
        where: { id: orderId },
        data: { paymentClaimedAt: new Date() },
      });
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
      await this.outbox.record(tx, `payment.marked_paid:${orderId}`, 'payment.marked_paid', {
        orderId, companyId: fresh.companyId, orderType: fresh.orderType,
      }, admins.map((a) => a.id));
      return updated;
    });
    const plan = order.planId
      ? await this.prisma.subscriptionPlan.findUnique({ where: { id: order.planId }, select: { code: true } })
      : null;
    return this.payments.toDto(order, plan?.code ?? null);
  }

  // Rulat orar de SubscriptionExpiryProcessor (job 'bank-transfer-expiry'). Scanarea citeste
  // created_at, deci e propria reconciliere (un job pierdut se recupereaza la rularea urmatoare).
  async sweep(now: Date = new Date()): Promise<{ reminded: number; cancelled: number }> {
    const [reminderDays, expiryDays] = await Promise.all([
      this.settings.getInt(SETTING_BANK_TRANSFER_REMINDER_DAYS, 0),
      this.settings.getInt(SETTING_BANK_TRANSFER_EXPIRY_DAYS, 0),
    ]);
    const expiry = expiryDays > 0 ? expiryDays : 0;
    // reminderul dupa (sau odata cu) anularea n-ar mai avea sens
    const reminder = reminderDays > 0 && (expiry === 0 || reminderDays < expiry) ? reminderDays : 0;
    let reminded = 0;
    let cancelled = 0;
    if (expiry === 0 && reminder === 0) return { reminded, cancelled };

    const base: Prisma.MockBillingOrderWhereInput = {
      status: 'PENDING',
      stripeSessionId: null,
      stripeCheckoutAttempt: { equals: Prisma.AnyNull },
      paymentClaimedAt: null,
      testMode: false,
    };

    if (expiry > 0) {
      const cutoff = new Date(now.getTime() - expiry * DAY_MS);
      const stale = await this.prisma.mockBillingOrder.findMany({
        where: { ...base, createdAt: { lte: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: SWEEP_BATCH,
        select: { id: true },
      });
      for (const { id } of stale) {
        if (await this.guarded('cancel', id, () => this.cancelStale(id, cutoff, expiry, now))) cancelled += 1;
      }
    }

    if (reminder > 0) {
      const cutoff = new Date(now.getTime() - reminder * DAY_MS);
      const due = await this.prisma.mockBillingOrder.findMany({
        where: { ...base, transferReminderSentAt: null, createdAt: { lte: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: SWEEP_BATCH,
        select: { id: true },
      });
      for (const { id } of due) {
        if (await this.guarded('remind', id, () => this.remind(id, cutoff, expiry, now))) reminded += 1;
      }
    }
    return { reminded, cancelled };
  }

  // o comanda care pica nu opreste lotul; rularea urmatoare o reia (handler idempotent)
  private async guarded(kind: string, id: string, fn: () => Promise<boolean>): Promise<boolean> {
    try {
      return await fn();
    } catch (e) {
      this.logger.warn(`bank-transfer ${kind} ${id} a esuat: ${safeErrorSummary(e)}`);
      return false;
    }
  }

  private async cancelStale(id: string, cutoff: Date, expiryDays: number, now: Date): Promise<boolean> {
    const cancelled = await runTx(this.prisma, 'write', async (tx): Promise<MockBillingOrder | null> => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${id} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUnique({ where: { id } });
      // re-verificare sub lock: confirmata/anulata intre timp, "Am platit" sau termen mutat
      if (!fresh || !isBankOrder(fresh) || fresh.paymentClaimedAt || fresh.createdAt > cutoff) return null;
      const res = await tx.mockBillingOrder.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      if (res.count !== 1) return null;
      const managers = await billingManagerIds(tx, fresh.companyId);
      await this.outbox.record(tx, `payment.auto_cancelled:${id}`, 'payment.auto_cancelled', {
        orderId: id, companyId: fresh.companyId, orderType: fresh.orderType, expiryDays,
      }, managers);
      return fresh;
    });
    if (!cancelled) return false;
    await this.audit.log({
      action: 'PAYMENT_CANCELLED',
      entityType: 'mock_billing_order',
      entityId: id,
      userAgent: 'bank-transfer-expiry',
      after: { orderId: id, status: 'CANCELLED' },
    });
    return true;
  }

  private async remind(id: string, cutoff: Date, expiryDays: number, now: Date): Promise<boolean> {
    return runTx(this.prisma, 'write', async (tx) => {
      await tx.$executeRaw`SELECT id FROM mock_billing_orders WHERE id = ${id} FOR UPDATE`;
      const fresh = await tx.mockBillingOrder.findUnique({ where: { id } });
      if (
        !fresh ||
        !isBankOrder(fresh) ||
        fresh.paymentClaimedAt ||
        fresh.transferReminderSentAt !== null ||
        fresh.createdAt > cutoff
      ) {
        return false;
      }
      await tx.mockBillingOrder.update({ where: { id }, data: { transferReminderSentAt: now } });
      const managers = await billingManagerIds(tx, fresh.companyId);
      await this.outbox.record(tx, `payment.transfer_reminder:${id}`, 'payment.transfer_reminder', {
        orderId: id,
        companyId: fresh.companyId,
        orderType: fresh.orderType,
        cancelAt: expiryDays > 0 ? new Date(fresh.createdAt.getTime() + expiryDays * DAY_MS).toISOString() : null,
      }, managers);
      return true;
    });
  }
}
