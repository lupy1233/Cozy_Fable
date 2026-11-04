import type { CreateQuoteInput, QuoteDto } from '@marketplace/shared';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  assertLedgerBalanced,
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  reservesOf,
  settlementsOf,
  sweepLateNotifications,
  type MoneyCleanup,
  type TestFirm,
} from '../../test/money-fixtures';
import { createMoneyServices, errorCode, errorLabel, errorStatus, ownerCtx } from '../../test/money-services';
import { OCCUPYING_CLAIM_STATUSES } from './claims.constants';

// E-admin-platform-14 — curse reale pe PostgreSQL (TEST_DATABASE_URL local, garda db-guard):
// claim pe ultimele sloturi, aceeasi firma de doua ori, doua accepturi, retragere dubla,
// retragere vs accept. Se verifica INVARIANTELE (numarari, exact o decontare per RESERVE,
// ledger echilibrat), niciodata cine castiga. Latenta de 20 ms/query doar in faza paralela.

const COST = 2;
const GRANT = 20;
const LAT = 44.4268;
const LNG = 26.1025;
const ITERATIONS = 5;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const t = createTestPrisma(dbUrl);
  return { prisma: t.prisma, setLatency: t.setLatency, ...createMoneyServices(t.prisma) };
}

const rejectionsOf = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason as unknown);

