import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CURRENT_FLOW_VERSION, ERROR_CODES } from '@marketplace/shared';
import { RequestsService } from './requests.service';

// E-client-3: repost autentificat (updateMany conditionat) + tokenul de draft
// valabil doar pe CIORNA si doar pentru proprietar/anonim.

type AnyMock = jest.Mock;

const EXP_ID = 'req-1';

function baseRequest(over: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    clientUserId: 'A',
    status: 'EXPIRED',
    repostUsed: false,
    deletedAt: null,
    configuratorState: null,
    ...over,
  };
}

function setup() {
  const tx = {
    request: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    requestContactDetection: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    request: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    // f2: rolul celui care publica se citeste din baza; a6: adminii anuntati (inainte de tranzactie)
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'CLIENT' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]),
    },
    // a6: acoperirea zonei (implicit exista o firma pe raza), citita in afara tranzactiei
    $queryRaw: jest.fn().mockResolvedValue([{ covered: true }]),
    // b8 / M3: camerele bifate ale cererii editate (reprezentarea veche a proiectarii)
    requestRoom: { count: jest.fn().mockResolvedValue(0) },
    requestContactDetection: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    requestStudioScene: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const geo = { geocode: jest.fn().mockResolvedValue({ lat: 44.4, lng: 26.1 }) };
  const sizing = { compute: jest.fn().mockResolvedValue({ score: 1, size: 'SMALL', creditCost: 1, baseScore: 1 }) };
  const configurator = {
    processRooms: jest.fn().mockReturnValue({ rooms: [], scoreEntries: [] }),
    collectUploadAttachmentIds: jest.fn().mockReturnValue([]),
    passesStrictValidation: jest.fn().mockReturnValue(false),
  };
  const inspiration = { assertSelectable: jest.fn().mockResolvedValue(undefined) };
  const calendar = {
    addWorkingDays: jest.fn().mockReturnValue(new Date('2026-10-20T10:00:00Z')),
    // E-admin-platform-44: reminderul 4.4 programat langa jobul de expirare
    workingDateBefore: jest.fn().mockReturnValue('2026-10-19'),
    bucharestWallClock: jest.fn().mockReturnValue(new Date('2026-10-19T06:00:00Z')),
  };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  // E-admin-platform-45: politica pentru contacte in texte libere (implicit MASK)
  const settings = { getString: jest.fn((_key: string, fallback: string) => Promise.resolve(fallback)) };
  const service = new RequestsService(
    prisma as never,
    geo as never,
    sizing as never,
    configurator as never,
    {} as never,
    inspiration as never,
    calendar as never,
    outbox as never,
    {} as never,
    queue as never,
    settings as never,
  );
  jest.spyOn(service as never, 'toDto').mockImplementation(((id: string) => Promise.resolve({ id })) as never);
  return { service, prisma, tx, configurator, outbox, queue, geo, settings, sizing };
}

async function expectCode(p: Promise<unknown>, type: new (...a: never[]) => Error, code: string) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(type);
  expect((err as { getResponse(): { code: string } }).getResponse().code).toBe(code);
}

