import { Prisma } from '@prisma/client';
import {
  closeOpenQuotesForSlot,
  haversineKm,
  readMaxClaims,
  recomputeRequestStatusAfterClaimChange,
  republishAfterMassBreach,
  slaBreachAt,
  slaGraceWarningEventKey,
  slaGraceWarningJobOptions,
  withSerializationRetry,
} from './claims.helpers';
import { CLAIMABLE_STATUSES, claimableStatuses } from './claims.constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = any;

function makeTx(opts: {
  requestStatus?: string | null;
  occupied?: number;
  openQuotes?: number;
  breachedCompanies?: string[];
  maxClaimsSetting?: string | number;
}): AnyTx {
  return {
    systemSetting: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.maxClaimsSetting === undefined
            ? null
            : { key: 'max_claims_per_request', value: String(opts.maxClaimsSetting) },
        ),
    },
    request: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.requestStatus === null ? null : { id: 'r1', status: opts.requestStatus, deletedAt: null },
        ),
      update: jest.fn().mockResolvedValue(undefined),
    },
    claimSlot: {
      count: jest.fn().mockResolvedValue(opts.occupied ?? 0),
      findMany: jest
        .fn()
        .mockResolvedValue((opts.breachedCompanies ?? []).map((companyId) => ({ companyId }))),
    },
    quote: { count: jest.fn().mockResolvedValue(opts.openQuotes ?? 0) },
    requestCompanyExclusion: { upsert: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('slaBreachAt (E-company-6)', () => {
  it('fara termen → null', () => {
    expect(slaBreachAt(null, null)).toBeNull();
  });

  it('SLA pe pauza → null (procesorul sare peste sloturile pe pauza)', () => {
    expect(slaBreachAt(new Date('2026-06-18T00:00:00Z'), new Date('2026-06-17T10:00:00Z'))).toBeNull();
  });

  it('termen + 12h gratie', () => {
    expect(slaBreachAt(new Date('2026-06-18T00:09:57Z'), null)?.toISOString()).toBe('2026-06-18T12:09:57.000Z');
  });
});

describe('slaGraceWarningJobOptions (E-company-13)', () => {
  const now = Date.parse('2026-09-30T10:00:00Z');
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('delay = termen - acum; jobId fara ":" si cu termenul', () => {
    const deadline = new Date(now + 5 * 60 * 60 * 1000);
    const opts = slaGraceWarningJobOptions('s1', deadline);
    expect(opts.delay).toBe(5 * 60 * 60 * 1000);
    expect(opts.jobId).toBe(`sla-grace-warn-s1-${deadline.getTime()}`);
    expect(opts.jobId).not.toContain(':');
    expect(opts.removeOnComplete).toBe(true);
  });

  it('termen trecut → delay 0', () => {
    expect(slaGraceWarningJobOptions('s1', new Date(now - 60_000)).delay).toBe(0);
  });

  it('cheia outbox include slotul si termenul', () => {
    expect(slaGraceWarningEventKey('s1', 123)).toBe('sla.expiring_soon:grace:s1:123');
  });
});

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
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 3);
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'CLAIMED_FULL' },
    });
  });

  it('zero sloturi ocupate → inapoi IN_MARKETPLACE', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 0 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 3);
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE' },
    });
  });

  it('NU suprascrie statusurile din afara fazei de claim (ex. ACCEPTED)', async () => {
    const tx = makeTx({ requestStatus: 'ACCEPTED', occupied: 0 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 3);
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  // --- Pasul 5 (audit 2026-08-23, F4/F5): cereri zombie ---

  it('F4: OFFERS_RECEIVED cu 0 ocupanti → revine IN_MARKETPLACE cu ceas nou + republishedExpiresAt', async () => {
    const tx = makeTx({ requestStatus: 'OFFERS_RECEIVED', occupied: 0 });
    const expiresAt = new Date('2026-09-01T12:00:00Z');
    const res = await recomputeRequestStatusAfterClaimChange(tx, 'r1', { republishExpiresAt: expiresAt });
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE', expiresAt },
    });
    expect(res.republishedExpiresAt).toEqual(expiresAt);
  });

  it('F4: OFFERS_RECEIVED cu ocupanti dar 0 oferte deschise → coboara la CLAIMED_PARTIAL', async () => {
    const tx = makeTx({ requestStatus: 'OFFERS_RECEIVED', occupied: 1, openQuotes: 0 });
    const res = await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 3);
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'CLAIMED_PARTIAL' },
    });
    expect(res.republishedExpiresAt).toBeNull();
  });

  it('F4: NEGOTIATION cu oferte inca deschise → statusul ramane neatins', async () => {
    const tx = makeTx({ requestStatus: 'NEGOTIATION', occupied: 2, openQuotes: 1 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 3);
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  // --- E-admin-platform-10: pragul CLAIMED_FULL vine din max_claims_per_request ---

  it('fara maxClaims explicit: settingul 2 + 2 ocupanti → CLAIMED_FULL', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 2, maxClaimsSetting: '2' });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1');
    expect(tx.systemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'max_claims_per_request' } });
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CLAIMED_FULL' } });
  });

  it('fara maxClaims explicit si fara setting → fallback 3 (2 ocupanti raman CLAIMED_PARTIAL)', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 2 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1');
    expect(tx.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it.each(['0', 'abc', '-1'])('setting invalid %p → fallback 3', async (value) => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 2, maxClaimsSetting: value });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1');
    expect(tx.request.update).not.toHaveBeenCalled();
    await expect(readMaxClaims(tx)).resolves.toBe(3);
  });

  it('maxClaims explicit castiga: settingul nu se mai citeste', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 2, maxClaimsSetting: '3' });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1', undefined, 2);
    expect(tx.systemSetting.findUnique).not.toHaveBeenCalled();
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CLAIMED_FULL' } });
  });

  it('OFFERS_RECEIVED cu oferte deschise → iesire devreme, settingul nu se citeste', async () => {
    const tx = makeTx({ requestStatus: 'OFFERS_RECEIVED', occupied: 3, openQuotes: 1, maxClaimsSetting: '2' });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1');
    expect(tx.systemSetting.findUnique).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('0 ocupanti → re-publicare fara citirea settingului', async () => {
    const tx = makeTx({ requestStatus: 'CLAIMED_PARTIAL', occupied: 0 });
    await recomputeRequestStatusAfterClaimChange(tx, 'r1');
    expect(tx.systemSetting.findUnique).not.toHaveBeenCalled();
  });
});

