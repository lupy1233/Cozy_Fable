import { randomUUID } from 'node:crypto';
import type { CreateQuoteInput, QuoteDto } from '@marketplace/shared';
import { IdempotentReplay, withIdempotentOperation } from '../../common/idempotency/idempotent-operation';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  assertLedgerBalanced,
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
import { createMoneyServices, errorCode, ownerCtx } from '../../test/money-services';

// a4 (2026-11-13) — refuzul ofertei pe PostgreSQL REAL (TEST_DATABASE_URL local, garda db-guard).
// Bani: fiecare loc se deconteaza EXACT o data, oricine castiga cursa. Cazuri:
//  (a) refuz simplu: DECLINED, slot OFFER_DECLINED, un CONSUME, chat read-only, mesaj de sistem,
//      excludere, cererea CLAIMED_PARTIAL; locul eliberat se preia de alta firma; firma refuzata
//      nu mai poate prelua; verificarea zilnica de registru (ledger-check) curata;
//  (b) doua refuzuri in paralel, chei DIFERITE → un refuz, un 409, o singura miscare;
//  (c) doua refuzuri in paralel, ACEEASI cheie → unul comite, celalalt e replay, o miscare;
//  (d) refuz ‖ acceptarea ACELEIASI oferte → exact unul castiga, o decontare per slot;
//  (e) refuz ‖ acceptarea ALTEI oferte de pe aceeasi cerere → fiecare slot decontat o data;
//  (f) refuz dupa retragerea ofertei / pe oferta acceptata → 409 QUOTE_NOT_DECLINABLE.

const COST = 2;
const GRANT = 20;
const LAT = 44.4268;
const LNG = 26.1025;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma, setLatency } = createTestPrisma(dbUrl);
  return { prisma, setLatency, ...createMoneyServices(prisma) };
}

