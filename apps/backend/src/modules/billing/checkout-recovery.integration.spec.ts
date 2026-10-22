import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotentReplay, withIdempotentOperation } from '../../common/idempotency/idempotent-operation';
import { PaymentsService } from './payments.service';
import { CreditsService } from './credits.service';
import { SubscriptionsService } from './subscriptions.service';
import { OutboxService } from '../outbox/outbox.service';
import { testDatabaseUrl } from '../../test/db-guard';

// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('purchase recovery against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const settings = { getString: async (_key: string, fallback: string) => fallback, getNumber: async (_key: string, fallback: number) => fallback };
  const credits = new CreditsService(prisma);
  const stripe = { isEnabled: jest.fn(() => false), mode: jest.fn(() => null), assertEventMode: jest.fn(), createCheckoutSession: jest.fn(), retrieveCheckoutSession: jest.fn(), expireSession: jest.fn() };
  // E-admin-platform-4: date fiscale valide (readiness e testat separat)
  const seller = { name: 'Firma Test SRL', cui: 'RO12345674', regCom: 'J40/1/2026', address: 'Str. Test 1', iban: 'RO08TEST0000000000000001' };
  const readiness = { assertReady: jest.fn(async () => seller), check: jest.fn(async () => ({ ready: true, problems: [], seller })) };
  const events = { publish: jest.fn().mockRejectedValue(new Error('Redis unavailable')) };
  const outbox = new OutboxService(prisma, events as never);
  const service = new PaymentsService(prisma, settings as never, credits, new SubscriptionsService(prisma, settings as never, credits), stripe as never, { getOrThrow: () => 'https://example.invalid' } as never, { log: jest.fn() } as never, outbox, readiness as never);
  let companyId: string, userId: string, packageId: string, receiptId: string;
  beforeEach(async () => {
    stripe.isEnabled.mockReturnValue(false); stripe.createCheckoutSession.mockReset();
    const company = await prisma.company.create({ data: { name: 'Checkout test', cui: randomUUID(), regComNumber: 'test', addressText: 'test', county: 'test', city: 'test', lat: 0, lng: 0 } }); companyId = company.id;
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.invalid`, name: 'Checkout test', role: 'COMPANY_USER', passwordHash: 'test' } }); userId = user.id;
    await prisma.companyMember.create({ data: { companyId, userId, role: 'OWNER' } });
    const pkg = await prisma.creditPackage.create({ data: { credits: 10, priceRon: 100 } }); packageId = pkg.id;
    const receipt = await prisma.idempotencyKey.create({ data: { key: randomUUID(), endpoint: 'POST /billing/credits/purchase', userId, requestHash: 'test', responseStatus: 0, responseBody: {}, expiresAt: new Date('9999-12-31') } }); receiptId = receipt.id;
  });
  afterEach(async () => {
    await prisma.domainEventOutbox.deleteMany({ where: { payload: { path: ['companyId'], equals: companyId } } });
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.creditPackage.delete({ where: { id: packageId } });
  });
  afterAll(async () => prisma.$disconnect());
  const run = () => withIdempotentOperation({ receiptId, responseStatus: 201, transactional: true }, () => service.purchaseCredits(companyId, userId, { creditPackageId: packageId }));

  it('parallel same-key purchases create one order and a committed replay receipt', async () => {
    const results = await Promise.allSettled([run(), run()]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.mockBillingOrder.count({ where: { companyId } })).toBe(1);
    const receipt = await prisma.idempotencyKey.findUniqueOrThrow({ where: { id: receiptId } });
    expect(receipt.responseStatus).toBe(201);
    await expect(run()).rejects.toBeInstanceOf(IdempotentReplay);
    expect(await prisma.domainEventOutbox.count({ where: { payload: { path: ['companyId'], equals: companyId }, eventType: 'payment.pending' } })).toBe(1);
  });

  it('recovers the same order after provider timeout without changing checkout parameters', async () => {
    stripe.isEnabled.mockReturnValue(true);
    stripe.createCheckoutSession.mockRejectedValueOnce(new Error('Unknown provider outcome')).mockResolvedValue({ id: `cs_${randomUUID()}`, url: 'https://checkout.stripe.com/test' });
    await expect(run()).rejects.toThrow('Unknown provider outcome');
    const pending = await prisma.idempotencyKey.findUniqueOrThrow({ where: { id: receiptId } });
    expect(pending.responseStatus).toBe(0);
    const first = stripe.createCheckoutSession.mock.calls[0][0];
    await run();
    expect(stripe.createCheckoutSession.mock.calls[1][0]).toEqual(first);
    expect(await prisma.mockBillingOrder.count({ where: { companyId } })).toBe(1);
    expect((await prisma.idempotencyKey.findUniqueOrThrow({ where: { id: receiptId } })).responseStatus).toBe(201);
  });

  it('admin/webhook confirmation race grants once and retains its delivery intent while Redis is down', async () => {
    const result = await run();
    const outcomes = await Promise.allSettled([service.confirm(result.order.id, 'admin'), service.confirm(result.order.id, 'webhook')]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId } })).balance).toBe(10);
    expect(await prisma.creditTransaction.count({ where: { companyId, type: 'GRANT' } })).toBe(1);
    const intent = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventKey: `payment.confirmed:${result.order.id}` } });
    expect(intent.completedAt).toBeNull();
    expect(intent.targetUserIds).toContain(userId);
  });
});
