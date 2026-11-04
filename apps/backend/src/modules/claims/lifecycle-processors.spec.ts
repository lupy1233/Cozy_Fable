import { ClaimAssignProcessor } from './claim-assign.processor';
import { SlaBreachProcessor } from './sla-breach.processor';
import { WithdrawalReminderProcessor } from './withdrawal-reminder.processor';
import { ReconciliationProcessor } from './reconciliation.processor';
import { ClaimSettlementService } from '../billing/claim-settlement.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
function harness(overrides: Record<string, unknown> = {}) {
  const claim = { id: 's1', requestId: 'r1', companyId: 'c1', status: 'ACTIVE', assignedToUserId: null,
    assignDeadlineAt: new Date(0), slaDeadlineAt: new Date(0), slaPausedAt: null,
    claimCostCreditsSnapshot: 3, request: { deletedAt: null, status: 'CLAIMED_PARTIAL', title: 'Test' }, ...overrides };
  const tx: any = {
    // E-admin-platform-10: recalculul citeste max_claims_per_request in tranzactie (null → fallback 3)
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    claimSlot: { findUnique: jest.fn().mockResolvedValue(claim), updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(1) },
    request: { findUnique: jest.fn().mockResolvedValue({ status: 'CLAIMED_PARTIAL' }) },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin' }]) },
    // E-admin-platform-15: ledger-ul slotului (settle() citeste RESERVE-ul inainte de decontare)
    creditTransaction: { findMany: jest.fn().mockResolvedValue([{ type: 'RESERVE', amount: 3 }]) },
    claimWithdrawal: { findUnique: jest.fn().mockResolvedValue({ status: 'PENDING_ADMIN_REVIEW', createdAt: new Date(0), claimSlot: { requestId: 'r1', request: { title: 'Test' } } }) },
  };
  const prisma: any = { $transaction: jest.fn((run) => run(tx)) };
  const credits: any = { refund: jest.fn().mockResolvedValue(true), consume: jest.fn().mockResolvedValue(true) };
  // decontarea reala peste credite mock-uite: verifica biletul + ledger-ul, nu doar apelul
  const settlement = new ClaimSettlementService(credits);
  const penalties: any = { applyPenalty: jest.fn().mockResolvedValue({ pointsApplied: 3, suspended: false }) };
  const calendar: any = { addWorkingDays: jest.fn().mockReturnValue(new Date()) };
  const bus: any = { publish: jest.fn() };
  const outbox: any = { record: jest.fn() };
  const queue: any = { add: jest.fn().mockResolvedValue(undefined) };
  return { tx, prisma, credits, settlement, penalties, calendar, bus, outbox, queue,
    assign: new ClaimAssignProcessor(prisma, settlement, bus, calendar, queue, outbox),
    sla: new SlaBreachProcessor(prisma, settlement, penalties, calendar, bus, queue, outbox),
    reminder: new WithdrawalReminderProcessor(prisma, bus, outbox) };
}