(url ? describe : describe.skip)('quote decline on PostgreSQL (a4)', () => {
  jest.setTimeout(180_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];
  // a1 (PO 2026-11-13): cererea ramane preluabila dupa prima oferta (implicit true in productie;
  // baza de test poate avea valoarea veche) — refuzul elibereaza un loc care se poate prelua
  const KEY = 'claims_open_after_first_offer';
  let previous: string | null = null;

  beforeAll(async () => {
    if (!url) return;
    previous = (await w.prisma.systemSetting.findUnique({ where: { key: KEY } }))?.value ?? null;
    await w.prisma.systemSetting.upsert({ where: { key: KEY }, update: { value: 'true' }, create: { key: KEY, value: 'true' } });
  });

  afterEach(async () => {
    w.setLatency(0);
    await w.prisma.idempotencyKey.deleteMany({ where: { userId: { in: ids.userIds } } });
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
      description: 'a4 oferta',
      vatMode: 'VAT_INCLUDED',
      deliveryTermValue: 6,
      deliveryTermUnit: 'WEEKS',
      warrantyMonths: 24,
      includesTransport: true,
      includesAssembly: true,
    } as CreateQuoteInput);

  async function quoted(f: TestFirm, requestId: string) {
    const slot = await claim(f, requestId);
    const quote = await offer(f, slot.id);
    return { slotId: slot.id, quote };
  }

  const slotStatus = async (id: string) => (await w.prisma.claimSlot.findUniqueOrThrow({ where: { id } })).status;
  const quoteStatus = async (id: string) => (await w.prisma.quote.findUniqueOrThrow({ where: { id } })).status;
  const requestStatus = async (id: string) => (await w.prisma.request.findUniqueOrThrow({ where: { id } })).status;
  const reasonsOf = async (slotId: string) =>
    (
      await w.prisma.creditTransaction.findMany({
        where: { claimSlotId: slotId, type: { in: ['REFUND', 'CONSUME'] } },
        select: { type: true, reason: true },
      })
    ).map((t) => `${t.type}:${t.reason}`);

  async function assertLedgerCheckClean(companyIds: string[], slotIds: string[]) {
    const report = await w.ledgerCheck.check();
    expect(report.walletMismatches.filter((m) => companyIds.includes(m.companyId))).toEqual([]);
    expect(report.unsettledTerminalSlots.filter((s) => slotIds.includes(s.claimSlotId))).toEqual([]);
    expect(report.openSlotsWithSettlement.filter((s) => slotIds.includes(s.claimSlotId))).toEqual([]);
  }

  async function receipt(userId: string): Promise<string> {
    const row = await w.prisma.idempotencyKey.create({
      data: {
        key: randomUUID(), endpoint: 'POST /client/quotes/:id/decline', userId, requestHash: 'test',
        responseStatus: 0, responseBody: {}, expiresAt: new Date('9999-12-31'),
      },
    });
    return row.id;
  }

  it('(a) refuz: DECLINED, slot inchis cu un CONSUME, chat read-only + mesaj de sistem, locul se preia de alta firma, firma refuzata exclusa, registru curat', async () => {
    const a = await firm('A');
    const b = await firm('B');
    const c = await firm('C');
    const { clientId, requestId } = await clientWithRequest();
    const { slotId: slotA, quote: qa } = await quoted(a, requestId);
    const { slotId: slotB } = await quoted(b, requestId);

    const out = await w.quotes.declineQuote(clientId, qa.id, { reason: 'DELIVERY_TERM', note: 'Termenul e prea lung' });
    expect(out).toMatchObject({ status: 'DECLINED', declineReason: 'DELIVERY_TERM', declineNote: 'Termenul e prea lung' });

    expect(await quoteStatus(qa.id)).toBe('DECLINED');
    expect(await slotStatus(slotA)).toBe('OFFER_DECLINED');
    expect(await reasonsOf(slotA)).toEqual(['CONSUME:OFFER_DECLINED']);
    expect(await settlementsOf(w.prisma, slotB)).toEqual([]);
    const thread = await w.prisma.chatThread.findUniqueOrThrow({ where: { claimSlotId: slotA } });
    expect(thread.readOnly).toBe(true);
    const system = await w.prisma.message.findMany({ where: { chatThreadId: thread.id, systemKind: 'QUOTE_DECLINED' } });
    expect(system).toHaveLength(1);
    expect(system[0]).toMatchObject({ senderUserId: clientId, body: 'Termenul e prea lung' });
    expect(system[0].systemPayload).toMatchObject({ quoteId: qa.id, reason: 'DELIVERY_TERM' });
    expect(await w.prisma.domainEventOutbox.count({ where: { eventKey: `quote.declined:${qa.id}` } })).toBe(1);
    // B are inca o oferta vie → cererea ramane in negociere (OFFERS_RECEIVED)
    expect(await requestStatus(requestId)).toBe('OFFERS_RECEIVED');

    // locul eliberat se preia de alta firma cat cererea e deschisa
    const slotC = await claim(c, requestId);
    expect(slotC.status).toBe('ACTIVE');
    // firma refuzata nu mai preia aceeasi cerere (refuz definitiv)
    const again = await claim(a, requestId).catch((e) => e);
    expect(errorCode(again)).toBe('COMPANY_EXCLUDED_FROM_REQUEST');

    // al doilea refuz pe aceeasi oferta → 409, registrul neschimbat
    const second = await w.quotes.declineQuote(clientId, qa.id).catch((e) => e);
    expect(errorCode(second)).toBe('QUOTE_NOT_DECLINABLE');
    expect(await reasonsOf(slotA)).toEqual(['CONSUME:OFFER_DECLINED']);

    for (const f of [a, b, c]) await assertLedgerBalanced(w.prisma, f.companyId);
    await assertLedgerCheckClean([a.companyId, b.companyId, c.companyId], [slotA, slotB, slotC.id]);
  });

  it('(a2) refuzul singurei oferte, fara alti ocupanti → cererea revine in piata (IN_MARKETPLACE)', async () => {
    const a = await firm('A');
    const { clientId, requestId } = await clientWithRequest();
    const { slotId, quote } = await quoted(a, requestId);
    await w.quotes.declineQuote(clientId, quote.id);
    expect(await requestStatus(requestId)).toBe('IN_MARKETPLACE');
    expect(await settlementsOf(w.prisma, slotId)).toEqual(['CONSUME']);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(b) doua refuzuri in paralel, chei diferite → un refuz, un 409, o singura miscare de credite', async () => {
    const a = await firm('A');
    const { clientId, requestId } = await clientWithRequest();
    const { slotId, quote } = await quoted(a, requestId);
    const [r1, r2] = [await receipt(clientId), await receipt(clientId)];
    w.setLatency(20);
    const results = await Promise.allSettled([
      withIdempotentOperation({ receiptId: r1, responseStatus: 201, transactional: true }, () => w.quotes.declineQuote(clientId, quote.id)),
      withIdempotentOperation({ receiptId: r2, responseStatus: 201, transactional: true }, () => w.quotes.declineQuote(clientId, quote.id)),
    ]);
    w.setLatency(0);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(errorCode(failed[0].reason)).toMatch(/QUOTE_NOT_DECLINABLE|CONCURRENT_MODIFICATION/);
    expect(await settlementsOf(w.prisma, slotId)).toEqual(['CONSUME']);
    expect(await slotStatus(slotId)).toBe('OFFER_DECLINED');
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(c) doua refuzuri in paralel, aceeasi cheie → unul comite, celalalt e replay, o miscare', async () => {
    const a = await firm('A');
    const { clientId, requestId } = await clientWithRequest();
    const { slotId, quote } = await quoted(a, requestId);
    const r = await receipt(clientId);
    w.setLatency(20);
    const results = await Promise.allSettled([1, 2].map(() =>
      withIdempotentOperation({ receiptId: r, responseStatus: 201, transactional: true }, () => w.quotes.declineQuote(clientId, quote.id)),
    ));
    w.setLatency(0);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((x): x is PromiseRejectedResult => x.status === 'rejected');
    // al doilea: replay al chitantei (interceptorul raspunde cu corpul salvat) sau 409 la fast-fail
    expect(rejected?.reason instanceof IdempotentReplay || errorCode(rejected?.reason) === 'QUOTE_NOT_DECLINABLE').toBe(true);
    const saved = await w.prisma.idempotencyKey.findUniqueOrThrow({ where: { id: r } });
    expect(saved.responseStatus).toBe(201);
    expect((saved.responseBody as { status?: string }).status).toBe('DECLINED');
    expect(await settlementsOf(w.prisma, slotId)).toEqual(['CONSUME']);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(d) refuz ‖ acceptarea aceleiasi oferte (10 iteratii) → exact unul castiga, o decontare per slot', async () => {
    for (let i = 0; i < 10; i++) {
      const a = await firm(`A${i}`);
      const b = await firm(`B${i}`);
      const { clientId, requestId } = await clientWithRequest();
      const { slotId: slotA, quote: qa } = await quoted(a, requestId);
      const { slotId: slotB } = await quoted(b, requestId);
      w.setLatency(i % 2 === 0 ? 15 : 0);
      const [declined, accepted] = await Promise.allSettled([
        w.quotes.declineQuote(clientId, qa.id),
        w.quotes.acceptQuote(clientId, qa.id, qa.versions[0].id),
      ]);
      w.setLatency(0);
      expect([declined.status, accepted.status].filter((s) => s === 'fulfilled')).toHaveLength(1);
      if (declined.status === 'fulfilled') {
        expect(errorCode((accepted as PromiseRejectedResult).reason)).toMatch(/QUOTE_ACCEPT_NOT_ALLOWED|CONCURRENT_MODIFICATION/);
        expect(await quoteStatus(qa.id)).toBe('DECLINED');
        expect(await settlementsOf(w.prisma, slotA)).toEqual(['CONSUME']);
        expect(await settlementsOf(w.prisma, slotB)).toEqual([]);
      } else {
        expect(errorCode((declined as PromiseRejectedResult).reason)).toMatch(/QUOTE_NOT_DECLINABLE|CONCURRENT_MODIFICATION/);
        expect(await quoteStatus(qa.id)).toBe('ACCEPTED');
        // castigatorul ramane deschis (fara decontare pana la finalizare), pierzatorul consumat o data
        expect(await settlementsOf(w.prisma, slotA)).toEqual([]);
        expect(await settlementsOf(w.prisma, slotB)).toEqual(['CONSUME']);
      }
      for (const f of [a, b]) await assertLedgerBalanced(w.prisma, f.companyId);
    }
  });

  it('(e) refuz ‖ acceptarea ALTEI oferte de pe aceeasi cerere (10 iteratii) → fiecare slot decontat exact o data', async () => {
    for (let i = 0; i < 10; i++) {
      const a = await firm(`A${i}`);
      const b = await firm(`B${i}`);
      const { clientId, requestId } = await clientWithRequest();
      const { slotId: slotA, quote: qa } = await quoted(a, requestId);
      const { slotId: slotB, quote: qb } = await quoted(b, requestId);
      w.setLatency(i % 2 === 0 ? 15 : 0);
      const [declined, accepted] = await Promise.allSettled([
        w.quotes.declineQuote(clientId, qa.id),
        w.quotes.acceptQuote(clientId, qb.id, qb.versions[0].id),
      ]);
      w.setLatency(0);
      expect(accepted.status).toBe('fulfilled');
      expect(await requestStatus(requestId)).toBe('ACCEPTED');
      if (declined.status === 'fulfilled') {
        expect(await quoteStatus(qa.id)).toBe('DECLINED');
        expect(await slotStatus(slotA)).toBe('OFFER_DECLINED');
        expect(await reasonsOf(slotA)).toEqual(['CONSUME:OFFER_DECLINED']);
      } else {
        // acceptul a comis primul: oferta A e SUPERSEDED, slotul inchis ca pierzator
        expect(errorCode(declined.reason)).toMatch(/QUOTE_NOT_DECLINABLE|CONCURRENT_MODIFICATION/);
        expect(await quoteStatus(qa.id)).toBe('SUPERSEDED');
        expect(await slotStatus(slotA)).toBe('CANCELLED_REQUEST_ACCEPTED');
        expect(await reasonsOf(slotA)).toEqual(['CONSUME:OFFER_LOST']);
      }
      expect(await settlementsOf(w.prisma, slotB)).toEqual([]);
      for (const f of [a, b]) await assertLedgerBalanced(w.prisma, f.companyId);
    }
  });

  it('(f) refuz dupa retragerea ofertei sau pe oferta acceptata → 409 QUOTE_NOT_DECLINABLE, fara miscari', async () => {
    const a = await firm('A');
    const b = await firm('B');
    const { clientId, requestId } = await clientWithRequest();
    const { slotId: slotA, quote: qa } = await quoted(a, requestId);
    const { quote: qb } = await quoted(b, requestId);
    await w.quotes.withdrawQuote(ownerCtx(a.companyId), qa.id);
    expect(errorCode(await w.quotes.declineQuote(clientId, qa.id).catch((e) => e))).toBe('QUOTE_NOT_DECLINABLE');
    expect(await settlementsOf(w.prisma, slotA)).toEqual([]);
    expect(await slotStatus(slotA)).toBe('ACTIVE');

    await w.quotes.acceptQuote(clientId, qb.id, qb.versions[0].id);
    expect(errorCode(await w.quotes.declineQuote(clientId, qb.id).catch((e) => e))).toBe('QUOTE_NOT_DECLINABLE');
    expect(await quoteStatus(qb.id)).toBe('ACCEPTED');
    for (const f of [a, b]) await assertLedgerBalanced(w.prisma, f.companyId);
  });

  // revizuire m1: curse rulate chiar in paralel (Promise.allSettled porneste ambele tranzactii
  // deodata), repetate; latenta alternativa ca ambele sa treaca de verificarea rapida.
  it('(g) refuz ‖ stergerea cererii de catre client (8 iteratii) → pe loc exact una dintre REFUND si CONSUME', async () => {
    for (let i = 0; i < 8; i++) {
      const a = await firm(`A${i}`);
      const { clientId, requestId } = await clientWithRequest();
      const { slotId, quote } = await quoted(a, requestId);
      w.setLatency(i % 2 === 0 ? 15 : 0);
      const [declined, deleted] = await Promise.allSettled([
        w.quotes.declineQuote(clientId, quote.id),
        w.requests.deleteForClient(clientId, requestId),
      ]);
      w.setLatency(0);
      const settled = await settlementsOf(w.prisma, slotId);
      // niciodata amandoua, niciodata niciuna
      expect(settled).toHaveLength(1);
      if (declined.status === 'fulfilled') {
        expect(settled).toEqual(['CONSUME']);
        expect(await slotStatus(slotId)).toBe('OFFER_DECLINED');
        expect(await quoteStatus(quote.id)).toBe('DECLINED');
      } else {
        expect(errorCode(declined.reason)).toMatch(/NOT_FOUND|QUOTE_NOT_DECLINABLE|CONCURRENT_MODIFICATION/);
        expect(deleted.status).toBe('fulfilled');
        expect(settled).toEqual(['REFUND']);
        expect(await slotStatus(slotId)).toBe('CANCELLED_BY_CLIENT');
      }
      await assertLedgerBalanced(w.prisma, a.companyId);
    }
  });

  it('(h) refuz ‖ retragerea voluntara a firmei din preluare (8 iteratii) → pe loc exact o decontare', async () => {
    for (let i = 0; i < 8; i++) {
      const a = await firm(`A${i}`);
      const { clientId, requestId } = await clientWithRequest();
      const { slotId, quote } = await quoted(a, requestId);
      w.setLatency(i % 2 === 0 ? 15 : 0);
      const [declined, withdrawn] = await Promise.allSettled([
        w.quotes.declineQuote(clientId, quote.id),
        w.withdrawals.request(ownerCtx(a.companyId), a.ownerId, slotId, { reasonType: 'VOLUNTARY_NO_REASON' }),
      ]);
      w.setLatency(0);
      const settled = await settlementsOf(w.prisma, slotId);
      expect(settled).toHaveLength(1);
      expect([declined.status, withdrawn.status].filter((s) => s === 'fulfilled')).toHaveLength(1);
      if (declined.status === 'fulfilled') {
        expect(settled).toEqual(['CONSUME']);
        expect(await slotStatus(slotId)).toBe('OFFER_DECLINED');
        expect(errorCode((withdrawn as PromiseRejectedResult).reason)).toMatch(/CLAIM_NOT_WITHDRAWABLE|CONCURRENT_MODIFICATION/);
      } else {
        // retragerea in gratia de 30 min → REFUND, oferta WITHDRAWN
        expect(errorCode(declined.reason)).toMatch(/QUOTE_NOT_DECLINABLE|CONCURRENT_MODIFICATION/);
        expect(settled).toEqual(['REFUND']);
        expect(await slotStatus(slotId)).toBe('WITHDRAWN_VOLUNTARY');
        expect(await quoteStatus(quote.id)).toBe('WITHDRAWN');
      }
      await assertLedgerBalanced(w.prisma, a.companyId);
    }
  });
});