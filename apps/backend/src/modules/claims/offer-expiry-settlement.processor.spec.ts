import { OfferExpirySettlementProcessor } from './offer-expiry-settlement.processor';
import { ClaimSettlementService } from '../billing/claim-settlement.service';

// E-admin-platform-3: inchiderea automata a ofertei expirate fara decizie — no-op cat timp
// PO nu a activat-o (enabled + rezultat), cand nu e scadenta, cand oferta a fost prelungita
// sau cererea acceptata, si cand slotul are o retragere in asteptarea adminului.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY = 24 * 60 * 60 * 1000;
const ENABLED: Record<string, string> = {
  expired_offer_autoclose_enabled: 'true',
  expired_offer_autoclose_days: '14',
  expired_offer_autoclose_credit_outcome: 'REFUND',
};

function harness(opts: {
  settings?: Record<string, string>;
  requestStatus?: string;
  quoteStatus?: string;
  validUntil?: Date;
  slotCount?: number;
  republished?: boolean;
} = {}) {
  const tx: Any = {
    // E-admin-platform-10: recalculul citeste max_claims_per_request in tranzactie (null → fallback 3)
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([{ status: opts.requestStatus ?? 'OFFERS_RECEIVED', deleted_at: null }]),
    quote: {
      findUnique: jest.fn().mockResolvedValue({
        status: opts.quoteStatus ?? 'EXPIRED',
        claimSlotId: 's1',
        companyId: 'c1',
        request: { clientUserId: 'u-client' },
        versions: [{ validUntil: opts.validUntil ?? new Date(Date.now() - 15 * DAY) }],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    claimSlot: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.slotCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', companyId: 'c1', requestId: 'r1', claimCostCreditsSnapshot: 3 }),
      count: jest.fn().mockResolvedValue(opts.republished ? 0 : 1),
    },
    chatThread: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    // E-admin-platform-15: ledger-ul slotului (RESERVE) citit de settle()
    creditTransaction: { findMany: jest.fn().mockResolvedValue([{ type: 'RESERVE', amount: 3 }]) },
    request: {
      findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: opts.requestStatus ?? 'OFFERS_RECEIVED', deletedAt: null }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
  };
  // recompute: fara alte oferte deschise → coboara la CLAIMED_* / revine in piata
  tx.quote.count = jest.fn().mockResolvedValue(0);
  const prisma: Any = {
    quote: { findUnique: jest.fn().mockResolvedValue({ requestId: 'r1' }) },
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
  };
  const values: Record<string, string> = opts.settings ?? ENABLED;
  const settings: Any = {
    getString: jest.fn(async (k: string, f: string) => values[k] ?? f),
    getInt: jest.fn(async (k: string, f: number) => (values[k] ? Number(values[k]) : f)),
  };
  const credits: Any = { refund: jest.fn().mockResolvedValue(true), consume: jest.fn().mockResolvedValue(true) };
  // decontarea reala (bilet + ledger) peste credite mock-uite
  const settlement = new ClaimSettlementService(credits);
  const calendar: Any = { addWorkingDays: jest.fn().mockReturnValue(new Date(Date.now() + 7 * DAY)) };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const proc = new OfferExpirySettlementProcessor(prisma, settlement, calendar, settings, outbox, queue);
  return { proc, tx, prisma, credits, outbox, queue };
}

const job: Any = { data: { quoteId: 'q1' } };

describe('OfferExpirySettlementProcessor', () => {
  it.each([
    ['oprita (implicit)', {}],
    ['activata dar rezultat UNSET', { expired_offer_autoclose_enabled: 'true', expired_offer_autoclose_credit_outcome: 'UNSET' }],
    ['rezultat setat dar neactivata', { expired_offer_autoclose_credit_outcome: 'REFUND' }],
  ])('%s → no-op complet', async (_label, settings) => {
    const { proc, prisma, credits } = harness({ settings });
    await proc.process(job);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('inca nescadenta (valid_until + 14 zile in viitor) → no-op', async () => {
    const { proc, tx, credits } = harness({ validUntil: new Date(Date.now() - 2 * DAY) });
    await proc.process(job);
    expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('oferta prelungita / reofertata intre timp (SENT) → no-op', async () => {
    const { proc, tx, credits } = harness({ quoteStatus: 'SENT' });
    await proc.process(job);
    expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('cererea a fost acceptata intre timp → no-op sub lock', async () => {
    const { proc, tx, credits } = harness({ requestStatus: 'ACCEPTED' });
    await proc.process(job);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.quote.findUnique).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('retragere PENDING_ADMIN_REVIEW pe slot → filtrul din UPDATE da count 0, fara credite', async () => {
    const { proc, tx, credits, outbox } = harness({ slotCount: 0 });
    await proc.process(job);
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { withdrawals: { none: { status: 'PENDING_ADMIN_REVIEW' } }, id: 's1', status: { in: ['OFFER_SENT'] } },
      data: { status: 'CANCELLED_OFFER_EXPIRED', withdrawnAt: expect.any(Date) },
    });
    expect(credits.refund).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('scadenta → CANCELLED_OFFER_EXPIRED + un refund + oferta WITHDRAWN + recalcul + ambele parti anuntate', async () => {
    const { proc, tx, credits, outbox } = harness();
    await proc.process(job);
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(credits.refund).toHaveBeenCalledWith('c1', 3, 'OFFER_EXPIRED_UNDECIDED_REFUND', 's1', tx);
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { claimSlotId: 's1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    });
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CLAIMED_PARTIAL' } });
    expect(outbox.record).toHaveBeenCalledWith(tx, 'claim.withdrawn:s1:OFFER_EXPIRED_UNDECIDED', 'claim.withdrawn',
      expect.objectContaining({ reason: 'OFFER_EXPIRED_UNDECIDED', refunded: true }), ['m1']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'quote.expired_closed:q1', 'quote.expired_closed',
      expect.objectContaining({ quoteId: 'q1', requestId: 'r1' }), ['u-client']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'request.offer-expired-closed:s1', 'request.status_changed',
      { requestId: 'r1' }, []);
  });

  it('CONSUME din setari → un consum; cererea goala revine in piata + job de expirare dupa commit', async () => {
    const { proc, tx, credits, queue } = harness({
      settings: { ...ENABLED, expired_offer_autoclose_credit_outcome: 'CONSUME' },
      republished: true,
    });
    await proc.process(job);
    expect(credits.consume).toHaveBeenCalledWith('c1', 3, 'OFFER_EXPIRED_UNDECIDED_CONSUME', 's1', tx);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE', expiresAt: expect.any(Date) },
    });
    expect(queue.add).toHaveBeenCalledWith('expire', { requestId: 'r1' }, expect.objectContaining({ jobId: expect.stringMatching(/^req-exp-r1-/) }));
  });
});
