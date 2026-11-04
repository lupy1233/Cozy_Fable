import { companyCtx, makeQuoteFull, makeService, offerDto } from './quotes.test-fixtures';

// E-company-2 — negocierea (4.13): limita de 3 versiuni non-extra, o singura cerere PENDING,
// modificarea refuzata nu se reia, extra/consultanta doar dupa limita; toate re-verificate
// pe starea BLOCATA (nu pe snapshot) si tranzitiile ofertei conditionate pe SENT/EXPIRED.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const pending = (id = 'cr1') => ({
  id,
  quoteVersionId: 'x',
  clientUserId: 'u-client',
  requestedText: 'mai ieftin',
  status: 'PENDING',
  respondedAt: null,
  createdAt: new Date(),
});

function snapshotWith(nonExtra: number, opts: { pendingOnLatest?: boolean; status?: string } = {}) {
  const versions = Array.from({ length: nonExtra }, (_, i) => ({
    changeRequests:
      opts.pendingOnLatest && i === nonExtra - 1 ? [{ ...pending(), quoteVersionId: `v${nonExtra}` }] : [],
  }));
  return makeQuoteFull({ versions, status: opts.status });
}

type Action = 'revise' | 'reoffer' | 'requestChange' | 'extra' | 'consultation';

async function run(action: Action, nonExtra: number, ctx = makeService({ snapshot: snapshotWith(nonExtra, { pendingOnLatest: action === 'revise' }) })) {
  const { service, prisma } = ctx;
  switch (action) {
    case 'revise':
      prisma.quoteChangeRequest.findUnique.mockResolvedValue({ ...pending(), quoteVersionId: `v${nonExtra}` });
      return service.reviseQuote(companyCtx, 'u-firm', 'q1', { ...offerDto, changeRequestId: 'cr1' } as Any);
    case 'reoffer':
      return service.reofferModify(companyCtx, 'u-firm', 'q1', offerDto);
    case 'extra':
      return service.extraVersion(companyCtx, 'u-firm', 'q1', offerDto);
    case 'consultation':
      return service.createConsultationInvite(companyCtx, 'q1', {
        locationAddress: 'Str. X 1',
        proposedDatetime: new Date(Date.now() + 86400000).toISOString(),
      } as Any);
    case 'requestChange':
      prisma.quoteVersion.findUnique.mockResolvedValue({ id: `v${nonExtra}`, quoteId: 'q1' });
      return service.requestChange('u-client', { quoteVersionId: `v${nonExtra}`, requestedText: 'alt text' });
  }
}

describe('QuotesService — limita de versiuni (tabel nonExtra × actiune)', () => {
  const limitCode: Record<Action, string> = {
    revise: 'QUOTE_VERSION_LIMIT_REACHED',
    reoffer: 'QUOTE_VERSION_LIMIT_REACHED',
    requestChange: 'QUOTE_VERSION_LIMIT_REACHED',
    extra: 'VALIDATION_ERROR',
    consultation: 'VALIDATION_ERROR',
  };
  const allowedAt: Record<Action, (n: number) => boolean> = {
    revise: (n) => n < 3,
    reoffer: (n) => n < 3,
    requestChange: (n) => n < 3,
    extra: (n) => n >= 3,
    consultation: (n) => n >= 3,
  };
  const cases: [Action, number][] = [];
  for (const a of ['revise', 'reoffer', 'requestChange', 'extra', 'consultation'] as Action[]) {
    for (const n of [1, 2, 3]) cases.push([a, n]);
  }

  it.each(cases)('%s cu %i versiuni non-extra', async (action, n) => {
    if (allowedAt[action](n)) {
      await expect(run(action, n)).resolves.toMatchObject({ id: 'q1' });
    } else {
      await expect(run(action, n)).rejects.toMatchObject({ status: 409, response: { code: limitCode[action] } });
    }
  });

  it.each(['revise', 'reoffer', 'requestChange'] as Action[])(
    '%s: limita atinsa INTRE snapshot (2) si lock (3) → refuz sub lock, nimic scris',
    async (action) => {
      const ctx = makeService({
        snapshot: snapshotWith(2, { pendingOnLatest: action === 'revise' }),
        state: { non_extra_count: 3 },
      });
      await expect(run(action, 2, ctx)).rejects.toMatchObject({
        status: 409,
        response: { code: 'QUOTE_VERSION_LIMIT_REACHED' },
      });
      expect(ctx.tx.quoteVersion.create).not.toHaveBeenCalled();
      expect(ctx.tx.quoteChangeRequest.create).not.toHaveBeenCalled();
      expect(ctx.outbox.record).not.toHaveBeenCalled();
    },
  );

  it('versiunea noua = max_version blocat + 1 (nu din snapshot)', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), state: { max_version: 4 } });
    await run('reoffer', 1, ctx);
    expect(ctx.tx.quoteVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: 5, isExtra: false }) });
  });
});

