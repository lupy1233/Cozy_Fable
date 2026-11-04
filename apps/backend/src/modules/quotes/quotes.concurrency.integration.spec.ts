import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { withIdempotentOperation } from '../../common/idempotency/idempotent-operation';
import { SettingsService } from '../../common/settings/settings.service';
import { CreditsService } from '../billing/credits.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import { OutboxService } from '../outbox/outbox.service';
import { QuotesService } from './quotes.service';
import { testDatabaseUrl } from '../../test/db-guard';

// E-company-2 — curse reale pe PostgreSQL (TEST_DATABASE_URL) si latenta simulata:
//  (a/b) createQuote vs un "inchizator" (SLA ratat / neatribuit) care tine lock-ul pe cerere;
//  (c)   createQuote vs acceptQuote al altei firme pe aceeasi cerere (10 iteratii, 30 ms/query);
//  (d)   extraVersion vs acceptQuote pe aceeasi oferta → ACCEPTED cu accepted_version_id = ultima
//        versiune, SAU (E-client-1) 409 QUOTE_VERSION_CHANGED cu oferta ramasa SENT;
//  (e)   withdrawQuote cu asignatul ocupat → 409, stare neschimbata;
//  (f)   E-client-1: accept cu id-ul unei versiuni vechi dupa revizie → 409, DB neschimbata;
//  latenta: ~150 ms/query (QUOTE_TEST_LATENCY_MS) → fara P2028, round-trip-uri in tx numarate.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY = 24 * 3600 * 1000;
const COST = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('quotes concurrency against PostgreSQL (E-company-2)', () => {
  jest.setTimeout(180_000);
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  let inTx = 0;
  let latencyMs = 0;
  // numara operatiile din tranzactii interactive si injecteaza latenta cross-region
  prisma.$use(async (params, next) => {
    if (params.runInTransaction) inTx++;
    if (latencyMs > 0) await sleep(latencyMs);
    return next(params);
  });
  const settings = new SettingsService(prisma);
  const credits = new CreditsService(prisma);
  const settlement = new ClaimSettlementService(credits);
  const outbox = new OutboxService(prisma, { publish: jest.fn() } as never);
  const calendar = { addWorkingDays: (d: Date, n: number) => new Date(d.getTime() + n * DAY) };
  const uploads = {
    listForEntities: async () => new Map(),
    relink: async () => [],
    toAttachmentDtos: async () => [],
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
  const service = new QuotesService(
    prisma,
    settings,
    outbox,
    calendar as never,
    uploads as never,
    settlement,
    queue as never,
    queue as never,
    queue as never,
    queue as never,
    queue as never,
  );

  interface Seed {
    clientId: string;
    requestId: string;
    companyA: string;
    ownerA: string;
    companyB: string;
    ownerB: string;
    slotA: string;
    extraRequestIds: string[];
  }
  const seeds: Seed[] = [];

  async function makeCompany(label: string) {
    const company = await prisma.company.create({
      data: {
        name: `EC2 ${label}`, cui: randomUUID(), regComNumber: 'test', addressText: 'test',
        county: 'test', city: 'test', lat: 0, lng: 0, status: 'APPROVED',
      },
    });
    const owner = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: `EC2 owner ${label}`, role: 'COMPANY_USER', passwordHash: 'test' },
    });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER' } });
    await prisma.companyOfferFieldPermission.createMany({
      data: (['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY'] as const).map((fieldKey) => ({
        companyId: company.id, role: 'OWNER' as const, fieldKey, canEdit: true,
      })),
    });
    await prisma.companyCreditWallet.create({ data: { companyId: company.id, balance: 10, reserved: 0 } });
    return { companyId: company.id, ownerId: owner.id };
  }

  async function makeRequest(clientId: string, status: 'CLAIMED_PARTIAL' | 'OFFERS_RECEIVED') {
    const r = await prisma.request.create({
      data: { clientUserId: clientId, status, title: 'EC2 test', includesPaidDesign: false, hasOwnProject: false },
    });
    return r.id;
  }

  // slot ocupant cu rezervarea lui (RESERVE) + thread de chat, ca la claim
  async function makeSlot(requestId: string, companyId: string, ownerId: string, opts: { assign?: boolean } = {}) {
    const slot = await prisma.claimSlot.create({
      data: {
        requestId, companyId, claimedByUserId: ownerId,
        assignedToUserId: opts.assign ? ownerId : null,
        status: 'ACTIVE', projectSizeSnapshot: 'SMALL', projectScoreSnapshot: 1,
        claimCostCreditsSnapshot: COST, slaDeadlineAt: new Date(Date.now() + 5 * DAY),
      },
    });
    await prisma.$transaction((tx) => credits.reserve(companyId, COST, 'CLAIM_RESERVE', slot.id, tx));
    await prisma.chatThread.create({ data: { claimSlotId: slot.id } });
    return slot.id;
  }

  async function seed(requestStatus: 'CLAIMED_PARTIAL' | 'OFFERS_RECEIVED' = 'CLAIMED_PARTIAL', assignA = false): Promise<Seed> {
    const client = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid`, name: 'EC2 client', role: 'CLIENT', passwordHash: 'test' },
    });
    const a = await makeCompany('A');
    const b = await makeCompany('B');
    const requestId = await makeRequest(client.id, requestStatus);
    const slotA = await makeSlot(requestId, a.companyId, a.ownerId, { assign: assignA });
    const s: Seed = {
      clientId: client.id, requestId, companyA: a.companyId, ownerA: a.ownerId,
      companyB: b.companyId, ownerB: b.ownerId, slotA, extraRequestIds: [],
    };
    seeds.push(s);
    return s;
  }

  async function cleanup(s: Seed) {
    const requestIds = [s.requestId, ...s.extraRequestIds];
    await prisma.domainEventOutbox.deleteMany({
      where: { OR: requestIds.map((id) => ({ payload: { path: ['requestId'], equals: id } })) },
    });
    await prisma.request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.company.deleteMany({ where: { id: { in: [s.companyA, s.companyB] } } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: [s.ownerA, s.ownerB, s.clientId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [s.clientId, s.ownerA, s.ownerB] } } });
  }

  afterEach(async () => {
    latencyMs = 0;
    while (seeds.length) await cleanup(seeds.pop() as Seed);
  });
  afterAll(async () => prisma.$disconnect());

  const ctxOf = (companyId: string): Any => ({ companyId, memberRole: 'OWNER', status: 'APPROVED' });
  const offer = (claimSlotId: string): Any => ({ claimSlotId, price: 1000, description: 'EC2 oferta' });

  async function settlementsOf(slotId: string) {
    return prisma.creditTransaction.findMany({
      where: { claimSlotId: slotId, type: { in: ['REFUND', 'CONSUME'] } },
      select: { type: true },
    });
  }

  async function assertLedgerSane(companyIds: string[]) {
    const wallets = await prisma.companyCreditWallet.findMany({ where: { companyId: { in: companyIds } } });
    for (const w of wallets) expect(w.reserved).toBeGreaterThanOrEqual(0);
  }

  // Inchizator concurent: tine FOR UPDATE pe cerere, inchide slotul conditionat si deconteaza,
  // apoi asteapta pana e eliberat (commit).
  function holdCloser(s: Seed, closedStatus: 'SLA_EXPIRED' | 'CANCELLED_UNASSIGNED', settle: 'consume' | 'refund') {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let signalLocked!: () => void;
    const locked = new Promise<void>((r) => (signalLocked = r));
    const done = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM requests WHERE id = ${s.requestId} FOR UPDATE`;
        // E-admin-platform-15: inchizatorul trece prin calea unica de decontare
        await settlement.settle(tx, {
          claimSlotId: s.slotA,
          from: ['ACTIVE'],
          to: closedStatus,
          outcome: settle === 'consume' ? 'CONSUME' : 'REFUND',
          reason: settle === 'consume' ? 'SLA_BREACH' : 'CLAIM_AUTO_CANCEL_UNASSIGNED',
          quotes: 'KEEP',
        });
        signalLocked();
        await gate;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
    return { locked, release, done };
  }

  it.each([
    ['SLA_EXPIRED', 'consume', 'CONSUME'],
    ['CANCELLED_UNASSIGNED', 'refund', 'REFUND'],
  ] as const)('(a/b) createQuote vs inchizator %s tinut pe lock → 409 QUOTE_ALREADY_SENT, o singura decontare', async (closedStatus, settle, txType) => {
    const s = await seed();
    const closer = holdCloser(s, closedStatus, settle);
    await closer.locked;
    const create = service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA));
    const outcome = create.then(() => 'ok', (e) => e);
    await sleep(500); // createQuote ajunge sa astepte lock-ul pe cerere
    closer.release();
    await closer.done;
    const err: Any = await outcome;
    expect(err?.response?.code).toBe('QUOTE_ALREADY_SENT');
    expect(await prisma.quote.count({ where: { claimSlotId: s.slotA } })).toBe(0);
    const slot = await prisma.claimSlot.findUniqueOrThrow({ where: { id: s.slotA } });
    expect(slot.status).toBe(closedStatus);
    expect(slot.quoteId).toBeNull();
    const settled = await settlementsOf(s.slotA);
    expect(settled).toEqual([{ type: txType }]);
    await assertLedgerSane([s.companyA]);
  });

  it('(c) createQuote vs acceptQuote al altei firme, 10 iteratii cu 30 ms/query', async () => {
    for (let i = 0; i < 10; i++) {
      const s = await seed('OFFERS_RECEIVED');
      const slotB = await makeSlot(s.requestId, s.companyB, s.ownerB);
      const quoteB = await service.createQuote(ctxOf(s.companyB), s.ownerB, offer(slotB));
      latencyMs = 30;
      const [created, accepted] = await Promise.allSettled([
        service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA)),
        service.acceptQuote(s.clientId, quoteB.id, quoteB.versions[0].id),
      ]);
      latencyMs = 0;
      expect(accepted.status).toBe('fulfilled');
      if (created.status === 'rejected') {
        expect((created.reason as Any).response?.code).toMatch(/QUOTE_ALREADY_SENT|REQUEST_NOT_OPEN_FOR_OFFERS/);
      }
      const request = await prisma.request.findUniqueOrThrow({ where: { id: s.requestId } });
      expect(request.status).toBe('ACCEPTED');
      const slots = await prisma.claimSlot.findMany({ where: { requestId: s.requestId } });
      for (const slot of slots) {
        if (slot.id === slotB) continue; // castigatorul ramane OFFER_SENT
        expect(slot.status).toBe('CANCELLED_REQUEST_ACCEPTED');
        expect((await settlementsOf(slot.id)).length).toBe(1);
      }
      expect(await prisma.quote.count({ where: { requestId: s.requestId, status: { in: ['SENT', 'EXPIRED'] } } })).toBe(0);
      await assertLedgerSane([s.companyA, s.companyB]);
      await cleanup(seeds.pop() as Seed);
    }
  });

  it('(d) extraVersion vs acceptQuote pe aceeasi oferta → ACCEPTED pe ultima versiune sau 409 QUOTE_VERSION_CHANGED', async () => {
    const s = await seed();
    const q = await service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA));
    let v3Id = '';
    for (const v of [2, 3]) {
      const row = await prisma.quoteVersion.create({
        data: {
          quoteId: q.id, version: v, price: 900, description: `v${v}`,
          validUntil: new Date(Date.now() + 10 * DAY), createdByUserId: s.ownerA,
        },
      });
      v3Id = row.id;
    }
    latencyMs = 20;
    const [extra, accepted] = await Promise.allSettled([
      service.extraVersion(ctxOf(s.companyA), s.ownerA, q.id, { price: 800, description: 'extra' } as Any),
      service.acceptQuote(s.clientId, q.id, v3Id),
    ]);
    latencyMs = 0;
    const final = await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { versions: true } });
    const latest = final.versions.reduce((a, b) => (b.version > a.version ? b : a));
    if (accepted.status === 'fulfilled') {
      // acceptul a castigat lock-ul: versiunea extra e refuzata
      expect(extra.status).toBe('rejected');
      expect(((extra as PromiseRejectedResult).reason as Any).response?.code).toMatch(/QUOTE_NOT_MODIFIABLE|REQUEST_NOT_OPEN_FOR_OFFERS/);
      expect(final.status).toBe('ACCEPTED');
      expect(final.acceptedVersionId).toBe(v3Id);
    } else {
      // versiunea extra a castigat: clientul nu accepta un pret pe care nu l-a vazut
      expect((accepted.reason as Any).response?.code).toBe('QUOTE_VERSION_CHANGED');
      expect(final.status).toBe('SENT');
      expect(final.versions).toHaveLength(4);
      expect(final.acceptedVersionId).toBeNull();
      const slotIds = (await prisma.claimSlot.findMany({ where: { requestId: s.requestId }, select: { id: true } })).map((x) => x.id);
      const txs = await prisma.creditTransaction.count({
        where: { claimSlotId: { in: slotIds }, type: { in: ['REFUND', 'CONSUME'] } },
      });
      expect(txs).toBe(0);
    }
    // niciodata ACCEPTED cu o versiune mai noua decat cea acceptata
    if (final.status === 'ACCEPTED') expect(latest.id).toBe(final.acceptedVersionId);
  });

  it('(f) E-client-1: accept cu versiunea veche dupa revizie → 409 QUOTE_VERSION_CHANGED, DB neschimbata', async () => {
    const s = await seed();
    const q = await service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA));
    const v1 = q.versions[0].id;
    const change = await prisma.quoteChangeRequest.create({
      data: { quoteVersionId: v1, clientUserId: s.clientId, requestedText: 'mai ieftin' },
    });
    const revised = await service.reviseQuote(ctxOf(s.companyA), s.ownerA, q.id, {
      changeRequestId: change.id, price: 900, description: 'v2',
    } as Any);
    const v2 = revised.versions.find((v) => v.version === 2)!.id;
    const requestBefore = await prisma.request.findUniqueOrThrow({ where: { id: s.requestId } });
    const slotsBefore = await prisma.claimSlot.findMany({ where: { requestId: s.requestId }, orderBy: { id: 'asc' } });

    const err: Any = await service.acceptQuote(s.clientId, q.id, v1).catch((e) => e);
    expect(err?.status).toBe(409);
    expect(err?.response).toMatchObject({ code: 'QUOTE_VERSION_CHANGED', details: { currentVersionId: v2, currentVersion: 2 } });

    const final = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(final).toMatchObject({ status: 'SENT', acceptedVersionId: null, acceptedAt: null });
    expect((await prisma.request.findUniqueOrThrow({ where: { id: s.requestId } })).status).toBe(requestBefore.status);
    const slotsAfter = await prisma.claimSlot.findMany({ where: { requestId: s.requestId }, orderBy: { id: 'asc' } });
    expect(slotsAfter.map((x) => x.status)).toEqual(slotsBefore.map((x) => x.status));
    expect(await settlementsOf(s.slotA)).toEqual([]);
  });

  it('(e) withdrawQuote cu asignatul ocupat → 409 ASSIGNED_USER_HAS_ACTIVE_CLAIM, stare neschimbata', async () => {
    const s = await seed('CLAIMED_PARTIAL', true);
    const q = await service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA));
    // al doilea claim ACTIVE fara oferta al aceluiasi asignat (permis: primul are oferta)
    const otherRequest = await makeRequest(s.clientId, 'CLAIMED_PARTIAL');
    s.extraRequestIds.push(otherRequest);
    const busySlot = await makeSlot(otherRequest, s.companyA, s.ownerA, { assign: true });

    const err: Any = await service.withdrawQuote(ctxOf(s.companyA), q.id).catch((e) => e);
    expect(err?.response).toMatchObject({
      code: 'ASSIGNED_USER_HAS_ACTIVE_CLAIM',
      details: { busyClaimSlotId: busySlot },
    });
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('SENT');
    const slot = await prisma.claimSlot.findUniqueOrThrow({ where: { id: s.slotA } });
    expect(slot).toMatchObject({ status: 'OFFER_SENT', quoteId: q.id });
  });

  it('extraVersion dupa withdraw → 409 QUOTE_NOT_MODIFIABLE, oferta ramane WITHDRAWN', async () => {
    const s = await seed();
    const q = await service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA));
    await service.withdrawQuote(ctxOf(s.companyA), q.id);
    const err: Any = await service.extraVersion(ctxOf(s.companyA), s.ownerA, q.id, { price: 1, description: 'x' } as Any).catch((e) => e);
    expect(err?.response?.code).toBe('QUOTE_NOT_MODIFIABLE');
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('WITHDRAWN');
    // slotul redevine ACTIVE, fara decontare
    expect((await prisma.claimSlot.findUniqueOrThrow({ where: { id: s.slotA } })).status).toBe('ACTIVE');
    expect(await settlementsOf(s.slotA)).toEqual([]);
  });

  it('latenta cross-region: createQuote ≤ 12 si reviseQuote ≤ 13 round-trip-uri in tx, fara P2028', async () => {
    const s = await seed();
    const latency = Number(process.env.QUOTE_TEST_LATENCY_MS ?? 150);
    const receipt = async (endpoint: string) =>
      (await prisma.idempotencyKey.create({
        data: {
          key: randomUUID(), endpoint, userId: s.ownerA, requestHash: 'test',
          responseStatus: 0, responseBody: {}, expiresAt: new Date('9999-12-31'),
        },
      })).id;

    const createReceipt = await receipt('POST /quotes');
    inTx = 0;
    latencyMs = latency;
    const q = await withIdempotentOperation({ receiptId: createReceipt, responseStatus: 201, transactional: true }, () =>
      service.createQuote(ctxOf(s.companyA), s.ownerA, offer(s.slotA)),
    );
    latencyMs = 0;
    const createRt = inTx;
    console.info('createQuote in-tx RT', createRt);
    expect(createRt).toBeLessThanOrEqual(12);
    const saved = await prisma.idempotencyKey.findUniqueOrThrow({ where: { id: createReceipt } });
    expect(saved.responseStatus).toBe(201);
    expect((saved.responseBody as Any).id).toBe(q.id);

    const version = await prisma.quoteVersion.findFirstOrThrow({ where: { quoteId: q.id } });
    const change = await prisma.quoteChangeRequest.create({
      data: { quoteVersionId: version.id, clientUserId: s.clientId, requestedText: 'mai ieftin' },
    });
    const reviseReceipt = await receipt('POST /quotes/:id/revise');
    inTx = 0;
    latencyMs = latency;
    const revised = await withIdempotentOperation({ receiptId: reviseReceipt, responseStatus: 201, transactional: true }, () =>
      service.reviseQuote(ctxOf(s.companyA), s.ownerA, q.id, { changeRequestId: change.id, price: 950, description: 'v2' } as Any),
    );
    latencyMs = 0;
    const reviseRt = inTx;
    console.info('reviseQuote in-tx RT', reviseRt);
    expect(reviseRt).toBeLessThanOrEqual(13);
    expect(revised.versions.map((v) => v.version)).toEqual([1, 2]);
  });
});
