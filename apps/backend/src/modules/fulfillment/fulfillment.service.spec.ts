import { FulfillmentService, AUTO_COMPLETE_DAYS, autoCompleteJobId } from './fulfillment.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';

// Pasul 5 (audit 2026-08-23, F1 + D-PO 14 zile): tranzitia DELIVERED_BY_COMPANY → COMPLETED
// e biletul de decontare (updateMany conditionat) — client-confirm si auto-complete nu pot
// consuma creditele castigatorului de doua ori.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY_MS = 24 * 60 * 60 * 1000;

function makeService(opts: {
  request?: Any;
  completeCount?: number;
  slotCloseCount?: number;
} = {}) {
  const request = opts.request ?? {
    id: 'r1',
    title: 'Dressing Iasi',
    status: 'DELIVERED_BY_COMPANY',
    deletedAt: null,
    clientUserId: 'u-client',
    deliveredAt: new Date(Date.now() - (AUTO_COMPLETE_DAYS + 1) * DAY_MS),
  };
  const slot = { id: 'slot1', companyId: 'c1', requestId: 'r1', claimCostCreditsSnapshot: 3, status: 'OFFER_SENT' };
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    request: {
      findUnique: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn().mockResolvedValue({ count: opts.completeCount ?? 1 }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    quote: { findFirst: jest.fn().mockResolvedValue({ id: 'q1', claimSlotId: 'slot1' }) },
    claimSlot: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.slotCloseCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(slot),
      count: jest.fn().mockResolvedValue(1),
    },
    // E-admin-platform-15: ledger-ul slotului (RESERVE) citit de settle()
    creditTransaction: { findMany: jest.fn().mockResolvedValue([{ type: 'RESERVE', amount: 3 }]) },
    reviewDispute: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    review: { delete: jest.fn().mockResolvedValue(undefined) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    request: { findUnique: jest.fn().mockResolvedValue(request) },
    quote: {
      findFirst: jest.fn().mockResolvedValue({
        claimSlotId: 'slot1',
        company: { name: 'Test' },
        claimSlot: { status: 'OFFER_SENT' },
      }),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    reviewDispute: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'd1',
        status: 'OPEN',
        review: { id: 'rev1', requestId: 'r1', companyId: 'c1' },
      }),
    },
  };
  const eventBus: Any = { publish: jest.fn().mockResolvedValue(undefined) };
  const credits: Any = { consume: jest.fn().mockResolvedValue(true) };
  // decontarea reala (bilet + ledger) peste credite mock-uite
  const settlement = new ClaimSettlementService(credits);
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(1) };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new FulfillmentService(prisma, eventBus, settlement, queue, outbox);
  return { service, tx, prisma, eventBus, credits, queue, request, outbox };
}

