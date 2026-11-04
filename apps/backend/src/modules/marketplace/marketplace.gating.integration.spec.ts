import { testDatabaseUrl } from '../../test/db-guard';
import {
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  reservesOf,
  sweepLateNotifications,
  type MoneyCleanup,
} from '../../test/money-fixtures';
import { createMoneyServices, errorCode, errorStatus, ownerCtx } from '../../test/money-services';
import { MarketplaceService } from './marketplace.service';

// E-admin-platform-14 — gating-ul planului (4.10) caracterizat pe PostgreSQL real: SQL-ul din
// marketplace (published_at + delay <= now()) si verificarea din claim (Date.now()) trebuie sa
// spuna acelasi lucru. Cerere publicata acum 10 min: vizibila cu gating 0, ascunsa cu 30 min,
// iar claim-ul cu gating 30 → 403 GATING_NOT_OPEN fara nicio rezervare.

const LAT = 44.4268;
const LNG = 26.1025;
const COST = 2;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma } = createTestPrisma(dbUrl);
  const services = createMoneyServices(prisma);
  const marketplace = new MarketplaceService(prisma, services.settings, services.uploads);
  return { prisma, marketplace, ...services };
}

(url ? describe : describe.skip)('marketplace gating on PostgreSQL (E-admin-platform-14)', () => {
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

  async function seed() {
    const f = await makeFirm(w.prisma, w.credits, { label: 'gating', lat: LAT, lng: LNG });
    ids.companyIds.push(f.companyId);
    ids.userIds.push(f.ownerId);
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, {
      cost: COST, lat: LAT, lng: LNG, publishedMinutesAgo: 10,
    });
    ids.requestIds.push(requestId);
    return { f, requestId };
  }

  it('list/detail: ascunsa cu gating 30 min, vizibila cu gating 0', async () => {
    const { f, requestId } = await seed();

    const gated = await w.marketplace.list(f.companyId, 30);
    expect(gated.map((r) => r.id)).not.toContain(requestId);
    const open = await w.marketplace.list(f.companyId, 0);
    const item = open.find((r) => r.id === requestId);
    expect(item).toMatchObject({ id: requestId, creditCost: COST, activeClaims: 0, alreadyClaimedByMyCompany: false });

    const hidden = await w.marketplace.detail(f.companyId, 30, requestId).catch((e: unknown) => e);
    expect(errorStatus(hidden)).toBe(404);
    expect(errorCode(hidden)).toBe('NOT_FOUND');
    await expect(w.marketplace.detail(f.companyId, 0, requestId)).resolves.toMatchObject({ id: requestId });
  });

  it('claim cu gating 30 min → 403 GATING_NOT_OPEN, fara slot si fara RESERVE', async () => {
    const { f, requestId } = await seed();

    const err = await w.claims.create(ownerCtx(f.companyId, 30), f.ownerId, { requestId }).catch((e: unknown) => e);
    expect(errorStatus(err)).toBe(403);
    expect(errorCode(err)).toBe('GATING_NOT_OPEN');
    expect(await w.prisma.claimSlot.count({ where: { requestId } })).toBe(0);
    expect(await w.prisma.creditTransaction.count({ where: { companyId: f.companyId, type: 'RESERVE' } })).toBe(0);

    // acelasi claim fara gating trece (controlul de mai sus nu era un refuz din alt motiv)
    const slot = await w.claims.create(ownerCtx(f.companyId, 0), f.ownerId, { requestId });
    expect(await reservesOf(w.prisma, slot.id)).toEqual({ count: 1, amount: COST });
  });
});
