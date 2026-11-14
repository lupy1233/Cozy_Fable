import { DRAFT_CLEANUP_DELETED_GRACE_MS, DraftCleanupService } from './draft-cleanup.service';
import { DRAFT_CLEANUP_JOB, DRAFT_CLEANUP_REPEAT, DraftCleanupProcessor } from './draft-cleanup.processor';

// f6 (PO f6-1): curatarea ciornelor — doar DRAFT, 7 zile vizitatori / 90 zile clienti,
// fisierele intai (doar cele nefolosite de alt rand), reverificare sub lock.

const NOW = new Date('2026-11-14T01:30:00Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 1000);

type Row = {
  id: string;
  status: string;
  clientUserId: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
};
type Att = { id: string; entityType: string; entityId: string; storageKey: string };
type Cut = { guest: Date; client: Date; deletedBefore: Date };

// aceleasi reguli ca SQL-ul din listCandidates (verificat separat, mai jos, pe text)
const matches = (r: Row, c: Cut, lastId?: string) => {
  if (r.status !== 'DRAFT') return false;
  if (lastId && !(r.id > lastId)) return false;
  if (r.deletedAt !== null) return r.deletedAt < c.deletedBefore;
  return r.updatedAt < (r.clientUserId === null ? c.guest : c.client);
};

function setup(rows: Row[], attachments: Att[] = [], settings: Record<string, number> = {}) {
  const db = { rows: rows.map((r) => ({ ...r })), attachments: attachments.map((a) => ({ ...a })) };
  const lockRow = (id: string) => {
    const r = db.rows.find((x) => x.id === id);
    return r ? [{ status: r.status, deleted_at: r.deletedAt, client_user_id: r.clientUserId, updated_at: r.updatedAt }] : [];
  };
  const tx = {
    $queryRaw: jest.fn((_s: TemplateStringsArray, id: string) => Promise.resolve(lockRow(id))),
    request: {
      updateMany: jest.fn(({ where, data }: { where: { id: string }; data: { deletedAt: Date } }) => {
        const r = db.rows.find((x) => x.id === where.id && x.status === 'DRAFT' && x.deletedAt === null);
        if (r) r.deletedAt = data.deletedAt;
        return Promise.resolve({ count: r ? 1 : 0 });
      }),
      deleteMany: jest.fn(({ where }: { where: { id: string } }) => {
        const before = db.rows.length;
        db.rows = db.rows.filter((x) => !(x.id === where.id && x.status === 'DRAFT' && x.deletedAt !== null));
        return Promise.resolve({ count: before - db.rows.length });
      }),
    },
    attachment: {
      // revizie m1: stergerea filtreaza pe perechile (id, storageKey) vazute la pasul (1)
      deleteMany: jest.fn(({ where }: { where: { entityId: string; OR: { id: string; storageKey: string }[] } }) => {
        const before = db.attachments.length;
        db.attachments = db.attachments.filter(
          (a) => !(a.entityId === where.entityId && where.OR.some((p) => p.id === a.id && p.storageKey === a.storageKey)),
        );
        return Promise.resolve({ count: before - db.attachments.length });
      }),
      count: jest.fn(({ where }: { where: { entityId: string } }) =>
        Promise.resolve(db.attachments.filter((a) => a.entityId === where.entityId).length)),
    },
  };
  // revizie M1: fara prisma.request — listarea nu mai are voie sa treaca prin findMany (middleware-ul
  // softDeleteReads ar anula ramura deleted_at); un findMany ar arunca aici
  const prisma = {
    $queryRaw: jest.fn(),
    attachment: {
      findMany: jest.fn(({ where }: { where: { entityId: string } }) =>
        Promise.resolve(db.attachments.filter((a) => a.entityType === 'REQUEST' && a.entityId === where.entityId).map((a) => ({ ...a })))),
      count: jest.fn(({ where }: { where: { storageKey: string; id: { not: string } } }) =>
        Promise.resolve(db.attachments.filter((a) => a.storageKey === where.storageKey && a.id !== where.id.not).length)),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const settingsService = {
    getInt: jest.fn((key: string, fallback: number) => Promise.resolve(settings[key] ?? fallback)),
  };
  const service = new DraftCleanupService(prisma as never, storage as never, settingsService as never);
  const listCalls: number[] = [];
  jest.spyOn(service, 'listCandidates').mockImplementation(async (cutoffs, lastId, take) => {
    listCalls.push(take);
    return db.rows
      .filter((r) => matches(r, cutoffs, lastId))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, take)
      .map((r) => ({ id: r.id }));
  });
  return { listCalls, service, db, prisma, tx, storage };
}

const draft = (id: string, over: Partial<Row> = {}): Row => ({
  id, status: 'DRAFT', clientUserId: null, updatedAt: daysAgo(1), deletedAt: null, ...over,
});

describe('DraftCleanupService', () => {
  it('sterge doar ciornele DRAFT peste prag: vizitator > 7 zile, client > 90 zile', async () => {
    const { service, db } = setup([
      draft('a-guest-old', { updatedAt: daysAgo(8) }),
      draft('b-guest-recent', { updatedAt: daysAgo(6) }),
      draft('c-client-60', { clientUserId: 'u1', updatedAt: daysAgo(60) }),
      draft('d-client-old', { clientUserId: 'u1', updatedAt: daysAgo(91) }),
    ]);
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 2, failed: 0, skipped: 0 });
    expect(db.rows.map((r) => r.id)).toEqual(['b-guest-recent', 'c-client-60']);
  });

  it('nu atinge cererile publicate / expirate, oricat de vechi (nici fisierele lor)', async () => {
    const { service, db, storage } = setup(
      [
        draft('p-pub', { status: 'IN_MARKETPLACE', updatedAt: daysAgo(400) }),
        draft('p-exp', { status: 'EXPIRED', updatedAt: daysAgo(400), deletedAt: daysAgo(300) }),
      ],
      [{ id: 'f1', entityType: 'REQUEST', entityId: 'p-pub', storageKey: 'request/p-pub/f1/clean-x.jpg' }],
    );
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 0, failed: 0, skipped: 0 });
    expect(db.rows).toHaveLength(2);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('cere stergerea fisierelor din storage INAINTE de randuri; randurile attachments pleaca si ele', async () => {
    const { service, db, storage, tx } = setup(
      [draft('g1', { updatedAt: daysAgo(10) })],
      [
        { id: 'f1', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/g1/f1/clean-a.jpg' },
        { id: 'f2', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/g1/f2/sealed-b.pdf' },
      ],
    );
    await service.run(NOW);
    expect(storage.deleteObject).toHaveBeenCalledWith('request/g1/f1/clean-a.jpg');
    expect(storage.deleteObject).toHaveBeenCalledWith('request/g1/f2/sealed-b.pdf');
    expect(storage.deleteObject.mock.invocationCallOrder[1]).toBeLessThan(tx.request.deleteMany.mock.invocationCallOrder[0]);
    expect(db.attachments).toHaveLength(0);
    expect(db.rows).toHaveLength(0);
  });

  it('un fisier a carui cheie e folosita de alt rand (cerere publicata) ramane in storage', async () => {
    const { service, db, storage } = setup(
      [draft('g1', { updatedAt: daysAgo(10) }), draft('pub', { status: 'IN_MARKETPLACE' })],
      [
        { id: 'f1', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/shared/key.jpg' },
        { id: 'f9', entityType: 'REQUEST', entityId: 'pub', storageKey: 'request/shared/key.jpg' },
      ],
    );
    await service.run(NOW);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(db.rows.map((r) => r.id)).toEqual(['pub']);
    expect(db.attachments.map((a) => a.id)).toEqual(['f9']);
  });

  it('curata ciornele aruncate (deleted_at), indiferent de varsta, dupa pauza de siguranta', async () => {
    const { service, db, storage } = setup(
      [
        draft('t1', { updatedAt: daysAgo(0), deletedAt: minutesAgo(31), clientUserId: 'u1' }),
        // aruncata acum 5 minute: o urcare in curs are timp sa se termine (revizie m1)
        draft('t2', { updatedAt: daysAgo(0), deletedAt: minutesAgo(5) }),
      ],
      [{ id: 'f1', entityType: 'REQUEST', entityId: 't1', storageKey: 'request/t1/f1/x.png' }],
    );
    expect(DRAFT_CLEANUP_DELETED_GRACE_MS).toBe(30 * 60 * 1000);
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 1, failed: 0, skipped: 0 });
    expect(storage.deleteObject).toHaveBeenCalledWith('request/t1/f1/x.png');
    expect(db.rows.map((r) => r.id)).toEqual(['t2']);
  });

  it('ciorna publicata intre listare si stergere: reverificarea sub lock o lasa in pace', async () => {
    const { service, db, tx, storage } = setup(
      [draft('g1', { updatedAt: daysAgo(10) })],
      [{ id: 'f1', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/g1/f1/a.jpg' }],
    );
    tx.$queryRaw.mockImplementationOnce(() => Promise.resolve([{ status: 'IN_MARKETPLACE', deleted_at: null, client_user_id: 'u1', updated_at: NOW }]));
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 0, failed: 0, skipped: 1 });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(1);
  });

  it('ciorna atinsa intre listare si lock (salvare automata) → nu se sterge', async () => {
    const { service, tx, storage } = setup([draft('g1', { updatedAt: daysAgo(10) })]);
    tx.$queryRaw.mockImplementationOnce(() => Promise.resolve([{ status: 'DRAFT', deleted_at: null, client_user_id: null, updated_at: NOW }]));
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 0, failed: 0, skipped: 1 });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('esecul stergerii unui fisier: ciorna ramane marcata, iar a doua rulare run() o termina', async () => {
    const { service, db, storage } = setup(
      [draft('g1', { updatedAt: daysAgo(10) })],
      [{ id: 'f1', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/g1/f1/a.jpg' }],
    );
    storage.deleteObject.mockRejectedValueOnce(new Error('S3 down'));
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 0, failed: 1, skipped: 0 });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].deletedAt).not.toBeNull();
    expect(db.attachments).toHaveLength(1);
    // rularea de a doua zi: ramura deleted_at o reia (revizie M1)
    const tomorrow = new Date(NOW.getTime() + DAY);
    await expect(service.run(tomorrow)).resolves.toEqual({ deleted: 1, failed: 0, skipped: 0 });
    expect(db.rows).toHaveLength(0);
    expect(db.attachments).toHaveLength(0);
  });

  it('revizie m1: cheia unui fisier schimbata intre storage si stergerea randurilor → randul ramane, ciorna se reia', async () => {
    const { service, db, storage } = setup(
      [draft('g1', { updatedAt: daysAgo(10) })],
      [{ id: 'f1', entityType: 'REQUEST', entityId: 'g1', storageKey: 'request/g1/f1/orig.jpg' }],
    );
    // sigilarea muta fisierul pe cheia noua exact dupa ce jobul a sters cheia veche
    storage.deleteObject.mockImplementationOnce(async () => {
      db.attachments[0].storageKey = 'request/g1/f1/sealed-new.jpg';
    });
    await expect(service.run(NOW)).resolves.toEqual({ deleted: 0, failed: 0, skipped: 1 });
    expect(db.rows).toHaveLength(1);
    expect(db.attachments.map((a) => a.storageKey)).toEqual(['request/g1/f1/sealed-new.jpg']);
    // rularea urmatoare sterge si cheia noua, apoi randurile
    await expect(service.run(new Date(NOW.getTime() + DAY))).resolves.toEqual({ deleted: 1, failed: 0, skipped: 0 });
    expect(storage.deleteObject).toHaveBeenLastCalledWith('request/g1/f1/sealed-new.jpg');
    expect(db.attachments).toHaveLength(0);
  });

  it('pragurile vin din setari; o valoare sub 1 cade pe implicit (nu sterge tot)', async () => {
    const custom = setup([draft('g1', { updatedAt: daysAgo(3) })], [], { guest_draft_retention_days: 2 });
    await expect(custom.service.run(NOW)).resolves.toMatchObject({ deleted: 1 });

    const zero = setup([draft('g1', { updatedAt: daysAgo(3) })], [], { guest_draft_retention_days: 0, client_draft_retention_days: 0 });
    await expect(zero.service.run(NOW)).resolves.toMatchObject({ deleted: 0 });
  });

  it('pe loturi, cu limita pe rulare', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => draft(`g${String(i).padStart(3, '0')}`, { updatedAt: daysAgo(30) }));
    const { service, db, listCalls } = setup(rows);
    await expect(service.run(NOW)).resolves.toMatchObject({ deleted: 120 });
    expect(db.rows).toHaveLength(0);
    for (const take of listCalls) expect(take).toBeLessThanOrEqual(50);
  });
});

