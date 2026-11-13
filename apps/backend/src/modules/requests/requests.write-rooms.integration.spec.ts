import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RequestsService } from './requests.service';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import { CURRENT_FLOW_VERSION } from '@marketplace/shared';
import { testDatabaseUrl } from '../../test/db-guard';

// Ruleaza doar cu TEST_DATABASE_URL (Postgres local): verifica semantica writeRooms
// dupa rescrierea cu numar constant de query-uri (incident publish P2028, 2026-09-17).
// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('RequestsService.writeRooms against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  // writeRooms foloseste doar clientul de tranzactie; restul dependintelor nu sunt atinse
  const service = new RequestsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const write = (requestId: string, rooms: ProcessedRoom[]) =>
    prisma.$transaction((tx) => (service as unknown as { writeRooms: RequestsService['writeRooms'] }).writeRooms(tx, requestId, rooms));
  const room = (sourceLocalId: string | undefined, names: string[]): ProcessedRoom => ({
    sourceLocalId,
    roomType: 'PIECES',
    flowVersion: 1,
    answers: {},
    scoreEntries: [],
    derived: {
      lengthM: names.length,
      widthM: 0.6,
      heightM: 2.4,
      items: names.map((name) => ({ name, material: 'PAL', systems: ['PUSH'], description: '', quantity: 1 })),
    },
  });
  const snapshot = async (requestId: string) => {
    const rooms = await prisma.requestRoom.findMany({ where: { requestId }, include: { items: { orderBy: { name: 'asc' } } }, orderBy: { lengthM: 'asc' } });
    return rooms.map((r) => ({ id: r.id, items: r.items.map((i) => i.name) }));
  };
  const created: string[] = [];
  const newRequest = async () => {
    const r = await prisma.request.create({ data: { draftTokenHash: randomUUID(), status: 'DRAFT', includesPaidDesign: false, hasOwnProject: false } });
    created.push(r.id);
    return r.id;
  };
  afterAll(async () => {
    await prisma.request.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('publish: creates every room with its items and maps sourceLocalId to the persisted id', async () => {
    const requestId = await newRequest();
    const ids = await write(requestId, [room('a', ['A1', 'A2']), room('b', ['B1']), room(undefined, ['C1', 'C2', 'C3'])]);
    const rooms = await snapshot(requestId);
    expect(rooms).toHaveLength(3);
    expect(rooms.map((r) => r.items)).toEqual([['B1'], ['A1', 'A2'], ['C1', 'C2', 'C3']]);
    expect([...ids.keys()].sort()).toEqual(['a', 'b']);
    expect(rooms.map((r) => r.id)).toEqual(expect.arrayContaining([ids.get('a'), ids.get('b')]));
  });

  it('edit: keeps owned ids, replaces their items, drops rooms left out and ignores foreign ids', async () => {
    const requestId = await newRequest();
    const first = await write(requestId, [room('a', ['A1']), room('b', ['B1']), room('c', ['C1'])]);
    const other = await newRequest();
    const foreign = await write(other, [room('x', ['X1'])]);
    const second = await write(requestId, [
      room(first.get('a'), ['A1-edited', 'A2-new']),
      room(foreign.get('x'), ['F1']), // id-ul altei cereri: nu poate fi selectat, devine camera noua
      room('brand-new', ['N1']),
    ]);
    const rooms = await snapshot(requestId);
    expect(rooms).toHaveLength(3);
    expect(second.get(first.get('a')!)).toBe(first.get('a'));
    expect(rooms.find((r) => r.id === first.get('a'))?.items).toEqual(['A1-edited', 'A2-new']);
    expect(rooms.map((r) => r.id)).not.toEqual(expect.arrayContaining([first.get('b'), first.get('c'), foreign.get('x')]));
    expect(second.get(foreign.get('x')!)).not.toBe(foreign.get('x'));
    // cererea straina ramane neatinsa
    expect(await snapshot(other)).toEqual([{ id: foreign.get('x'), items: ['X1'] }]);
    // itemele camerelor sterse nu raman orfane
    expect(await prisma.requestRoomItem.count({ where: { name: { in: ['B1', 'C1'] }, room: { requestId } } })).toBe(0);
  });

  // b8 (PO g0-8 / b8-3): camera cu ajutor se scrie cu needs_design_help=true si fara raspunsuri
  it('design help: the flagged room is stored without answers and the flag follows edits', async () => {
    const requestId = await newRequest();
    const sketchId = randomUUID();
    const processed = new ConfiguratorService().processRooms([
      {
        sourceLocalId: 'help',
        roomType: 'BEDROOM',
        flowVersion: CURRENT_FLOW_VERSION.BEDROOM,
        answers: { piecesNeeded: ['NOT_A_PIECE'], sketch: [sketchId] },
        needsDesignHelp: true,
      },
    ]);
    const ids = await write(requestId, processed.rooms);
    const stored = await prisma.requestRoom.findUniqueOrThrow({ where: { id: ids.get('help')! } });
    expect(stored.needsDesignHelp).toBe(true);
    expect(stored.answers).toEqual({ sketch: [sketchId] });

    // editarea pastreaza id-ul camerei si rescrie bifa
    await write(requestId, [{ ...room(stored.id, ['P1']), needsDesignHelp: false }]);
    const edited = await prisma.requestRoom.findUniqueOrThrow({ where: { id: stored.id } });
    expect(edited.needsDesignHelp).toBe(false);
  });
});
