import { WithdrawalsService, autoWithdrawalCreditReason } from './withdrawals.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import { REQUEST_SETTLED_STATUSES } from './claims.constants';

// L0-B — retrageri (4.15) cu Prisma mock-uit:
//  - voluntar dupa gratie: creditele rezervate se CONSUMA (nu raman RESERVED la infinit);
//  - CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION → PENDING_ADMIN_REVIEW (nu auto);
//  - retragerea unui slot OFFER_SENT inchide ofertele (WITHDRAWN) + thread read-only;
//  - admin approve pe slot deja inchis → 409 (fara refund dublu).
// Audit 2026-08-23 (anti dubla rambursare): tranzitia de status a slotului = biletul unic
// de decontare (updateMany conditionat); count 0 → 409 fara nicio miscare de credite.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// E-company-3: semnalele pentru motivele automate (mesajul firmei, clarificarea, oferta dupa editare)
type Signals = {
  firmMessageAt?: Date | null;
  clarification?: { createdAt: Date; answeredAt: Date | null } | null;
  versionAfterEdit?: boolean;
};

function makeService(slot: Any, pending: Any = null, signals: Signals = {}) {
  const tx: Any = {
    // E-admin-platform-10: recalculul citeste max_claims_per_request in tranzactie (null → fallback 3)
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Firma Demo' }) },
    claimSlot: {
      findUnique: jest.fn().mockResolvedValue(slot),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    claimWithdrawal: {
      findFirst: jest.fn().mockResolvedValue(pending),
      create: jest.fn().mockImplementation(({ data }: Any) =>
        Promise.resolve({
          id: 'wd1',
          customReason: null,
          refunded: false,
          adminNote: null,
          reviewedAt: null,
          createdAt: new Date(),
          ...data,
        }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }: Any) =>
        Promise.resolve({
          id: where.id,
          claimSlotId: slot.id,
          reasonType: 'CUSTOM',
          status: 'ADMIN_APPROVED',
          customReason: null,
          refunded: true,
          adminNote: null,
          reviewedAt: new Date(),
          createdAt: new Date(),
        }),
      ),
    },
    quote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    chatThread: { updateMany: jest.fn().mockResolvedValue(undefined) },
    request: { findUnique: jest.fn().mockResolvedValue({ id: slot.requestId, status: 'CLAIMED_PARTIAL' }) },
    // E-admin-platform-15: ledger-ul slotului (RESERVE = snapshot-ul) citit de settle()
    creditTransaction: { findMany: jest.fn().mockResolvedValue([{ type: 'RESERVE', amount: slot.claimCostCreditsSnapshot }]) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    claimWithdrawal: {
      findFirst: jest.fn().mockResolvedValue(pending),
      create: tx.claimWithdrawal.create,
      findUnique: jest.fn(),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Firma Demo' }) },
    message: {
      findFirst: jest.fn().mockResolvedValue(signals.firmMessageAt ? { createdAt: signals.firmMessageAt } : null),
    },
    clarificationRequest: { findFirst: jest.fn().mockResolvedValue(signals.clarification ?? null) },
    quoteVersion: { findFirst: jest.fn().mockResolvedValue(signals.versionAfterEdit ? { id: 'v2' } : null) },
  };
  const credits: Any = {
    refund: jest.fn().mockResolvedValue(true),
    consume: jest.fn().mockResolvedValue(true),
  };
  // decontarea reala (bilet + ledger) peste credite mock-uite
  const settlement = new ClaimSettlementService(credits);
  const penalties: Any = {
    applyPenalty: jest.fn().mockResolvedValue(undefined),
    previewCompanyPenalty: jest.fn().mockResolvedValue({ points: 2, activePoints: 3, threshold: 12, suspensionMonths: 6 }),
  };
  const eventBus: Any = { publish: jest.fn().mockResolvedValue(undefined) };
  const calendar: Any = {
    addWorkingDays: jest.fn().mockReturnValue(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
  };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const expirationQueue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new WithdrawalsService(prisma, settlement, penalties, eventBus, calendar, queue, expirationQueue, outbox);
  return { service, tx, prisma, credits, penalties, eventBus, queue, expirationQueue, outbox };
}

const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };
const HOURS_2 = 2 * 60 * 60 * 1000;

function slot(overrides: Partial<Any> = {}) {
  return {
    id: 's1',
    companyId: 'c1',
    requestId: 'r1',
    status: 'ACTIVE',
    claimCostCreditsSnapshot: 3,
    createdAt: new Date(Date.now() - HOURS_2),
    claimedByUserId: 'u1',
    assignedToUserId: null,
    quotes: [],
    request: { lastEditAt: null, status: 'CLAIMED_PARTIAL', title: 'T', clientUserId: 'client1' },
    chatThread: { id: 't1', lastClientMessageAt: null },
    ...overrides,
  };
}

const HOUR_MS = 60 * 60 * 1000;
// mesajul firmei vechi de 72h, fara raspuns → CLIENT_UNRESPONSIVE_48H dovedit
const FIRM_MSG_72H: Signals = { firmMessageAt: new Date(Date.now() - 72 * HOUR_MS) };

describe('WithdrawalsService (L0-B)', () => {
  it('records withdrawal and penalty intents in the financial transaction, never publishes directly', async () => {
    const { service, tx, penalties, eventBus, outbox } = makeService(slot());
    penalties.applyPenalty.mockResolvedValue({ pointsApplied: 2, suspended: true, suspendedUntil: new Date() });
    await service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'claim.withdrawn:s1:VOLUNTARY_NO_REASON', 'claim.withdrawn', expect.anything(), ['m1']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'penalty.withdrawal:wd1', 'penalty.applied', expect.anything(), ['m1']);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('keeps pending withdrawal successful when reminder queue is unavailable', async () => {
    const { service, queue, outbox } = makeService(slot());
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.request(ctx, 'u1', 's1', { reasonType: 'CUSTOM', customReason: 'review' } as Any)).resolves.toMatchObject({ status: 'PENDING_ADMIN_REVIEW' });
    expect(outbox.record).toHaveBeenCalled();
  });
  it('retragere voluntara DUPA gratie: consuma creditele rezervate + 2 pct, fara refund', async () => {
    const { service, credits, penalties } = makeService(slot());
    const wd = await service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(false);
    expect(credits.consume).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_LATE', 's1', expect.anything());
    expect(credits.refund).not.toHaveBeenCalled();
    expect(penalties.applyPenalty).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', ruleKey: 'VOLUNTARY_WITHDRAWAL' }),
      expect.anything(),
    );
  });

  it('retragere voluntara IN gratie (<30 min): refund integral, fara consum/penalizare', async () => {
    const { service, credits, penalties } = makeService(slot({ createdAt: new Date() }));
    const wd = await service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(true);
    expect(credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_GRACE', 's1', expect.anything());
    expect(credits.consume).not.toHaveBeenCalled();
    expect(penalties.applyPenalty).not.toHaveBeenCalled();
  });

  it.each(['CLIENT_CONTACT_INVALID', 'CLIENT_REQUESTED_CANCELLATION'])(
    '%s NU se mai auto-aproba → PENDING_ADMIN_REVIEW, slot ocupat, reminder 48h',
    async (reasonType) => {
      const { service, tx, credits, queue } = makeService(slot());
      const wd = await service.request(ctx, 'u1', 's1', { reasonType } as Any);
      expect(wd.status).toBe('PENDING_ADMIN_REVIEW');
      expect(wd.reasonType).toBe(reasonType);
      expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
      expect(credits.refund).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('remind', { withdrawalId: 'wd1' }, expect.objectContaining({ jobId: 'wd-rem-wd1' }));
    },
  );

  it('retragerea unui slot OFFER_SENT (auto-aprobat) inchide ofertele SENT/EXPIRED → WITHDRAWN + thread read-only', async () => {
    const s = slot({
      status: 'OFFER_SENT',
      createdAt: new Date(Date.now() - 3 * 24 * HOURS_2 * 12),
      chatThread: { id: 't1', lastClientMessageAt: new Date(Date.now() - 96 * HOUR_MS) },
    });
    const { service, tx, credits } = makeService(s, null, FIRM_MSG_72H);
    const wd = await service.request(ctx, 'u1', 's1', { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any);
    expect(wd.status).toBe('AUTO_APPROVED');
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 's1',
          status: { in: ['ACTIVE', 'OFFER_SENT'] },
          request: { status: { notIn: REQUEST_SETTLED_STATUSES } },
          quotes: { none: { status: 'ACCEPTED' } },
        },
        data: expect.objectContaining({ status: 'WITHDRAWN' }),
      }),
    );
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claimSlotId: 's1', status: { in: ['SENT', 'EXPIRED'] } },
        data: expect.objectContaining({ status: 'WITHDRAWN' }),
      }),
    );
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 's1' }, data: { readOnly: true } });
    expect(credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_CLIENT_UNRESPONSIVE_48H', 's1', expect.anything());
  });

  it('IDOR: claim-ul altei firme → NOT_FOUND', async () => {
    const { service } = makeService(slot({ companyId: 'c-other' }));
    await expect(service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('admin approve pe slot deja inchis pe alta cale → 409 CLAIM_NOT_WITHDRAWABLE (fara refund dublu)', async () => {
    const { service, prisma, credits } = makeService(slot());
    prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot({ status: 'CANCELLED_REQUEST_ACCEPTED' }),
    });
    await expect(service.adminReview('admin', 'wd1', { approve: true })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_WITHDRAWABLE' },
    });
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('admin approve pe slot OFFER_SENT → WITHDRAWN + refund + ofertele inchise', async () => {
    const { service, prisma, tx, credits } = makeService(slot());
    prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CLIENT_CONTACT_INVALID',
      claimSlot: slot({ status: 'OFFER_SENT' }),
    });
    const res = await service.adminReview('admin', 'wd1', { approve: true });
    expect(res.status).toBe('ADMIN_APPROVED');
    expect(credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_ADMIN_APPROVED', 's1', expect.anything());
    expect(tx.quote.updateMany).toHaveBeenCalled();
  });

  // --- audit 2026-08-23: race-uri de dubla decontare ---

  it('RACE dublu withdraw: slotul e inchis intre verificare si tranzactie (count 0) → 409, zero miscari de credite', async () => {
    const { service, tx, credits, penalties } = makeService(slot());
    tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_WITHDRAWABLE' } });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(penalties.applyPenalty).not.toHaveBeenCalled();
    expect(tx.claimWithdrawal.create).not.toHaveBeenCalled();
  });

  it('RACE auto-refund: slot inchis intre timp (count 0) → 409, fara refund si fara rand de retragere', async () => {
    const s = slot({ chatThread: { id: 't1', lastClientMessageAt: null } });
    const { service, tx, credits } = makeService(s, null, FIRM_MSG_72H);
    tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.request(ctx, 'u1', 's1', { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_WITHDRAWABLE' } });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(tx.claimWithdrawal.create).not.toHaveBeenCalled();
  });

  it('RACE doi admini decid simultan: updateMany pe retragere count 0 → 409 WITHDRAWAL_ALREADY_DECIDED, fara refund', async () => {
    const { service, prisma, tx, credits } = makeService(slot());
    prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot(),
    });
    tx.claimWithdrawal.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adminReview('admin', 'wd1', { approve: true })).rejects.toMatchObject({
      status: 409,
      response: { code: 'WITHDRAWAL_ALREADY_DECIDED' },
    });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
  });

  it('RACE admin approve vs decontare concurenta: slotul se inchide pe alta cale in timpul tx (count 0) → 409, fara refund', async () => {
    const { service, prisma, tx, credits } = makeService(slot());
    prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot(), // deschis la pre-check; se inchide concurent in tx
    });
    tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adminReview('admin', 'wd1', { approve: true })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_WITHDRAWABLE' },
    });
    expect(credits.refund).not.toHaveBeenCalled();
  });
});

