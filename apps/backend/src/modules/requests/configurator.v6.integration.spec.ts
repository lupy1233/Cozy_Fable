import { randomUUID } from 'crypto';
import {
  ETAPA6_FLOW_VERSION,
  FIRM_DECIDES,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  FLOW_VERSIONS_BEFORE_ETAPA6,
  type RoomType,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { testDatabaseUrl } from '../../test/db-guard';
import { computeSizing } from '../sizing/sizing.service';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import type { ConfiguratorRoomInputDto } from './dto/request.dto';
import { RequestsService } from './requests.service';

// etapa 6 (DESIGN §7 "Server", pachet F) pe PostgreSQL real: camerele pe versiunile noi ale formularului
// se salveaza cu piesele derivate pe server ("decide firma" → ALTUL + nota, dimensiunile "Altei piese" in
// descriere), cererile vechi se rescriu pe versiunea lor, iar randul de scor nou al blatului exista dupa
// migrarea 20261114120000. Ruleaza doar cu TEST_DATABASE_URL local (garda db-guard) si cu migrarile aplicate.
const url = testDatabaseUrl();
(url ? describe : describe.skip)('Configurator etapa 6 against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  // writeRooms foloseste doar clientul de tranzactie; restul dependintelor nu sunt atinse
  const service = new RequestsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const configurator = new ConfiguratorService();
  const write = (requestId: string, rooms: ProcessedRoom[]) =>
    prisma.$transaction((tx) => (service as unknown as { writeRooms: RequestsService['writeRooms'] }).writeRooms(tx, requestId, rooms));

  const OLD = (rt: RoomType) => Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6[rt]);
  const NEW = (rt: RoomType) => ETAPA6_FLOW_VERSION[rt];
  const input = (sourceLocalId: string, roomType: RoomType, flowVersion: number, answers: Record<string, unknown>) =>
    ({ sourceLocalId, roomType, flowVersion, answers }) as ConfiguratorRoomInputDto;
  const KITCHEN = {
    layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 },
    frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], openingSystemsWall: ['PUSH'], countertop: 'PAL',
  };

  const created: string[] = [];
  const newRequest = async () => {
    const r = await prisma.request.create({ data: { draftTokenHash: randomUUID(), status: 'DRAFT', includesPaidDesign: false, hasOwnProject: false } });
    created.push(r.id);
    return r.id;
  };
  const storedRoom = (id: string) =>
    prisma.requestRoom.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { name: 'asc' } } } });
  afterAll(async () => {
    await prisma.request.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('publicare pe versiunile noi: "decide firma" se salveaza ca ALTUL + nota, dimensiunile "Altei piese" in descriere', async () => {
    const requestId = await newRequest();
    const processed = configurator.processRooms([
      input('kitchen', 'KITCHEN', NEW('KITCHEN'), { ...KITCHEN, frontMaterialBase: FIRM_DECIDES, openingSystemsBase: [FIRM_DECIDES], countertop: FIRM_DECIDES }),
      input('bedroom', 'BEDROOM', NEW('BEDROOM'), {
        piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_INFOLIAT',
      }),
      input('pieces', 'PIECES', NEW('PIECES'), {
        pieces: [{ name: 'Raft baie', material: 'PAL', systems: ['MANER'], quantity: 1, description: 'Cu două uși', widthCm: 120, heightCm: 80, depthCm: 40 }],
      }),
    ]);
    const ids = await write(requestId, processed.rooms);

    const kitchen = await storedRoom(ids.get('kitchen')!);
    expect(kitchen.flowVersion).toBe(NEW('KITCHEN'));
    // raspunsurile brute pastreaza marcajul (fisa firmei re-deriva "Recomandarea firmei" din ele)
    expect(kitchen.answers).toMatchObject({ frontMaterialBase: FIRM_DECIDES, countertop: FIRM_DECIDES });
    const base = kitchen.items.find((i) => i.name === 'Corpuri de bază');
    expect(base).toMatchObject({ material: 'ALTUL', systems: [] });
    expect(base?.description).toContain(FIRM_MATERIAL_NOTE);
    expect(base?.description).toContain(FIRM_OPENING_NOTE);

    const bedroom = await storedRoom(ids.get('bedroom')!);
    expect(bedroom.flowVersion).toBe(NEW('BEDROOM'));
    expect(bedroom.items).toHaveLength(1);
    expect(bedroom.items[0]).toMatchObject({ material: 'MDF_INFOLIAT', systems: ['GLISANTE'] });

    const pieces = await storedRoom(ids.get('pieces')!);
    expect(pieces.items[0].description).toContain('Cu două uși');
    expect(pieces.items[0].description).toContain('Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)');
  });

  it('editarea unei cereri vechi: camera ramane pe versiunea ei, cu aceleasi piese; o camera noua primeste versiunea noua', async () => {
    const requestId = await newRequest();
    const first = await write(requestId, configurator.processRooms([input('old', 'KITCHEN', OLD('KITCHEN'), KITCHEN)]).rooms);
    const oldId = first.get('old')!;
    const before = await storedRoom(oldId);

    // republicarea trimite aceleasi raspunsuri pe versiunea veche + o camera adaugata la editare
    const edited = configurator.processRooms([
      input(oldId, 'KITCHEN', OLD('KITCHEN'), KITCHEN),
      input('added', 'KITCHEN', NEW('KITCHEN'), KITCHEN),
    ]);
    const second = await write(requestId, edited.rooms);
    const after = await storedRoom(oldId);
    expect(second.get(oldId)).toBe(oldId);
    expect(after.flowVersion).toBe(OLD('KITCHEN'));
    expect(after.items.map(({ name, material, systems, description, quantity }) => ({ name, material, systems, description, quantity })))
      .toEqual(before.items.map(({ name, material, systems, description, quantity }) => ({ name, material, systems, description, quantity })));
    expect((await storedRoom(second.get('added')!)).flowVersion).toBe(NEW('KITCHEN'));
  });

  it('randul de scor KITCHEN_COUNTERTOP:FIRM_DECIDES exista dupa migrare (0 puncte) si blatul "decide firma" nu schimba costul', async () => {
    const row = await prisma.projectSizingConfig.findUnique({ where: { key_option: { key: 'KITCHEN_COUNTERTOP', option: FIRM_DECIDES } } });
    expect(row?.weight).toBe(0);

    // ponderile citite din baza (ca SizingService.compute); pragurile S/M/L nu conteaza aici
    // (baza de test poate fi fara seed), deci un singur prag deschis
    const weights = await prisma.projectSizingConfig.findMany();
    const cost = (countertop: string) =>
      computeSizing(weights, [{ size: 'S', minScore: 0, maxScore: null }], {
        scoreEntries: configurator.processRooms([input('k', 'KITCHEN', NEW('KITCHEN'), { ...KITCHEN, countertop })]).scoreEntries,
        budgetRange: 'UNDISCLOSED',
        includesPaidDesign: false,
      }).baseScore;
    expect(cost(FIRM_DECIDES)).toBe(cost('PAL'));
  });
});