describe('RequestsService.repostForClient', () => {
  // ceasul fixat inaintea termenului mock (2026-10-20); altfel reminderul nu se mai programeaza dupa acea data
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-10-06T10:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reposts an expired request with a conditional update, one outbox event and one expiration job', async () => {
    const { service, prisma, tx, outbox, queue } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest());

    await expect(service.repostForClient('A', EXP_ID)).resolves.toEqual({ id: EXP_ID });

    expect(tx.request.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXP_ID, status: 'EXPIRED', repostUsed: false, deletedAt: null },
        data: expect.objectContaining({ status: 'IN_MARKETPLACE', repostUsed: true }),
      }),
    );
    expect(outbox.record).toHaveBeenCalledTimes(1);
    expect(outbox.record.mock.calls[0][1]).toBe(`request.reposted:${EXP_ID}`);
    expect(queue.add.mock.calls.filter((c: unknown[]) => c[0] === 'expire')).toHaveLength(1);
    // E-admin-platform-44: + reminderul catre client (4.4), cu jobId determinist
    expect(queue.add).toHaveBeenCalledWith(
      'remind-expiry',
      expect.objectContaining({ requestId: EXP_ID }),
      expect.objectContaining({ jobId: `req-rem-${EXP_ID}-${new Date('2026-10-20T10:00:00Z').getTime()}` }),
    );
  });

  it('rejects when the repost was already used', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ repostUsed: true }));
    await expectCode(service.repostForClient('A', EXP_ID), BadRequestException, ERROR_CODES.REPOST_ALREADY_USED);
  });

  it('rejects a request that is not expired', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'IN_MARKETPLACE' }));
    await expectCode(service.repostForClient('A', EXP_ID), BadRequestException, ERROR_CODES.REQUEST_NOT_EDITABLE);
  });

  it('rejects another user and a deleted request', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest());
    await expectCode(service.repostForClient('B', EXP_ID), ForbiddenException, ERROR_CODES.FORBIDDEN);
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ deletedAt: new Date() }));
    await expectCode(service.repostForClient('A', EXP_ID), NotFoundException, ERROR_CODES.NOT_FOUND);
  });

  it('a lost race (count 0) gives REPOST_ALREADY_USED without event or job', async () => {
    const { service, prisma, tx, outbox, queue } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest());
    tx.request.updateMany.mockResolvedValue({ count: 0 });
    await expectCode(service.repostForClient('A', EXP_ID), BadRequestException, ERROR_CODES.REPOST_ALREADY_USED);
    expect(outbox.record).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe('RequestsService draft token (DRAFT-only, owner check)', () => {
  const draft = (over: Record<string, unknown> = {}) => baseRequest({ status: 'DRAFT', ...over });

  it('a published request no longer resolves by token', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ status: 'IN_MARKETPLACE' }));
    await expectCode(service.getDraft('tok', 'A'), NotFoundException, ERROR_CODES.DRAFT_TOKEN_INVALID);
    await expectCode(service.getDraft('tok', null), NotFoundException, ERROR_CODES.DRAFT_TOKEN_INVALID);
  });

  it('another logged-in account gets 404, the owner and anonymous callers get the draft', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: 'A' }));
    await expectCode(service.getDraft('tok', 'B'), NotFoundException, ERROR_CODES.DRAFT_TOKEN_INVALID);
    await expect(service.getDraft('tok', 'A')).resolves.toEqual({ id: EXP_ID });
    await expect(service.getDraft('tok', null)).resolves.toEqual({ id: EXP_ID });
  });

  it('an anonymous draft is readable by any logged-in caller', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
    await expect(service.getDraft('tok', 'B')).resolves.toEqual({ id: EXP_ID });
  });

  it('publish by another account is rejected before the rooms are processed', async () => {
    const { service, prisma, configurator } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: 'A' }));
    await expectCode(
      service.publish('tok', { rooms: [] } as never, 'B'),
      NotFoundException,
      ERROR_CODES.DRAFT_TOKEN_INVALID,
    );
    expect(configurator.processRooms).not.toHaveBeenCalled();
  });

  it('patchDraft binds an anonymous draft to the logged-in client, never rewrites an owner', async () => {
    const { service, prisma, tx } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
    await service.patchDraft('tok', { city: 'Cluj' } as never, 'B', 'CLIENT');
    expect(tx.request.update.mock.calls[0][0].data.clientUserId).toBe('B');

    tx.request.update.mockClear();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: 'B' }));
    await service.patchDraft('tok', { city: 'Cluj' } as never, 'B', 'CLIENT');
    expect(tx.request.update.mock.calls[0][0].data).not.toHaveProperty('clientUserId');

    tx.request.update.mockClear();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
    await service.patchDraft('tok', { city: 'Cluj' } as never, null);
    expect(tx.request.update.mock.calls[0][0].data).not.toHaveProperty('clientUserId');
  });

  it('f2: patchDraft / createDraft never bind a draft to a company or admin account', async () => {
    const { service, prisma, tx } = setup();
    for (const role of ['COMPANY_USER', 'ADMIN'] as const) {
      tx.request.update.mockClear();
      (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
      await service.patchDraft('tok', { city: 'Cluj' } as never, 'F', role);
      expect(tx.request.update.mock.calls[0][0].data).not.toHaveProperty('clientUserId');
    }
    const create = jest.fn().mockResolvedValue({ id: 'new' });
    (prisma.request as Record<string, unknown>).create = create;
    await service.createDraft('F', undefined, 'COMPANY_USER');
    expect(create.mock.calls[0][0].data.clientUserId).toBeNull();
    await service.createDraft('C', undefined, 'CLIENT');
    expect(create.mock.calls[1][0].data.clientUserId).toBe('C');
  });

  it('f2: publish from a company or admin account → 403 REQUEST_PUBLISH_CLIENT_ONLY before the draft is touched', async () => {
    const { service, prisma, configurator } = setup();
    for (const role of ['COMPANY_USER', 'ADMIN']) {
      (prisma.user.findUnique as AnyMock).mockResolvedValue({ role });
      (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
      await expectCode(
        service.publish('tok', { rooms: [] } as never, 'F'),
        ForbiddenException,
        ERROR_CODES.REQUEST_PUBLISH_CLIENT_ONLY,
      );
    }
    expect(prisma.request.findUnique).not.toHaveBeenCalled();
    expect(configurator.processRooms).not.toHaveBeenCalled();
  });

  it('discardDraft soft-deletes and clears the token hash', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: 'A' }));
    await expect(service.discardDraft('tok', 'A')).resolves.toEqual({ ok: true });
    const data = (prisma.request.update as AnyMock).mock.calls[0][0].data;
    expect(data.draftTokenHash).toBeNull();
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  it('publish clears the draft token hash in the same update', async () => {
    const { service, prisma, tx } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft({ clientUserId: null }));
    const s = service as unknown as Record<string, unknown>;
    for (const m of ['withAccountEmail', 'assertRoomAttachments', 'writeContactPreferences', 'writeInspirationPhotos', 'writeStudioScenes', 'writeVersion']) {
      jest.spyOn(s as never, m as never).mockResolvedValue([] as never);
    }
    jest.spyOn(s as never, 'assertContactFormats' as never).mockReturnValue(undefined as never);
    jest.spyOn(s as never, 'scalarData' as never).mockReturnValue({} as never);
    jest.spyOn(s as never, 'resolveTitle' as never).mockReturnValue('Titlu' as never);
    jest.spyOn(s as never, 'writeRooms' as never).mockResolvedValue(new Map() as never);

    await service.publish('tok', { rooms: [], hasOwnProject: false, studioScenes: [] } as never, 'A');

    const data = tx.request.update.mock.calls[0][0].data;
    expect(data.draftTokenHash).toBeNull();
    expect(data.clientUserId).toBe('A');
    expect(data.status).toBe('IN_MARKETPLACE');
  });
});