describe('QuotesService.requestChange — garzi (4.13)', () => {
  it('o cerere PENDING deja existenta (sub lock) → 409 VALIDATION_ERROR', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), state: { pending_changes: 1 } });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({
      status: 409,
      response: { code: 'VALIDATION_ERROR', message: 'A change request is already pending' },
    });
    expect(ctx.tx.quoteChangeRequest.create).not.toHaveBeenCalled();
  });

  it('PENDING vazut deja in snapshot → fast-fail fara tranzactie', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { pendingOnLatest: true }) });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aceeasi modificare refuzata anterior → 409 CHANGE_REQUEST_ALREADY_REJECTED', async () => {
    const snapshot = makeQuoteFull({
      versions: [{ changeRequests: [{ ...pending(), quoteVersionId: 'v1', status: 'REJECTED', requestedText: 'alt text' }] }],
    });
    const ctx = makeService({ snapshot });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CHANGE_REQUEST_ALREADY_REJECTED' },
    });
  });

  it('negocierea incheiata de firma sub lock → 409 NEGOTIATION_ENDED', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), state: { negotiation_ended_by_company: true } });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({ response: { code: 'NEGOTIATION_ENDED' } });
  });

  it('versiune noua aparuta intre timp (latest_version_id diferit) → 409 VALIDATION_ERROR', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), state: { latest_version_id: 'v9' } });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR', message: 'Not the latest version' },
    });
  });

  it('oferta EXPIRED → 409 QUOTE_ACCEPT_NOT_ALLOWED (codul de azi)', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { status: 'EXPIRED' }) });
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({ response: { code: 'QUOTE_ACCEPT_NOT_ALLOWED' } });
  });

  it('succes: cererea urca in NEGOTIATION conditionat, din statusul blocat', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), lockedRequest: { status: 'OFFERS_RECEIVED' } });
    await run('requestChange', 1, ctx);
    expect(ctx.tx.request.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: { in: ['CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED'] } },
      data: { status: 'NEGOTIATION' },
    });
  });
});

describe('QuotesService — actiuni pe oferte inchise (QUOTE_NOT_MODIFIABLE)', () => {
  it.each(['WITHDRAWN', 'ACCEPTED', 'SUPERSEDED'])(
    'extraVersion pe oferta %s (snapshot) → 409 QUOTE_NOT_MODIFIABLE fara tranzactie',
    async (status) => {
      const ctx = makeService({ snapshot: snapshotWith(3, { status }) });
      await expect(run('extra', 3, ctx)).rejects.toMatchObject({
        status: 409,
        response: { code: 'QUOTE_NOT_MODIFIABLE' },
      });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['WITHDRAWN', 'ACCEPTED', 'SUPERSEDED'])(
    'extraVersion: oferta devenita %s intre snapshot si lock → 409, nicio versiune scrisa',
    async (status) => {
      const ctx = makeService({ snapshot: snapshotWith(3), state: { quote_status: status as Any } });
      await expect(run('extra', 3, ctx)).rejects.toMatchObject({ response: { code: 'QUOTE_NOT_MODIFIABLE' } });
      expect(ctx.tx.quoteVersion.create).not.toHaveBeenCalled();
    },
  );

  it('extraVersion: slotul nu mai e OFFER_SENT sub lock → 409 QUOTE_NOT_MODIFIABLE', async () => {
    const ctx = makeService({ snapshot: snapshotWith(3), state: { slot_status: 'SLA_EXPIRED' } });
    await expect(run('extra', 3, ctx)).rejects.toMatchObject({ response: { code: 'QUOTE_NOT_MODIFIABLE' } });
  });

  it('extraVersion: updateMany conditionat pe SENT/EXPIRED (count 0 → 409, rollback)', async () => {
    const ctx = makeService({ snapshot: snapshotWith(3) });
    ctx.tx.quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(run('extra', 3, ctx)).rejects.toMatchObject({ response: { code: 'QUOTE_NOT_MODIFIABLE' } });
    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { extraVersionsCount: { increment: 1 }, status: 'SENT' },
    });
  });

  it('cererea inchisa sub lock → 409 REQUEST_NOT_OPEN_FOR_OFFERS', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1), lockedRequest: { status: 'ACCEPTED' } });
    await expect(run('reoffer', 1, ctx)).rejects.toMatchObject({ response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' } });
  });
});

