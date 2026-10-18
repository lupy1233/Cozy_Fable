import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RequestsService } from './requests.service';
import type { ProcessedRoom } from './configurator.service';
import { inspirationRows } from './inspiration-selection';
import { testDatabaseUrl } from '../../test/db-guard';

// Ruleaza doar cu TEST_DATABASE_URL (Postgres local): E-client-34 — request_room_id =
// id-ul persistat al camerei, FK SET NULL cand camera dispare, VARCHAR(200) pe notita.
const url = testDatabaseUrl();
(url ? describe : describe.skip)('request_inspiration_photos (note + camera) against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const service = new RequestsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const internals = service as unknown as {
    writeRooms: RequestsService['writeRooms'];
    writeInspirationPhotos: RequestsService['writeInspirationPhotos'];
  };
  const room = (sourceLocalId: string | undefined, roomType: ProcessedRoom['roomType']): ProcessedRoom => ({
    sourceLocalId,
    roomType,
    flowVersion: 1,
    answers: {},
    scoreEntries: [],
    derived: { lengthM: 1, widthM: 1, heightM: 2.4, items: [] },
  });
  const createdRequests: string[] = [];
  let companyId = '';
  let photoA = '';
  let photoB = '';

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        name: `it-e-client-34-${randomUUID().slice(0, 8)}`,
        cui: 'RO1',
        regComNumber: 'J00/1/2000',
        addressText: 'Str. Test 1',
        county: 'Cluj',
        city: 'Cluj-Napoca',
        lat: 46.77,
        lng: 23.6,
      },
    });
    companyId = company.id;
    const mk = (title: string) =>
      prisma.inspirationPhoto.create({ data: { companyId, title, roomType: 'KITCHEN', published: true } });
    photoA = (await mk('Poza A')).id;
    photoB = (await mk('Poza B')).id;
  });

  afterAll(async () => {
    await prisma.request.deleteMany({ where: { id: { in: createdRequests } } });
    await prisma.company.deleteMany({ where: { id: companyId } }); // cascade pe poze
    await prisma.$disconnect();
  });

  const newRequest = async () => {
    const r = await prisma.request.create({ data: { draftTokenHash: randomUUID(), status: 'DRAFT', includesPaidDesign: false, hasOwnProject: false } });
    createdRequests.push(r.id);
    return r.id;
  };
  const writeAll = (requestId: string, rooms: ProcessedRoom[], selection: Parameters<typeof inspirationRows>[1]) =>
    prisma.$transaction(async (tx) => {
      const roomIds = await internals.writeRooms(tx, requestId, rooms);
      await internals.writeInspirationPhotos(tx, requestId, selection, roomIds);
      return roomIds;
    });

  it('links the photo to the persisted room id and stores the note', async () => {
    const requestId = await newRequest();
    const ids = await writeAll(requestId, [room('k1', 'KITCHEN'), room('l1', 'LIVING')], [
      { photoId: photoA, note: 'fronturi mate', roomLocalId: 'k1' },
      { photoId: photoB, note: null, roomLocalId: null },
    ]);
    const rows = await prisma.requestInspirationPhoto.findMany({ where: { requestId }, orderBy: { photoId: 'asc' } });
    const a = rows.find((r) => r.photoId === photoA)!;
    const b = rows.find((r) => r.photoId === photoB)!;
    expect(a.requestRoomId).toBe(ids.get('k1'));
    expect(a.note).toBe('fronturi mate');
    expect(b.requestRoomId).toBeNull();
    expect(b.note).toBeNull();
  });

  it('edit: a room dropped from the request leaves the row rewritten without a room', async () => {
    const requestId = await newRequest();
    const first = await writeAll(requestId, [room('k1', 'KITCHEN')], [{ photoId: photoA, note: 'x', roomLocalId: 'k1' }]);
    // a doua scriere: camera dispare, poza ramane fara camera
    await writeAll(requestId, [room('l1', 'LIVING')], [{ photoId: photoA, note: 'x', roomLocalId: null }]);
    const row = await prisma.requestInspirationPhoto.findUniqueOrThrow({ where: { requestId_photoId: { requestId, photoId: photoA } } });
    expect(row.requestRoomId).toBeNull();
    expect(await prisma.requestRoom.count({ where: { id: first.get('k1') } })).toBe(0);
  });

  it('deleting the room directly sets request_room_id to NULL (FK SET NULL)', async () => {
    const requestId = await newRequest();
    const ids = await writeAll(requestId, [room('k1', 'KITCHEN')], [{ photoId: photoA, note: 'pastrez nota', roomLocalId: 'k1' }]);
    await prisma.requestRoom.delete({ where: { id: ids.get('k1')! } });
    const row = await prisma.requestInspirationPhoto.findUniqueOrThrow({ where: { requestId_photoId: { requestId, photoId: photoA } } });
    expect(row.requestRoomId).toBeNull();
    expect(row.note).toBe('pastrez nota');
  });

  it('a 200 character note is stored; 201 never reaches the column (validated before)', async () => {
    const requestId = await newRequest();
    await writeAll(requestId, [], [{ photoId: photoA, note: 'a'.repeat(200), roomLocalId: null }]);
    const row = await prisma.requestInspirationPhoto.findUniqueOrThrow({ where: { requestId_photoId: { requestId, photoId: photoA } } });
    expect(row.note).toHaveLength(200);
    // plasa de siguranta: coloana refuza 201 daca validarea din amonte ar lipsi
    const other = await newRequest();
    await expect(
      prisma.requestInspirationPhoto.create({ data: { requestId: other, photoId: photoB, note: 'a'.repeat(201) } }),
    ).rejects.toThrow();
  });
});