// a6 (PO a6-2): publicarea trece si fara firma in zona; adminii sunt anuntati o singura data.
describe('RequestsService publish — acoperirea zonei (a6)', () => {
  function prepare(covered: boolean) {
    const ctx = setup();
    (ctx.prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
    ctx.prisma.$queryRaw.mockResolvedValue([{ covered }]);
    const s = ctx.service as unknown as Record<string, unknown>;
    for (const m of ['withAccountEmail', 'assertRoomAttachments', 'writeContactPreferences', 'writeInspirationPhotos', 'writeStudioScenes', 'writeVersion']) {
      jest.spyOn(s as never, m as never).mockResolvedValue([] as never);
    }
    jest.spyOn(s as never, 'assertContactFormats' as never).mockReturnValue(undefined as never);
    jest.spyOn(s as never, 'scalarData' as never).mockReturnValue({} as never);
    jest.spyOn(s as never, 'resolveTitle' as never).mockReturnValue('Bucatarie Cluj' as never);
    jest.spyOn(s as never, 'writeRooms' as never).mockResolvedValue(new Map() as never);
    return ctx;
  }
  const content = { rooms: [], hasOwnProject: false, studioScenes: [], addressText: 'Str. X 1', city: 'Cluj-Napoca', county: 'Cluj' } as never;
  const noCoverageCalls = (outbox: { record: AnyMock }) =>
    outbox.record.mock.calls.filter((c: unknown[]) => c[2] === 'request.no_coverage');

  it('NONE → un singur eveniment request.no_coverage catre admini, in tranzactie; publicarea trece', async () => {
    const { service, outbox, tx, prisma } = prepare(false);
    await expect(service.publish('tok', content, 'A')).resolves.toEqual({ id: EXP_ID });
    expect(tx.request.update.mock.calls[0][0].data.status).toBe('IN_MARKETPLACE');
    const calls = noCoverageCalls(outbox);
    expect(calls).toHaveLength(1);
    const [txArg, key, , payload, targets] = calls[0];
    expect(txArg).toBe(tx);
    expect(key).toBe(`request.no_coverage:${EXP_ID}`);
    expect(payload).toEqual({ requestId: EXP_ID, requestTitle: 'Bucatarie Cluj', city: 'Cluj-Napoca', county: 'Cluj' });
    expect(targets).toEqual(['admin-1', 'admin-2']);
    // m1: acoperirea se citeste in afara tranzactiei (inaintea ei)
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
  });

  // m5: doar adminii activi (nestersi, neblocati, neanonimizati)
  it('destinatarii sunt doar adminii activi', async () => {
    const { service, prisma } = prepare(false);
    await service.publish('tok', content, 'A');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: 'ADMIN', deletedAt: null, blockedAt: null, anonymizedAt: null },
    }));
  });

  it('NONE fara admini activi → niciun eveniment', async () => {
    const { service, outbox, prisma } = prepare(false);
    prisma.user.findMany.mockResolvedValue([]);
    await service.publish('tok', content, 'A');
    expect(noCoverageCalls(outbox)).toHaveLength(0);
  });

  it('COVERED → niciun eveniment request.no_coverage', async () => {
    const { service, outbox, prisma } = prepare(true);
    await service.publish('tok', content, 'A');
    expect(noCoverageCalls(outbox)).toHaveLength(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  // m1: o eroare a interogarii de acoperire nu strica publicarea
  it('interogarea de acoperire arunca → publicarea reuseste, fara eveniment', async () => {
    const { service, outbox, prisma, tx } = prepare(false);
    prisma.$queryRaw.mockRejectedValue(new Error('statement timeout'));
    await expect(service.publish('tok', content, 'A')).resolves.toEqual({ id: EXP_ID });
    expect(tx.request.update.mock.calls[0][0].data.status).toBe('IN_MARKETPLACE');
    expect(noCoverageCalls(outbox)).toHaveLength(0);
    expect(outbox.record.mock.calls.map((c: unknown[]) => c[1])).toContain(`request.published:${EXP_ID}`);
  });

  it('interogarea primeste punctul geocodat al cererii', async () => {
    const { service, prisma } = prepare(true);
    await service.publish('tok', content, 'A');
    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(values).toEqual(expect.arrayContaining([44.4, 26.1]));
  });
});

// a6 — Sumar: POST drafts/:token/coverage
describe('RequestsService.draftCoverage (a6)', () => {
  const address = { addressText: 'Str. X 1', city: 'Cluj-Napoca', county: 'Cluj' };

  it('ciorna proprie + firma pe raza → COVERED; fara firma → NONE', async () => {
    const { service, prisma, geo } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
    const raw = prisma.$queryRaw;
    await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'COVERED' });
    expect(geo.geocode).toHaveBeenCalledWith('Str. X 1', 'Cluj-Napoca', 'Cluj', undefined);
    raw.mockResolvedValue([{ covered: false }]);
    await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'NONE' });
  });

  it('geocodarea esueaza → UNKNOWN, nu eroare', async () => {
    const { service, prisma, geo } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: null }));
    geo.geocode.mockRejectedValue(new Error('geocoding failed'));
    await expect(service.draftCoverage('tok', address, null)).resolves.toEqual({ coverage: 'UNKNOWN' });
  });

  it('interogarea de acoperire arunca → UNKNOWN, nu eroare', async () => {
    const { service, prisma } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'UNKNOWN' });
  });

  // m6: cel mult 10 intrebari pe minut pe ciorna; peste limita UNKNOWN, fara geocodare
  it('limita pe ciorna: a 11-a intrebare in 60 s → UNKNOWN fara geocodare; dupa fereastra merge iar', async () => {
    jest.useFakeTimers({
      now: new Date('2026-11-14T10:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    try {
      const { service, prisma, geo } = setup();
      (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
      for (let i = 0; i < 10; i++) {
        await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'COVERED' });
      }
      await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'UNKNOWN' });
      expect(geo.geocode).toHaveBeenCalledTimes(10);
      // alta ciorna are contorul ei
      (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ id: 'req-2', status: 'DRAFT', clientUserId: 'A' }));
      await expect(service.draftCoverage('tok2', address, 'A')).resolves.toEqual({ coverage: 'COVERED' });
      (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
      jest.setSystemTime(new Date('2026-11-14T10:01:00Z'));
      await expect(service.draftCoverage('tok', address, 'A')).resolves.toEqual({ coverage: 'COVERED' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('ciorna altui cont → 404 DRAFT_TOKEN_INVALID, fara geocodare', async () => {
    const { service, prisma, geo } = setup();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'B' }));
    await expectCode(service.draftCoverage('tok', address, 'A'), NotFoundException, ERROR_CODES.DRAFT_TOKEN_INVALID);
    expect(geo.geocode).not.toHaveBeenCalled();
  });
});