// --- E-company-1 (WF1-2 P0 + WF1-10): castigatorul nu mai poate iesi dupa accept; roluri ---

const ALL_REASONS: [string, Any][] = [
  ['CLIENT_UNRESPONSIVE_48H', {}],
  ['REQUEST_MODIFIED_POST_CLAIM', {}],
  ['CLIENT_CONTACT_INVALID', {}],
  ['CLIENT_REQUESTED_CANCELLATION', {}],
  ['VOLUNTARY_NO_REASON', {}],
  ['CUSTOM', { customReason: 'x' }],
];
const MIN_5 = 5 * 60 * 1000;

function expectNoMoneyMoved(m: { credits: Any; penalties: Any; tx: Any }) {
  expect(m.credits.refund).not.toHaveBeenCalled();
  expect(m.credits.consume).not.toHaveBeenCalled();
  expect(m.penalties.applyPenalty).not.toHaveBeenCalled();
  expect(m.tx.claimWithdrawal.create).not.toHaveBeenCalled();
}

describe('E-company-1 - castigatorul nu mai poate retrage dupa accept', () => {
  it.each(ALL_REASONS)('(a) %s pe slot castigator (oferta ACCEPTED, cerere ACCEPTED) → 409', async (reasonType, extra) => {
    const s = slot({
      status: 'OFFER_SENT',
      quotes: [{ id: 'q1' }],
      request: { lastEditAt: new Date(), status: 'ACCEPTED', title: 'T' },
      chatThread: { lastClientMessageAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
    });
    const m = makeService(s);
    await expect(m.service.request(ctx, 'u1', 's1', { reasonType, ...extra } as Any)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_WITHDRAWABLE' },
    });
    expectNoMoneyMoved(m);
    expect(m.tx.claimSlot.updateMany).not.toHaveBeenCalled();
  });

  it.each(['IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED'])(
    '(b) cerere %s: CLIENT_UNRESPONSIVE_48H → 409, fara refund',
    async (status) => {
      const s = slot({
        status: 'OFFER_SENT',
        request: { lastEditAt: null, status, title: 'T' },
        chatThread: { lastClientMessageAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
      });
      const m = makeService(s);
      await expect(
        m.service.request(ctx, 'u1', 's1', { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any),
      ).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_WITHDRAWABLE' } });
      expectNoMoneyMoved(m);
    },
  );

  it('(c) RACE accept intre verificare si tranzactie: closeSlot filtrat pe relatii (count 0) → 409, fara refund', async () => {
    const s = slot({
      status: 'OFFER_SENT',
      request: { lastEditAt: null, status: 'CLAIMED_FULL', title: 'T', clientUserId: 'client1' },
      chatThread: { id: 't1', lastClientMessageAt: null },
    });
    const m = makeService(s, null, FIRM_MSG_72H);
    m.tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      m.service.request(ctx, 'u1', 's1', { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_WITHDRAWABLE' } });
    expect(m.tx.claimSlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          request: { status: { notIn: REQUEST_SETTLED_STATUSES } },
          quotes: { none: { status: 'ACCEPTED' } },
        }),
      }),
    );
    expectNoMoneyMoved(m);
  });

  it('(d) cerere PENDING: slotul castiga intre verificare si tranzactie → 409, fara rand de retragere', async () => {
    const m = makeService(slot());
    m.tx.claimSlot.findUnique.mockResolvedValue({
      status: 'OFFER_SENT',
      request: { status: 'ACCEPTED' },
      quotes: [{ id: 'q1' }],
    });
    await expect(
      m.service.request(ctx, 'u1', 's1', { reasonType: 'CUSTOM', customReason: 'x' } as Any),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_WITHDRAWABLE' } });
    expect(m.tx.claimWithdrawal.create).not.toHaveBeenCalled();
    expect(m.outbox.record).not.toHaveBeenCalled();
  });

  it.each([
    ['cerere ACCEPTED', { request: { lastEditAt: null, status: 'ACCEPTED', title: 'T' } }],
    ['oferta ACCEPTED', { quotes: [{ id: 'q1' }] }],
  ])('(e) admin approve pe castigator (%s) → 409, fara decizie si fara refund', async (_label, over) => {
    const m = makeService(slot());
    m.prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot({ status: 'OFFER_SENT', ...(over as Any) }),
    });
    await expect(m.service.adminReview('admin', 'wd1', { approve: true })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_WITHDRAWABLE' },
    });
    expect(m.tx.claimWithdrawal.updateMany).not.toHaveBeenCalled();
    expect(m.credits.refund).not.toHaveBeenCalled();
  });

  it('(f) admin REJECT pe castigator ramane permis (goleste coada), fara refund', async () => {
    const m = makeService(slot());
    m.prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot({
        status: 'OFFER_SENT',
        quotes: [{ id: 'q1' }],
        request: { lastEditAt: null, status: 'ACCEPTED', title: 'T' },
      }),
    });
    await expect(m.service.adminReview('admin', 'wd1', { approve: false })).resolves.toBeDefined();
    expect(m.tx.claimWithdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ADMIN_REJECTED', refunded: false }) }),
    );
    expect(m.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(m.credits.refund).not.toHaveBeenCalled();
  });
});

