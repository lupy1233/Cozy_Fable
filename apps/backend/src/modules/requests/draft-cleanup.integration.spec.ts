import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CURRENT_FLOW_VERSION, ERROR_CODES } from '@marketplace/shared';
import { softDeleteReads } from '../../infra/prisma/soft-delete';
import { testDatabaseUrl } from '../../test/db-guard';
import { cleanupMoney, createTestPrisma, makeClient, makePublishedRequest, type MoneyCleanup } from '../../test/money-fixtures';
import { ConfiguratorService } from './configurator.service';
import { DraftCleanupService } from './draft-cleanup.service';
import { RequestsService } from './requests.service';

// f6 pe PostgreSQL REAL (doar coordonatorul il ruleaza, pe marketplace_test):
// - curatarea: doar DRAFT peste prag (7 / 90 zile), fisierele cerute din storage, randurile
//   attachments + ciorna sterse (camerele prin cascada), cererea publicata si cheia ei impartita
//   raman neatinse;
// - revizie M1: run() cu middleware-ul softDeleteReads ACTIV (ca in aplicatie) vede si ciornele
//   aruncate / marcate de o rulare esuata;
// - "Republica cu modificari": EXPIRED → IN_MARKETPLACE cu datele noi, a doua oara
//   REPOST_ALREADY_USED, contoarele de editare neschimbate; doua apeluri simultane → unul singur;
// - revizie A m2: doua editari simultane dupa preluare → una singura trece.
// ATENTIE: run() curata orice ciorna eligibila din baza de test (marketplace_test), nu doar pe ale lui.

const url = testDatabaseUrl();
const DAY = 24 * 60 * 60 * 1000;

