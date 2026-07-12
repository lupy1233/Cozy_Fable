import {
  haversineKm,
  recomputeRequestStatusAfterClaimChange,
  republishAfterMassBreach,
} from './claims.helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = any;

function makeTx(opts: {
  requestStatus?: string | null;
  occupied?: number;
  breachedCompanies?: string[];
}): AnyTx {
  return {
    request: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.requestStatus === null ? null : { id: 'r1', status: opts.requestStatus },
        ),
      update: jest.fn().mockResolvedValue(undefined),
    },
    claimSlot: {
      count: jest.fn().mockResolvedValue(opts.occupied ?? 0),
      findMany: jest
        .fn()
        .mockResolvedValue((opts.breachedCompanies ?? []).map((companyId) => ({ companyId }))),
    },
    requestCompanyExclusion: { upsert: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('haversineKm', () => {
  it('distanta identica = 0', () => {
    expect(haversineKm(44.43, 26.1, 44.43, 26.1)).toBe(0);
  });

  it('Bucuresti → Iasi ≈ 300-340 km (verificarea ariei de acoperire)', () => {
    const km = haversineKm(44.4268, 26.1025, 47.1585, 27.6014);
    expect(km).toBeGreaterThan(300);
    expect(km).toBeLessThan(340);
  });
});

describe('recomputeRequestStatusAfterClaimChange (3.1)', () => {
  it('toate sloturile ocupate → CLAIMED_FULL', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 3 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', 3);
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'CLAIMED_FULL' },
    });
  });

  it('zero sloturi ocupate → inapoi IN_MARKETPLACE', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 0 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', 3);
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE' },
    });
  });

  it('NU suprascrie statusurile din afara fazei de claim (ex. ACCEPTED)', async () => {
    const tx = makeTx({ requestStatus: 'ACCEPTED', occupied: 0 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', 3);
    expect(tx.request.update).not.toHaveBeenCalled();
  });
});

describe('republishAfterMassBreach (4.11)', () => {
  const newExpiry = new Date('2026-08-01T00:00:00Z');

  it('cu claim-uri inca active NU re-publica', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 1 });
    await expect(republishAfterMassBreach(tx, 'r1', newExpiry)).resolves.toBe(false);
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('fara claim-uri active: exclude firmele care au ratat SLA si re-publica', async () => {
    const tx = makeTx({
      requestStatus: 'CLAIMED_FULL',
      occupied: 0,
      breachedCompanies: ['cA', 'cB'],
    });
    await expect(republishAfterMassBreach(tx, 'r1', newExpiry)).resolves.toBe(true);
    expect(tx.requestCompanyExclusion.upsert).toHaveBeenCalledTimes(2);
    expect(tx.requestCompanyExclusion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { requestId: 'r1', companyId: 'cA', reason: 'SLA_BREACH' },
      }),
    );
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE', expiresAt: newExpiry },
    });
  });
});