describe('E-company-1 - roluri la retragere', () => {
  const managed: Any = { companyId: 'c1', memberRole: 'EMPLOYEE_MANAGED', status: 'APPROVED' };
  const trusted: Any = { companyId: 'c1', memberRole: 'EMPLOYEE_TRUSTED', status: 'APPROVED' };
  const manager: Any = { companyId: 'c1', memberRole: 'MANAGER', status: 'APPROVED' };

  it('(g) angajat care nu e nici claimer, nici atribuit (in gratie) → 403, fara tranzactie', async () => {
    const m = makeService(slot({ createdAt: new Date(Date.now() - MIN_5) }));
    await expect(
      m.service.request(managed, 'u9', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('(h) angajat atribuit, in gratia de 30 min → retragere cu refund', async () => {
    const m = makeService(slot({ assignedToUserId: 'u9', createdAt: new Date(Date.now() - MIN_5) }));
    const wd = await m.service.request(managed, 'u9', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(true);
    expect(m.credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_GRACE', 's1', expect.anything());
  });

  it('(i) angajat atribuit, dupa gratie → 403, fara consum/penalizare', async () => {
    const m = makeService(slot({ assignedToUserId: 'u9' }));
    await expect(
      m.service.request(managed, 'u9', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expectNoMoneyMoved(m);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('(j) EMPLOYEE_TRUSTED claimer dupa gratie → 403', async () => {
    const m = makeService(slot());
    await expect(
      m.service.request(trusted, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expectNoMoneyMoved(m);
  });

  it('(k) MANAGER dupa gratie → permis (consum + penalizare)', async () => {
    const m = makeService(slot());
    const wd = await m.service.request(manager, 'u7', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(false);
    expect(m.credits.consume).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_LATE', 's1', expect.anything());
    expect(m.penalties.applyPenalty).toHaveBeenCalled();
  });

  it('(l) angajat pe slot castigator → 403 (rolul se verifica inaintea starii)', async () => {
    const m = makeService(
      slot({
        status: 'OFFER_SENT',
        quotes: [{ id: 'q1' }],
        request: { lastEditAt: null, status: 'IN_EXECUTION', title: 'T' },
      }),
    );
    await expect(
      m.service.request(managed, 'u9', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expectNoMoneyMoved(m);
  });
});

// E-company-6: previzualizarea consecintelor (read-only) + expectedOutcome la retragere.
describe('WithdrawalsService.preview + expectedOutcome (E-company-6)', () => {
  const HOUR = 60 * 60 * 1000;
  const employee: Any = { companyId: 'c1', memberRole: 'EMPLOYEE_MANAGED', status: 'APPROVED' };
  const outcomeOf = (p: Any, reason: string) => p.reasons.find((r: Any) => r.reasonType === reason);

  function expectNoWrites(m: Any) {
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.claimWithdrawal.create).not.toHaveBeenCalled();
    expect(m.tx.claimWithdrawal.updateMany).not.toHaveBeenCalled();
    expect(m.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(m.credits.refund).not.toHaveBeenCalled();
    expect(m.credits.consume).not.toHaveBeenCalled();
    expect(m.penalties.applyPenalty).not.toHaveBeenCalled();
  }

  it('(1) in gratie: VOLUNTARY → REFUND, withinGrace, blockedCode null', async () => {
    const m = makeService(slot({ createdAt: new Date(Date.now() - 5 * 60 * 1000) }));
    const p = await m.service.preview(ctx, 'u1', 's1');
    expect(p.blockedCode).toBeNull();
    expect(p.withinGrace).toBe(true);
    expect(outcomeOf(p, 'VOLUNTARY_NO_REASON').outcome).toBe('REFUND');
    expect(p.claimCostCredits).toBe(3);
    expect(p.offerWillBeWithdrawn).toBe(false);
    expect(p.reasons.map((r: Any) => r.reasonType)).toEqual([
      'CLIENT_UNRESPONSIVE_48H',
      'REQUEST_MODIFIED_POST_CLAIM',
      'CLIENT_CONTACT_INVALID',
      'CLIENT_REQUESTED_CANCELLATION',
      'VOLUNTARY_NO_REASON',
      'CUSTOM',
    ]);
  });

  it('(2) dupa gratie: CONSUME_AND_PENALTY + punctele si soldul din server', async () => {
    const m = makeService(slot({ status: 'OFFER_SENT' }));
    const p = await m.service.preview(ctx, 'u1', 's1');
    expect(p.withinGrace).toBe(false);
    expect(outcomeOf(p, 'VOLUNTARY_NO_REASON').outcome).toBe('CONSUME_AND_PENALTY');
    expect(p.penalty).toEqual({ lateWithdrawalPoints: 2, activePoints: 3, threshold: 12, suspensionMonths: 6 });
    expect(p.offerWillBeWithdrawn).toBe(true);
    expect(m.penalties.previewCompanyPenalty).toHaveBeenCalledWith('c1', 'VOLUNTARY_WITHDRAWAL');
  });

  it('(3) CLIENT_UNRESPONSIVE_48H (E-company-3): fara mesaj al firmei → FIRM_MESSAGE_REQUIRED; mesaj acum 10h → WAITING_48H; acum 50h → REFUND', async () => {
    const m0 = makeService(slot({ createdAt: new Date(Date.now() - 100 * HOUR) }));
    expect(outcomeOf(await m0.service.preview(ctx, 'u1', 's1'), 'CLIENT_UNRESPONSIVE_48H')).toEqual({
      reasonType: 'CLIENT_UNRESPONSIVE_48H',
      outcome: 'NOT_ELIGIBLE',
      eligibleFrom: null,
      notEligibleReason: 'FIRM_MESSAGE_REQUIRED',
    });

    const sent = new Date(Date.now() - 10 * HOUR);
    const m = makeService(slot(), null, { firmMessageAt: sent });
    const r = outcomeOf(await m.service.preview(ctx, 'u1', 's1'), 'CLIENT_UNRESPONSIVE_48H');
    expect(r.outcome).toBe('NOT_ELIGIBLE');
    expect(r.notEligibleReason).toBe('WAITING_48H');
    expect(r.eligibleFrom).toBe(new Date(sent.getTime() + 48 * HOUR).toISOString());

    const m2 = makeService(slot(), null, { firmMessageAt: new Date(Date.now() - 50 * HOUR) });
    const r2 = outcomeOf(await m2.service.preview(ctx, 'u1', 's1'), 'CLIENT_UNRESPONSIVE_48H');
    expect(r2).toEqual({ reasonType: 'CLIENT_UNRESPONSIVE_48H', outcome: 'REFUND', eligibleFrom: null, notEligibleReason: null });
    // mesajele clientului nu conteaza ca "mesajul firmei"
    expect(m2.prisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { chatThreadId: 't1', senderUserId: { not: 'client1' } } }),
    );
  });

  it('(4) REQUEST_MODIFIED_POST_CLAIM: editare dupa preluare → REFUND, altfel NOT_ELIGIBLE', async () => {
    const created = new Date(Date.now() - 2 * HOUR);
    const m = makeService(
      slot({ createdAt: created, request: { lastEditAt: new Date(Date.now() - HOUR), status: 'CLAIMED_PARTIAL', title: 'T' } }),
    );
    expect(outcomeOf(await m.service.preview(ctx, 'u1', 's1'), 'REQUEST_MODIFIED_POST_CLAIM').outcome).toBe('REFUND');
    const m2 = makeService(slot({ createdAt: created }));
    expect(outcomeOf(await m2.service.preview(ctx, 'u1', 's1'), 'REQUEST_MODIFIED_POST_CLAIM')).toEqual({
      reasonType: 'REQUEST_MODIFIED_POST_CLAIM',
      outcome: 'NOT_ELIGIBLE',
      eligibleFrom: null,
      notEligibleReason: 'REQUEST_NOT_EDITED',
    });
    // fara editare nu se mai cauta oferta dupa editare
    expect(m2.prisma.quoteVersion.findFirst).not.toHaveBeenCalled();
  });

  it('(5) CUSTOM / CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION → ADMIN_REVIEW', async () => {
    const p = await makeService(slot()).service.preview(ctx, 'u1', 's1');
    for (const r of ['CUSTOM', 'CLIENT_CONTACT_INVALID', 'CLIENT_REQUESTED_CANCELLATION']) {
      expect(outcomeOf(p, r).outcome).toBe('ADMIN_REVIEW');
    }
  });

  it('(6) angajat pe slotul altcuiva sau pe slotul propriu dupa gratie → FORBIDDEN', async () => {
    const inGrace = makeService(slot({ createdAt: new Date(Date.now() - 5 * 60 * 1000) }));
    expect((await inGrace.service.preview(employee, 'u9', 's1')).blockedCode).toBe('FORBIDDEN');
    const own = makeService(slot());
    expect((await own.service.preview(employee, 'u1', 's1')).blockedCode).toBe('FORBIDDEN');
    const ownInGrace = makeService(slot({ createdAt: new Date(Date.now() - 5 * 60 * 1000) }));
    expect((await ownInGrace.service.preview(employee, 'u1', 's1')).blockedCode).toBeNull();
  });

  it('(7) cerere decontata (oferta ACCEPTED) → CLAIM_NOT_WITHDRAWABLE', async () => {
    const m = makeService(slot({ status: 'OFFER_SENT', quotes: [{ id: 'q1' }] }));
    expect((await m.service.preview(ctx, 'u1', 's1')).blockedCode).toBe('CLAIM_NOT_WITHDRAWABLE');
  });

  it('(8) retragere in asteptare → WITHDRAWAL_ALREADY_PENDING + pendingWithdrawal', async () => {
    const pending = {
      id: 'wdp',
      claimSlotId: 's1',
      reasonType: 'CUSTOM',
      status: 'PENDING_ADMIN_REVIEW',
      customReason: 'motiv',
      refunded: false,
      adminNote: null,
      reviewedAt: null,
      createdAt: new Date('2026-09-29T10:00:00Z'),
    };
    const m = makeService(slot(), pending);
    const p = await m.service.preview(ctx, 'u1', 's1');
    expect(p.blockedCode).toBe('WITHDRAWAL_ALREADY_PENDING');
    expect(p.pendingWithdrawal).toMatchObject({ id: 'wdp', status: 'PENDING_ADMIN_REVIEW', createdAt: '2026-09-29T10:00:00.000Z' });
  });

  it('(9) slot al altei firme → 404', async () => {
    const m = makeService(slot({ companyId: 'c2' }));
    await expect(m.service.preview(ctx, 'u1', 's1')).rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND' } });
  });

  it('(10) previzualizarea nu deschide tranzactii si nu scrie nimic', async () => {
    const m = makeService(slot());
    await m.service.preview(ctx, 'u1', 's1');
    expectNoWrites(m);
    expect(m.outbox.record).not.toHaveBeenCalled();
  });

  it('(11) expectedOutcome REFUND dupa gratie → 409 WITHDRAWAL_OUTCOME_CHANGED, fara efecte', async () => {
    const m = makeService(slot());
    await expect(
      m.service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON', expectedOutcome: 'REFUND' } as Any),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'WITHDRAWAL_OUTCOME_CHANGED', details: { outcome: 'CONSUME_AND_PENALTY' } },
    });
    expectNoWrites(m);
  });

  it('(12) expectedOutcome CONSUME_AND_PENALTY dupa gratie → merge (consum + penalizare)', async () => {
    const m = makeService(slot());
    const wd = await m.service.request(ctx, 'u1', 's1', {
      reasonType: 'VOLUNTARY_NO_REASON',
      expectedOutcome: 'CONSUME_AND_PENALTY',
    } as Any);
    expect(wd.refunded).toBe(false);
    expect(m.credits.consume).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_LATE', 's1', expect.anything());
    expect(m.penalties.applyPenalty).toHaveBeenCalled();
  });

  it('(12b) expectedOutcome CONSUME_AND_PENALTY in gratie → 409 (firma ar fi confirmat alt cost)', async () => {
    const m = makeService(slot({ createdAt: new Date(Date.now() - 60 * 1000) }));
    await expect(
      m.service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON', expectedOutcome: 'CONSUME_AND_PENALTY' } as Any),
    ).rejects.toMatchObject({ status: 409, response: { code: 'WITHDRAWAL_OUTCOME_CHANGED', details: { outcome: 'REFUND' } } });
    expectNoWrites(m);
  });

  it('(13) fara expectedOutcome: comportament neschimbat (in gratie → refund)', async () => {
    const m = makeService(slot({ createdAt: new Date(Date.now() - 60 * 1000) }));
    const wd = await m.service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(true);
    expect(m.credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_VOLUNTARY_GRACE', 's1', expect.anything());
  });
});

// E-company-3: rambursarea automata cere dovada — firma i-a scris clientului si acesta tace 48h;
// modificarea cererii ramane motiv valid doar pana la prima oferta pe versiunea modificata.
describe('E-company-3 - motive automate validate', () => {
  const HOUR = HOUR_MS;
  const unresponsive = { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any;
  const modified = { reasonType: 'REQUEST_MODIFIED_POST_CLAIM' } as Any;
  const oldSlot = (over: Partial<Any> = {}) => slot({ createdAt: new Date(Date.now() - 100 * HOUR), ...over });
  const editedSlot = () =>
    slot({
      createdAt: new Date(Date.now() - 5 * HOUR),
      request: { lastEditAt: new Date(Date.now() - 2 * HOUR), status: 'CLAIMED_PARTIAL', title: 'T', clientUserId: 'client1' },
    });

  async function expectRejected(m: Any, body: Any, notEligibleReason: string) {
    await expect(m.service.request(ctx, 'u1', 's1', body)).rejects.toMatchObject({
      status: 409,
      response: { code: 'WITHDRAWAL_REASON_NOT_VALIDATED', details: { notEligibleReason } },
    });
    expect(m.credits.refund).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  }

  it('fara niciun mesaj al firmei (claim vechi de 100h) → 409 FIRM_MESSAGE_REQUIRED, fara refund', async () => {
    await expectRejected(makeService(oldSlot()), unresponsive, 'FIRM_MESSAGE_REQUIRED');
  });

  it('mesaj al firmei acum 50h, clientul a raspuns acum 10h → FIRM_MESSAGE_REQUIRED', async () => {
    const m = makeService(
      oldSlot({ chatThread: { id: 't1', lastClientMessageAt: new Date(Date.now() - 10 * HOUR) } }),
      null,
      { firmMessageAt: new Date(Date.now() - 50 * HOUR) },
    );
    await expectRejected(m, unresponsive, 'FIRM_MESSAGE_REQUIRED');
  });

  it('mesaj al firmei acum 50h, fara raspuns → REFUND (WITHDRAWAL_CLIENT_UNRESPONSIVE_48H)', async () => {
    const m = makeService(oldSlot(), null, { firmMessageAt: new Date(Date.now() - 50 * HOUR) });
    const wd = await m.service.request(ctx, 'u1', 's1', unresponsive);
    expect(wd.status).toBe('AUTO_APPROVED');
    expect(m.credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_CLIENT_UNRESPONSIVE_48H', 's1', expect.anything());
  });

  it('mesaj al firmei acum 10h → 409 WAITING_48H cu eligibleFrom = mesaj + 48h', async () => {
    const sent = new Date(Date.now() - 10 * HOUR);
    const m = makeService(oldSlot(), null, { firmMessageAt: sent });
    await expect(m.service.request(ctx, 'u1', 's1', unresponsive)).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'WITHDRAWAL_REASON_NOT_VALIDATED',
        details: { notEligibleReason: 'WAITING_48H', eligibleFrom: new Date(sent.getTime() + 48 * HOUR).toISOString() },
      },
    });
    expect(m.credits.refund).not.toHaveBeenCalled();
  });

  it('clarificare ceruta acum 50h, nerezolvata → REFUND', async () => {
    const m = makeService(oldSlot(), null, {
      clarification: { createdAt: new Date(Date.now() - 50 * HOUR), answeredAt: null },
    });
    const wd = await m.service.request(ctx, 'u1', 's1', unresponsive);
    expect(wd.status).toBe('AUTO_APPROVED');
    expect(m.credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_CLIENT_UNRESPONSIVE_48H', 's1', expect.anything());
  });

  it('clarificare la care clientul a raspuns dupa → FIRM_MESSAGE_REQUIRED', async () => {
    const m = makeService(oldSlot(), null, {
      clarification: { createdAt: new Date(Date.now() - 60 * HOUR), answeredAt: new Date(Date.now() - 55 * HOUR) },
    });
    await expectRejected(m, unresponsive, 'FIRM_MESSAGE_REQUIRED');
  });

  it('REQUEST_MODIFIED cu o versiune de oferta trimisa dupa editare → 409 OFFER_SENT_AFTER_EDIT', async () => {
    const m = makeService(editedSlot(), null, { versionAfterEdit: true });
    await expectRejected(m, modified, 'OFFER_SENT_AFTER_EDIT');
    expect(m.prisma.quoteVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quote: { claimSlotId: 's1', status: { not: 'DRAFT' } } }),
      }),
    );
  });

  it('REQUEST_MODIFIED editat, fara oferta dupa → REFUND', async () => {
    const m = makeService(editedSlot());
    const wd = await m.service.request(ctx, 'u1', 's1', modified);
    expect(wd.status).toBe('AUTO_APPROVED');
    expect(m.credits.refund).toHaveBeenCalledWith('c1', 3, 'WITHDRAWAL_REQUEST_MODIFIED_POST_CLAIM', 's1', expect.anything());
  });

  it('semnalele nu se citesc pe ramura voluntara / admin', async () => {
    const m = makeService(slot());
    await m.service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(m.prisma.message.findFirst).not.toHaveBeenCalled();
    expect(m.prisma.clarificationRequest.findFirst).not.toHaveBeenCalled();
  });
});

// E-admin-platform-15 — refunded urmeaza banii (settle), motivul din ledger e tipat exhaustiv
describe('WithdrawalsService — decontare prin ClaimSettlementService (E-admin-platform-15)', () => {
  it('retragere in gratie pe slot fara RESERVE → slot inchis, fara refund, refunded=false', async () => {
    const m = makeService(slot({ createdAt: new Date() }));
    m.tx.creditTransaction.findMany.mockResolvedValue([]);
    const wd = await m.service.request(ctx, 'u1', 's1', { reasonType: 'VOLUNTARY_NO_REASON' } as Any);
    expect(wd.refunded).toBe(false);
    expect(m.credits.refund).not.toHaveBeenCalled();
    expect(m.outbox.record).toHaveBeenCalledWith(m.tx, 'claim.withdrawn:s1:VOLUNTARY_NO_REASON', 'claim.withdrawn',
      expect.objectContaining({ refunded: false }), ['m1']);
  });

  it('admin approve pe portofel deviat → retragerea ramane aprobata, refunded corectat la false', async () => {
    const m = makeService(slot());
    m.tx.claimWithdrawal.update = jest.fn().mockResolvedValue(undefined);
    m.credits.refund.mockResolvedValue(false);
    m.prisma.claimWithdrawal.findUnique.mockResolvedValue({
      id: 'wd1',
      claimSlotId: 's1',
      status: 'PENDING_ADMIN_REVIEW',
      reasonType: 'CUSTOM',
      claimSlot: slot(),
    });
    await m.service.adminReview('admin', 'wd1', { approve: true });
    expect(m.credits.refund).toHaveBeenCalledTimes(1);
    expect(m.tx.claimWithdrawal.update).toHaveBeenCalledWith({ where: { id: 'wd1' }, data: { refunded: false } });
  });

  it('autoWithdrawalCreditReason: doar motivele auto-validate au motiv de ledger', () => {
    expect(autoWithdrawalCreditReason('CLIENT_UNRESPONSIVE_48H')).toBe('WITHDRAWAL_CLIENT_UNRESPONSIVE_48H');
    expect(autoWithdrawalCreditReason('REQUEST_MODIFIED_POST_CLAIM')).toBe('WITHDRAWAL_REQUEST_MODIFIED_POST_CLAIM');
    for (const r of ['CLIENT_CONTACT_INVALID', 'CLIENT_REQUESTED_CANCELLATION', 'VOLUNTARY_NO_REASON', 'CUSTOM'] as const) {
      expect(() => autoWithdrawalCreditReason(r)).toThrow();
    }
  });
});
