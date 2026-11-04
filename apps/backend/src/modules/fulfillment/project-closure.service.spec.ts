import { ProjectClosureService } from './project-closure.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';

// E-admin-platform-3: inchiderea proiectului acceptat de catre admin — tranzitia conditionata
// a cererii e biletul (o singura decontare), rezultatul creditelor e ales explicit.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function harness(opts: { requestCount?: number; slotCount?: number; winning?: Any } = {}) {
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    request: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.requestCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ clientUserId: 'u-client' }),
    },
    quote: {
      findFirst: jest.fn().mockResolvedValue(
        opts.winning === undefined
          ? { claimSlotId: 's-win', companyId: 'c-win', versions: [{ deliveryDate: new Date('2026-10-20T00:00:00Z') }] }
          : opts.winning,
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    claimSlot: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.slotCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's-win', companyId: 'c-win', requestId: 'r1', claimCostCreditsSnapshot: 4 }),
    },
    chatThread: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    // E-admin-platform-15: ledger-ul slotului (RESERVE) citit de settle()
    creditTransaction: { findMany: jest.fn().mockResolvedValue([{ type: 'RESERVE', amount: 4 }]) },
    requestProjectCase: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }]) },
  };
  const prisma: Any = {
    request: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) },
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
  };
  const credits: Any = { refund: jest.fn().mockResolvedValue(true), consume: jest.fn().mockResolvedValue(true) };
  // decontarea reala (bilet + ledger) peste credite mock-uite
  const settlement = new ClaimSettlementService(credits);
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const cases: Any = { getAdminRequestDetail: jest.fn().mockResolvedValue({ id: 'r1', status: 'CANCELLED' }) };
  const queue: Any = { remove: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectClosureService(prisma, settlement, outbox, cases, queue);
  return { service, tx, prisma, credits, outbox, cases, queue };
}

const refundDto = { creditOutcome: 'REFUND' as const, adminNote: 'Firma nu mai raspunde de 3 saptamani' };

describe('ProjectClosureService.closeAcceptedProject', () => {
  it('ACCEPTED → CANCELLED + slot castigator CANCELLED_PROJECT + exact un refund + caz inchis + 3 intentii outbox', async () => {
    const { service, tx, credits, outbox, queue } = harness();
    await expect(service.closeAcceptedProject('admin1', 'r1', refundDto)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(tx.$queryRaw).toHaveBeenCalled(); // FOR UPDATE pe cerere
    expect(tx.request.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: { in: ['ACCEPTED', 'IN_EXECUTION'] }, deletedAt: null },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 's-win', status: { in: ['OFFER_SENT'] } },
      data: { status: 'CANCELLED_PROJECT', withdrawnAt: expect.any(Date) },
    });
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(credits.refund).toHaveBeenCalledWith('c-win', 4, 'PROJECT_CANCELLED_REFUND', 's-win', tx);
    expect(credits.consume).not.toHaveBeenCalled();
    expect(tx.requestProjectCase.updateMany).toHaveBeenCalledWith({
      where: { requestId: 'r1', status: 'OPEN' },
      data: expect.objectContaining({ status: 'CLOSED_PROJECT_CANCELLED', resolvedByUserId: 'admin1', creditOutcome: 'REFUND' }),
    });
    expect(outbox.record).toHaveBeenCalledTimes(3);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'claim.withdrawn:s-win:PROJECT_CANCELLED', 'claim.withdrawn',
      expect.objectContaining({ reason: 'PROJECT_CANCELLED', refunded: true }), ['m1', 'm2']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'project.cancelled:r1', 'project.cancelled',
      expect.objectContaining({ requestId: 'r1', claimSlotId: 's-win' }), ['u-client']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'request.cancelled:r1', 'request.status_changed',
      { requestId: 'r1', status: 'CANCELLED' }, []);
    // joburile de termen sunt scoase best-effort
    expect(queue.remove).toHaveBeenCalledWith('proj-rem-r1-2026-10-20');
    expect(queue.remove).toHaveBeenCalledWith('proj-overdue-r1-2026-10-20');
  });

  it('CONSUME → exact un consum, refunded=false in notificare', async () => {
    const { service, credits, outbox, tx } = harness();
    await service.closeAcceptedProject('admin1', 'r1', { creditOutcome: 'CONSUME', adminNote: 'Clientul a renuntat fara motiv' });
    expect(credits.consume).toHaveBeenCalledTimes(1);
    expect(credits.consume).toHaveBeenCalledWith('c-win', 4, 'PROJECT_CANCELLED_CONSUME', 's-win', tx);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(outbox.record).toHaveBeenCalledWith(tx, 'claim.withdrawn:s-win:PROJECT_CANCELLED', 'claim.withdrawn',
      expect.objectContaining({ refunded: false }), ['m1', 'm2']);
  });

  // E-admin-platform-15: refunded urmeaza banii, nu alegerea adminului
  it('REFUND ales, dar portofel deviat (refund intoarce false) → claim.withdrawn cu refunded=false', async () => {
    const { service, credits, outbox, tx } = harness();
    credits.refund.mockResolvedValue(false);
    await service.closeAcceptedProject('admin1', 'r1', refundDto);
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'claim.withdrawn:s-win:PROJECT_CANCELLED', 'claim.withdrawn',
      expect.objectContaining({ refunded: false }), ['m1', 'm2']);
  });

  it('a doua inchidere (cererea deja CANCELLED) → 409 PROJECT_NOT_CLOSABLE, zero credite', async () => {
    const { service, credits, outbox, tx } = harness({ requestCount: 0 });
    await expect(service.closeAcceptedProject('admin1', 'r1', refundDto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_NOT_CLOSABLE' },
    });
    expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('DELIVERED_BY_COMPANY (nu e in ACCEPTED/IN_EXECUTION) → 409 prin acelasi bilet conditionat', async () => {
    const { service, credits } = harness({ requestCount: 0 });
    await expect(service.closeAcceptedProject('admin1', 'r1', refundDto)).rejects.toMatchObject({ status: 409 });
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('slotul castigator nu mai e OFFER_SENT (anomalie) → cererea se inchide, fara credite si fara claim.withdrawn', async () => {
    const { service, credits, outbox } = harness({ slotCount: 0 });
    await service.closeAcceptedProject('admin1', 'r1', refundDto);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    const types = outbox.record.mock.calls.map((c: Any[]) => c[2]);
    expect(types).not.toContain('claim.withdrawn');
    expect(types).toContain('project.cancelled');
  });

  it('cerere inexistenta → 404', async () => {
    const { service, prisma } = harness();
    prisma.request.findUnique.mockResolvedValue(null);
    await expect(service.closeAcceptedProject('admin1', 'r1', refundDto)).rejects.toMatchObject({ status: 404 });
  });
});
