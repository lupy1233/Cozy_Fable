import { randomUUID } from 'node:crypto';
import type { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TX_PROFILES } from '../../infra/prisma/tx-options';
import { OutboxService } from '../outbox/outbox.service';
import { CreditsService } from './credits.service';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions.service';
import { testDatabaseUrl } from '../../test/db-guard';

jest.mock('../../infra/monitoring/error-tracking', () => ({ captureServerException: jest.fn() }));

// E-admin-platform-54 — confirmari concurente pe Postgres real cu latenta cross-region simulata
// (150 ms per query, ca incidentul 2026-09-17): toate reusesc, numerele de factura sunt
// consecutive, iar data emiterii urmeaza ordinea numerelor (4.17). Cu un plafon de 1 s
// tranzactia cade cu P2028 → filtrul raspunde 503 DATABASE_BUSY si nimic nu ramane comis.
const url = testDatabaseUrl();
const LATENCY_MS = 150;

(url ? describe : describe.skip)('payments.confirm concurrency against PostgreSQL', () => {
  jest.setTimeout(60_000);
  const datasources = url ? { db: { url } } : undefined;
  // client curat pentru pregatire/verificari; clientul "lent" ruleaza serviciul
  const prisma = new PrismaService({ datasources });
  const slow = new PrismaService({ datasources });
  slow.$use(async (params, next) => {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    return next(params);
  });

  const series = `T${randomUUID().slice(0, 8)}`;
  const settings = {
    getString: async (key: string, fallback: string) => (key === 'invoice_series' ? series : fallback),
    getNumber: async (_key: string, fallback: number) => fallback,
  };
  const seller = { name: 'Firma Test SRL', cui: 'RO12345674', regCom: 'J40/1/2026', address: 'Str. Test 1', iban: 'RO08TEST0000000000000001' };
  const readiness = { assertReady: jest.fn(async () => seller) };
  const stripe = { isEnabled: jest.fn(() => false), ensureSessionExpired: jest.fn(), expireSession: jest.fn() };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };

  const build = (db: PrismaService) => {
    const credits = new CreditsService(db);
    return new PaymentsService(
      db,
      settings as never,
      credits,
      new SubscriptionsService(db, settings as never, credits),
      stripe as never,
      { getOrThrow: () => 'https://example.invalid' } as never,
      { log: jest.fn() } as never,
      new OutboxService(db, events as never),
      readiness as never,
    );
  };
  const service = build(slow);

  let companyIds: string[] = [];
  let userIds: string[] = [];

  async function company(label: string): Promise<string> {
    const c = await prisma.company.create({
      data: { name: `Confirm ${label}`, cui: randomUUID(), regComNumber: 'test', addressText: 'test', county: 'test', city: 'test', lat: 0, lng: 0 },
    });
    const u = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: 'Confirm test', role: 'COMPANY_USER', passwordHash: 'test' },
    });
    await prisma.companyMember.create({ data: { companyId: c.id, userId: u.id, role: 'OWNER' } });
    companyIds.push(c.id);
    userIds.push(u.id);
    return c.id;
  }

  const pendingOrder = (companyId: string) =>
    prisma.mockBillingOrder.create({
      data: {
        companyId,
        orderType: 'CREDIT_PACKAGE',
        credits: 10,
        baseAmountRon: 100,
        vatRate: 21,
        vatAmountRon: 21,
        totalRon: 121,
        testMode: false,
      },
    });

  afterEach(async () => {
    for (const companyId of companyIds) {
      await prisma.domainEventOutbox.deleteMany({ where: { payload: { path: ['companyId'], equals: companyId } } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    for (const id of userIds) await prisma.user.delete({ where: { id } });
    companyIds = [];
    userIds = [];
  });
  afterAll(async () => {
    await slow.$disconnect();
    await prisma.$disconnect();
  });

  it('three concurrent live confirms all succeed with consecutive numbers and monotonic dates', async () => {
    const a = await company('A');
    const b = await company('B');
    const orders = [await pendingOrder(a), await pendingOrder(a), await pendingOrder(b)];

    const results = await Promise.allSettled(orders.map((o) => service.confirm(o.id, 'admin')));
    expect(results.map((r) => (r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : r.status))).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);

    const confirmed = await prisma.mockBillingOrder.findMany({
      where: { id: { in: orders.map((o) => o.id) } },
      orderBy: { invoiceNumber: 'asc' },
    });
    expect(confirmed.every((o) => o.status === 'CONFIRMED' && o.invoiceSeries === series)).toBe(true);
    expect(confirmed.map((o) => o.invoiceNumber)).toEqual([1, 2, 3]);
    const stamps = confirmed.map((o) => o.confirmedAt!.getTime());
    expect([...stamps].sort((x, y) => x - y)).toEqual(stamps);
    expect(confirmed.every((o) => o.paidAt!.getTime() === o.confirmedAt!.getTime())).toBe(true);

    expect((await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId: a } })).balance).toBe(20);
    expect((await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId: b } })).balance).toBe(10);
    expect(await prisma.creditTransaction.count({ where: { companyId: a, type: 'GRANT' } })).toBe(2);
    expect(await prisma.creditTransaction.count({ where: { companyId: b, type: 'GRANT' } })).toBe(1);
  });

  it('a transaction over its ceiling rolls back and maps to 503 DATABASE_BUSY', async () => {
    const a = await company('slow');
    const order = await pendingOrder(a);
    // DB lent: plafonul profilului write scurtat la 1 s (optiunile profilului bat transactionOptions
    // ale clientului, deci nu ajunge un client construit cu timeout mic)
    const original = TX_PROFILES.write;
    TX_PROFILES.write = { ...original, timeout: 1_000 };
    let err: unknown;
    try {
      err = await service.confirm(order.id, 'admin').then(
        () => null,
        (e: unknown) => e,
      );
    } finally {
      TX_PROFILES.write = original;
    }
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe('P2028');

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const setHeader = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader }),
        getRequest: () => ({ id: randomUUID(), method: 'POST', route: { path: '/api/v1/admin/payments/:id/confirm' } }),
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(err, host);
    expect(status).toHaveBeenCalledWith(503);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'DATABASE_BUSY' }) });

    const after = await prisma.mockBillingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('PENDING');
    expect(after.invoiceNumber).toBeNull();
    expect(await prisma.creditTransaction.count({ where: { companyId: a } })).toBe(0);
  });
});