// b8 (PO g0-8): ajutor pe camera; includesPaidDesign derivat din camere, valoarea clientului ignorata.
describe('RequestsService publish — needsDesignHelp pe camera', () => {
  const room = (over: Record<string, unknown> = {}) => ({ roomType: 'KITCHEN', flowVersion: 1, answers: {}, ...over });
  const content = (over: Record<string, unknown> = {}) =>
    ({
      hasOwnProject: false,
      budgetRange: 'UNDER_5K',
      studioScenes: [],
      addressText: 'Str. X 1',
      city: 'Cluj-Napoca',
      county: 'Cluj',
      ...over,
    }) as never;

  function prepare() {
    const ctx = setup();
    (ctx.prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
    const s = ctx.service as unknown as Record<string, unknown>;
    for (const m of ['withAccountEmail', 'assertRoomAttachments', 'writeContactPreferences', 'writeInspirationPhotos', 'writeStudioScenes', 'writeVersion']) {
      jest.spyOn(s as never, m as never).mockResolvedValue([] as never);
    }
    jest.spyOn(s as never, 'assertContactFormats' as never).mockReturnValue(undefined as never);
    jest.spyOn(s as never, 'resolveTitle' as never).mockReturnValue('Titlu' as never);
    jest.spyOn(s as never, 'writeRooms' as never).mockResolvedValue(new Map() as never);
    return ctx;
  }

  it('o camera cu ajutor din doua → includesPaidDesign=true (scris si trimis la sizing), chiar daca clientul trimite false', async () => {
    const { service, configurator, sizing, tx } = prepare();
    await service.publish('tok', content({ includesPaidDesign: false, rooms: [room({ needsDesignHelp: true }), room()] }), 'A');
    const [rooms, opts] = configurator.processRooms.mock.calls[0];
    expect(rooms.map((r: { needsDesignHelp: boolean }) => r.needsDesignHelp)).toEqual([true, false]);
    expect(opts).toEqual({ ownProject: false });
    expect(sizing.compute).toHaveBeenCalledWith(expect.objectContaining({ includesPaidDesign: true }));
    expect(tx.request.update.mock.calls[0][0].data.includesPaidDesign).toBe(true);
  });

  it('nicio camera cu ajutor → includesPaidDesign=false, chiar daca clientul trimite true', async () => {
    const { service, tx } = prepare();
    await service.publish('tok', content({ includesPaidDesign: true, rooms: [room({ needsDesignHelp: false })] }), 'A');
    expect(tx.request.update.mock.calls[0][0].data.includesPaidDesign).toBe(false);
  });

  it('interfata veche (fara needsDesignHelp pe camere) + includesPaidDesign=true → camerele care nu trec validarea stricta primesc ajutor', async () => {
    const { service, configurator, tx } = prepare();
    await service.publish('tok', content({ includesPaidDesign: true, rooms: [room(), room({ roomType: 'BATHROOM' })] }), 'A');
    const [rooms] = configurator.processRooms.mock.calls[0];
    expect(rooms.map((r: { needsDesignHelp: boolean }) => r.needsDesignHelp)).toEqual([true, true]);
    expect(tx.request.update.mock.calls[0][0].data.includesPaidDesign).toBe(true);
  });

  it('M2: piesa din Studio bifata → VALIDATION_ERROR designHelpWithStudioPiece, inaintea verificarilor Studio', async () => {
    const { service, configurator } = prepare();
    // scena din ciorna (payload fara studioScenes) leaga piesa p1 de o asezare din Studio
    jest.spyOn(service as never, 'extractStudioScenes' as never).mockReturnValue([{ requestEntryIds: { pl1: 'p1' } }] as never);
    const err = await service
      .publish('tok', content({ studioScenes: undefined, rooms: [room({ sourceLocalId: 'p1', roomType: 'PIECE_DRESSER', needsDesignHelp: true })] }), 'A')
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      details: [expect.objectContaining({ roomIndex: 0, messageKey: 'validation.designHelpWithStudioPiece' })],
    });
    expect(configurator.processRooms).not.toHaveBeenCalled();
  });

  it('M3: editarea unei cereri vechi cu proiectare, fara camere bifate, pastreaza includesPaidDesign', async () => {
    const { service, prisma, tx } = prepare();
    (prisma.request.findUnique as AnyMock).mockResolvedValue(baseRequest({ status: 'IN_MARKETPLACE', preClaimEditsUsed: 0, includesPaidDesign: true }));
    await service.editForClient('A', EXP_ID, content({ rooms: [room({ needsDesignHelp: false })] }));
    expect(prisma.requestRoom.count).toHaveBeenCalledWith({ where: { requestId: EXP_ID, needsDesignHelp: true } });
    expect(tx.request.update.mock.calls[0][0].data.includesPaidDesign).toBe(true);

    // cererea avea deja camere bifate (reprezentarea noua) → derivare stricta
    tx.request.update.mockClear();
    (prisma.requestRoom.count as AnyMock).mockResolvedValue(1);
    await service.editForClient('A', EXP_ID, content({ rooms: [room({ needsDesignHelp: false })] }));
    expect(tx.request.update.mock.calls[0][0].data.includesPaidDesign).toBe(false);
  });

  it('M1: fisierele aruncate dintr-o camera cu ajutor (snapshot3d) se sterg de pe cerere dupa publicare', async () => {
    const { service, configurator } = prepare();
    const remove = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { uploads: unknown }).uploads = { remove };
    const SNAP = '22222222-2222-4222-8222-222222222222';
    configurator.processRooms.mockReturnValue({ rooms: [{ answers: {} }], scoreEntries: [] });
    await service.publish('tok', content({
      rooms: [room({ roomType: 'PIECE_DRESSER', flowVersion: CURRENT_FLOW_VERSION.PIECE_DRESSER, answers: { snapshot3d: [SNAP] }, needsDesignHelp: true })],
    }), 'A');
    expect(remove).toHaveBeenCalledWith('REQUEST', EXP_ID, SNAP);
  });

  // b11: suma aleasa pe glisor → budget_declared; aceeasi treapta (deci acelasi punctaj) la sizing
  it('b11: budgetDeclared se scrie doar langa suma; treapta trimisa la sizing nu se schimba', async () => {
    const { service, sizing, tx } = prepare();
    await service.publish('tok', content({ budgetRange: 'UNDER_5K', budgetEstimateRon: 12000, budgetDeclared: true, rooms: [room()] }), 'A');
    expect(tx.request.update.mock.calls[0][0].data).toMatchObject({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true });
    expect(sizing.compute).toHaveBeenLastCalledWith(expect.objectContaining({ budgetRange: 'FROM_5K_TO_15K' }));

    // interfata veche (fara camp) → suma fara "declarat"; aceeasi treapta la sizing
    tx.request.update.mockClear();
    (service as unknown as { prisma: { request: { findUnique: AnyMock } } }).prisma.request.findUnique.mockResolvedValue(baseRequest({ status: 'DRAFT', clientUserId: 'A' }));
    await service.publish('tok', content({ budgetRange: 'UNDER_5K', budgetEstimateRon: 12000, rooms: [room()] }), 'A');
    expect(tx.request.update.mock.calls[0][0].data).toMatchObject({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: false });
    expect(sizing.compute).toHaveBeenLastCalledWith(expect.objectContaining({ budgetRange: 'FROM_5K_TO_15K' }));
  });

  // M3: o suma declarata sub estimare nu coboara marimea; treapta salvata = cea folosita la marime
  it('M3: suma sub estimare → marimea si treapta salvata pornesc de la minimul estimarii', async () => {
    const { service, sizing, tx } = prepare();
    sizing.compute.mockImplementation(async ({ budgetRange }: { budgetRange: string }) => ({ score: budgetRange === 'OVER_15K' ? 34 : 29, size: budgetRange === 'OVER_15K' ? 'LARGE' : 'MEDIUM', creditCost: 24, baseScore: 24 }));
    await service.publish('tok', content({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 8000, budgetDeclared: true, rooms: [room()] }), 'A');
    expect(sizing.compute.mock.calls.map((c: [{ budgetRange: string }]) => c[0].budgetRange)).toEqual(['FROM_5K_TO_15K', 'OVER_15K']);
    expect(tx.request.update.mock.calls[0][0].data).toMatchObject({ budgetRange: 'OVER_15K', budgetEstimateRon: 8000, budgetDeclared: true, projectSize: 'LARGE', creditCost: 24 });
  });

  it('m1: budgetDeclared fara suma → 400 VALIDATION_ERROR, fara publicare', async () => {
    const { service, tx } = prepare();
    await expectCode(service.publish('tok', content({ budgetRange: 'UNDER_5K', budgetDeclared: true, rooms: [room()] }), 'A'), BadRequestException, ERROR_CODES.VALIDATION_ERROR);
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('proiect propriu + camera cu ajutor → VALIDATION_ERROR, fara procesarea camerelor', async () => {
    const { service, configurator } = prepare();
    await expectCode(
      service.publish('tok', content({ hasOwnProject: true, rooms: [room({ needsDesignHelp: true })] }), 'A'),
      BadRequestException,
      ERROR_CODES.VALIDATION_ERROR,
    );
    expect(configurator.processRooms).not.toHaveBeenCalled();
  });
});

