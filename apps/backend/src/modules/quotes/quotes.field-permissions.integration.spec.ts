import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { CreditsService } from '../billing/credits.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import { OutboxService } from '../outbox/outbox.service';
import { QuotesService } from './quotes.service';
import { testDatabaseUrl } from '../../test/db-guard';

// h1-2 (etapa 11) pe PostgreSQL real (TEST_DATABASE_URL, doar host local): firma FARA niciun
// rand in company_offer_field_permissions → proprietarul trimite oferta; angajatul de incredere
// e refuzat pe pret (matricea de la inscriere); firma cu randuri ramane pe randurile ei.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY = 24 * 3600 * 1000;
const COST = 2;

const url = testDatabaseUrl();
(url ? describe : describe.skip)('quotes field permissions against PostgreSQL (h1-2)', () => {
  jest.setTimeout(120_000);
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const settings = new SettingsService(prisma);
  const credits = new CreditsService(prisma);
  const outbox = new OutboxService(prisma, { publish: jest.fn() } as never);
  const queue = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
  const service = new QuotesService(
    prisma,
    settings,
    outbox,
    { addWorkingDays: (d: Date, n: number) => new Date(d.getTime() + n * DAY) } as never,
    { listForEntities: async () => new Map(), relink: async () => [], toAttachmentDtos: async () => [] } as never,
    new ClaimSettlementService(credits),
    queue as never,
    queue as never,
    queue as never,
    queue as never,
    queue as never,
    queue as never,
    { encrypt: (s: string | null) => s } as never,
  );

  const created: { companyIds: string[]; userIds: string[]; requestIds: string[] } = { companyIds: [], userIds: [], requestIds: [] };

  async function seed() {
    const client = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: 'H1 client', role: 'CLIENT', passwordHash: 'test' },
    });
    const owner = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: 'H1 owner', role: 'COMPANY_USER', passwordHash: 'test' },
    });
    const trusted = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: 'H1 trusted', role: 'COMPANY_USER', passwordHash: 'test' },
    });
    const company = await prisma.company.create({
      data: {
        name: 'H1 fara permisiuni', cui: randomUUID(), regComNumber: 'test', addressText: 'test',
        county: 'test', city: 'test', lat: 0, lng: 0, status: 'APPROVED',
      },
    });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER' } });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: trusted.id, role: 'EMPLOYEE_TRUSTED' } });
    await prisma.companyCreditWallet.create({ data: { companyId: company.id, balance: 10, reserved: 0 } });
    // fara niciun rand de permisiuni (ca firmele demo aprobate ulterior inainte de etapa 11)
    await prisma.companyOfferFieldPermission.deleteMany({ where: { companyId: company.id } });
    const request = await prisma.request.create({
      data: { clientUserId: client.id, status: 'CLAIMED_PARTIAL', title: 'H1 test', includesPaidDesign: false, hasOwnProject: false },
    });
    const slot = await prisma.claimSlot.create({
      data: {
        requestId: request.id, companyId: company.id, claimedByUserId: owner.id,
        status: 'ACTIVE', projectSizeSnapshot: 'SMALL', projectScoreSnapshot: 1,
        claimCostCreditsSnapshot: COST, slaDeadlineAt: new Date(Date.now() + 5 * DAY),
      },
    });
    await prisma.$transaction((tx) => credits.reserve(company.id, COST, 'CLAIM_RESERVE', slot.id, tx));
    await prisma.chatThread.create({ data: { claimSlotId: slot.id } });
    created.companyIds.push(company.id);
    created.userIds.push(client.id, owner.id, trusted.id);
    created.requestIds.push(request.id);
    return { companyId: company.id, ownerId: owner.id, trustedId: trusted.id, slotId: slot.id };
  }

  afterEach(async () => {
    await prisma.domainEventOutbox.deleteMany({
      where: { OR: created.requestIds.map((id) => ({ payload: { path: ['requestId'], equals: id } })) },
    });
    await prisma.request.deleteMany({ where: { id: { in: created.requestIds } } });
    await prisma.company.deleteMany({ where: { id: { in: created.companyIds } } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    created.companyIds = [];
    created.userIds = [];
    created.requestIds = [];
  });
  afterAll(async () => prisma.$disconnect());

  const offer = (claimSlotId: string): Any => ({
    claimSlotId, price: 1000, description: 'H1 oferta', vatMode: 'VAT_INCLUDED',
    deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', warrantyMonths: 24, includesTransport: true, includesAssembly: true,
  });
  const ctx = (companyId: string, memberRole: string): Any => ({ companyId, memberRole, status: 'APPROVED' });

  it('angajatul de incredere e refuzat pe pret (matricea de la inscriere), nimic scris', async () => {
    const s = await seed();
    await expect(service.createQuote(ctx(s.companyId, 'EMPLOYEE_TRUSTED'), s.trustedId, offer(s.slotId))).rejects.toMatchObject({
      status: 403,
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['PRICE'] } },
    });
    expect(await prisma.quote.count({ where: { claimSlotId: s.slotId } })).toBe(0);
  });

  it('proprietarul trimite oferta fara niciun rand de permisiuni', async () => {
    const s = await seed();
    const q = await service.createQuote(ctx(s.companyId, 'OWNER'), s.ownerId, offer(s.slotId));
    expect(q.status).toBe('SENT');
    expect(await prisma.companyOfferFieldPermission.count({ where: { companyId: s.companyId } })).toBe(0);
  });

  it('firma cu randuri doar pentru alt rol: angajatul de incredere e refuzat (fara matricea implicita)', async () => {
    const s = await seed();
    await prisma.companyOfferFieldPermission.create({
      data: { companyId: s.companyId, role: 'MANAGER', fieldKey: 'DESCRIPTION', canEdit: true },
    });
    await expect(service.createQuote(ctx(s.companyId, 'EMPLOYEE_TRUSTED'), s.trustedId, offer(s.slotId))).rejects.toMatchObject({
      response: { code: 'OFFER_FIELD_NOT_EDITABLE' },
    });
  });
});