// revizie M1: listarea e SQL direct (nu findMany, care trece prin softDeleteReads), cu ramura
// deleted_at si filtrul strict pe DRAFT
describe('DraftCleanupService.listCandidates — SQL', () => {
  it('interogheaza requests prin $queryRaw: status DRAFT + ramura deleted_at IS NOT NULL + praguri', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'x' }]) };
    const service = new DraftCleanupService(prisma as never, {} as never, {} as never);
    const cutoffs = { guest: daysAgo(7), client: daysAgo(90), deletedBefore: minutesAgo(30) };
    await expect(service.listCandidates(cutoffs, undefined, 50)).resolves.toEqual([{ id: 'x' }]);
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain("WHERE status = 'DRAFT'");
    expect(sql).toContain('deleted_at IS NOT NULL AND deleted_at < ?');
    expect(sql).toContain('deleted_at IS NULL AND client_user_id IS NULL AND updated_at < ?');
    expect(sql).toContain('deleted_at IS NULL AND client_user_id IS NOT NULL AND updated_at < ?');
    expect(sql).toContain('ORDER BY id ASC');
    expect(values).toEqual(expect.arrayContaining([cutoffs.deletedBefore, cutoffs.guest, cutoffs.client, 50]));
  });
});

describe('DraftCleanupProcessor', () => {
  it('programeaza jobul zilnic la 03:30 ora Romaniei si ruleaza curatarea', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const cleanup = { run: jest.fn().mockResolvedValue({ deleted: 0, failed: 0, skipped: 0 }) };
    const processor = new DraftCleanupProcessor(cleanup as never, queue as never);
    await processor.onModuleInit();
    expect(DRAFT_CLEANUP_REPEAT).toEqual({ pattern: '30 3 * * *', tz: 'Europe/Bucharest' });
    expect(queue.add).toHaveBeenCalledWith(DRAFT_CLEANUP_JOB, {}, expect.objectContaining({ repeat: DRAFT_CLEANUP_REPEAT }));
    await processor.process({ name: DRAFT_CLEANUP_JOB } as never);
    expect(cleanup.run).toHaveBeenCalledTimes(1);
  });
});
