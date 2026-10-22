import { Prisma } from '@prisma/client';
import { BankTransferService, isBankOrder } from './bank-transfer.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SettingsService } from '../../common/settings/settings.service';
import type { OutboxService } from '../outbox/outbox.service';
import type { AuditService } from '../audit/audit.service';
import type { PaymentsService } from './payments.service';

// E-company-24 — "Am platit" + reminder / anulare automata a comenzilor prin transfer bancar.
// Setarile sunt 0 (oprit) pana la decizia PO; comenzile marcate "Am platit" nu se ating.

/* eslint-disable @typescript-eslint/no-explicit-any */

const NOW = new Date('2026-10-10T12:00:00Z');
const DAY = 86_400_000;

function order(over: Partial<any> = {}) {
  return {
    id: 'o1',
    companyId: 'c1',
    orderType: 'CREDIT_PACKAGE',
    status: 'PENDING',
    planId: null,
    stripeSessionId: null,
    stripeCheckoutAttempt: null,
    testMode: false,
    paymentClaimedAt: null,
    transferReminderSentAt: null,
    createdAt: new Date(NOW.getTime() - 4 * DAY),
    totalRon: new Prisma.Decimal('121.00'),
    ...over,
  };
}

function build(rows: any[], settingsValues: Record<string, number> = {}) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    mockBillingOrder: {
      findUnique: jest.fn(async ({ where }: any) => byId.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => Object.assign(byId.get(where.id), data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = byId.get(where.id);
        if (row && row.status === where.status) {
          Object.assign(row, data);
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner-1' }, { userId: 'mgr-1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
  };
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    mockBillingOrder: {
      // simuleaza filtrul de candidati (fara conditiile de timp/stare, re-verificate sub lock)
      findMany: jest.fn(async () => rows.map((r) => ({ id: r.id }))),
    },
    subscriptionPlan: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const settings = {
    getInt: jest.fn(async (key: string, fb: number) => settingsValues[key] ?? fb),
  } as unknown as SettingsService;
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const payments = { toDto: jest.fn((o: any) => ({ id: o.id, status: o.status, paymentClaimedAt: o.paymentClaimedAt?.toISOString() ?? null })) };
  const service = new BankTransferService(
    prisma as PrismaService,
    settings,
    outbox as unknown as OutboxService,
    audit as unknown as AuditService,
    payments as unknown as PaymentsService,
  );
  return { service, prisma, tx, outbox, audit, byId };
}

describe('BankTransferService.sweep', () => {
  it('setari 0/0 (implicit) → nicio interogare pe comenzi', async () => {
    const { service, prisma } = build([order()]);
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 0 });
    expect(prisma.mockBillingOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('expirare 3 zile: anuleaza comanda de 4 zile + payment.auto_cancelled (OWNER/MANAGER) + audit', async () => {
    const { service, prisma, byId, outbox, audit } = build([order()], { bank_transfer_expiry_days: 3 });
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 1 });
    const where = prisma.mockBillingOrder.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: 'PENDING',
      stripeSessionId: null,
      stripeCheckoutAttempt: { equals: Prisma.AnyNull },
      paymentClaimedAt: null,
      testMode: false,
      createdAt: { lte: new Date(NOW.getTime() - 3 * DAY) },
    });
    expect(byId.get('o1')).toMatchObject({ status: 'CANCELLED', cancelledAt: NOW });
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      'payment.auto_cancelled:o1',
      'payment.auto_cancelled',
      { orderId: 'o1', companyId: 'c1', orderType: 'CREDIT_PACKAGE', expiryDays: 3 },
      ['owner-1', 'mgr-1'],
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PAYMENT_CANCELLED', entityId: 'o1', userAgent: 'bank-transfer-expiry', after: { orderId: 'o1', status: 'CANCELLED' },
    }));
  });

  it.each([
    ['sesiune Stripe', { stripeSessionId: 'cs_1' }],
    ['incercare Stripe', { stripeCheckoutAttempt: { idempotencyKey: 'k' } }],
    ['"Am platit"', { paymentClaimedAt: new Date(NOW.getTime() - DAY) }],
    ['comanda test', { testMode: true }],
    ['confirmata intre timp (sub lock)', { status: 'CONFIRMED' }],
    ['prea noua', { createdAt: new Date(NOW.getTime() - DAY) }],
  ])('nu anuleaza: %s', async (_label, over) => {
    const { service, byId, outbox, audit } = build([order(over)], { bank_transfer_expiry_days: 3 });
    const before = byId.get('o1').status;
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 0 });
    expect(byId.get('o1').status).toBe(before);
    expect(outbox.record).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('race: confirmarea adminului castiga updateMany → fara eveniment de anulare', async () => {
    const { service, tx, outbox } = build([order()], { bank_transfer_expiry_days: 3 });
    tx.mockBillingOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 0 });
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('reminder o singura data (transfer_reminder_sent_at), cu termenul de anulare in payload', async () => {
    const o = order({ createdAt: new Date(NOW.getTime() - 2 * DAY) });
    const { service, byId, outbox } = build([o], { bank_transfer_reminder_days: 1, bank_transfer_expiry_days: 5 });
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 1, cancelled: 0 });
    expect(byId.get('o1').transferReminderSentAt).toEqual(NOW);
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      'payment.transfer_reminder:o1',
      'payment.transfer_reminder',
      {
        orderId: 'o1', companyId: 'c1', orderType: 'CREDIT_PACKAGE',
        cancelAt: new Date(o.createdAt.getTime() + 5 * DAY).toISOString(),
      },
      ['owner-1', 'mgr-1'],
    );
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 0 });
    expect(outbox.record).toHaveBeenCalledTimes(1);
  });

  it('reminder fara anulare automata → cancelAt null; reminder >= expirare → fara reminder', async () => {
    const a = build([order()], { bank_transfer_reminder_days: 2 });
    await expect(a.service.sweep(NOW)).resolves.toEqual({ reminded: 1, cancelled: 0 });
    expect(a.outbox.record.mock.calls[0][3].cancelAt).toBeNull();

    const b = build([order({ createdAt: new Date(NOW.getTime() - 2 * DAY) })], { bank_transfer_reminder_days: 3, bank_transfer_expiry_days: 3 });
    await expect(b.service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 0 });
    expect(b.prisma.mockBillingOrder.findMany).toHaveBeenCalledTimes(1); // doar scanarea de anulare
  });

  it('o comanda care pica nu opreste lotul', async () => {
    const { service, tx, byId } = build([order(), order({ id: 'o2' })], { bank_transfer_expiry_days: 3 });
    tx.$executeRaw.mockRejectedValueOnce(new Error('lock timeout'));
    await expect(service.sweep(NOW)).resolves.toEqual({ reminded: 0, cancelled: 1 });
    expect(byId.get('o2').status).toBe('CANCELLED');
  });
});