// E-admin-platform-45 (F2-16) — date de contact in texte libere la publicare/editare.
describe('RequestsService contact screening in free text', () => {
  const AUTO_TITLE = 'Bucătărie — Cluj-Napoca';
  const draft = (over: Record<string, unknown> = {}) => baseRequest({ status: 'DRAFT', clientUserId: 'A', ...over });
  const content = (over: Record<string, unknown> = {}) =>
    ({
      rooms: [],
      hasOwnProject: false,
      includesPaidDesign: false,
      budgetRange: 'UNDER_5K',
      studioScenes: [],
      addressText: 'Str. X 1',
      city: 'Cluj-Napoca',
      county: 'Cluj',
      ...over,
    }) as never;

  function stubWrites(service: RequestsService) {
    const s = service as unknown as Record<string, unknown>;
    for (const m of ['withAccountEmail', 'assertRoomAttachments', 'writeContactPreferences', 'writeInspirationPhotos', 'writeStudioScenes', 'writeVersion']) {
      jest.spyOn(s as never, m as never).mockResolvedValue([] as never);
    }
    jest.spyOn(s as never, 'assertContactFormats' as never).mockReturnValue(undefined as never);
    jest.spyOn(s as never, 'writeRooms' as never).mockResolvedValue(new Map() as never);
    jest.spyOn(s as never, 'buildRequestTitle' as never).mockReturnValue(AUTO_TITLE as never);
  }

  it('MASK: publish succeeds, stores the description unchanged and logs one MASKED row in the transaction', async () => {
    const { service, prisma, tx, geo } = setup();
    stubWrites(service);
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    await service.publish('tok', content({ description: 'Sunati la 0722 123 456' }), 'A');

    expect(tx.request.update.mock.calls[0][0].data.description).toBe('Sunati la 0722 123 456');
    expect(tx.requestContactDetection.createMany).toHaveBeenCalledTimes(1);
    const data = tx.requestContactDetection.createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      expect.objectContaining({ requestId: EXP_ID, trigger: 'PUBLISH', field: 'DESCRIPTION', kinds: ['PHONE'], action: 'MASKED' }),
    ]);
    expect(data[0].excerpt).not.toContain('0722 123 456');
    expect(prisma.requestContactDetection.createMany).not.toHaveBeenCalled();
    expect(geo.geocode).toHaveBeenCalledTimes(1);
  });

  it('BLOCK: rejects with details, logs BLOCKED outside the transaction and makes no external call', async () => {
    const { service, prisma, geo, settings } = setup();
    stubWrites(service);
    settings.getString.mockResolvedValue('BLOCK');
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    const err = await service.publish('tok', content({ description: 'Sunati la 0722 123 456' }), 'A').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as { code: string; details: unknown };
    expect(body.code).toBe(ERROR_CODES.REQUEST_CONTACT_INFO_IN_TEXT);
    expect(body.details).toEqual([{ field: 'description', messageKey: 'validation.contactInText' }]);
    expect(prisma.requestContactDetection.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ field: 'DESCRIPTION', action: 'BLOCKED', trigger: 'PUBLISH' })],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(geo.geocode).not.toHaveBeenCalled();
  });

  it('BLOCK: stops logging BLOCKED rows once the hourly cap per request is reached', async () => {
    const { service, prisma, settings } = setup();
    stubWrites(service);
    settings.getString.mockResolvedValue('BLOCK');
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());
    (prisma.requestContactDetection.count as AnyMock).mockResolvedValue(100);

    const err = await service.publish('tok', content({ description: 'Sunati la 0722 123 456' }), 'A').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(prisma.requestContactDetection.createMany).not.toHaveBeenCalled();
  });

  it('dimensions only: no detection rows and no settings lookup', async () => {
    const { service, prisma, tx, settings } = setup();
    stubWrites(service);
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    await service.publish('tok', content({ description: 'Corp 240 x 60 cm, blat 38 mm' }), 'A');

    expect(tx.requestContactDetection.createMany).not.toHaveBeenCalled();
    expect(prisma.requestContactDetection.createMany).not.toHaveBeenCalled();
    expect(settings.getString).not.toHaveBeenCalled();
  });

  it('a manual title with a phone is replaced by the auto title and logged as TITLE_REPLACED', async () => {
    const { service, prisma, tx } = setup();
    stubWrites(service);
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    await service.publish('tok', content({ title: 'Bucatarie 0722123456' }), 'A');

    expect(tx.request.update.mock.calls[0][0].data.title).toBe(AUTO_TITLE);
    expect(tx.requestContactDetection.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ field: 'TITLE', action: 'TITLE_REPLACED' }),
    ]);
  });

  it('BLOCK on edit: no edit counter is consumed', async () => {
    const { service, prisma, tx, settings } = setup();
    stubWrites(service);
    settings.getString.mockResolvedValue('BLOCK');
    const published = baseRequest({ status: 'IN_MARKETPLACE', preClaimEditsUsed: 0, addressText: 'Str. X 1', city: 'Cluj-Napoca', county: 'Cluj', country: 'RO' });
    (prisma.request.findUnique as AnyMock).mockResolvedValue(published);

    const err = await service.editForClient('A', EXP_ID, content({ description: 'scrieti pe ana@example.com' })).catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.REQUEST_CONTACT_INFO_IN_TEXT });
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.requestContactDetection.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ trigger: 'EDIT', action: 'BLOCKED', kinds: ['EMAIL'] })],
    });
  });

  // E-client-34: notitele pozelor de inspiratie trec prin acelasi screening
  const PHOTO = '11111111-1111-4111-8111-111111111111';
  const kitchen = { sourceLocalId: 'k1', roomType: 'KITCHEN', flowVersion: 1, answers: {}, derived: { lengthM: 1, widthM: 1, heightM: 2.6, items: [] }, scoreEntries: [] };

  it('MASK: a note with a phone publishes and logs one PHOTO_NOTE MASKED row in the transaction', async () => {
    const { service, prisma, tx, configurator } = setup();
    stubWrites(service);
    configurator.processRooms.mockReturnValue({ rooms: [kitchen], scoreEntries: [] });
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    await service.publish(
      'tok',
      content({ inspirationPhotos: [{ photoId: PHOTO, note: 'suna la 0722 123 456', roomLocalId: 'k1' }] }),
      'A',
    );

    const data = tx.requestContactDetection.createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      expect.objectContaining({ field: 'PHOTO_NOTE', action: 'MASKED', roomType: 'KITCHEN', kinds: ['PHONE'] }),
    ]);
    expect(data[0].excerpt).not.toContain('0722 123 456');
  });

  it('BLOCK: a note with a phone is refused with the inspirationNote detail and no geocoding', async () => {
    const { service, prisma, geo, settings } = setup();
    stubWrites(service);
    settings.getString.mockResolvedValue('BLOCK');
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    const err = await service
      .publish('tok', content({ inspirationPhotos: [{ photoId: PHOTO, note: 'ana@example.com' }] }), 'A')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as { code: string; details: unknown };
    expect(body.code).toBe(ERROR_CODES.REQUEST_CONTACT_INFO_IN_TEXT);
    expect(body.details).toEqual([{ field: 'inspirationNote', photoId: PHOTO, messageKey: 'validation.contactInText' }]);
    expect(geo.geocode).not.toHaveBeenCalled();
  });

  it('an unknown roomLocalId is refused before geocoding', async () => {
    const { service, prisma, geo, configurator } = setup();
    stubWrites(service);
    configurator.processRooms.mockReturnValue({ rooms: [kitchen], scoreEntries: [] });
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    const err = await service
      .publish('tok', content({ inspirationPhotos: [{ photoId: PHOTO, roomLocalId: 'nope' }] }), 'A')
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
    expect(geo.geocode).not.toHaveBeenCalled();
  });

  it('inspirationPhotoIds together with inspirationPhotos is a 400', async () => {
    const { service, prisma, geo } = setup();
    stubWrites(service);
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    const err = await service
      .publish('tok', content({ inspirationPhotoIds: [PHOTO], inspirationPhotos: [{ photoId: PHOTO }] }), 'A')
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
    expect(geo.geocode).not.toHaveBeenCalled();
  });

  it('the selection (note + room map) reaches writeInspirationPhotos', async () => {
    const { service, prisma, configurator } = setup();
    stubWrites(service);
    configurator.processRooms.mockReturnValue({ rooms: [kitchen], scoreEntries: [] });
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());
    const roomIds = new Map([['k1', 'room-uuid']]);
    jest.spyOn(service as never, 'writeRooms' as never).mockResolvedValue(roomIds as never);
    const write = jest.spyOn(service as never, 'writeInspirationPhotos' as never);

    await service.publish('tok', content({ inspirationPhotos: [{ photoId: PHOTO, note: ' nota ', roomLocalId: 'k1' }] }), 'A');

    expect(write).toHaveBeenCalledWith(
      expect.anything(),
      EXP_ID,
      [{ photoId: PHOTO, note: 'nota', roomLocalId: 'k1' }],
      roomIds,
    );
  });

  it('an unknown policy value falls back to MASK', async () => {
    const { service, prisma, tx, settings } = setup();
    stubWrites(service);
    settings.getString.mockResolvedValue('FOO');
    (prisma.request.findUnique as AnyMock).mockResolvedValue(draft());

    await service.publish('tok', content({ description: 'www.mobila-ana.ro' }), 'A');

    expect(tx.requestContactDetection.createMany.mock.calls[0][0].data[0]).toMatchObject({ action: 'MASKED', kinds: ['URL'] });
  });
});