(url ? describe : describe.skip)('f6 drafts cleanup + repost with changes on PostgreSQL', () => {
  jest.setTimeout(60_000);
  // clientul fara softDeleteReads (createTestPrisma nu apeleaza onModuleInit) — pentru fixture-uri
  const prisma = url ? createTestPrisma(url).prisma : (undefined as never);
  // revizie M1: al doilea client, cu middleware-ul aplicatiei inregistrat explicit
  const appPrisma = url ? createTestPrisma(url).prisma : (undefined as never);
  if (url) appPrisma.$use(softDeleteReads);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const attachmentIds: string[] = [];

  afterAll(async () => {
    await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
    await cleanupMoney(prisma, ids);
    await prisma.$disconnect();
    await appPrisma.$disconnect();
  });

  const backdateUpdatedAt = (id: string, days: number) =>
    prisma.$executeRaw`UPDATE requests SET updated_at = now() - make_interval(days => ${days}::int) WHERE id = ${id}`;
  const draft = async (clientUserId: string | null, ageDays: number, over: Record<string, unknown> = {}) => {
    const r = await prisma.request.create({ data: { clientUserId, status: 'DRAFT', draftTokenHash: randomUUID(), ...over } });
    ids.requestIds.push(r.id);
    await backdateUpdatedAt(r.id, ageDays);
    return r.id;
  };
  const file = async (entityId: string, storageKey = `request/${entityId}/${randomUUID()}/clean-x.jpg`) => {
    const a = await prisma.attachment.create({
      data: { entityType: 'REQUEST', entityId, filename: 'x.jpg', mimeType: 'image/jpeg', sizeBytes: 1, storageKey, status: 'SAFE' },
    });
    attachmentIds.push(a.id);
    return a;
  };
  const exists = async (id: string) => (await prisma.request.count({ where: { id } })) === 1;

  describe('DraftCleanupService', () => {
    const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    const settings = { getInt: jest.fn((_k: string, fallback: number) => Promise.resolve(fallback)) };
    const service = url ? new DraftCleanupService(prisma as never, storage as never, settings as never) : (undefined as never);
    const appService = url ? new DraftCleanupService(appPrisma as never, storage as never, settings as never) : (undefined as never);

    beforeEach(() => storage.deleteObject.mockReset().mockResolvedValue(undefined));

    it('sterge doar ciornele DRAFT vechi; pastreaza cererile publicate, ciornele recente si cheile impartite', async () => {
      const client = await makeClient(prisma);
      ids.userIds.push(client);
      const now = new Date();
      const cutoffs = await service.cutoffs(now);

      const guestOld = await draft(null, 8);
      const guestRecent = await draft(null, 6);
      const clientMid = await draft(client, 60);
      const clientOld = await draft(client, 91);
      const discarded = await draft(client, 0, { deletedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), draftTokenHash: null });
      const published = await makePublishedRequest(prisma, client, { cost: 1, lat: 44.4, lng: 26.1 });
      ids.requestIds.push(published);
      await backdateUpdatedAt(published, 400);

      await prisma.requestRoom.create({ data: { requestId: guestOld, roomType: 'KITCHEN', lengthM: 1, widthM: 1, heightM: 1 } });
      const own = await file(guestOld);
      const sharedKey = `request/${published}/${randomUUID()}/clean-shared.jpg`;
      await file(clientOld, sharedKey);
      await file(published, sharedKey);
      const publishedFile = await file(published);

      for (const id of [guestOld, guestRecent, clientMid, clientOld, discarded, published]) {
        await service.deleteDraft(id, cutoffs, now);
      }

      const left = await prisma.request.findMany({ where: { id: { in: [guestOld, guestRecent, clientMid, clientOld, discarded, published] } }, select: { id: true } });
      expect(left.map((r) => r.id).sort()).toEqual([guestRecent, clientMid, published].sort());
      expect(await prisma.requestRoom.count({ where: { requestId: guestOld } })).toBe(0);
      expect(storage.deleteObject).toHaveBeenCalledWith(own.storageKey);
      expect(storage.deleteObject).not.toHaveBeenCalledWith(sharedKey);
      expect(storage.deleteObject).not.toHaveBeenCalledWith(publishedFile.storageKey);
      expect(await prisma.attachment.count({ where: { entityId: published } })).toBe(2);
      expect(await prisma.attachment.count({ where: { entityId: { in: [guestOld, clientOld] } } })).toBe(0);
    });

    it('revizie M1: run() cu softDeleteReads activ sterge ciorna aruncata si nu atinge cererile sterse nepublicabile', async () => {
      const client = await makeClient(prisma);
      ids.userIds.push(client);
      // aruncata azi ("Incepe o cerere noua"), dupa pauza de siguranta
      const discarded = await draft(client, 0, { deletedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), draftTokenHash: null });
      const discardedFile = await file(discarded);
      // aruncata chiar acum: inca in pauza de siguranta
      const justDiscarded = await draft(null, 0, { deletedAt: new Date(), draftTokenHash: null });
      // cerere publicata stearsa de client: NU e DRAFT → neatinsa
      const deletedPublished = await makePublishedRequest(prisma, client, { cost: 1, lat: 44.4, lng: 26.1 });
      ids.requestIds.push(deletedPublished);
      await prisma.request.update({ where: { id: deletedPublished }, data: { deletedAt: new Date(Date.now() - 10 * DAY) } });

      await appService.run(new Date());

      expect(await exists(discarded)).toBe(false);
      expect(storage.deleteObject).toHaveBeenCalledWith(discardedFile.storageKey);
      expect(await exists(justDiscarded)).toBe(true);
      expect(await exists(deletedPublished)).toBe(true);
    });

    it('revizie M1: dupa un esec la storage, a doua rulare run() (nu deleteDraft) termina stergerea', async () => {
      const id = await draft(null, 30);
      const f = await file(id);
      storage.deleteObject.mockImplementation(async (key: string) => {
        if (key === f.storageKey) throw new Error('S3 down');
      });
      await appService.run(new Date());
      const row = await prisma.request.findUnique({ where: { id } });
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.draftTokenHash).toBeNull();
      expect(await prisma.attachment.count({ where: { entityId: id } })).toBe(1);

      storage.deleteObject.mockReset().mockResolvedValue(undefined);
      // a doua zi (dupa pauza de siguranta a ciornelor marcate)
      await appService.run(new Date(Date.now() + DAY));
      expect(await exists(id)).toBe(false);
      expect(await prisma.attachment.count({ where: { entityId: id } })).toBe(0);
    });

    it('revizie m1: cheia schimbata intre storage si stergerea randurilor → randul ramane, ciorna se reia', async () => {
      const now = new Date();
      const cutoffs = await service.cutoffs(now);
      const id = await draft(null, 30);
      const f = await file(id);
      const newKey = `request/${id}/${f.id}/sealed-${randomUUID()}.jpg`;
      storage.deleteObject.mockImplementationOnce(async () => {
        await prisma.attachment.update({ where: { id: f.id }, data: { storageKey: newKey } });
      });
      await expect(service.deleteDraft(id, cutoffs, now)).resolves.toBe('skipped');
      expect(await prisma.attachment.findUnique({ where: { id: f.id } })).toMatchObject({ storageKey: newKey });
      expect(await exists(id)).toBe(true);
      await expect(service.deleteDraft(id, await service.cutoffs(new Date(Date.now() + DAY)), new Date(Date.now() + DAY))).resolves.toBe('deleted');
      expect(storage.deleteObject).toHaveBeenLastCalledWith(newKey);
    });
  });

  describe('RequestsService — republicare cu modificari si editare dupa preluare', () => {
    const outbox = { record: jest.fn().mockResolvedValue(undefined) };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const calendar = {
      addWorkingDays: jest.fn((d: Date, n: number) => new Date(d.getTime() + n * DAY)),
      workingDateBefore: jest.fn().mockReturnValue('2099-01-01'),
      bucharestWallClock: jest.fn().mockReturnValue(new Date('2099-01-01T06:00:00Z')),
    };
    const service = url
      ? new RequestsService(
          prisma as never,
          { geocode: jest.fn().mockResolvedValue({ lat: 44.4, lng: 26.1 }) } as never,
          { compute: jest.fn().mockResolvedValue({ score: 10, size: 'SMALL', creditCost: 2, baseScore: 10 }) } as never,
          new ConfiguratorService(),
          { remove: jest.fn(), listForEntity: jest.fn().mockResolvedValue([]) } as never,
          { assertSelectable: jest.fn().mockResolvedValue(undefined) } as never,
          calendar as never,
          outbox as never,
          {} as never,
          queue as never,
          { getString: jest.fn((_k: string, fallback: string) => Promise.resolve(fallback)) } as never,
        )
      : (undefined as never);

    const contentFor = async (client: string, description = 'Mesaj nou dupa expirare') => {
      const email = (await prisma.user.findUniqueOrThrow({ where: { id: client } })).email;
      return {
        description,
        budgetRange: 'UNDISCLOSED',
        hasOwnProject: false,
        includesPaidDesign: true,
        addressText: 'test',
        county: 'test',
        city: 'test',
        country: 'RO',
        rooms: [{ sourceLocalId: 'r1', roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers: {}, needsDesignHelp: true }],
        contactPreferences: [{ channel: 'EMAIL', value: email }],
        studioScenes: [],
      } as never;
    };
    const expiredRequest = async (client: string) => {
      const id = await makePublishedRequest(prisma, client, { cost: 1, lat: 44.4, lng: 26.1, status: 'EXPIRED' });
      ids.requestIds.push(id);
      await prisma.request.update({ where: { id }, data: { preClaimEditsUsed: 2, expiresAt: new Date(Date.now() - DAY) } });
      return id;
    };

    beforeEach(() => outbox.record.mockClear());

    it('EXPIRED → IN_MARKETPLACE cu datele noi; a doua oara REPOST_ALREADY_USED; editarile raman', async () => {
      const client = await makeClient(prisma);
      ids.userIds.push(client);
      const id = await expiredRequest(client);
      const content = await contentFor(client);

      await service.repostWithChangesForClient(client, id, content);
      const row = await prisma.request.findUniqueOrThrow({ where: { id }, include: { rooms: true } });
      expect(row.status).toBe('IN_MARKETPLACE');
      expect(row.repostUsed).toBe(true);
      expect(row.description).toBe('Mesaj nou dupa expirare');
      expect(row.rooms.map((r) => r.roomType)).toEqual(['BEDROOM']);
      expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now());
      expect(row.preClaimEditsUsed).toBe(2);
      expect(row.postClaimEditsUsed).toBe(0);

      await prisma.request.update({ where: { id }, data: { status: 'EXPIRED' } });
      const err = await service.repostWithChangesForClient(client, id, content).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.REPOST_ALREADY_USED });
    });

    it('doua republicari simultane → exact una trece: un eveniment reposted, o versiune noua', async () => {
      const client = await makeClient(prisma);
      ids.userIds.push(client);
      const id = await expiredRequest(client);
      const versionsBefore = await prisma.requestVersion.count({ where: { requestId: id } });
      const results = await Promise.allSettled([
        service.repostWithChangesForClient(client, id, await contentFor(client, 'Varianta A')),
        service.repostWithChangesForClient(client, id, await contentFor(client, 'Varianta B')),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((rejected.reason as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.REPOST_ALREADY_USED });
      expect(outbox.record.mock.calls.filter((c: unknown[]) => c[1] === `request.reposted:${id}`)).toHaveLength(1);
      expect(await prisma.requestVersion.count({ where: { requestId: id } })).toBe(versionsBefore + 1);
    });

    it('cererea altui client → FORBIDDEN; cererea stearsa → NOT_FOUND', async () => {
      const owner = await makeClient(prisma);
      const other = await makeClient(prisma);
      ids.userIds.push(owner, other);
      const id = await expiredRequest(owner);
      await expect(service.repostWithChangesForClient(other, id, await contentFor(other))).rejects.toBeInstanceOf(ForbiddenException);
      await prisma.request.update({ where: { id }, data: { deletedAt: new Date() } });
      await expect(service.repostWithChangesForClient(owner, id, await contentFor(owner))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revizie A m2: doua editari simultane dupa preluare → una singura; a doua EDIT_LIMIT_POST_CLAIM_REACHED', async () => {
      const client = await makeClient(prisma);
      ids.userIds.push(client);
      const id = await makePublishedRequest(prisma, client, { cost: 1, lat: 44.4, lng: 26.1, status: 'CLAIMED_PARTIAL' });
      ids.requestIds.push(id);
      const results = await Promise.allSettled([
        service.editForClient(client, id, await contentFor(client, 'Editare A')),
        service.editForClient(client, id, await contentFor(client, 'Editare B')),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((rejected.reason as BadRequestException).getResponse()).toMatchObject({ code: ERROR_CODES.EDIT_LIMIT_POST_CLAIM_REACHED });
      expect((await prisma.request.findUniqueOrThrow({ where: { id } })).postClaimEditsUsed).toBe(1);
    });
  });
});
