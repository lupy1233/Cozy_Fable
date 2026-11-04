import { ClaimSettlementService, type SettleArgs } from './claim-settlement.service';
import type { CreditsService } from './credits.service';

// E-admin-platform-15 (preia cazurile din claims/settlement.spec.ts, E-admin-platform-3):
// biletul de decontare — creditele se misca O SINGURA data, doar daca tranzitia conditionata
// a reusit (count === 1) si doar daca ledger-ul are un RESERVE nedecontat.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const SLOT = { id: 's1', companyId: 'c1', requestId: 'r1', claimCostCreditsSnapshot: 4 };

function makeTx(count: number, ledger: { type: string; amount: number }[] = [{ type: 'RESERVE', amount: 4 }]) {
  const tx: Any = {
    claimSlot: {
      updateMany: jest.fn().mockResolvedValue({ count }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(SLOT),
    },
    quote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    chatThread: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    creditTransaction: { findMany: jest.fn().mockResolvedValue(ledger) },
  };
  const credits = {
    refund: jest.fn().mockResolvedValue(true),
    consume: jest.fn().mockResolvedValue(true),
  };
  const service = new ClaimSettlementService(credits as unknown as CreditsService);
  return { tx, credits, service };
}

const PROJECT_REFUND: SettleArgs = {
  claimSlotId: 's1',
  from: ['OFFER_SENT'],
  to: 'CANCELLED_PROJECT',
  outcome: 'REFUND',
  reason: 'PROJECT_CANCELLED_REFUND',
  quotes: 'WITHDRAWN',
};

describe('ClaimSettlementService.settle', () => {
  it('count 0 (slot deja inchis pe alta cale) → fara credite si fara atingerea ofertelor', async () => {
    const { tx, credits, service } = makeTx(0);
    const res = await service.settle(tx, PROJECT_REFUND);
    expect(res).toEqual({ settled: false });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.creditTransaction.findMany).not.toHaveBeenCalled();
  });

  it('REFUND → un singur refund cu suma din RESERVE + oferte deschise WITHDRAWN', async () => {
    const { tx, credits, service } = makeTx(1);
    const res = await service.settle(tx, PROJECT_REFUND);
    expect(res).toEqual({ settled: true, slot: SLOT, credit: 'REFUNDED', refunded: true, amount: 4 });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', status: { in: ['OFFER_SENT'] } },
      data: { status: 'CANCELLED_PROJECT', withdrawnAt: expect.any(Date) },
    });
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(credits.refund).toHaveBeenCalledWith('c1', 4, 'PROJECT_CANCELLED_REFUND', 's1', tx);
    expect(credits.consume).not.toHaveBeenCalled();
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { claimSlotId: 's1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    });
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 's1' }, data: { readOnly: true } });
  });

  it('CONSUME → un singur consum; filtrul `where` ajunge in acelasi UPDATE', async () => {
    const { tx, credits, service } = makeTx(1);
    const res = await service.settle(tx, {
      claimSlotId: 's1',
      from: ['OFFER_SENT'],
      to: 'CANCELLED_OFFER_EXPIRED',
      outcome: 'CONSUME',
      reason: 'OFFER_EXPIRED_UNDECIDED_CONSUME',
      where: { withdrawals: { none: { status: 'PENDING_ADMIN_REVIEW' } } },
      quotes: 'WITHDRAWN',
    });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: {
        withdrawals: { none: { status: 'PENDING_ADMIN_REVIEW' } },
        id: 's1',
        status: { in: ['OFFER_SENT'] },
      },
      data: { status: 'CANCELLED_OFFER_EXPIRED', withdrawnAt: expect.any(Date) },
    });
    expect(credits.consume).toHaveBeenCalledTimes(1);
    expect(credits.consume).toHaveBeenCalledWith('c1', 4, 'OFFER_EXPIRED_UNDECIDED_CONSUME', 's1', tx);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(res).toMatchObject({ settled: true, credit: 'CONSUMED', refunded: false, amount: 4 });
  });

  it('fara RESERVE in ledger (demo / vechi) → tranzitia se comite, fara portofel si fara ledger', async () => {
    const { tx, credits, service } = makeTx(1, []);
    const res = await service.settle(tx, { ...PROJECT_REFUND, from: ['ACTIVE'], to: 'SLA_EXPIRED', outcome: 'CONSUME', reason: 'SLA_BREACH', quotes: 'KEEP' });
    expect(res).toMatchObject({ settled: true, credit: 'SKIPPED_NO_RESERVE', refunded: false, amount: 0 });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledTimes(1);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('rezervare deja decontata (REFUND/CONSUME existent) → skip', async () => {
    const { tx, credits, service } = makeTx(1, [
      { type: 'RESERVE', amount: 4 },
      { type: 'CONSUME', amount: 4 },
    ]);
    const res = await service.settle(tx, PROJECT_REFUND);
    expect(res).toMatchObject({ settled: true, credit: 'SKIPPED_ALREADY_SETTLED', refunded: false });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('portofel deviat (credits intoarce false) → SKIPPED_WALLET_DRIFT, refunded false', async () => {
    const { tx, credits, service } = makeTx(1);
    credits.refund.mockResolvedValue(false);
    const res = await service.settle(tx, PROJECT_REFUND);
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ settled: true, credit: 'SKIPPED_WALLET_DRIFT', refunded: false, amount: 0 });
  });

  it('suma vine din RESERVE (ledger), nu din snapshot', async () => {
    const { tx, credits, service } = makeTx(1, [{ type: 'RESERVE', amount: 7 }]);
    const res = await service.settle(tx, PROJECT_REFUND);
    expect(credits.refund).toHaveBeenCalledWith('c1', 7, 'PROJECT_CANCELLED_REFUND', 's1', tx);
    expect(res).toMatchObject({ amount: 7 });
  });

  it('quotes KEEP → nu atinge nici ofertele, nici chat-ul', async () => {
    const { tx, service } = makeTx(1);
    await service.settle(tx, { ...PROJECT_REFUND, quotes: 'KEEP' });
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.chatThread.updateMany).not.toHaveBeenCalled();
  });

  it('quotes SUPERSEDED → ofertele deschise SUPERSEDED + chat read-only', async () => {
    const { tx, service } = makeTx(1);
    await service.settle(tx, { ...PROJECT_REFUND, quotes: 'SUPERSEDED' });
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { claimSlotId: 's1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'SUPERSEDED' },
    });
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 's1' }, data: { readOnly: true } });
  });

  it('quotes CHAT_READ_ONLY → doar chat-ul, ofertele raman', async () => {
    const { tx, service } = makeTx(1);
    await service.settle(tx, { ...PROJECT_REFUND, quotes: 'CHAT_READ_ONLY' });
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 's1' }, data: { readOnly: true } });
  });

  it('COMPLETED → fara withdrawnAt pe slot', async () => {
    const { tx, service } = makeTx(1);
    await service.settle(tx, {
      claimSlotId: 's1',
      from: ['OFFER_SENT'],
      to: 'COMPLETED',
      outcome: 'CONSUME',
      reason: 'COMPLETED',
      quotes: 'KEEP',
    });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', status: { in: ['OFFER_SENT'] } },
      data: { status: 'COMPLETED' },
    });
  });

  it('slot dat de apelant → fara findUniqueOrThrow', async () => {
    const { tx, service } = makeTx(1);
    const res = await service.settle(tx, {
      ...PROJECT_REFUND,
      slot: { companyId: 'c1', requestId: 'r1', claimCostCreditsSnapshot: 4 },
    });
    expect(tx.claimSlot.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(res).toMatchObject({ settled: true, slot: SLOT });
  });
});