// E-admin-platform-44 — lista "De facut acum" a clientului (scoped pe clientUserId).
describe('RequestsService.dashboardStatsForClient — actions', () => {
  const day = 24 * 60 * 60 * 1000;

  function dashboardSetup(reminderAt: Date, openCase = false) {
    const now = Date.now();
    const expiresAt = new Date(now + 6 * 60 * 60 * 1000);
    const deliveredAt = new Date(now - 2 * day);
    const findMany = jest.fn(async (args: { where: Record<string, unknown> }) => {
      const where = args.where;
      if (where.quotes) return [{ id: 'r-offers', title: 'Dulap', _count: { quotes: 2 } }];
      if (where.status === 'DELIVERED_BY_COMPANY') return [{ id: 'r-deliv', title: 'Birou', deliveredAt }];
      if (where.status === 'IN_MARKETPLACE') return [{ id: 'r-exp', title: 'Hol', expiresAt }];
      return [];
    });
    const prisma = {
      request: { count: jest.fn().mockResolvedValue(4), groupBy: jest.fn().mockResolvedValue([]), findMany },
      quote: { count: jest.fn().mockResolvedValue(2) },
      claimSlot: { count: jest.fn().mockResolvedValue(1) },
      // e2-1: termenul confirmarii automate tine cont de rapoartele de proiect
      requestProjectCase: { findFirst: jest.fn().mockResolvedValue(openCase ? { id: 'case-1' } : null) },
      clarificationRequest: {
        findMany: jest.fn().mockResolvedValue([
          { claimSlot: { requestId: 'r-clar', request: { title: 'Bucatarie' } } },
          { claimSlot: { requestId: 'r-clar', request: { title: 'Bucatarie' } } },
        ]),
      },
    };
    const calendar = {
      workingDateBefore: jest.fn().mockReturnValue('2026-10-09'),
      bucharestWallClock: jest.fn().mockReturnValue(reminderAt),
    };
    const service = new RequestsService(
      prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      calendar as never, {} as never, {} as never, {} as never, {} as never,
    );
    return { service, prisma, expiresAt, deliveredAt };
  }

  it('produce tipurile asteptate, sortate dupa termen (fara termen la final)', async () => {
    const { service, prisma, expiresAt, deliveredAt } = dashboardSetup(new Date(Date.now() - 60_000));
    const stats = await service.dashboardStatsForClient('A');
    expect(stats.actions.map((a) => a.kind)).toEqual([
      'REQUEST_EXPIRING',
      'DELIVERY_TO_CONFIRM',
      'OFFERS_TO_REVIEW',
      'CLARIFICATION_TO_ANSWER',
    ]);
    expect(stats.actions[0]).toEqual({
      kind: 'REQUEST_EXPIRING', requestId: 'r-exp', claimSlotId: null, title: 'Hol', count: null, dueAt: expiresAt.toISOString(),
    });
    expect(stats.actions[1].dueAt).toBe(new Date(deliveredAt.getTime() + 14 * day).toISOString());
    expect(stats.actions[2].count).toBe(2);
    expect(stats.actions[3]).toMatchObject({ requestId: 'r-clar', count: 2 });
    // toate interogarile sunt limitate la clientul curent
    for (const call of prisma.request.findMany.mock.calls) {
      expect((call[0] as { where: { clientUserId: string } }).where.clientUserId).toBe('A');
    }
    expect(prisma.clarificationRequest.findMany.mock.calls[0][0].where.claimSlot.request.clientUserId).toBe('A');
  });

  it('e2-1: cu raport de proiect deschis, livrarea de confirmat nu are termen (finalizarea automata e oprita)', async () => {
    const { service } = dashboardSetup(new Date(Date.now() - 60_000), true);
    const stats = await service.dashboardStatsForClient('A');
    const delivery = stats.actions.find((a) => a.kind === 'DELIVERY_TO_CONFIRM');
    expect(delivery).toMatchObject({ requestId: 'r-deliv', dueAt: null });
  });

  it('cererea inca in afara ferestrei reminderului nu apare ca REQUEST_EXPIRING', async () => {
    const { service } = dashboardSetup(new Date(Date.now() + 60 * 60 * 1000));
    const stats = await service.dashboardStatsForClient('A');
    expect(stats.actions.map((a) => a.kind)).not.toContain('REQUEST_EXPIRING');
  });
});

