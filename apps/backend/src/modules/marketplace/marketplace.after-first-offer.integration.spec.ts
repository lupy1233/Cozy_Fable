import type { CreateQuoteInput, QuoteDto } from '@marketplace/shared';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  settlementsOf,
  sweepLateNotifications,
  type MoneyCleanup,
  type TestFirm,
} from '../../test/money-fixtures';
import { createMoneyServices, errorCode, errorStatus, ownerCtx } from '../../test/money-services';
import { MarketplaceService } from './marketplace.service';

// a1 (PO 2026-11-13) — cererea ramane deschisa dupa prima oferta pana se ocupa cele 3 locuri,
// pe PostgreSQL real (TEST_DATABASE_URL; fara el se sare). Comutatorul e pus explicit pe 'true'
// (baza de test poate avea randul 'false' din migrarea 20260930120000) si refacut la final.

const LAT = 44.4268;
const LNG = 26.1025;
const COST = 2;
const KEY = 'claims_open_after_first_offer';

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma } = createTestPrisma(dbUrl);
  const services = createMoneyServices(prisma);
  const marketplace = new MarketplaceService(prisma, services.settings, services.uploads, services.calendar);
  return { prisma, marketplace, ...services };
}

(url ? describe : describe.skip)('claim dupa prima oferta pe PostgreSQL (a1)', () => {
  jest.setTimeout(180_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];
  let previous: string | null = null;

  beforeAll(async () => {
    previous = (await w.prisma.systemSetting.findUnique({ where: { key: KEY } }))?.value ?? null;
    await w.prisma.systemSetting.upsert({ where: { key: KEY }, update: { value: 'true' }, create: { key: KEY, value: 'true' } });
  });
  afterEach(async () => {
    await cleanupMoney(w.prisma, ids);
    ids.requestIds = [];
    ids.companyIds = [];
    allUserIds.push(...ids.userIds);
    ids.userIds = [];
  });
  afterAll(async () => {
    if (previous === null) await w.prisma.systemSetting.deleteMany({ where: { key: KEY } });
    else await w.prisma.systemSetting.update({ where: { key: KEY }, data: { value: previous } });
    await sweepLateNotifications(w.prisma, allUserIds);
    await w.prisma.$disconnect();
  });

  async function firm(label: string): Promise<TestFirm> {
    const f = await makeFirm(w.prisma, w.credits, { label, lat: LAT, lng: LNG });
    ids.companyIds.push(f.companyId);
    ids.userIds.push(f.ownerId);
    return f;
  }
  const claim = (f: TestFirm, requestId: string) =>
    w.claims.create(ownerCtx(f.companyId), f.ownerId, { requestId, assignToUserId: f.ownerId });
  const offer = (f: TestFirm, claimSlotId: string): Promise<QuoteDto> =>
    w.quotes.createQuote(ownerCtx(f.companyId), f.ownerId, {
      claimSlotId,
      price: 1000,
      description: 'a1 oferta',
    } as CreateQuoteInput);

  async function requestWithFirstOffer() {
    const [a, b, c, d] = [await firm('A'), await firm('B'), await firm('C'), await firm('D')];
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: COST, lat: LAT, lng: LNG });
    ids.requestIds.push(requestId);
    const slotA = await claim(a, requestId);
    const quoteA = await offer(a, slotA.id);
    return { a, b, c, d, clientId, requestId, quoteA };
  }

  it('o oferta trimisa + 2 locuri libere → cererea apare in piata si se poate prelua; a 4-a preluare → CLAIM_SLOTS_FULL', async () => {
    const { b, c, d, requestId } = await requestWithFirstOffer();
    expect((await w.prisma.request.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('OFFERS_RECEIVED');

    const listD = await w.marketplace.list(d.companyId, 0);
    expect(listD.find((r) => r.id === requestId)).toMatchObject({ activeClaims: 1 });

    await claim(b, requestId);
    await claim(c, requestId);
    const err = await claim(d, requestId).catch((e: unknown) => e);
    expect(errorStatus(err)).toBe(409);
    expect(errorCode(err)).toBe('CLAIM_SLOTS_FULL');

    // pagina din piata a firmei D spune motivul, nu "Nicio cerere"
    const closed = await w.marketplace.detail(d.companyId, 0, requestId).catch((e: unknown) => e);
    expect(errorStatus(closed)).toBe(409);
    expect(errorCode(closed)).toBe('REQUEST_NO_LONGER_CLAIMABLE');
  });

  it('dupa acceptare, firma care a preluat tarziu fara oferta primeste creditele inapoi', async () => {
    const { b, clientId, requestId, quoteA } = await requestWithFirstOffer();
    const late = await claim(b, requestId);
    await w.quotes.acceptQuote(clientId, quoteA.id, quoteA.versions[0].id);
    expect(await settlementsOf(w.prisma, late.id)).toEqual(['REFUND']);
  });
});