// E-admin-platform-3: setari implicite (inchiderea automata OPRITA) + calendar real simplificat
function settingsOff(overrides: Record<string, string> = {}): any {
  return {
    getString: jest.fn(async (key: string, fallback: string) => overrides[key] ?? fallback),
    getInt: jest.fn(async (key: string, fallback: number) => (overrides[key] ? Number(overrides[key]) : fallback)),
  };
}
function calendarStub(): any {
  // ora de perete Bucuresti aproximata ca UTC — suficient pentru ordinea termenelor
  return {
    bucharestWallClock: (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`),
    endOfBucharestDate: (d: string) => new Date(`${d}T23:59:59.999Z`),
  };
}
// E-admin-platform-15: verificarea zilnica ledger vs portofel (jobul 'ledger-check')
function ledgerStub(): any {
  return { runAndAlert: jest.fn().mockResolvedValue(undefined), check: jest.fn() };
}
function emptySweepPrisma(h: any) {
  h.prisma.request = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.claimSlot = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.physicalConsultationInvite = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.company = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.claimWithdrawal = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.quote = { findMany: jest.fn().mockResolvedValue([]) };
  h.prisma.domainEventOutbox = { findUnique: jest.fn().mockResolvedValue(null) };
}

describe('Reconciliation — ramurile E-admin-platform-3', () => {
  const day = 24 * 60 * 60 * 1000;

  it('inchiderea automata OPRITA (implicit) → nicio cautare de oferte expirate', async () => {
    const h = harness();
    emptySweepPrisma(h);
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff({ expired_offer_autoclose_enabled: 'true' }), calendarStub(), ledgerStub());
    await worker.process({} as any);
    // doar ramura 4 (SENT) cauta oferte; ramura 8 cere si rezultat REFUND/CONSUME
    expect(h.prisma.quote.findMany).toHaveBeenCalledTimes(1);
    expect(queue.add).not.toHaveBeenCalledWith('settle', expect.anything(), expect.anything());
  });

  it('activata: re-inarmeaza doar ofertele EXPIRED peste valid_until + N zile, paginat, cu jobId determinist', async () => {
    const h = harness();
    emptySweepPrisma(h);
    const due = new Date(Date.now() - 15 * day);
    const notDue = new Date(Date.now() - 2 * day);
    h.prisma.quote.findMany = jest.fn()
      .mockResolvedValueOnce([]) // ramura 4 (SENT)
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => ({ id: `fresh-${i}`, versions: [{ validUntil: notDue }] })))
      .mockResolvedValueOnce([{ id: 'stale', versions: [{ validUntil: due }] }]);
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const settings = settingsOff({
      expired_offer_autoclose_enabled: 'true',
      expired_offer_autoclose_credit_outcome: 'REFUND',
      expired_offer_autoclose_days: '14',
    });
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settings, calendarStub(), ledgerStub());
    await worker.process({} as any);
    expect(h.prisma.quote.findMany).toHaveBeenCalledTimes(3);
    const settleCalls = queue.add.mock.calls.filter((c: any[]) => c[0] === 'settle');
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0][1]).toEqual({ quoteId: 'stale' });
    expect(settleCalls[0][2]).toMatchObject({ jobId: `oes-stale-${due.getTime()}` });
  });

  it('termene de proiect: overdue si reminder re-inarmate o singura data (dedup pe cheia outbox)', async () => {
    const h = harness();
    emptySweepPrisma(h);
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const pastDate = iso(Date.now() - 2 * day);
    const soonDate = iso(Date.now() + 2 * day);
    const longAgo = new Date(Date.now() - 30 * day);
    h.prisma.request.findMany = jest.fn(async (args: any) =>
      args?.where?.quotes
        ? [
            { id: 'late', quotes: [{ acceptedAt: longAgo, versions: [{ deliveryDate: new Date(`${pastDate}T00:00:00Z`) }] }] },
            { id: 'soon', quotes: [{ acceptedAt: longAgo, versions: [{ deliveryDate: new Date(`${soonDate}T00:00:00Z`) }] }] },
            { id: 'nodate', quotes: [{ acceptedAt: longAgo, versions: [{ deliveryDate: null }] }] },
            { id: 'done', quotes: [{ acceptedAt: longAgo, versions: [{ deliveryDate: new Date(`${pastDate}T00:00:00Z`) }] }] },
          ]
        : [],
    );
    h.prisma.domainEventOutbox.findUnique = jest.fn(async (args: any) =>
      args.where.eventKey === `project.overdue:done:${pastDate}` ? { id: 'x' } : null,
    );
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarStub(), ledgerStub());
    await worker.process({} as any);
    expect(queue.add).toHaveBeenCalledWith('delivery-overdue', { requestId: 'late', deliveryDate: pastDate }, expect.objectContaining({ jobId: `proj-overdue-late-${pastDate}` }));
    expect(queue.add).toHaveBeenCalledWith('delivery-reminder', { requestId: 'soon', deliveryDate: soonDate }, expect.objectContaining({ jobId: `proj-rem-soon-${soonDate}` }));
    expect(queue.add).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId: 'done' }), expect.anything());
    expect(queue.add).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId: 'nodate' }), expect.anything());
  });
});

describe('Lifecycle transactional event intents', () => {
  it('quote sweep passes a full page of renewed offers and re-arms later expired offers', async () => {
    const h = harness();
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const future = new Date(Date.now() + 60_000);
    h.prisma.request = { findMany: jest.fn().mockResolvedValue([]) };
    h.prisma.claimSlot = { findMany: jest.fn().mockResolvedValue([]) };
    h.prisma.physicalConsultationInvite = { findMany: jest.fn().mockResolvedValue([]) };
    h.prisma.company = { findMany: jest.fn().mockResolvedValue([]) };
    h.prisma.claimWithdrawal = { findMany: jest.fn().mockResolvedValue([]) };
    h.prisma.quote = { findMany: jest.fn()
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: `renewed-${index}`, versions: [{ id: `v-${index}`, validUntil: future }] })))
      .mockResolvedValueOnce([{ id: 'expired', versions: [{ id: 'expired-v', validUntil: new Date(0) }] }]) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarStub(), ledgerStub());
    await worker.process({} as any);
    expect(h.prisma.quote.findMany).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith('expire', { quoteVersionId: 'expired-v' }, expect.objectContaining({ jobId: 'qv-expired-v-0' }));
  });

  it('reconciliation retries a retained failed timer instead of silently re-adding its job id', async () => {
    const h = harness();
    const retry = jest.fn();
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue({ getState: jest.fn().mockResolvedValue('failed'), retry }) };
    const worker: any = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarStub(), ledgerStub());
    await worker.rearm(queue, 'expire', { requestId: 'r1' }, { jobId: 'timer-r1' });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('refund and withdrawal intent use the same request-locked transaction', async () => {
    const h = harness();
    await h.assign.process({ data: { claimSlotId: 's1' } } as any);
    expect(h.tx.$queryRaw).toHaveBeenCalled();
    expect(h.credits.refund).toHaveBeenCalledWith('c1', 3, 'CLAIM_AUTO_CANCEL_UNASSIGNED', 's1', h.tx);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.unassigned:s1', 'claim.withdrawn', expect.anything(), ['u1']);
    expect(h.bus.publish).not.toHaveBeenCalled();
  });

  it.each([{ assignedToUserId: 'assigned' }, { assignDeadlineAt: new Date(Date.now() + 60000) }])('stale assignment job has no effects: %j', async (override) => {
    const h = harness(override);
    await h.assign.process({ data: { claimSlotId: 's1' } } as any);
    expect(h.credits.refund).not.toHaveBeenCalled();
    expect(h.outbox.record).not.toHaveBeenCalled();
  });

  it('paused SLA has no credit or notification effects', async () => {
    const h = harness({ slaPausedAt: new Date() });
    await h.sla.process({ data: { claimSlotId: 's1' } } as any);
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.outbox.record).not.toHaveBeenCalled();
  });

  it('SLA consumption and penalty intents use the same locked transaction', async () => {
    const h = harness();
    await h.sla.process({ data: { claimSlotId: 's1' } } as any);
    expect(h.credits.consume).toHaveBeenCalledWith('c1', 3, 'SLA_BREACH', 's1', h.tx);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.sla:s1', 'claim.withdrawn', expect.anything(), ['u1']);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'penalty.sla:s1', 'penalty.applied', expect.anything(), ['u1']);
    expect(h.bus.publish).not.toHaveBeenCalled();
  });

  // E-admin-platform-15 (LIVE-11): slot demo / vechi fara RESERVE → tranzitia + penalizarea +
  // notificarea raman, fara consum; jobul nu mai arunca pe CHECK-ul reserved >= 0
  it('SLA pe slot fara RESERVE → SLA_EXPIRED + penalizare, fara consum, refunded=false', async () => {
    const h = harness();
    h.tx.creditTransaction.findMany.mockResolvedValue([]);
    await expect(h.sla.process({ data: { claimSlotId: 's1' } } as any)).resolves.toBeUndefined();
    expect(h.tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', status: { in: ['ACTIVE'] } },
      data: { status: 'SLA_EXPIRED', withdrawnAt: expect.any(Date) },
    });
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.penalties.applyPenalty).toHaveBeenCalledTimes(1);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.sla:s1', 'claim.withdrawn',
      expect.objectContaining({ reason: 'SLA_EXPIRED', refunded: false }), ['u1']);
  });

  it('SLA pe portofel deviat (consume intoarce false) → tranzitia se comite, jobul nu arunca', async () => {
    const h = harness();
    h.credits.consume.mockResolvedValue(false);
    await expect(h.sla.process({ data: { claimSlotId: 's1' } } as any)).resolves.toBeUndefined();
    expect(h.credits.consume).toHaveBeenCalledTimes(1);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.sla:s1', 'claim.withdrawn', expect.anything(), ['u1']);
  });

  it('neatribuit pe slot fara RESERVE → CANCELLED_UNASSIGNED, fara refund, payload refunded=false', async () => {
    const h = harness();
    h.tx.creditTransaction.findMany.mockResolvedValue([]);
    await h.assign.process({ data: { claimSlotId: 's1' } } as any);
    expect(h.tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { assignedToUserId: null, id: 's1', status: { in: ['ACTIVE'] } },
      data: { status: 'CANCELLED_UNASSIGNED', withdrawnAt: expect.any(Date) },
    });
    expect(h.credits.refund).not.toHaveBeenCalled();
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.unassigned:s1', 'claim.withdrawn',
      expect.objectContaining({ refunded: false }), ['u1']);
  });

  it("reconciliation: jobul 'ledger-check' ruleaza doar verificarea, fara sweep", async () => {
    const h = harness();
    emptySweepPrisma(h);
    const queue: any = { add: jest.fn() };
    const ledger = ledgerStub();
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarStub(), ledger);
    await worker.process({ name: 'ledger-check' } as any);
    expect(ledger.runAndAlert).toHaveBeenCalledTimes(1);
    expect(h.prisma.request.findMany).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reconciliation: onModuleInit programeaza ledger-check zilnic (Europe/Bucharest) + o rulare la pornire', async () => {
    const h = harness();
    const queue: any = { add: jest.fn().mockResolvedValue(undefined) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarStub(), ledgerStub());
    await worker.onModuleInit();
    expect(queue.add).toHaveBeenCalledWith('ledger-check', {}, expect.objectContaining({ repeat: { pattern: '40 3 * * *', tz: 'Europe/Bucharest' } }));
    expect(queue.add).toHaveBeenCalledWith('ledger-check', {}, expect.objectContaining({ jobId: 'startup-ledger-check' }));
  });

  it('48-hour reminder has stable intent identity and does not decide withdrawal', async () => {
    const h = harness();
    await h.reminder.process({ data: { withdrawalId: 'wd1' } } as any);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'withdrawal.reminder:wd1', 'withdrawal.reminder', expect.anything(), ['admin']);
    expect(h.bus.publish).not.toHaveBeenCalled();
  });
});

// E-admin-platform-44 — avertizari de termen: doar notificari (fara lock, fara bani).
describe('Avertizari de termen (warn-assign / warn-sla)', () => {
  const min = 60 * 1000;
  const hour = 60 * min;
  function warnHarness(overrides: Record<string, unknown> = {}) {
    const h = harness({ claimedByUserId: 'claimer', ...overrides });
    h.prisma.claimSlot = h.tx.claimSlot;
    h.tx.companyMember.findMany = jest.fn().mockResolvedValue([
      { userId: 'owner', role: 'OWNER' },
      { userId: 'manager', role: 'MANAGER' },
      { userId: 'claimer', role: 'EMPLOYEE_TRUSTED' },
      { userId: 'worker', role: 'EMPLOYEE_BASIC' },
    ]);
    return h;
  }

  it('warn-assign: OWNER/MANAGER + cine a preluat, cheie determinista, fara refund', async () => {
    const deadline = new Date(Date.now() + 20 * min);
    const h = warnHarness({ assignDeadlineAt: deadline });
    await h.assign.process({ name: 'warn-assign', data: { claimSlotId: 's1' } } as any);
    expect(h.tx.companyMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'c1', OR: [{ role: { in: ['OWNER', 'MANAGER'] } }, { userId: { in: ['claimer'] } }] },
    }));
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.assign_warning:s1', 'claim.assign_warning',
      { claimSlotId: 's1', requestId: 'r1', companyId: 'c1', assignDeadlineAt: deadline.toISOString() },
      ['owner', 'manager', 'claimer']);
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
    expect(h.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(h.credits.refund).not.toHaveBeenCalled();
  });

  it('warn-assign: un fost membru (scos din firma) care a preluat nu mai primeste avertizarea', async () => {
    const h = warnHarness({ assignDeadlineAt: new Date(Date.now() + 20 * min) });
    h.tx.companyMember.findMany = jest.fn().mockResolvedValue([
      { userId: 'owner', role: 'OWNER' },
      { userId: 'manager', role: 'MANAGER' },
    ]);
    await h.assign.process({ name: 'warn-assign', data: { claimSlotId: 's1' } } as any);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, 'claim.assign_warning:s1', 'claim.assign_warning',
      expect.anything(), ['owner', 'manager']);
  });

  it.each([
    ['atribuita intre timp', { assignedToUserId: 'u9', assignDeadlineAt: new Date(Date.now() + 20 * 60 * 1000) }],
    ['termenul a trecut', { assignDeadlineAt: new Date(Date.now() - 1000) }],
    ['prea devreme (inainte de +30 min)', { assignDeadlineAt: new Date(Date.now() + 50 * 60 * 1000) }],
    ['cerere deja decontata', { assignDeadlineAt: new Date(Date.now() + 20 * 60 * 1000), request: { deletedAt: null, status: 'ACCEPTED' } }],
    ['slot inchis', { status: 'CANCELLED_UNASSIGNED', assignDeadlineAt: new Date(Date.now() + 20 * 60 * 1000) }],
  ])('warn-assign no-op: %s', async (_label, override) => {
    const h = warnHarness(override);
    await h.assign.process({ name: 'warn-assign', data: { claimSlotId: 's1' } } as any);
    expect(h.outbox.record).not.toHaveBeenCalled();
    expect(h.credits.refund).not.toHaveBeenCalled();
  });

  it('assign-deadline ramane neschimbat (auto-cancel + refund)', async () => {
    const h = warnHarness();
    await h.assign.process({ name: 'assign-deadline', data: { claimSlotId: 's1' } } as any);
    expect(h.credits.refund).toHaveBeenCalledWith('c1', 3, 'CLAIM_AUTO_CANCEL_UNASSIGNED', 's1', h.tx);
  });

  it('warn-sla: responsabil + OWNER/MANAGER + cine a preluat; NU consuma credite, NU penalizeaza', async () => {
    const deadline = new Date(Date.now() + 20 * hour);
    const h = warnHarness({ slaDeadlineAt: deadline, assignedToUserId: 'worker' });
    await h.sla.process({ name: 'warn-sla', data: { claimSlotId: 's1', slaDeadlineAt: deadline.toISOString() } } as any);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, `sla.expiring_soon:s1:${deadline.getTime()}`, 'sla.expiring_soon',
      { claimSlotId: 's1', requestId: 'r1', companyId: 'c1', slaDeadlineAt: deadline.toISOString() },
      ['owner', 'manager', 'claimer', 'worker']);
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.penalties.applyPenalty).not.toHaveBeenCalled();
    expect(h.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['SLA pe pauza', { slaPausedAt: new Date() }, 0],
    ['oferta deja trimisa', { status: 'OFFER_SENT' }, 0],
    ['termenul s-a mutat (clarificare)', {}, 3600_000],
    ['termenul a trecut', { slaDeadlineAt: new Date(Date.now() - 1000) }, 0],
    ['prea devreme', { slaDeadlineAt: new Date(Date.now() + 30 * 60 * 60 * 1000) }, 0],
  ])('warn-sla no-op: %s', async (_label, override, shift) => {
    const deadline = new Date(Date.now() + 20 * hour);
    const h = warnHarness({ slaDeadlineAt: deadline, ...(override as object) });
    const base: Date = (override as any).slaDeadlineAt ?? deadline;
    const scheduled = new Date(base.getTime() + (shift as number));
    await h.sla.process({ name: 'warn-sla', data: { claimSlotId: 's1', slaDeadlineAt: scheduled.toISOString() } } as any);
    expect(h.outbox.record).not.toHaveBeenCalled();
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.penalties.applyPenalty).not.toHaveBeenCalled();
  });

  // E-company-13 — reminderul de la inceputul gratiei
  it('warn-sla-grace: phase GRACE + slaBreachAt, aceleasi tinte; NU consuma, NU penalizeaza, fara lock', async () => {
    const deadline = new Date(Date.now() - hour);
    const h = warnHarness({ slaDeadlineAt: deadline, assignedToUserId: 'worker' });
    await h.sla.process({ name: 'warn-sla-grace', data: { claimSlotId: 's1', slaDeadlineAt: deadline.toISOString() } } as any);
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, `sla.expiring_soon:grace:s1:${deadline.getTime()}`, 'sla.expiring_soon',
      {
        claimSlotId: 's1',
        requestId: 'r1',
        companyId: 'c1',
        slaDeadlineAt: deadline.toISOString(),
        slaBreachAt: new Date(deadline.getTime() + 12 * hour).toISOString(),
        phase: 'GRACE',
      },
      ['owner', 'manager', 'claimer', 'worker']);
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.penalties.applyPenalty).not.toHaveBeenCalled();
    expect(h.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['SLA pe pauza', { slaPausedAt: new Date() }, 0],
    ['oferta deja trimisa', { status: 'OFFER_SENT' }, 0],
    ['termenul s-a mutat (clarificare)', {}, 3600_000],
    ['gratia nu a inceput (termen in viitor)', { slaDeadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000) }, 0],
    ['gratia s-a terminat', { slaDeadlineAt: new Date(Date.now() - 13 * 60 * 60 * 1000) }, 0],
    ['cerere deja acceptata', { request: { deletedAt: null, status: 'ACCEPTED' } }, 0],
    ['cerere stearsa', { request: { deletedAt: new Date(), status: 'CLAIMED_PARTIAL' } }, 0],
  ])('warn-sla-grace no-op: %s', async (_label, override, shift) => {
    const deadline = new Date(Date.now() - hour);
    const h = warnHarness({ slaDeadlineAt: deadline, ...(override as object) });
    const base: Date = (override as any).slaDeadlineAt ?? deadline;
    const scheduled = new Date(base.getTime() + (shift as number));
    await h.sla.process({ name: 'warn-sla-grace', data: { claimSlotId: 's1', slaDeadlineAt: scheduled.toISOString() } } as any);
    expect(h.outbox.record).not.toHaveBeenCalled();
    expect(h.credits.consume).not.toHaveBeenCalled();
    expect(h.penalties.applyPenalty).not.toHaveBeenCalled();
    expect(h.tx.claimSlot.updateMany).not.toHaveBeenCalled();
  });
});

describe('Reconciliation — ramurile 10-13 (E-admin-platform-44 + E-company-13)', () => {
  const min = 60 * 1000;
  function calendarWithWorkingDays(): any {
    // reminderul cererii cade oricum inaintea lui "acum" in testele de mai jos
    return { ...calendarStub(), workingDateBefore: () => '2000-01-01' };
  }
  function sweepRows(h: any, rows: { expiresAt: Date; assignDeadline: Date; slaDeadline: Date; graceDeadline: Date }) {
    h.prisma.request.findMany = jest.fn(async (args: any) =>
      args?.where?.status === 'IN_MARKETPLACE' && args?.where?.expiresAt?.gt ? [{ id: 'r9', expiresAt: rows.expiresAt }] : [],
    );
    h.prisma.claimSlot.findMany = jest.fn(async (args: any) => {
      if (args?.where?.assignDeadlineAt?.gt) return [{ id: 's9', assignDeadlineAt: rows.assignDeadline }];
      const sla = args?.where?.slaDeadlineAt;
      // ramura 13 (gratie): termen deja trecut (lte <= acum); ramura 12: termen in viitor
      if (sla?.gt && sla?.lte && sla.lte.getTime() <= Date.now()) return [{ id: 's7', slaDeadlineAt: rows.graceDeadline }];
      if (sla?.gt) return [{ id: 's8', slaDeadlineAt: rows.slaDeadline }];
      return [];
    });
  }

  it('re-inarmeaza reminderul cererii, warning-ul de atribuire si pe cel SLA cu jobId canonic', async () => {
    const h = harness();
    emptySweepPrisma(h);
    const rows = {
      expiresAt: new Date(Date.now() + 6 * 60 * min),
      assignDeadline: new Date(Date.now() + 20 * min),
      slaDeadline: new Date(Date.now() + 20 * 60 * min),
      graceDeadline: new Date(Date.now() - 2 * 60 * min),
    };
    sweepRows(h, rows);
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarWithWorkingDays(), ledgerStub());
    await worker.process({} as any);
    expect(queue.add).toHaveBeenCalledWith('remind-expiry',
      expect.objectContaining({ requestId: 'r9', expiresAt: rows.expiresAt.toISOString() }),
      expect.objectContaining({ jobId: `req-rem-r9-${rows.expiresAt.getTime()}` }));
    expect(queue.add).toHaveBeenCalledWith('warn-assign', { claimSlotId: 's9' },
      expect.objectContaining({ jobId: 'claim-assign-warn-s9' }));
    expect(queue.add).toHaveBeenCalledWith('warn-sla', { claimSlotId: 's8', slaDeadlineAt: rows.slaDeadline.toISOString() },
      expect.objectContaining({ jobId: `sla-warn-s8-${rows.slaDeadline.getTime()}` }));
    expect(queue.add).toHaveBeenCalledWith('warn-sla-grace', { claimSlotId: 's7', slaDeadlineAt: rows.graceDeadline.toISOString() },
      expect.objectContaining({ jobId: `sla-grace-warn-s7-${rows.graceDeadline.getTime()}`, delay: 0 }));
    // gratia s7 nu intra si in ramura 12 (termen trecut)
    expect(queue.add).not.toHaveBeenCalledWith('warn-sla', expect.objectContaining({ claimSlotId: 's7' }), expect.anything());
  });

  it('sare peste avertizarile deja inregistrate in outbox', async () => {
    const h = harness();
    emptySweepPrisma(h);
    const rows = {
      expiresAt: new Date(Date.now() + 6 * 60 * min),
      assignDeadline: new Date(Date.now() + 20 * min),
      slaDeadline: new Date(Date.now() + 20 * 60 * min),
      graceDeadline: new Date(Date.now() - 2 * 60 * min),
    };
    sweepRows(h, rows);
    const recorded = new Set([
      `request.expiry_reminder:r9:${rows.expiresAt.getTime()}`,
      'claim.assign_warning:s9',
      `sla.expiring_soon:s8:${rows.slaDeadline.getTime()}`,
      `sla.expiring_soon:grace:s7:${rows.graceDeadline.getTime()}`,
    ]);
    h.prisma.domainEventOutbox.findUnique = jest.fn(async (args: any) => (recorded.has(args.where.eventKey) ? { id: 'x' } : null));
    const queue: any = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
    const worker = new ReconciliationProcessor(h.prisma, h.bus, queue, queue, queue, queue, queue, queue, queue, h.outbox, queue, queue, queue, settingsOff(), calendarWithWorkingDays(), ledgerStub());
    await worker.process({} as any);
    for (const name of ['remind-expiry', 'warn-assign', 'warn-sla', 'warn-sla-grace']) {
      expect(queue.add).not.toHaveBeenCalledWith(name, expect.anything(), expect.anything());
    }
  });
});