describe('BankTransferService.markPaid', () => {
  it('seteaza payment_claimed_at + payment.marked_paid spre admini; al doilea apel nu mai scrie nimic', async () => {
    const { service, byId, outbox, tx } = build([order()]);
    const dto = await service.markPaid('c1', 'o1');
    expect(dto.paymentClaimedAt).toBeTruthy();
    expect(byId.get('o1').paymentClaimedAt).toBeInstanceOf(Date);
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      'payment.marked_paid:o1',
      'payment.marked_paid',
      { orderId: 'o1', companyId: 'c1', orderType: 'CREDIT_PACKAGE' },
      ['admin-1'],
    );
    expect(tx.$executeRaw).toHaveBeenCalled(); // FOR UPDATE
    const again = await service.markPaid('c1', 'o1');
    expect(again.paymentClaimedAt).toBe(dto.paymentClaimedAt);
    expect(outbox.record).toHaveBeenCalledTimes(1);
    expect(tx.mockBillingOrder.update).toHaveBeenCalledTimes(1);
  });

  it('comanda altei firme / inexistenta → 404', async () => {
    const { service } = build([order()]);
    await expect(service.markPaid('c2', 'o1')).rejects.toMatchObject({ status: 404 });
    await expect(service.markPaid('c1', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['CONFIRMED', { status: 'CONFIRMED' }],
    ['CANCELLED', { status: 'CANCELLED' }],
    ['Stripe', { stripeSessionId: 'cs_1' }],
    ['test', { testMode: true }],
  ])('comanda %s → 409 PAYMENT_NOT_PENDING', async (_label, over) => {
    const { service, outbox } = build([order(over)]);
    await expect(service.markPaid('c1', 'o1')).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'PAYMENT_NOT_PENDING' }),
    });
    expect(outbox.record).not.toHaveBeenCalled();
  });
});

describe('isBankOrder', () => {
  it('doar PENDING, fara Stripe, non-test', () => {
    expect(isBankOrder(order())).toBe(true);
    expect(isBankOrder(order({ stripeCheckoutAttempt: {} }))).toBe(false);
    expect(isBankOrder(order({ status: 'CANCELLED' }))).toBe(false);
  });
});
