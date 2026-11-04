import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import type { CreateQuoteInput, QuoteDto } from '@marketplace/shared';
import { runTx } from '../../infra/prisma/tx';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  assertLedgerBalanced,
  backdate,
  backdateRequest,
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
import { createMoneyServices, errorCode, errorStatus, ownerCtx } from '../../test/money-services';
import { SLA_GRACE_MS } from './claims.constants';
import type { ClaimAssignJob } from './claim-assign.processor';
import type { SlaBreachJob } from './sla-breach.processor';

// E-admin-platform-14 — drumurile banilor pe PostgreSQL REAL (TEST_DATABASE_URL local, garda
// db-guard). Fiecare caz ia claim prin ClaimsService.create (RESERVE din codul de productie) si
// se termina cu assertLedgerBalanced: portofel = ledger, fiecare RESERVE are exact o decontare
// cand slotul e inchis. Regulile (IMPACT credite pct. 3, D-L0-3, pay-to-play):
//  retragere < 30 min → REFUND; ≥ 30 min → CONSUME + VOLUNTARY_WITHDRAWAL; neatribuit 1h →
//  REFUND; SLA ratat → CONSUME + SLA_MISS; accept: pierzator cu oferta → CONSUME, fara oferta →
//  REFUND; castigator → CONSUME la COMPLETED; stergerea cererii → REFUND pe toate sloturile deschise.
// Timpul se simuleaza prin coloane mutate in trecut (fara fake timers: Postgres merge pe timp real).

const DAY = 24 * 3600 * 1000;
const MIN = 60_000;
const COST = 2;
const GRANT = 20;
const LAT = 44.4268;
const LNG = 26.1025;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma } = createTestPrisma(dbUrl);
  return { prisma, ...createMoneyServices(prisma) };
}