describe('FulfillmentService — auto-COMPLETED la 14 zile (D-PO 2026-08-23)', () => {
  it('delivered state and notification intent survive an unavailable timer queue', async () => {
    const { service, queue, tx, outbox, eventBus } = makeService({ request: { id: 'r1', status: 'ACCEPTED', clientUserId: 'u-client' } });
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.markDelivered({ companyId: 'c1', memberRole: 'OWNER' } as Any, 'r1')).resolves.toEqual({ status: 'DELIVERED_BY_COMPANY' });
    expect(outbox.record).toHaveBeenCalledWith(tx, 'delivery.marked:r1', 'delivery.marked', expect.anything(), ['u-client']);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  it('auto-complete dupa fereastra: COMPLETED conditionat + consum credite + notificari tintite', async () => {
    const { service, tx, credits, outbox } = makeService();
    await expect(service.autoCompleteDelivered('r1')).resolves.toBe(true);
    expect(tx.request.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'DELIVERED_BY_COMPANY', deletedAt: null },
      data: { status: 'COMPLETED' },
    });
    expect(credits.consume).toHaveBeenCalledWith('c1', 3, 'COMPLETED', 'slot1', expect.anything());
    // E-admin-platform-15: COMPLETED prin settle(), fara withdrawnAt (nu e o retragere)
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot1', status: { in: ['OFFER_SENT'] } },
      data: { status: 'COMPLETED' },
    });
    // firma afla (delivery.confirmed cu autoCompleted) + clientul afla (delivery.autocompleted)
    const events = outbox.record.mock.calls.map((c: Any[]) => c[2]);
    expect(events).toContain('delivery.confirmed');
    expect(events).toContain('delivery.autocompleted');
  });

  it('inainte de 14 zile → no-op complet (jobul vechi / re-livrare)', async () => {
    const { service, tx, credits } = makeService({
      request: {
        id: 'r1', title: 'X', status: 'DELIVERED_BY_COMPANY', deletedAt: null,
        clientUserId: 'u-client', deliveredAt: new Date(Date.now() - 2 * DAY_MS),
      },
    });
    await expect(service.autoCompleteDelivered('r1')).resolves.toBe(false);
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('RACE client-confirm vs auto-complete: biletul e luat (count 0) → fara consum dublu', async () => {
    const { service, credits, eventBus } = makeService({ completeCount: 0 });
    await expect(service.autoCompleteDelivered('r1')).resolves.toBe(false);
    expect(credits.consume).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('slotul deja decontat pe alta cale (count 0 pe slot) → COMPLETED fara al doilea consum', async () => {
    const { service, credits } = makeService({ slotCloseCount: 0 });
    await expect(service.autoCompleteDelivered('r1')).resolves.toBe(true);
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('jobId-ul de auto-complete e determinist pe delivered_at (contract cu sweep-ul)', () => {
    const at = new Date('2026-08-23T10:00:00Z');
    expect(autoCompleteJobId('r1', at)).toBe(`auto-complete-r1-${at.getTime()}`);
  });
});

// D-L1-3 (PO 2026-08-23): DISMISSED sterge recenzia; RESOLVED o pastreaza.
describe('resolveDispute (D-L1-3)', () => {
  it('concurrent decision cannot delete a review or publish another outcome', async () => {
    const { service, tx, outbox } = makeService();
    tx.reviewDispute.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resolveDispute('admin', 'd1', { status: 'DISMISSED' } as Any)).rejects.toMatchObject({ status: 409 });
    expect(tx.review.delete).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });
  it('DISMISSED → recenzia se STERGE + dispute.decided(dismissed:true) catre parti', async () => {
    const { service, tx, outbox } = makeService();
    await service.resolveDispute('admin', 'd1', { status: 'DISMISSED' } as Any);
    expect(tx.review.delete).toHaveBeenCalledWith({ where: { id: 'rev1' } });
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'COMPLETED' },
    });
    const decided = outbox.record.mock.calls.find((c: Any[]) => c[2] === 'dispute.decided');
    expect(decided[3].dismissed).toBe(true);
    expect(decided[4]).toEqual(expect.arrayContaining(['m1', 'u-client']));
  });

  it('RESOLVED → recenzia RAMANE + dispute.decided(dismissed:false)', async () => {
    const { service, tx, outbox } = makeService();
    await service.resolveDispute('admin', 'd1', { status: 'RESOLVED' } as Any);
    expect(tx.review.delete).not.toHaveBeenCalled();
    const decided = outbox.record.mock.calls.find((c: Any[]) => c[2] === 'dispute.decided');
    expect(decided[3].dismissed).toBe(false);
  });
});

// E-company-1 (WF1-2 / WF1-10): livrarea o marcheaza doar OWNER/MANAGER, iar castigatorul
// trebuie sa fie inca OFFER_SENT (verificat si sub FOR UPDATE pe cerere).
describe('markDelivered - E-company-1', () => {
  const accepted = { id: 'r1', title: 'X', status: 'IN_EXECUTION', clientUserId: 'u-client' };

  it.each(['EMPLOYEE_MANAGED', 'EMPLOYEE_TRUSTED'])('%s → 403 FORBIDDEN, fara tranzactie', async (memberRole) => {
    const { service, prisma, outbox } = makeService({ request: accepted });
    await expect(service.markDelivered({ companyId: 'c1', memberRole } as Any, 'r1')).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('MANAGER → DELIVERED_BY_COMPANY', async () => {
    const { service } = makeService({ request: accepted });
    await expect(service.markDelivered({ companyId: 'c1', memberRole: 'MANAGER' } as Any, 'r1')).resolves.toEqual({
      status: 'DELIVERED_BY_COMPANY',
    });
  });

  it('slot castigator retras (WITHDRAWN) → 409 DELIVERY_NOT_ALLOWED, cererea nu se schimba', async () => {
    const { service, prisma, tx } = makeService({ request: accepted });
    prisma.quote.findFirst.mockResolvedValue({
      claimSlotId: 'slot1',
      company: { name: 'Test' },
      claimSlot: { status: 'WITHDRAWN' },
    });
    await expect(service.markDelivered({ companyId: 'c1', memberRole: 'OWNER' } as Any, 'r1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'DELIVERY_NOT_ALLOWED' },
    });
    expect(tx.request.updateMany).not.toHaveBeenCalled();
  });

  it('RACE: slotul se inchide intre verificare si tranzactie (count 0 sub lock) → 409, fara notificari', async () => {
    const { service, tx, outbox } = makeService({ request: accepted });
    tx.claimSlot.count.mockResolvedValue(0);
    await expect(service.markDelivered({ companyId: 'c1', memberRole: 'OWNER' } as Any, 'r1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'DELIVERY_NOT_ALLOWED' },
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.claimSlot.count).toHaveBeenCalledWith({ where: { id: 'slot1', status: 'OFFER_SENT' } });
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });
});
