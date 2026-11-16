import { testDatabaseUrl } from '../../test/db-guard';
import {
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  sweepLateNotifications,
  type MoneyCleanup,
  type TestFirm,
} from '../../test/money-fixtures';
import { createMoneyServices, ownerCtx } from '../../test/money-services';

// e4 (etapa 7) — pe PostgreSQL REAL: cand o firma renunta la preluare, clientul primeste o
// singura intentie outbox `request.company_withdrew` (clopotel + e-mail), tintita doar lui;
// istoricul "O firma a avut acces pana pe …" apare in cardul "Cine vede cererea".

const LAT = 44.4268;
const LNG = 26.1025;
const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma } = createTestPrisma(dbUrl);
  return { prisma, ...createMoneyServices(prisma) };
}

(url ? describe : describe.skip)('withdrawal → client notice on PostgreSQL (e4)', () => {
  jest.setTimeout(120_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];

  afterEach(async () => {
    await cleanupMoney(w.prisma, ids);
    ids.requestIds = [];
    ids.companyIds = [];
    allUserIds.push(...ids.userIds);
    ids.userIds = [];
  });
  afterAll(async () => {
    await sweepLateNotifications(w.prisma, allUserIds);
    await w.prisma.$disconnect();
  });

  async function firm(label: string): Promise<TestFirm> {
    const f = await makeFirm(w.prisma, w.credits, { label, lat: LAT, lng: LNG, grant: 20 });
    ids.companyIds.push(f.companyId);
    ids.userIds.push(f.ownerId);
    return f;
  }

  it('retragere voluntara → o singura intentie catre client; a doua cerere de retragere nu dubleaza', async () => {
    const a = await firm('E4A');
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: 2, lat: LAT, lng: LNG });
    ids.requestIds.push(requestId);
    const slot = await w.claims.create(ownerCtx(a.companyId), a.ownerId, { requestId });

    await w.withdrawals.request(ownerCtx(a.companyId), a.ownerId, slot.id, { reasonType: 'VOLUNTARY_NO_REASON' });
    await expect(
      w.withdrawals.request(ownerCtx(a.companyId), a.ownerId, slot.id, { reasonType: 'VOLUNTARY_NO_REASON' }),
    ).rejects.toBeTruthy();

    const rows = await w.prisma.domainEventOutbox.findMany({ where: { eventKey: `request.company_withdrew:${slot.id}` } });
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('request.company_withdrew');
    expect(rows[0].targetUserIds).toEqual([clientId]);
    // fara numele firmei in intentie
    expect(JSON.stringify(rows[0].payload)).not.toContain(a.companyId);
  });
});
