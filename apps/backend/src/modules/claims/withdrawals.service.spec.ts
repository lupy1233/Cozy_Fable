import { WithdrawalsService } from './withdrawals.service';

// L0-B — retrageri (4.15) cu Prisma mock-uit:
//  - voluntar dupa gratie: creditele rezervate se CONSUMA (nu raman RESERVED la infinit);
//  - CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION → PENDING_ADMIN_REVIEW (nu auto);
//  - retragerea unui slot OFFER_SENT inchide ofertele (WITHDRAWN) + thread read-only;
//  - admin approve pe slot deja inchis → 409 (fara refund dublu).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function makeService(slot: Any, pending: Any = null) {
  const tx: Any = {
    claimSlot: { update: jest.fn().mockResolvedValue(undefined), count: jest.fn().mockResolvedValue(1) },
    claimWithdrawal: {
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
      update: jest.fn().mockImplementation(({ data }: Any) =>
        Promise.resolve({
          id: 'wd1',
          claimSlotId: slot.id,
          reasonType: 'CUSTOM',
          customReason: null,
          createdAt: new Date(),
          ...data,
        }),
      ),
    },
    quote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    chatThread: { updateMany: jest.fn().mockResolvedValue(undefined) },
    request: { findUnique: jest.fn().mockResolvedValue({ id: slot.requestId, status: 'CLAIMED_PARTIAL' }) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    claimWithdrawal: {
      findFirst: jest.fn().mockResolvedValue(pending),
      create: tx.claimWithdrawal.create,
      findUnique: jest.fn(),
    },
  };
  const credits: Any = {
    refund: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const penalties: Any = { applyPenalty: jest.fn().mockResolvedValue(undefined) };
  const eventBus: Any = { publish: jest.fn().mockResolvedValue(undefined) };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new WithdrawalsService(prisma, credits, penalties, eventBus, queue);
  return { service, tx, prisma, credits, penalties, eventBus, queue };
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
    request: { lastEditAt: null },
    chatThread: { lastClientMessageAt: null },
    ...overrides,
  };
}

describe('WithdrawalsService (L0-B)', () => {
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
      expect(tx.claimSlot.update).not.toHaveBeenCalled();
      expect(credits.refund).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('remind', { withdrawalId: 'wd1' }, expect.objectContaining({ jobId: 'wd-rem-wd1' }));
    },
  );

  it('retragerea unui slot OFFER_SENT (auto-aprobat) inchide ofertele SENT/EXPIRED → WITHDRAWN + thread read-only', async () => {
    const s = slot({
      status: 'OFFER_SENT',
      createdAt: new Date(Date.now() - 3 * 24 * HOURS_2 * 12),
      chatThread: { lastClientMessageAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
    });
    const { service, tx, credits } = makeService(s);
    const wd = await service.request(ctx, 'u1', 's1', { reasonType: 'CLIENT_UNRESPONSIVE_48H' } as Any);
    expect(wd.status).toBe('AUTO_APPROVED');
    expect(tx.claimSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: expect.objectContaining({ status: 'WITHDRAWN' }) }),
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
});