describe('claimableStatuses (E-admin-platform-10)', () => {
  it('flag oprit → exact setul invariantei 3.1', () => {
    expect(claimableStatuses(false)).toEqual(['IN_MARKETPLACE', 'CLAIMED_PARTIAL']);
    expect(claimableStatuses(false)).toBe(CLAIMABLE_STATUSES);
  });

  it('flag pornit → + OFFERS_RECEIVED/NEGOTIATION, niciodata CLAIMED_FULL', () => {
    const set = claimableStatuses(true);
    expect(set).toEqual(['IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'OFFERS_RECEIVED', 'NEGOTIATION']);
    expect(set).not.toContain('CLAIMED_FULL');
    expect(set).not.toContain('ACCEPTED');
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

describe('withSerializationRetry (P2034, L0-B + E-company-2)', () => {
  const p2034 = () =>
    new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: 'test' });

  it('reia la serialization failure si intoarce rezultatul (succes la a 3-a incercare)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(p2034())
      .mockRejectedValueOnce(p2034())
      .mockResolvedValueOnce('ok');
    await expect(withSerializationRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries up to 3 times: P2034 persistent → 4 apeluri, apoi 409 CONCURRENT_MODIFICATION', async () => {
    const fn = jest.fn().mockRejectedValue(p2034());
    await expect(withSerializationRetry(fn)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONCURRENT_MODIFICATION' },
    });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it.each(['40001', '40P01'])('raw query P2010 cu SQLSTATE %s e tratat ca serialization failure', async (sqlState) => {
    const raw = new Prisma.PrismaClientKnownRequestError('raw failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: sqlState, message: 'could not serialize access' },
    });
    const fn = jest.fn().mockRejectedValueOnce(raw).mockResolvedValueOnce('ok');
    await expect(withSerializationRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('P2010 cu alt SQLSTATE trece neschimbat', async () => {
    const raw = new Prisma.PrismaClientKnownRequestError('raw failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '23505' },
    });
    const fn = jest.fn().mockRejectedValue(raw);
    await expect(withSerializationRetry(fn)).rejects.toBe(raw);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('alte erori trec neschimbate, fara retry', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(withSerializationRetry(fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('closeOpenQuotesForSlot (L0-B)', () => {
  it('WITHDRAWN: ofertele SENT/EXPIRED → WITHDRAWN + withdrawnAt; thread read-only', async () => {
    const tx: AnyTx = {
      quote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      chatThread: { updateMany: jest.fn().mockResolvedValue(undefined) },
    };
    await expect(closeOpenQuotesForSlot(tx, 's1', 'WITHDRAWN')).resolves.toBe(1);
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { claimSlotId: 's1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    });
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 's1' }, data: { readOnly: true } });
  });

  it('SUPERSEDED (accept pe alta oferta): fara withdrawnAt', async () => {
    const tx: AnyTx = {
      quote: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      chatThread: { updateMany: jest.fn().mockResolvedValue(undefined) },
    };
    await closeOpenQuotesForSlot(tx, 's1', 'SUPERSEDED');
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUPERSEDED' } }),
    );
  });
});