(url ? describe : describe.skip)('credit settlement on PostgreSQL (E-admin-platform-14)', () => {
  jest.setTimeout(180_000);
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

  const wallet = async (companyId: string) => {
    const row = await w.prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId } });
    return { balance: row.balance, reserved: row.reserved };
  };
  const slotStatus = async (id: string) => (await w.prisma.claimSlot.findUniqueOrThrow({ where: { id } })).status;
  const requestStatus = async (id: string) => (await w.prisma.request.findUniqueOrThrow({ where: { id } })).status;
  const settlementReasons = async (slotId: string) =>
    (
      await w.prisma.creditTransaction.findMany({
        where: { claimSlotId: slotId, type: { in: ['REFUND', 'CONSUME'] } },
        select: { type: true, reason: true },
      })
    ).map((t) => `${t.type}:${t.reason}`);
  const penaltyEventsOf = (claimSlotId: string, ruleKey: string) =>
    w.prisma.penaltyEvent.count({ where: { claimSlotId, ruleKey } });

  it('(a) claim → slot ACTIVE, un RESERVE din productie, portofel 18/2, cerere CLAIMED_PARTIAL, intentie outbox', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);

    expect(slot.status).toBe('ACTIVE');
    expect(slot.claimCostCreditsSnapshot).toBe(COST);
    expect(await reservesOf(w.prisma, slot.id)).toEqual({ count: 1, amount: COST });
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT - COST, reserved: COST });
    expect(await requestStatus(requestId)).toBe('CLAIMED_PARTIAL');
    expect(await w.prisma.domainEventOutbox.count({ where: { eventKey: `claim.created:${slot.id}` } })).toBe(1);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(b1) retragere voluntara < 30 min → un REFUND, portofel 20/0, cererea revine IN_MARKETPLACE', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);

    await w.withdrawals.request(ownerCtx(a.companyId), a.ownerId, slot.id, { reasonType: 'VOLUNTARY_NO_REASON' });

    expect(await settlementsOf(w.prisma, slot.id)).toEqual(['REFUND']);
    expect(await slotStatus(slot.id)).toBe('WITHDRAWN_VOLUNTARY');
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT, reserved: 0 });
    expect(await requestStatus(requestId)).toBe('IN_MARKETPLACE');
    expect(await penaltyEventsOf(slot.id, 'VOLUNTARY_WITHDRAWAL')).toBe(0);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(b2+b3) retragere voluntara ≥ 30 min → un CONSUME (+ penalizare daca regula are puncte); a doua retragere → 409, ledger neschimbat', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);
    await backdate(w.prisma, 'claimSlot', slot.id, { createdAt: new Date(Date.now() - 31 * MIN) });
    const { points } = await w.penalties.previewCompanyPenalty(a.companyId, 'VOLUNTARY_WITHDRAWAL');

    await w.withdrawals.request(ownerCtx(a.companyId), a.ownerId, slot.id, {
      reasonType: 'VOLUNTARY_NO_REASON',
      expectedOutcome: 'CONSUME_AND_PENALTY',
    });

    expect(await settlementsOf(w.prisma, slot.id)).toEqual(['CONSUME']);
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT - COST, reserved: 0 });
    expect(await penaltyEventsOf(slot.id, 'VOLUNTARY_WITHDRAWAL')).toBe(points > 0 ? 1 : 0);
    await assertLedgerBalanced(w.prisma, a.companyId);

    // (b3) a doua retragere pe acelasi slot
    const ledgerBefore = await w.prisma.creditTransaction.count({ where: { companyId: a.companyId } });
    const err = await w.withdrawals
      .request(ownerCtx(a.companyId), a.ownerId, slot.id, { reasonType: 'VOLUNTARY_NO_REASON' })
      .catch((e: unknown) => e);
    expect(errorStatus(err)).toBe(409);
    expect(errorCode(err)).toBe('CLAIM_NOT_WITHDRAWABLE');
    expect(await w.prisma.creditTransaction.count({ where: { companyId: a.companyId } })).toBe(ledgerBefore);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(c) neatribuit dupa termen → CANCELLED_UNASSIGNED + un REFUND; jobul repetat nu mai ramburseaza', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);
    expect(slot.assignedToUserId).toBeNull();
    await backdate(w.prisma, 'claimSlot', slot.id, { assignDeadlineAt: new Date(Date.now() - MIN) });
    const job = { name: 'assign-deadline', data: { claimSlotId: slot.id } } as Job<ClaimAssignJob>;

    await w.claimAssign.process(job);
    expect(await slotStatus(slot.id)).toBe('CANCELLED_UNASSIGNED');
    expect(await settlementReasons(slot.id)).toEqual(['REFUND:CLAIM_AUTO_CANCEL_UNASSIGNED']);

    await w.claimAssign.process(job);
    expect(await settlementsOf(w.prisma, slot.id)).toEqual(['REFUND']);
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT, reserved: 0 });
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(d) SLA ratat (termen + gratie trecute) → SLA_EXPIRED + un CONSUME (+ SLA_MISS); jobul repetat nu mai consuma', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);
    await backdate(w.prisma, 'claimSlot', slot.id, { slaDeadlineAt: new Date(Date.now() - SLA_GRACE_MS - MIN) });
    const { points } = await w.penalties.previewCompanyPenalty(a.companyId, 'SLA_MISS');
    const job = { name: 'breach', data: { claimSlotId: slot.id } } as Job<SlaBreachJob>;

    await w.slaBreach.process(job);
    expect(await slotStatus(slot.id)).toBe('SLA_EXPIRED');
    expect(await settlementReasons(slot.id)).toEqual(['CONSUME:SLA_BREACH']);
    expect(await penaltyEventsOf(slot.id, 'SLA_MISS')).toBe(points > 0 ? 1 : 0);

    await w.slaBreach.process(job);
    expect(await settlementsOf(w.prisma, slot.id)).toEqual(['CONSUME']);
    expect(await penaltyEventsOf(slot.id, 'SLA_MISS')).toBe(points > 0 ? 1 : 0);
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT - COST, reserved: 0 });
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  // accept cu trei firme: A castiga, B a ofertat si pierde (CONSUME), C fara oferta (REFUND)
  async function acceptWithLosers() {
    const [a, b, c] = [await firm('A'), await firm('B'), await firm('C')];
    const { clientId, requestId } = await clientWithRequest();
    const slotA = await claim(a, requestId);
    const slotB = await claim(b, requestId);
    const slotC = await claim(c, requestId);
    const quoteA = await offer(a, slotA.id);
    const quoteB = await offer(b, slotB.id);
    await w.quotes.acceptQuote(clientId, quoteA.id, quoteA.versions[0].id);
    return { a, b, c, clientId, requestId, slotA, slotB, slotC, quoteA, quoteB };
  }

  it('(e) accept: castigatorul ramane rezervat, pierzatorul cu oferta → CONSUME, cel fara oferta → REFUND', async () => {
    const maxClaims = await w.settings.getInt('max_claims_per_request', 3);
    expect(maxClaims).toBeGreaterThanOrEqual(3); // cazul cere trei sloturi
    const s = await acceptWithLosers();

    expect(await requestStatus(s.requestId)).toBe('ACCEPTED');
    expect(await slotStatus(s.slotA.id)).toBe('OFFER_SENT');
    expect(await settlementsOf(w.prisma, s.slotA.id)).toEqual([]);
    expect(await slotStatus(s.slotB.id)).toBe('CANCELLED_REQUEST_ACCEPTED');
    expect(await settlementsOf(w.prisma, s.slotB.id)).toEqual(['CONSUME']);
    expect((await w.prisma.quote.findUniqueOrThrow({ where: { id: s.quoteB.id } })).status).toBe('SUPERSEDED');
    expect(await slotStatus(s.slotC.id)).toBe('CANCELLED_REQUEST_ACCEPTED');
    expect(await settlementsOf(w.prisma, s.slotC.id)).toEqual(['REFUND']);
    expect(await wallet(s.a.companyId)).toEqual({ balance: GRANT - COST, reserved: COST });
    expect(await wallet(s.b.companyId)).toEqual({ balance: GRANT - COST, reserved: 0 });
    expect(await wallet(s.c.companyId)).toEqual({ balance: GRANT, reserved: 0 });
    for (const f of [s.a, s.b, s.c]) await assertLedgerBalanced(w.prisma, f.companyId);
  });

  it('(f) livrare confirmata de client → COMPLETED + un CONSUME "COMPLETED"; a doua confirmare → 409 fara al doilea consum', async () => {
    const s = await acceptWithLosers();
    await w.fulfillment.markDelivered(ownerCtx(s.a.companyId), s.requestId);
    await expect(w.fulfillment.confirmDelivery(s.clientId, s.requestId)).resolves.toEqual({ status: 'COMPLETED' });

    expect(await requestStatus(s.requestId)).toBe('COMPLETED');
    expect(await slotStatus(s.slotA.id)).toBe('COMPLETED');
    expect(await settlementReasons(s.slotA.id)).toEqual(['CONSUME:COMPLETED']);

    const err = await w.fulfillment.confirmDelivery(s.clientId, s.requestId).catch((e: unknown) => e);
    expect(errorStatus(err)).toBe(409);
    expect(errorCode(err)).toBe('COMPLETION_NOT_ALLOWED');
    expect(await settlementsOf(w.prisma, s.slotA.id)).toEqual(['CONSUME']);
    expect(await wallet(s.a.companyId)).toEqual({ balance: GRANT - COST, reserved: 0 });
    for (const f of [s.a, s.b, s.c]) await assertLedgerBalanced(w.prisma, f.companyId);
  });

  it('(f2) auto-confirmare la 14 zile de la livrare → un CONSUME; al doilea apel → false', async () => {
    const s = await acceptWithLosers();
    await w.fulfillment.markDelivered(ownerCtx(s.a.companyId), s.requestId);
    await backdateRequest(w.prisma, s.requestId, { deliveredAt: new Date(Date.now() - 15 * DAY) });

    await expect(w.fulfillment.autoCompleteDelivered(s.requestId)).resolves.toBe(true);
    await expect(w.fulfillment.autoCompleteDelivered(s.requestId)).resolves.toBe(false);

    expect(await requestStatus(s.requestId)).toBe('COMPLETED');
    expect(await slotStatus(s.slotA.id)).toBe('COMPLETED');
    expect(await settlementReasons(s.slotA.id)).toEqual(['CONSUME:COMPLETED']);
    for (const f of [s.a, s.b, s.c]) await assertLedgerBalanced(w.prisma, f.companyId);
  });

  it('(g) clientul sterge cererea → toate sloturile deschise CANCELLED_BY_CLIENT + REFUND, oferta WITHDRAWN', async () => {
    const [a, b] = [await firm('A'), await firm('B')];
    const { clientId, requestId } = await clientWithRequest();
    const slotA = await claim(a, requestId);
    const slotB = await claim(b, requestId);
    const quoteA = await offer(a, slotA.id);
    expect(await slotStatus(slotA.id)).toBe('OFFER_SENT');

    await expect(w.requests.deleteForClient(clientId, requestId)).resolves.toEqual({ ok: true });

    for (const slotId of [slotA.id, slotB.id]) {
      expect(await slotStatus(slotId)).toBe('CANCELLED_BY_CLIENT');
      expect(await settlementReasons(slotId)).toEqual(['REFUND:REQUEST_DELETED_BY_CLIENT']);
    }
    expect((await w.prisma.quote.findUniqueOrThrow({ where: { id: quoteA.id } })).status).toBe('WITHDRAWN');
    expect((await w.prisma.request.findUniqueOrThrow({ where: { id: requestId } })).deletedAt).not.toBeNull();
    for (const f of [a, b]) {
      expect(await wallet(f.companyId)).toEqual({ balance: GRANT, reserved: 0 });
      await assertLedgerBalanced(w.prisma, f.companyId);
    }
  });

  it('(h) plasele din DB: index unic partial pe (cerere, firma) si CHECK reserved >= 0 cu rollback', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);

    // al doilea slot ocupant pentru aceeasi (cerere, firma), ocolind serviciul
    const dup = await w.prisma.claimSlot
      .create({
        data: {
          requestId, companyId: a.companyId, claimedByUserId: a.ownerId, status: 'ACTIVE',
          projectSizeSnapshot: 'SMALL', projectScoreSnapshot: COST, claimCostCreditsSnapshot: COST,
        },
      })
      .catch((e: unknown) => e);
    expect(dup).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((dup as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    // indexul partial claim_slots_one_active_per_company_per_request; Prisma raporteaza in
    // meta.target COLOANELE indexului (request_id, company_id), nu numele lui — vezi CHANGELOG
    // E-admin-platform-14 (mapUniqueViolation din ClaimsService cauta numele → nu se potriveste;
    // plasa ramane filtrul global: P2002 → 409 CONCURRENT_MODIFICATION).
    const target = (dup as Prisma.PrismaClientKnownRequestError).meta?.target;
    expect(Array.isArray(target) ? [...target].sort() : String(target).split(',').sort()).toEqual(['company_id', 'request_id']);

    // E-admin-platform-15: consum peste rezervat → update conditionat, false, fara rand in ledger
    const before = await wallet(a.companyId);
    const consumesBefore = await w.prisma.creditTransaction.count({ where: { companyId: a.companyId, type: 'CONSUME' } });
    await expect(
      runTx(w.prisma, 'write', (tx) => w.credits.consume(a.companyId, before.reserved + 1, 'SLA_BREACH', slot.id, tx)),
    ).resolves.toBe(false);
    expect(await wallet(a.companyId)).toEqual(before);
    expect(await w.prisma.creditTransaction.count({ where: { companyId: a.companyId, type: 'CONSUME' } })).toBe(consumesBefore);

    // CHECK (reserved >= 0) ramane ultima bariera pentru un UPDATE brut
    await expect(
      w.prisma.$executeRaw`UPDATE company_credit_wallets SET reserved = -1 WHERE company_id = ${a.companyId}`,
    ).rejects.toBeDefined();
    expect(await wallet(a.companyId)).toEqual(before);

    // indexurile unice partiale: al doilea RESERVE si a doua decontare pe acelasi slot → P2002
    const dupReserve = await w.prisma.creditTransaction
      .create({ data: { companyId: a.companyId, type: 'RESERVE', amount: COST, reason: 'CLAIM_RESERVE', claimSlotId: slot.id } })
      .catch((e: unknown) => e);
    expect((dupReserve as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    const dupRefund = await runTx(w.prisma, 'write', async (tx) => {
      await tx.creditTransaction.create({ data: { companyId: a.companyId, type: 'REFUND', amount: COST, reason: 'SLA_BREACH', claimSlotId: slot.id } });
      await tx.creditTransaction.create({ data: { companyId: a.companyId, type: 'CONSUME', amount: COST, reason: 'SLA_BREACH', claimSlotId: slot.id } });
    }).catch((e: unknown) => e);
    expect((dupRefund as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    expect(await settlementsOf(w.prisma, slot.id)).toEqual([]);

    // ambele CHECK-uri sunt VALIDATE (20261001011000)
    const checks = await w.prisma.$queryRaw<{ conname: string; convalidated: boolean }[]>`
      SELECT conname, convalidated FROM pg_constraint WHERE conname LIKE 'company_credit_wallets_%nonneg' ORDER BY conname`;
    expect(checks).toEqual([
      { conname: 'company_credit_wallets_balance_nonneg', convalidated: true },
      { conname: 'company_credit_wallets_reserved_nonneg', convalidated: true },
    ]);
    await assertLedgerBalanced(w.prisma, a.companyId);
  });

  it('(i) SLA pe slot fara RESERVE (ca seed-demo) → SLA_EXPIRED, fara ledger, portofel neschimbat, refunded=false; repetat = no-op', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await w.prisma.claimSlot.create({
      data: {
        requestId, companyId: a.companyId, claimedByUserId: a.ownerId, status: 'ACTIVE',
        projectSizeSnapshot: 'SMALL', projectScoreSnapshot: COST, claimCostCreditsSnapshot: COST,
        slaDeadlineAt: new Date(Date.now() - SLA_GRACE_MS - MIN),
      },
    });
    await w.prisma.request.update({ where: { id: requestId }, data: { status: 'CLAIMED_PARTIAL' } });
    const before = await wallet(a.companyId);
    const job = { name: 'breach', data: { claimSlotId: slot.id } } as Job<SlaBreachJob>;

    await expect(w.slaBreach.process(job)).resolves.toBeUndefined();
    expect(await slotStatus(slot.id)).toBe('SLA_EXPIRED');
    expect(await w.prisma.creditTransaction.count({ where: { claimSlotId: slot.id } })).toBe(0);
    expect(await wallet(a.companyId)).toEqual(before);
    const intent = await w.prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventKey: `claim.sla:${slot.id}` } });
    expect((intent.payload as { refunded?: unknown }).refunded).toBe(false);

    await w.slaBreach.process(job);
    expect(await w.prisma.creditTransaction.count({ where: { claimSlotId: slot.id } })).toBe(0);
    expect(await w.prisma.domainEventOutbox.count({ where: { eventKey: `claim.sla:${slot.id}` } })).toBe(1);
    await assertLedgerBalanced(w.prisma, a.companyId, { unreservedSlotIds: [slot.id] });
  });

  it('(j) portofel deviat → SLA_EXPIRED fara CONSUME; verificarea zilnica raporteaza firma si slotul', async () => {
    const a = await firm('A');
    const { requestId } = await clientWithRequest();
    const slot = await claim(a, requestId);
    // deviatie simulata: rezervarea "a disparut" din portofel (balance +COST, reserved 0)
    await w.prisma.$executeRaw`UPDATE company_credit_wallets SET reserved = 0, balance = balance + ${COST} WHERE company_id = ${a.companyId}`;
    await backdate(w.prisma, 'claimSlot', slot.id, { slaDeadlineAt: new Date(Date.now() - SLA_GRACE_MS - MIN) });

    await w.slaBreach.process({ name: 'breach', data: { claimSlotId: slot.id } } as Job<SlaBreachJob>);
    expect(await slotStatus(slot.id)).toBe('SLA_EXPIRED');
    expect(await settlementsOf(w.prisma, slot.id)).toEqual([]);
    expect(await wallet(a.companyId)).toEqual({ balance: GRANT, reserved: 0 });

    const report = await w.ledgerCheck.check();
    expect(report.walletMismatches).toContainEqual({
      companyId: a.companyId, balance: GRANT, reserved: 0, ledgerBalance: GRANT - COST, ledgerReserved: COST,
    });
    expect(report.unsettledTerminalSlots).toContainEqual({ claimSlotId: slot.id, status: 'SLA_EXPIRED' });
    // firma e stearsa in afterEach (cascade pe portofel si ledger) — fara assertLedgerBalanced aici
  });
});