describe('QuotesService.reviseQuote / rejectChange — cererea de modificare', () => {
  it('revise: cererea deja FULFILLED sub lock (updateMany 0) → 409 CHANGE_REQUEST_NOT_PENDING', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { pendingOnLatest: true }) });
    ctx.tx.quoteChangeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(run('revise', 1, ctx)).rejects.toMatchObject({ response: { code: 'CHANGE_REQUEST_NOT_PENDING' } });
    expect(ctx.tx.quoteVersion.create).not.toHaveBeenCalled();
  });

  it('revise: FULFILLED conditionat pe PENDING + oferta; oferta redeschisa conditionat; chitanta cu v2', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { pendingOnLatest: true }) });
    const out = await run('revise', 1, ctx);
    expect(ctx.tx.quoteChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'cr1', status: 'PENDING', quoteVersion: { quoteId: 'q1' } },
      data: { status: 'FULFILLED', respondedAt: expect.any(Date) },
    });
    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'SENT', updatedAt: expect.any(Date) },
    });
    expect(out.versions.map((v: Any) => v.version)).toEqual([1, 2]);
    expect(out.versions[0].changeRequest).toMatchObject({ id: 'cr1', status: 'FULFILLED' });
    // fara recitirea ofertei in tranzactie
    expect(ctx.tx.quote.findUnique).not.toHaveBeenCalled();
  });

  it('rejectChange: deja raspunsa sub lock → 409 CHANGE_REQUEST_NOT_PENDING', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { pendingOnLatest: true }) });
    ctx.prisma.quoteChangeRequest.findUnique.mockResolvedValue({ ...pending(), quoteVersionId: 'v1' });
    ctx.tx.quoteChangeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.rejectChange(companyCtx, 'q1', 'cr1')).rejects.toMatchObject({
      response: { code: 'CHANGE_REQUEST_NOT_PENDING' },
    });
  });

  it('rejectChange pe oferta ACCEPTED → 409 QUOTE_NOT_MODIFIABLE', async () => {
    const ctx = makeService({ snapshot: snapshotWith(1, { pendingOnLatest: true }), state: { quote_status: 'ACCEPTED' } });
    ctx.prisma.quoteChangeRequest.findUnique.mockResolvedValue({ ...pending(), quoteVersionId: 'v1' });
    await expect(ctx.service.rejectChange(companyCtx, 'q1', 'cr1')).rejects.toMatchObject({
      response: { code: 'QUOTE_NOT_MODIFIABLE' },
    });
  });

  it('P2002 pe quote_change_requests_one_pending_per_version → 409 VALIDATION_ERROR (codul de azi)', async () => {
    const { Prisma } = jest.requireActual('@prisma/client');
    const ctx = makeService({ snapshot: snapshotWith(1) });
    ctx.tx.quoteChangeRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { modelName: 'QuoteChangeRequest', target: ['quote_version_id'] },
      }),
    );
    await expect(run('requestChange', 1, ctx)).rejects.toMatchObject({
      status: 409,
      response: { code: 'VALIDATION_ERROR', message: 'A change request is already pending' },
    });
  });
});