(url ? describe : describe.skip)('claims concurrency against PostgreSQL (E-admin-platform-14)', () => {
  jest.setTimeout(300_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];

  async function cleanup() {
    w.setLatency(0);
    await cleanupMoney(w.prisma, ids);
    ids.requestIds = [];
    ids.companyIds = [];
    allUserIds.push(...ids.userIds);
    ids.userIds = [];
  }
  afterEach(cleanup);
  afterAll(async () => {
    await sweepLateNotifications(w.prisma, allUserIds);
    await w.prisma.$disconnect();
  });

  async function firm(label: string): Promise<TestFirm> {
    const f = await makeFirm(w.prisma, w.credits, { label, lat: LAT, lng: LNG, grant: GRANT });
    ids.companyIds.push(f.companyId);
    ids.userIds.push(f.ownerId);
    return f;
  }

  async function clientWithRequest(): Promise<{ clientId: string; requestId: string }> {
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: COST, lat: LAT, lng: LNG });
    ids.requestIds.push(requestId);
    return { clientId, requestId };
  }

  const claim = (f: TestFirm, requestId: string) => w.claims.create(ownerCtx(f.companyId), f.ownerId, { requestId });
  const offer = (f: TestFirm, claimSlotId: string): Promise<QuoteDto> =>
    w.quotes.createQuote(ownerCtx(f.companyId), f.ownerId, {
      claimSlotId,
      price: 1000,
      description: 'E14 oferta',
    } as CreateQuoteInput);
  const withdrawVoluntary = (f: TestFirm, slotId: string) =>
    w.withdrawals.request(ownerCtx(f.companyId), f.ownerId, slotId, { reasonType: 'VOLUNTARY_NO_REASON' });

  it('(1) ultimele sloturi: exact maxClaims claim-uri reusesc, restul refuzate (plin / CONCURRENT_MODIFICATION), fara rezervari pierdute', async () => {
    const maxClaims = await w.settings.getInt('max_claims_per_request', SETTING_DEFAULTS.max_claims_per_request);
    const n = maxClaims + 3;
    let concurrentTotal = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const firms: TestFirm[] = [];
      for (let k = 0; k < n; k++) firms.push(await firm(`R${i}-${k}`));
      const { requestId } = await clientWithRequest();

      w.setLatency(20);
      const results = await Promise.allSettled(firms.map((f) => claim(f, requestId)));
      w.setLatency(0);

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const codes = rejectionsOf(results).map(errorLabel);
      concurrentTotal += codes.filter((c) => c === 'CONCURRENT_MODIFICATION').length;
      // CLAIM_NOT_ALLOWED = a ajuns la lock dupa ce cererea a devenit CLAIMED_FULL (statusul se
      // verifica inaintea numararii sloturilor, invarianta 3.1) — acelasi refuz legitim de "plin"
      for (const code of codes) expect(['CLAIM_SLOTS_FULL', 'CLAIM_NOT_ALLOWED', 'CONCURRENT_MODIFICATION']).toContain(code);
      // retry-ul la serialization failure nu trebuie sa infometeze claim-urile legitime
      expect(fulfilled).toBe(maxClaims);

      const occupying = await w.prisma.claimSlot.findMany({
        where: { requestId, status: { in: OCCUPYING_CLAIM_STATUSES } },
        select: { id: true, companyId: true },
      });
      expect(occupying).toHaveLength(maxClaims);
      const reserves = await w.prisma.creditTransaction.findMany({
        where: { claimSlotId: { in: occupying.map((s) => s.id) }, type: 'RESERVE' },
        select: { amount: true },
      });
      expect(reserves).toHaveLength(maxClaims);
      expect(reserves.reduce((sum, r) => sum + r.amount, 0)).toBe(maxClaims * COST);
      expect((await w.prisma.request.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('CLAIMED_FULL');

      const winners = new Set(occupying.map((s) => s.companyId));
      for (const f of firms) {
        if (!winners.has(f.companyId)) {
          const wallet = await w.prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId: f.companyId } });
          expect({ balance: wallet.balance, reserved: wallet.reserved }).toEqual({ balance: GRANT, reserved: 0 });
          expect(await w.prisma.creditTransaction.count({ where: { companyId: f.companyId, type: 'RESERVE' } })).toBe(0);
        }
        await assertLedgerBalanced(w.prisma, f.companyId);
      }
      await cleanup();
    }
    console.info(`(1) CONCURRENT_MODIFICATION in ${ITERATIONS} iteratii: ${concurrentTotal}`);
  });

  it('(2) aceeasi firma de doua ori in paralel → exact un claim, o singura rezervare', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    w.setLatency(20);
    const results = await Promise.allSettled([claim(a, requestId), claim(a, requestId)]);
    w.setLatency(0);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const e of rejectionsOf(results)) {
      expect(['CLAIM_ALREADY_EXISTS', 'CONCURRENT_MODIFICATION', 'MANAGER_UNASSIGNED_CAP_REACHED']).toContain(errorCode(e));
    }
    const slots = await w.prisma.claimSlot.findMany({ where: { requestId, companyId: a.companyId } });
    expect(slots).toHaveLength(1);
    expect(await reservesOf(w.prisma, slots[0].id)).toEqual({ count: 1, amount: COST });
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(3) doua accepturi paralele pe aceeasi cerere → exact unul reuseste, pierzatorul are un singur CONSUME', async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const [a, b] = [await firm(`A${i}`), await firm(`B${i}`)];
      const { clientId, requestId } = await clientWithRequest();
      const slotA = await claim(a, requestId);
      const slotB = await claim(b, requestId);
      const qA = await offer(a, slotA.id);
      const qB = await offer(b, slotB.id);
      expect((await w.prisma.request.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('OFFERS_RECEIVED');

      w.setLatency(20);
      const results = await Promise.allSettled([
        w.quotes.acceptQuote(clientId, qA.id, qA.versions[0].id),
        w.quotes.acceptQuote(clientId, qB.id, qB.versions[0].id),
      ]);
      w.setLatency(0);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const e of rejectionsOf(results)) {
        expect(errorStatus(e)).toBe(409);
        expect(['QUOTE_ACCEPT_NOT_ALLOWED', 'CONCURRENT_MODIFICATION']).toContain(errorCode(e));
      }
      expect(await w.prisma.quote.count({ where: { requestId, status: 'ACCEPTED' } })).toBe(1);
      const winnerSlot = results[0].status === 'fulfilled' ? slotA.id : slotB.id;
      const loserSlot = winnerSlot === slotA.id ? slotB.id : slotA.id;
      expect((await w.prisma.claimSlot.findUniqueOrThrow({ where: { id: winnerSlot } })).status).toBe('OFFER_SENT');
      expect(await settlementsOf(w.prisma, winnerSlot)).toEqual([]);
      expect((await w.prisma.claimSlot.findUniqueOrThrow({ where: { id: loserSlot } })).status).toBe('CANCELLED_REQUEST_ACCEPTED');
      expect(await settlementsOf(w.prisma, loserSlot)).toEqual(['CONSUME']);
      for (const f of [a, b]) await assertLedgerBalanced(w.prisma, f.companyId);
      await cleanup();
    }
  });

  it('(4) retragere dubla in gratie → una reuseste, cealalta 409, exact un REFUND', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);

    w.setLatency(20);
    const results = await Promise.allSettled([withdrawVoluntary(a, slot.id), withdrawVoluntary(a, slot.id)]);
    w.setLatency(0);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const e of rejectionsOf(results)) {
      expect(errorStatus(e)).toBe(409);
      expect(['CLAIM_NOT_WITHDRAWABLE', 'CONCURRENT_MODIFICATION']).toContain(errorCode(e));
    }
    expect(await settlementsOf(w.prisma, slot.id)).toEqual(['REFUND']);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(5) retragere B vs accept A → slotul B are exact o decontare (REFUND daca a castigat retragerea, CONSUME daca acceptul)', async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const [a, b] = [await firm(`A${i}`), await firm(`B${i}`)];
      const { clientId, requestId } = await clientWithRequest();
      const slotA = await claim(a, requestId);
      const slotB = await claim(b, requestId);
      const qA = await offer(a, slotA.id);
      await offer(b, slotB.id);

      w.setLatency(20);
      const [withdrawn, accepted] = await Promise.allSettled([
        withdrawVoluntary(b, slotB.id),
        w.quotes.acceptQuote(clientId, qA.id, qA.versions[0].id),
      ]);
      w.setLatency(0);

      // acceptul pe A e valid in ambele ordini (B nu ii inchide oferta)
      expect(accepted.status).toBe('fulfilled');
      expect((await w.prisma.claimSlot.findUniqueOrThrow({ where: { id: slotA.id } })).status).toBe('OFFER_SENT');
      expect(await settlementsOf(w.prisma, slotA.id)).toEqual([]);
      const settledB = await settlementsOf(w.prisma, slotB.id);
      if (withdrawn.status === 'fulfilled') {
        expect(settledB).toEqual(['REFUND']);
      } else {
        expect(errorStatus(withdrawn.reason)).toBe(409);
        expect(['CLAIM_NOT_WITHDRAWABLE', 'CONCURRENT_MODIFICATION']).toContain(errorCode(withdrawn.reason));
        expect(settledB).toEqual(['CONSUME']);
      }
      for (const f of [a, b]) await assertLedgerBalanced(w.prisma, f.companyId);
      await cleanup();
    }
  });
});