// E-admin-platform-14 / PO r5 V1: bugetul minim estimat vine din scorul de BAZA (camerele),
// nu din scorul total — costul ramane minRon/1000 si cu BUDGET:UNDISCLOSED nenul.
describe('RequestsService.estimate — scorul de baza', () => {
  it('score/minRon/maxRon din baseScore, nu din scorul total', async () => {
    const { service, sizing, configurator } = setup();
    sizing.compute.mockResolvedValue({ score: 12, size: 'SMALL', creditCost: 10, baseScore: 10 });
    await expect(service.estimate([])).resolves.toEqual({ score: 10, minRon: 10_000, maxRon: 30_000 });
    expect(configurator.processRooms).toHaveBeenCalledWith([], { designBrief: true });
    expect(sizing.compute).toHaveBeenCalledWith({ scoreEntries: [], budgetRange: 'UNDISCLOSED', includesPaidDesign: false });
  });
});

// E-admin-platform-15: stergerea cererii deconteaza fiecare slot deschis prin settle();
// notificarea claim.withdrawn doar pentru sloturile decontate, cu refunded din rezultat.
describe('RequestsService.deleteForClient — decontare prin ClaimSettlementService', () => {
  function deleteSetup() {
    const slots = [
      { id: 's-a', companyId: 'c-a', requestId: EXP_ID, claimCostCreditsSnapshot: 2, status: 'ACTIVE' },
      { id: 's-b', companyId: 'c-b', requestId: EXP_ID, claimCostCreditsSnapshot: 3, status: 'OFFER_SENT' },
      { id: 's-c', companyId: 'c-c', requestId: EXP_ID, claimCostCreditsSnapshot: 4, status: 'ACTIVE' },
    ];
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: EXP_ID, status: 'OFFERS_RECEIVED', deleted_at: null }]),
      claimSlot: { findMany: jest.fn().mockResolvedValue(slots) },
      companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
      request: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      request: { findUnique: jest.fn().mockResolvedValue(baseRequest({ status: 'OFFERS_RECEIVED' })) },
      $transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const settle = jest
      .fn()
      .mockResolvedValueOnce({ settled: true, slot: slots[0], credit: 'REFUNDED', refunded: true, amount: 2 })
      .mockResolvedValueOnce({ settled: false })
      .mockResolvedValueOnce({ settled: true, slot: slots[2], credit: 'SKIPPED_NO_RESERVE', refunded: false, amount: 0 });
    const outbox = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new RequestsService(
      prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, outbox as never, { settle } as never, {} as never, {} as never,
    );
    return { service, tx, settle, outbox };
  }

  it('fiecare slot deschis → settle(REFUND, REQUEST_DELETED_BY_CLIENT, WITHDRAWN); refunded urmeaza rezultatul', async () => {
    const { service, tx, settle, outbox } = deleteSetup();
    await expect(service.deleteForClient('A', EXP_ID)).resolves.toEqual({ ok: true });
    expect(settle).toHaveBeenCalledTimes(3);
    expect(settle).toHaveBeenCalledWith(tx, expect.objectContaining({
      claimSlotId: 's-a',
      from: ['ACTIVE', 'OFFER_SENT'],
      to: 'CANCELLED_BY_CLIENT',
      outcome: 'REFUND',
      reason: 'REQUEST_DELETED_BY_CLIENT',
      quotes: 'WITHDRAWN',
    }));
    const withdrawn = outbox.record.mock.calls.filter((c: unknown[]) => c[2] === 'claim.withdrawn');
    expect(withdrawn.map((c: unknown[]) => [c[1], (c[3] as { refunded: boolean }).refunded])).toEqual([
      ['request.deleted:claim:s-a', true],
      ['request.deleted:claim:s-c', false],
    ]);
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: EXP_ID }, data: { deletedAt: expect.any(Date) } });
  });
});
