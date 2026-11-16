import {
  BODY_NOTE,
  collectScoreEntries,
  CURRENT_FLOW_VERSION,
  defaultPieceConfig,
  ERROR_CODES,
  ETAPA10_FLOW_VERSION,
  ETAPA6_FLOW_VERSION,
  evalCondition,
  FIRM_DECIDES,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  FLOW_REGISTRY,
  FLOW_VERSIONS_BEFORE_ETAPA10,
  FLOW_VERSIONS_BEFORE_ETAPA6,
  FRAME_BY_FIRM_NOTE,
  NO_FRONTS,
  NO_FRONTS_NOTE,
  normalizePieceConfig,
  pruneAnswers,
  visibleOptions,
  type AnswerMap,
  type PieceConfig3d,
  type QuestionStep,
  type RoomFlow,
  type RoomType,
  type ScoreEntry,
} from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'fs';
// fixture-urile deterministe ale instantaneelor (nu sunt exportate din pachet); jest ruleaza sursele shared
import { allFixtureFlows, FIXTURE_VARIANTS, fixtureAnswers } from '../../../../../packages/shared/src/questionnaire/firm-text.fixtures';
import { join } from 'path';
import { computeSizing, type SizingConfigRow } from '../sizing/sizing.service';
import { ConfiguratorService, droppedDesignHelpUploadIds, type ProcessedRoom } from './configurator.service';
import type { ConfiguratorRoomInputDto } from './dto/request.dto';

const service = new ConfiguratorService();

function bedroom(answers: Record<string, unknown> = {}): ConfiguratorRoomInputDto {
  return { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers } as ConfiguratorRoomInputDto;
}

function errorOf(fn: () => unknown): { code?: string; details?: unknown } {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).getResponse() as { code?: string; details?: unknown };
  }
  throw new Error('expected BadRequestException');
}

describe('ConfiguratorService', () => {
  it('collectUploadAttachmentRefs keeps room index and step id', () => {
    const rooms = [
      { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers: {} },
      { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers: { sketch: ['a', 'b'] } },
    ] as unknown as ProcessedRoom[];
    const refs = service.collectUploadAttachmentRefs(rooms);
    expect(refs).toEqual([
      { roomIndex: 1, stepId: 'sketch', id: 'a' },
      { roomIndex: 1, stepId: 'sketch', id: 'b' },
    ]);
    expect(service.collectUploadAttachmentIds(rooms)).toEqual(['a', 'b']);
  });

  it('allows an empty design-brief room (zero derived length is "unknown")', () => {
    const processed = service.processRooms([bedroom()], { designBrief: true });
    expect(processed.rooms).toHaveLength(1);
    expect(processed.rooms[0].derived.lengthM).toBe(0);
  });

  // b8 (PO g0-8 / b8-3): camera cu ajutor pierde raspunsurile, isi pastreaza schitele
  it('a design-help room drops its questionnaire answers but keeps its sketches', () => {
    const helpRoom = { ...bedroom({ piecesNeeded: ['NOT_A_PIECE'], strayKey: 1, sketch: ['11111111-1111-4111-8111-111111111111'] }), needsDesignHelp: true };
    const processed = service.processRooms([helpRoom]);
    expect(processed.rooms[0].answers).toEqual({ sketch: ['11111111-1111-4111-8111-111111111111'] });
    expect(processed.rooms[0].needsDesignHelp).toBe(true);
    expect(service.collectUploadAttachmentIds(processed.rooms)).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  // M1: poza 3D (pas ascuns snapshot3d) a unei camere cu ajutor nu pleaca la firme
  it('a design-help piece drops its hidden 3D snapshot and reports it as dropped', () => {
    const SKETCH = '11111111-1111-4111-8111-111111111111';
    const SNAP = '22222222-2222-4222-8222-222222222222';
    const raw = [{
      roomType: 'PIECE_DRESSER',
      flowVersion: CURRENT_FLOW_VERSION.PIECE_DRESSER,
      answers: { sketch: [SKETCH], snapshot3d: [SNAP] },
      needsDesignHelp: true,
    }] as ConfiguratorRoomInputDto[];
    const processed = service.processRooms(raw);
    expect(processed.rooms[0].answers).toEqual({ sketch: [SKETCH] });
    expect(droppedDesignHelpUploadIds(raw, processed.rooms)).toEqual([SNAP]);
    // o camera fara ajutor nu raporteaza nimic
    expect(droppedDesignHelpUploadIds([{ ...raw[0], needsDesignHelp: false }], processed.rooms)).toEqual([]);
  });

  // d1 (PO d1-1): camera cu ajutor nu primeste piese, materiale si dimensiuni inventate
  it('a design-help room gets no generated items and no made-up dimensions', () => {
    const rooms = [
      { roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, answers: {}, needsDesignHelp: true },
      { ...bedroom(), needsDesignHelp: true },
    ] as ConfiguratorRoomInputDto[];
    const processed = service.processRooms(rooms);
    for (const room of processed.rooms) {
      expect(room.derived).toEqual({ lengthM: 0, widthM: 0, heightM: 0, items: [] });
      expect(room.scoreEntries.some((e) => e.category === 'MATERIAL' || e.category === 'SYSTEM')).toBe(false);
    }
  });

  describe('credit cost with design help (d1-1: the cost goes down)', () => {
    // greutatile din prisma/seed.ts (doar categoriile atinse aici)
    const W: SizingConfigRow[] = [
      ['ROOM_TYPE', 'KITCHEN', 8], ['ROOM_TYPE', 'BEDROOM', 4],
      ['ROOM_SIZE', 'UNDER_2M', 1], ['ROOM_SIZE', 'FROM_2_TO_4M', 3], ['ROOM_SIZE', 'OVER_4M', 5],
      ['MATERIAL', 'PAL', 1], ['MATERIAL', 'MDF_INFOLIAT', 2],
      ['SYSTEM', 'MANER', 1], ['SYSTEM', 'PUSH', 2], ['SYSTEM', 'GLISANTE', 3],
      ['ITEM_QUANTITY', 'QTY_1', 0], ['ITEM_QUANTITY', 'QTY_2_3', 2], ['ITEM_QUANTITY', 'QTY_4_PLUS', 4],
      ['KITCHEN_LAYOUT', 'STRAIGHT', 1], ['KITCHEN_COUNTERTOP', 'PAL', 0],
    ].map(([key, option, weight]) => ({ key: key as string, option: option as string, weight: weight as number }));
    const thresholds = [{ size: 'S', minScore: 0, maxScore: null }];
    const kitchen = {
      // etapa 6: cifrele d1-1 sunt pe versiunile de dinainte (kitchen v3, bedroom v2); pe bedroom v3
      // `systemsWardrobe` la usi glisante e respins, iar camera goala v3 deriva alte piese implicite
      roomType: 'KITCHEN', flowVersion: Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6.KITCHEN),
      answers: { layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 }, frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], openingSystemsWall: ['PUSH'], countertop: 'PAL' },
    } as unknown as ConfiguratorRoomInputDto;
    const room2 = {
      ...bedroom({ piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_INFOLIAT', systemsWardrobe: ['GLISANTE'] }),
      flowVersion: Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6.BEDROOM),
    };
    const cost = (rooms: ConfiguratorRoomInputDto[]) =>
      computeSizing(W, thresholds, { scoreEntries: service.processRooms(rooms).scoreEntries, budgetRange: 'UNDISCLOSED', includesPaidDesign: false }).creditCost;
    // costul vechi: camera bifata primea piesele implicite (ce facea deriveRoom pe raspunsuri goale)
    const oldCost = (rooms: ConfiguratorRoomInputDto[]) =>
      computeSizing(W, thresholds, {
        scoreEntries: rooms.flatMap((r) => collectScoreEntries(r.roomType, r.needsDesignHelp ? {} : (r.answers as AnswerMap), r.flowVersion)),
        budgetRange: 'UNDISCLOSED', includesPaidDesign: false,
      }).creditCost;
    const help = (r: ConfiguratorRoomInputDto) => ({ ...r, answers: {}, needsDesignHelp: true });

    it('all rooms with help: 19 -> 14 credits', () => {
      const rooms = [help(kitchen), help(room2)];
      expect([oldCost(rooms), cost(rooms)]).toEqual([19, 14]);
    });
    it('one room of two with help: 25 -> 21 credits', () => {
      const rooms = [help(kitchen), room2];
      expect([oldCost(rooms), cost(rooms)]).toEqual([25, 21]);
    });
    it('no room with help: unchanged (32 credits)', () => {
      const rooms = [kitchen, room2];
      expect([oldCost(rooms), cost(rooms)]).toEqual([32, 32]);
    });
  });

  it('passesStrictValidation: an empty room fails, without throwing', () => {
    expect(service.passesStrictValidation(bedroom())).toBe(false);
  });

  it('relaxes only the design-help room: an incomplete room without help is still rejected', () => {
    const body = errorOf(() => service.processRooms([{ ...bedroom(), needsDesignHelp: true }, bedroom()]));
    expect(body.code).toBe(ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID);
    const details = body.details as { roomIndex: number }[];
    expect(details.length).toBeGreaterThan(0);
    expect(details.every((d) => d.roomIndex === 1)).toBe(true);
  });

  it('rejects an empty room in strict mode with room/step details', () => {
    const body = errorOf(() => service.processRooms([bedroom(), bedroom()]));
    expect(body.code).toBe(ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID);
    const details = body.details as { roomIndex: number; stepId: string; messageKey: string }[];
    expect(details.length).toBeGreaterThan(0);
    expect(details[0].roomIndex).toBe(0);
    expect(typeof details[0].stepId).toBe('string');
  });
});

// d3 (etapa 5, PO d3-2): "Lungime aproximativa" doar cu "Am deja un proiect"
describe('ConfiguratorService — approxLengthM', () => {
  const kitchen = (extra: Partial<ConfiguratorRoomInputDto> = {}): ConfiguratorRoomInputDto =>
    ({ roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, answers: {}, ...extra }) as ConfiguratorRoomInputDto;
  const roomSize = (rooms: ProcessedRoom[]) =>
    rooms[0].scoreEntries.find((e) => e.category === 'ROOM_SIZE' && 'optionKey' in e) as { optionKey: string } | undefined;

  it('fara proiect propriu, campul e respins (400 VALIDATION_ERROR pe approxLengthM)', () => {
    const body = errorOf(() => service.processRooms([kitchen(), kitchen({ approxLengthM: 8 })], { ownProject: false }));
    expect(body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.details).toEqual([{ roomIndex: 1, field: 'approxLengthM', messageKey: 'validation.approxLengthWithoutOwnProject' }]);
  });

  it('cu proiect propriu, camera fara dimensiuni cu 8 m conteaza "peste 4 m" si pastreaza valoarea', () => {
    const processed = service.processRooms([kitchen({ approxLengthM: 8 })], { ownProject: true, designBrief: true });
    expect(processed.rooms[0].approxLengthM).toBe(8);
    expect(processed.rooms[0].derived.lengthM).toBe(0);
    expect(roomSize(processed.rooms)?.optionKey).toBe('OVER_4M');
  });

  it('fara camp ramane "sub 2 m", ca inainte', () => {
    const processed = service.processRooms([kitchen()], { ownProject: true, designBrief: true });
    expect(processed.rooms[0].approxLengthM).toBeNull();
    expect(roomSize(processed.rooms)?.optionKey).toBe('UNDER_2M');
  });

  // revizuire M1: dormitor doar cu cadru de pat (fara pas de dimensiuni liniar) — valoarea ramasa
  // in ciorna nu se salveaza si nu urca costul
  it('o valoare ramasa fara pas de dimensiuni liniar e ignorata (nu se salveaza, nu se plateste)', () => {
    const processed = service.processRooms(
      [{ ...bedroom({ piecesNeeded: ['BED_FRAME'] }), approxLengthM: 6 }],
      { ownProject: true, designBrief: true },
    );
    expect(processed.rooms[0].approxLengthM).toBeNull();
    expect(roomSize(processed.rooms)?.optionKey).toBe('UNDER_2M');
  });

  it('camera cu ajutor nu pastreaza lungimea aproximativa', () => {
    const processed = service.processRooms([kitchen({ needsDesignHelp: true, approxLengthM: 8 })], { ownProject: true });
    expect(processed.rooms[0].approxLengthM).toBeNull();
    expect(roomSize(processed.rooms)?.optionKey).toBe('UNDER_2M');
  });
});

// etapa 6 (DESIGN §7 "Server", pachet F): versiunile noi ale formularului (material + deschidere pe
// un ecran, "decide firma", "fara usi sau sertare") stau inregistrate langa cele vechi. Serverul
// accepta orice versiune inregistrata, deci fiecare camera se valideaza si se puncteaza pe versiunea ei.
// Versiunile sunt fixate explicit (nu CURRENT_FLOW_VERSION), ca testele sa ramana valabile dupa valul 3.
describe('ConfiguratorService — etapa 6 (versiunile noi ale formularului)', () => {
  const OLD = (rt: RoomType) => Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6[rt]);
  const NEW = (rt: RoomType) => ETAPA6_FLOW_VERSION[rt];
  const room = (roomType: RoomType, flowVersion: number, answers: Record<string, unknown>): ConfiguratorRoomInputDto =>
    ({ roomType, flowVersion, answers }) as ConfiguratorRoomInputDto;

  // ponderile reale din prisma/seed.ts (SIZING_CONFIG), citite din fisier — o singura sursa
  const SEED_SRC = readFileSync(join(__dirname, '../../../prisma/seed.ts'), 'utf8');
  const MIGRATION_SRC = readFileSync(
    join(__dirname, '../../../prisma/migrations/20261114120000_kitchen_countertop_firm_decides/migration.sql'),
    'utf8',
  );
  const SEED_WEIGHTS: SizingConfigRow[] = [
    ...SEED_SRC.matchAll(/\{\s*key:\s*'([A-Z0-9_]+)',\s*option:\s*'([A-Z0-9_]+)',\s*weight:\s*(-?\d+)\s*\}/g),
  ].map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));
  const baseScore = (rooms: ConfiguratorRoomInputDto[]) =>
    computeSizing(SEED_WEIGHTS, [{ size: 'S', minScore: 0, maxScore: null }], {
      scoreEntries: service.processRooms(rooms).scoreEntries,
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    }).baseScore;

  // aceleasi raspunsuri ca la testul costului de mai sus (bucatarie dreapta 3 m, PAL, Push)
  const KITCHEN = {
    layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 },
    frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], openingSystemsWall: ['PUSH'], countertop: 'PAL',
  };
  // dulap 2,4 m cu usi glisante; pe versiunea veche deschiderea se intreba separat
  const WARDROBE_NEW = { piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_INFOLIAT' };
  const WARDROBE_OLD = { ...WARDROBE_NEW, systemsWardrobe: ['GLISANTE'] };
  const HALL_WARDROBE = { piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2, ceilingHeight: 2.6 }, materialWardrobe: 'PAL' };
  const BENCH = { piecesNeeded: ['BENCH'], dimensions: { benchWidth: 1 }, materialBench: 'PAL' };
  const pieceRow = (extra: Record<string, unknown> = {}) => ({
    name: 'Raft baie', material: 'PAL', systems: ['MANER'], quantity: 1, description: 'Cu două uși', ...extra,
  });
  const issues = (fn: () => unknown) => (errorOf(fn).details ?? []) as { roomIndex: number; stepId: string; messageKey: string }[];

  it('fiecare tip de camera are o versiune noua inregistrata, dupa cele vechi (care raman inregistrate)', () => {
    for (const rt of Object.keys(FLOW_VERSIONS_BEFORE_ETAPA6) as RoomType[]) {
      expect(NEW(rt)).toBeGreaterThan(OLD(rt));
      for (const v of [...FLOW_VERSIONS_BEFORE_ETAPA6[rt], NEW(rt)]) expect(FLOW_REGISTRY[rt][v]).toBeDefined();
    }
  });

  it('publicare cu camere pe versiunile noi: bucatarie, dormitor, hol si "Alta piesa"', () => {
    const processed = service.processRooms([
      room('KITCHEN', NEW('KITCHEN'), KITCHEN),
      room('BEDROOM', NEW('BEDROOM'), WARDROBE_NEW),
      room('HALLWAY', NEW('HALLWAY'), { ...BENCH, systemsBench: [NO_FRONTS] }),
      room('PIECES', NEW('PIECES'), { pieces: [pieceRow()] }),
    ]);
    expect(processed.rooms.map((r) => r.flowVersion)).toEqual([NEW('KITCHEN'), NEW('BEDROOM'), NEW('HALLWAY'), NEW('PIECES')]);
  });

  it('republicare / editare pe versiunile vechi: raspunsurile raman valide si costul e acelasi (32)', () => {
    const rooms = [room('KITCHEN', OLD('KITCHEN'), KITCHEN), room('BEDROOM', OLD('BEDROOM'), WARDROBE_OLD)];
    const processed = service.processRooms(rooms);
    expect(processed.rooms.map((r) => r.flowVersion)).toEqual([OLD('KITCHEN'), OLD('BEDROOM')]);
    expect(baseScore(rooms)).toBe(32);
  });

  it('aceleasi alegeri pe versiunile noi costa la fel (32): glisantele vin din tipul usilor, fara intrebare', () => {
    expect(baseScore([room('KITCHEN', NEW('KITCHEN'), KITCHEN), room('BEDROOM', NEW('BEDROOM'), WARDROBE_NEW)])).toBe(32);
    const wardrobe = service.processRooms([room('BEDROOM', NEW('BEDROOM'), WARDROBE_NEW)]).rooms[0].derived.items[0];
    expect(wardrobe.systems).toEqual(['GLISANTE']);
  });

  it('cerere mixta (camera veche + camera adaugata la editare pe versiunea noua) e acceptata', () => {
    const processed = service.processRooms([room('KITCHEN', OLD('KITCHEN'), KITCHEN), room('BEDROOM', NEW('BEDROOM'), WARDROBE_NEW)]);
    expect(processed.rooms.map((r) => r.flowVersion)).toEqual([OLD('KITCHEN'), NEW('BEDROOM')]);
  });

  it.each<[string, RoomType, Record<string, unknown>, string]>([
    ['blatul bucatariei', 'KITCHEN', { ...KITCHEN, countertop: FIRM_DECIDES }, 'countertop'],
    ['materialul fronturilor', 'KITCHEN', { ...KITCHEN, frontMaterialBase: FIRM_DECIDES }, 'frontMaterialBase'],
    ['deschiderea corpurilor de baza', 'KITCHEN', { ...KITCHEN, openingSystemsBase: [FIRM_DECIDES] }, 'openingSystemsBase'],
    ['materialul dulapului', 'BEDROOM', { ...WARDROBE_OLD, materialWardrobe: FIRM_DECIDES }, 'materialWardrobe'],
    ['deschiderea bancutei din hol', 'HALLWAY', { ...BENCH, systemsBench: [FIRM_DECIDES] }, 'systemsBench'],
  ])('FIRM_DECIDES e respins pe versiunea veche (%s)', (_label, rt, answers, stepId) => {
    const body = errorOf(() => service.processRooms([room(rt, OLD(rt), answers)]));
    expect(body.code).toBe(ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID);
    expect(body.details).toContainEqual({ roomIndex: 0, stepId, messageKey: 'validation.optionInvalid' });
  });

  it('NO_FRONTS e respins pe versiunea veche si acceptat pe cea noua (bancuta din hol → fara sisteme)', () => {
    expect(issues(() => service.processRooms([room('HALLWAY', OLD('HALLWAY'), { ...BENCH, systemsBench: [NO_FRONTS] })])))
      .toContainEqual({ roomIndex: 0, stepId: 'systemsBench', messageKey: 'validation.optionInvalid' });
    const item = service.processRooms([room('HALLWAY', NEW('HALLWAY'), { ...BENCH, systemsBench: [NO_FRONTS] })]).rooms[0].derived.items[0];
    expect(item.systems).toEqual([]);
    expect(item.description).toContain(NO_FRONTS_NOTE);
  });

  it('o optiune exclusiva impreuna cu alta e respinsa pe versiunea noua (validation.exclusiveOption)', () => {
    expect(issues(() => service.processRooms([room('KITCHEN', NEW('KITCHEN'), { ...KITCHEN, openingSystemsBase: ['PUSH', FIRM_DECIDES] })])))
      .toContainEqual({ roomIndex: 0, stepId: 'openingSystemsBase', messageKey: 'validation.exclusiveOption' });
  });

  it.each<[RoomType, Record<string, unknown>]>([
    ['BEDROOM', WARDROBE_NEW],
    ['HALLWAY', HALL_WARDROBE],
  ])('dulap cu usi glisante (%s): un raspuns la deschiderea dulapului e respins pe versiunea noua', (rt, answers) => {
    expect(issues(() => service.processRooms([room(rt, NEW(rt), { ...answers, systemsWardrobe: ['MANER'] })])))
      .toContainEqual({ roomIndex: 0, stepId: 'systemsWardrobe', messageKey: 'validation.unknownAnswer' });
    // fara raspunsul la deschidere, aceeasi camera trece
    expect(service.processRooms([room(rt, NEW(rt), answers)]).rooms[0].derived.items[0].systems).toEqual(['GLISANTE']);
  });

  it('"Alta piesa" v2 cu dimensiuni: descrierea piesei salvate le contine; fara dimensiuni, nimic in plus', () => {
    const [withDims, without] = service.processRooms([
      room('PIECES', NEW('PIECES'), { pieces: [pieceRow({ widthCm: 120, heightCm: 80, depthCm: 40 })] }),
      room('PIECES', NEW('PIECES'), { pieces: [pieceRow()] }),
    ]).rooms.map((r) => r.derived.items[0]);
    expect(withDims.description).toContain('Cu două uși');
    expect(withDims.description).toContain('Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)');
    expect(withDims).not.toHaveProperty('widthCm');
    expect(without.description).toBe('Cu două uși');
    // pe versiunea veche randul nu cunoaste "decide firma" la material
    expect(issues(() => service.processRooms([room('PIECES', OLD('PIECES'), { pieces: [pieceRow({ material: FIRM_DECIDES })] })])))
      .toContainEqual(expect.objectContaining({ roomIndex: 0, stepId: 'pieces' }));
  });

  it('"decide firma": piesa salvata are ALTUL, fara sisteme, cu nota (si fara "Corp: PAL standard")', () => {
    const kitchen = service.processRooms([
      room('KITCHEN', NEW('KITCHEN'), { ...KITCHEN, frontMaterialBase: FIRM_DECIDES, openingSystemsBase: [FIRM_DECIDES] }),
    ]).rooms[0].derived;
    const base = kitchen.items[0];
    expect(base).toMatchObject({ name: 'Corpuri de bază', material: 'ALTUL', systems: [] });
    expect(base.description).toContain(FIRM_MATERIAL_NOTE);
    expect(base.description).toContain(FIRM_OPENING_NOTE);
    expect(base.description).not.toContain(BODY_NOTE);
    expect(kitchen.firmRecommendations).toContainEqual({ itemName: 'Corpuri de bază', material: true, opening: true });

    const wardrobe = service.processRooms([room('BEDROOM', NEW('BEDROOM'), { ...WARDROBE_NEW, materialWardrobe: FIRM_DECIDES })]).rooms[0].derived.items[0];
    expect(wardrobe).toMatchObject({ material: 'ALTUL', systems: ['GLISANTE'] });
    expect(wardrobe.description).toContain(FIRM_MATERIAL_NOTE);

    const piece = service.processRooms([
      room('PIECES', NEW('PIECES'), { pieces: [pieceRow({ material: 'ALTUL', materialChoice: FIRM_DECIDES, systems: [], openingChoice: FIRM_DECIDES })] }),
    ]).rooms[0].derived.items[0];
    expect(piece).toMatchObject({ material: 'ALTUL', systems: [] });
    expect(piece.description).toContain(FIRM_MATERIAL_NOTE);
  });

  it('randul de scor KITCHEN_COUNTERTOP:FIRM_DECIDES exista in seed si in migrare, cu aceeasi valoare (0)', () => {
    const seedRows = SEED_WEIGHTS.filter((r) => r.key === 'KITCHEN_COUNTERTOP' && r.option === FIRM_DECIDES);
    expect(seedRows).toEqual([{ key: 'KITCHEN_COUNTERTOP', option: FIRM_DECIDES, weight: 0 }]);
    const migrationRows = [...MIGRATION_SRC.matchAll(/gen_random_uuid\(\)::text,\s*'([A-Z0-9_]+)',\s*'([A-Z0-9_]+)',\s*(-?\d+)\s*\)/g)]
      .map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));
    expect(migrationRows).toEqual(seedRows);
    expect(MIGRATION_SRC).toMatch(/ON CONFLICT \("key", "option"\) DO NOTHING;/);
    // migrarea doar adauga randul (fara schimbari de schema sau de ponderi existente)
    expect(MIGRATION_SRC.replace(/^--.*$/gm, '')).not.toMatch(/\b(ALTER|UPDATE|DELETE|DROP|CREATE)\b/i);
  });

  it('blatul "decide firma" da 0 puncte: acelasi cost ca blatul PAL, cu intrarea de scor proprie', () => {
    const firm = room('KITCHEN', NEW('KITCHEN'), { ...KITCHEN, countertop: FIRM_DECIDES });
    expect(service.processRooms([firm]).scoreEntries).toContainEqual({ category: 'KITCHEN_COUNTERTOP', optionKey: FIRM_DECIDES });
    expect(baseScore([firm])).toBe(baseScore([room('KITCHEN', NEW('KITCHEN'), KITCHEN)]));
  });

  // raspunsuri generate determinist (aceeasi reteta ca firm-text.fixtures.ts din shared, care nu e
  // exportat): prima optiune vizibila, fara optiunile exclusive, dimensiuni la mijlocul intervalului
  function generatedAnswers(flow: RoomFlow): AnswerMap {
    const answerFor = (step: QuestionStep, answers: AnswerMap): AnswerMap[string] | undefined => {
      switch (step.type) {
        case 'single-choice':
          return visibleOptions(step, answers)[0]?.value;
        case 'multi-choice': {
          const plain = visibleOptions(step, answers).filter((o) => !o.exclusive);
          return plain.length > 0 ? plain.slice(0, Math.max(1, step.minSelected ?? 1)).map((o) => o.value) : undefined;
        }
        case 'boolean':
          return true;
        case 'dimension-group':
          return Object.fromEntries(step.slots(answers).map((s) => [s.id, Math.round(((s.min + s.max) / 2) * 100) / 100]));
        case 'number':
          return step.min;
        case 'text':
          return 'note client';
        case 'pieces':
          return [{ name: 'Raft perete', material: 'PAL', systems: ['MANER'], quantity: 2 }] as unknown as AnswerMap[string];
        case 'configurator-3d':
          return defaultPieceConfig(step.piece) as unknown as AnswerMap[string];
        default:
          return undefined;
      }
    };
    let answers: AnswerMap = {};
    for (const step of flow.steps) {
      if (step.hidden || (step.visibleIf && !evalCondition(step.visibleIf, answers))) continue;
      const value = answerFor(step, answers);
      if (value !== undefined) answers = { ...answers, [step.id]: value };
    }
    return pruneAnswers(flow, answers);
  }

  const rejectedRooms = (versionOf: (rt: RoomType) => number) =>
    (Object.keys(FLOW_VERSIONS_BEFORE_ETAPA6) as RoomType[]).flatMap((rt) => {
      try {
        service.processRooms([room(rt, versionOf(rt), generatedAnswers(FLOW_REGISTRY[rt][versionOf(rt)]))]);
        return [];
      } catch (err) {
        return [{ roomType: rt, version: versionOf(rt), error: err instanceof BadRequestException ? err.getResponse() : String(err) }];
      }
    });

  it('fiecare flux vechi (ultima versiune dinainte de etapa 6) trece publicarea cu raspunsuri generate', () => {
    expect(rejectedRooms(OLD)).toEqual([]);
  });

  it('fiecare flux nou (cele 28) trece publicarea cu raspunsuri generate', () => {
    expect(rejectedRooms(NEW)).toEqual([]);
  });

  // revizuire m5: testul de mai sus trece si pentru un schelet { ...vechi, version: N } — aici, pe fluxuri
  // reprezentative, un comportament pe care il are DOAR versiunea noua
  describe('versiunile noi nu sunt copii ale celor vechi', () => {
    const stepIds = (rt: RoomType, v: number) => FLOW_REGISTRY[rt][v].steps.map((s) => s.id);
    const step = (rt: RoomType, v: number, id: string) => FLOW_REGISTRY[rt][v].steps.find((s) => s.id === id);
    const optionValues = (rt: RoomType, v: number, id: string) =>
      ((step(rt, v, id) as { options?: { value: string }[] } | undefined)?.options ?? []).map((o) => o.value);

    it('dormitor: intrebarea comuna exista doar pe versiunea noua; "decide firma" acceptat la material', () => {
      expect(stepIds('BEDROOM', OLD('BEDROOM'))).not.toContain('sameFinishAll');
      expect(stepIds('BEDROOM', NEW('BEDROOM'))).toContain('sameFinishAll');
      expect(service.processRooms([room('BEDROOM', NEW('BEDROOM'), { ...WARDROBE_NEW, materialWardrobe: FIRM_DECIDES })]).rooms).toHaveLength(1);
    });

    it('hol: tipul usilor dulapului e nou; cuierul si oglinda nu mai au pas de deschidere', () => {
      expect(stepIds('HALLWAY', OLD('HALLWAY'))).toEqual(expect.arrayContaining(['systemsCoatUnit', 'systemsMirror']));
      expect(stepIds('HALLWAY', OLD('HALLWAY'))).not.toContain('wardrobeDoorType');
      expect(stepIds('HALLWAY', NEW('HALLWAY'))).toContain('wardrobeDoorType');
      expect(stepIds('HALLWAY', NEW('HALLWAY'))).not.toEqual(expect.arrayContaining(['systemsCoatUnit']));
      expect(stepIds('HALLWAY', NEW('HALLWAY'))).not.toContain('systemsMirror');
    });

    it('bucatarie: blatul "decide firma" doar pe versiunea noua (si se publica)', () => {
      expect(optionValues('KITCHEN', OLD('KITCHEN'), 'countertop')).not.toContain(FIRM_DECIDES);
      expect(optionValues('KITCHEN', NEW('KITCHEN'), 'countertop')).toContain(FIRM_DECIDES);
      expect(service.processRooms([room('KITCHEN', NEW('KITCHEN'), { ...KITCHEN, countertop: FIRM_DECIDES })]).rooms).toHaveLength(1);
    });

    it('baie: pasul de deschidere pe piesa exista doar pe versiunea noua', () => {
      expect(stepIds('BATHROOM', OLD('BATHROOM'))).not.toContain('systemsVanity');
      expect(stepIds('BATHROOM', NEW('BATHROOM'))).toEqual(expect.arrayContaining(['systemsVanity', 'sameFinishAll']));
    });

    it('"Alta piesa": randul v2 (rowVersion 2) doar pe versiunea noua', () => {
      expect((step('PIECES', OLD('PIECES'), 'pieces') as { rowVersion?: number }).rowVersion).toBeUndefined();
      expect((step('PIECES', NEW('PIECES'), 'pieces') as { rowVersion?: number }).rowVersion).toBe(2);
    });

    it('comoda TV ghidata: fara pasul openingSystems (o singura sursa, 3D), cu bifa de pistoane', () => {
      expect(stepIds('PIECE_TV_UNIT', OLD('PIECE_TV_UNIT'))).toContain('openingSystems');
      expect(stepIds('PIECE_TV_UNIT', NEW('PIECE_TV_UNIT'))).not.toContain('openingSystems');
      expect(stepIds('PIECE_TV_UNIT', NEW('PIECE_TV_UNIT'))).toContain('liftUpDoors');
      expect(optionValues('PIECE_TV_UNIT', NEW('PIECE_TV_UNIT'), 'material')).toContain(FIRM_DECIDES);
    });

    it('canapea de catalog: fara pas de material pe versiunea noua, piesa ALTUL + "Cadru: il alege firma"', () => {
      expect(stepIds('PIECE_SOFA', OLD('PIECE_SOFA'))).toContain('material');
      expect(stepIds('PIECE_SOFA', NEW('PIECE_SOFA'))).not.toContain('material');
      const flow = FLOW_REGISTRY.PIECE_SOFA[NEW('PIECE_SOFA')];
      const item = service.processRooms([room('PIECE_SOFA', NEW('PIECE_SOFA'), generatedAnswers(flow))]).rooms[0].derived.items[0];
      expect(item.material).toBe('ALTUL');
      expect(item.description).toContain(FRAME_BY_FIRM_NOTE);
    });
  });

  // revizuire m5 / DESIGN §5.11: randul "Alta piesa" v2 la publicare
  it.each<[string, Record<string, unknown>, string]>([
    ['latime 0', { widthCm: 0 }, 'validation.dimensionOutOfRange'],
    ['inaltime 601', { heightCm: 601 }, 'validation.dimensionOutOfRange'],
    ['adancime 12.5', { depthCm: 12.5 }, 'validation.dimensionOutOfRange'],
    ['cheie necunoscuta pe rand', { color: 'alb' }, 'validation.unknownAnswer'],
    ['openingChoice cu sisteme', { openingChoice: NO_FRONTS, systems: ['MANER'] }, 'validation.exclusiveOption'],
    ['materialChoice fara ALTUL', { materialChoice: FIRM_DECIDES, material: 'PAL' }, 'validation.answerInvalid'],
  ])('"Alta piesa" v2: randul cu %s e respins la publicare', (_label, extra, messageKey) => {
    expect(issues(() => service.processRooms([room('PIECES', NEW('PIECES'), { pieces: [pieceRow(extra)] })])))
      .toContainEqual({ roomIndex: 0, stepId: 'pieces', messageKey });
  });
});

// etapa 10 (DESIGN §10 "Backend", formularul v7): cele 14 versiuni noi stau inregistrate langa cele ale
// etapei 6. Versiunile sunt fixate explicit (ETAPA10 / ETAPA6, nu CURRENT_FLOW_VERSION), ca testele sa ramana
// valabile si dupa comutarea din valul 2.
describe('ConfiguratorService — etapa 10 (formularul v7)', () => {
  const E6 = (rt: RoomType) => ETAPA6_FLOW_VERSION[rt];
  const E10 = (rt: RoomType) => ETAPA10_FLOW_VERSION[rt];
  const room = (roomType: RoomType, flowVersion: number, answers: Record<string, unknown>): ConfiguratorRoomInputDto =>
    ({ roomType, flowVersion, answers }) as ConfiguratorRoomInputDto;
  const issues = (fn: () => unknown) => (errorOf(fn).details ?? []) as { roomIndex: number; stepId: string; messageKey: string }[];
  const derived = (rt: RoomType, version: number, answers: Record<string, unknown>) =>
    service.processRooms([room(rt, version, answers)]).rooms[0].derived;

  const SEED_SRC = readFileSync(join(__dirname, '../../../prisma/seed.ts'), 'utf8');
  const MIGRATION_SRC = readFileSync(
    join(__dirname, '../../../prisma/migrations/20261115100000_form_v7_scores/migration.sql'),
    'utf8',
  );
  const SEED_WEIGHTS: SizingConfigRow[] = [
    ...SEED_SRC.matchAll(/\{\s*key:\s*'([A-Z0-9_]+)',\s*option:\s*'([A-Z0-9_]+)',\s*weight:\s*(-?\d+)\s*\}/g),
  ].map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));
  const MIGRATION_ROWS = [...MIGRATION_SRC.matchAll(/gen_random_uuid\(\)::text,\s*'([A-Z0-9_]+)',\s*'([A-Z0-9_]+)',\s*(-?\d+)\s*\)/g)]
    .map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));
  const baseScore = (rooms: ConfiguratorRoomInputDto[]) =>
    computeSizing(SEED_WEIGHTS, [{ size: 'S', minScore: 0, maxScore: null }], {
      scoreEntries: service.processRooms(rooms).scoreEntries,
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    }).baseScore;

  // aceleasi raspunsuri ca la etapa 6 (bucatarie dreapta 3 m, PAL, Push; dulap 2,4 m cu usi glisante)
  const KITCHEN = {
    layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 },
    frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], openingSystemsWall: ['PUSH'], countertop: 'PAL',
  };
  const { openingSystemsWall: _wall, ...KITCHEN_NO_WALL_ANSWERS } = KITCHEN;
  const KITCHEN_NO_WALL = { ...KITCHEN_NO_WALL_ANSWERS, wallCabinets: 'NO_WALL_CABINETS' };
  // inaltimea dulapului (slot optional) lasata goala
  const WARDROBE = { piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_INFOLIAT' };
  const sofa = (extra: Record<string, unknown>): PieceConfig3d => {
    const base = defaultPieceConfig('SOFA');
    return normalizePieceConfig('SOFA', { ...base, widthM: 2.4, sofa: { ...base.sofa!, ...extra } } as PieceConfig3d);
  };

  const NEW_TYPES: RoomType[] = [
    'KITCHEN', 'DRESSING', 'LIVING', 'OFFICE', 'BEDROOM', 'BATHROOM', 'PANTRY', 'LAUNDRY', 'BALCONY', 'HALLWAY',
    'PIECE_BED', 'PIECE_TABLE', 'PIECE_BENCH', 'PIECE_SOFA',
  ];

  it('cele 14 tipuri au versiunea noua inregistrata dupa cea a etapei 6; restul raman pe versiunea etapei 6', () => {
    for (const rt of Object.keys(ETAPA10_FLOW_VERSION) as RoomType[]) {
      for (const v of [...FLOW_VERSIONS_BEFORE_ETAPA10[rt], E10(rt)]) expect(FLOW_REGISTRY[rt][v]).toBeDefined();
      if (NEW_TYPES.includes(rt)) expect(E10(rt)).toBe(E6(rt) + 1);
      else expect(E10(rt)).toBe(E6(rt));
    }
  });

  it('publicare pe versiunile noi: bucatarie, dormitor cu dulap (inaltimea goala), canapea extensibila', () => {
    const processed = service.processRooms([
      room('KITCHEN', E10('KITCHEN'), KITCHEN),
      room('BEDROOM', E10('BEDROOM'), WARDROBE),
      room('PIECE_SOFA', E10('PIECE_SOFA'), { config3d: sofa({ sleeper: true, storage: true }) }),
    ]);
    expect(processed.rooms.map((r) => r.flowVersion)).toEqual([E10('KITCHEN'), E10('BEDROOM'), E10('PIECE_SOFA')]);
  });

  it('republicarea pe versiunile etapei 6 ramane valida si costa la fel (32); aceleasi alegeri pe v7 costa tot 32', () => {
    const old = [room('KITCHEN', E6('KITCHEN'), KITCHEN), room('BEDROOM', E6('BEDROOM'), WARDROBE)];
    expect(service.processRooms(old).rooms.map((r) => r.flowVersion)).toEqual([E6('KITCHEN'), E6('BEDROOM')]);
    expect(baseScore(old)).toBe(32);
    expect(baseScore([room('KITCHEN', E10('KITCHEN'), KITCHEN), room('BEDROOM', E10('BEDROOM'), WARDROBE)])).toBe(32);
  });

  it('cerere mixta (camera pe versiunea etapei 6 + camera adaugata pe v7) e acceptata', () => {
    const processed = service.processRooms([room('KITCHEN', E6('KITCHEN'), KITCHEN), room('KITCHEN', E10('KITCHEN'), KITCHEN_NO_WALL)]);
    expect(processed.rooms.map((r) => r.flowVersion)).toEqual([E6('KITCHEN'), E10('KITCHEN')]);
  });

  it('"Fara corpuri suspendate": piesa nu se creeaza, nota pe corpurile de baza, costul scade (−5 cu Push)', () => {
    const kitchen = derived('KITCHEN', E10('KITCHEN'), KITCHEN_NO_WALL);
    expect(kitchen.items.map((i) => i.name)).toEqual(['Corpuri de bază']);
    expect(kitchen.items[0].description).toContain('Fără corpuri suspendate');
    // 8 + FROM_2_TO_4M 3 + QTY_2_3 2 + STRAIGHT 1 + (PAL 1 + PUSH 2) × 2 = 20; fara suspendate:
    // piesa dispare (−3) si cantitatea scade de la QTY_2_3 la QTY_1 (−2) → 15
    expect(baseScore([room('KITCHEN', E10('KITCHEN'), KITCHEN)])).toBe(20);
    expect(baseScore([room('KITCHEN', E10('KITCHEN'), KITCHEN_NO_WALL)])).toBe(15);
  });

  it('"Fara corpuri suspendate": un raspuns la deschiderea suspendatelor e respins (pasul nu mai e vizibil)', () => {
    expect(issues(() => service.processRooms([room('KITCHEN', E10('KITCHEN'), { ...KITCHEN, wallCabinets: 'NO_WALL_CABINETS' })])))
      .toContainEqual({ roomIndex: 0, stepId: 'openingSystemsWall', messageKey: 'validation.unknownAnswer' });
  });

  it('"Nu stiu" la corpurile suspendate pastreaza piesa (cu nota), la acelasi cost', () => {
    const answers = { ...KITCHEN, wallCabinets: FIRM_DECIDES };
    const wall = derived('KITCHEN', E10('KITCHEN'), answers).items.find((i) => i.name === 'Corpuri suspendate');
    expect(wall?.description).toContain('Corpuri suspendate: clientul vrea recomandarea firmei');
    expect(baseScore([room('KITCHEN', E10('KITCHEN'), answers)])).toBe(baseScore([room('KITCHEN', E10('KITCHEN'), KITCHEN)]));
  });

  it('chiuveta si frigiderul ajung in descrierea corpurilor de baza, in romana cu diacritice', () => {
    const base = derived('KITCHEN', E10('KITCHEN'), {
      ...KITCHEN, sinkMounting: 'UNDERMOUNT', sinkMaterial: 'COMPOSITE', appliances: ['OVEN', 'FRIDGE'], fridgeType: 'BUILT_IN',
    }).items[0];
    expect(base.name).toBe('Corpuri de bază');
    expect(base.description).toContain('Frigider: încorporabil');
    expect(base.description).toContain('Chiuvetă: compozit (granit), montată sub blat');
  });

  it.each<[string, RoomType, Record<string, unknown>, string]>([
    ['corpurile suspendate (bucatarie)', 'KITCHEN', { ...KITCHEN_NO_WALL }, 'wallCabinets'],
    ['montajul chiuvetei (bucatarie)', 'KITCHEN', { ...KITCHEN, sinkMounting: 'INSET' }, 'sinkMounting'],
    ['stofa patului (dormitor)', 'BEDROOM', { ...WARDROBE, bedFabric: 'VELVET' }, 'bedFabric'],
    ['interiorul dulapului (dormitor)', 'BEDROOM', { ...WARDROBE, wardrobeInterior: ['SHELVES'] }, 'wardrobeInterior'],
  ])('o intrebare noua e respinsa pe versiunea etapei 6 (%s)', (_label, rt, answers, stepId) => {
    expect(issues(() => service.processRooms([room(rt, E6(rt), answers)])))
      .toContainEqual({ roomIndex: 0, stepId, messageKey: 'validation.unknownAnswer' });
  });

  it('canapeaua extensibila / cu lada: respinsa pe v2, acceptata pe v3 (cu intrarile de scor d3 + c9-3)', () => {
    const config3d = sofa({ seats: 4, layout: 'CHAISE_RIGHT', sleeper: true, storage: true });
    expect(issues(() => service.processRooms([room('PIECE_SOFA', E6('PIECE_SOFA'), { config3d })])))
      .toContainEqual({ roomIndex: 0, stepId: 'config3d', messageKey: 'validation.unknownAnswer' });
    expect(service.processRooms([room('PIECE_SOFA', E10('PIECE_SOFA'), { config3d })]).scoreEntries).toEqual(expect.arrayContaining<ScoreEntry>([
      { category: 'SOFA_SEATS', optionKey: 'SEATS_4' },
      { category: 'SOFA_LAYOUT', optionKey: 'CHAISE_RIGHT' },
      { category: 'SOFA_SLEEPER', optionKey: 'YES' },
      { category: 'SOFA_STORAGE', optionKey: 'YES' },
    ]));
  });

  it('slotul optional gol e acceptat la publicare; slotul obligatoriu gol nu', () => {
    expect(service.processRooms([room('BEDROOM', E10('BEDROOM'), WARDROBE)]).rooms).toHaveLength(1);
    expect(issues(() => service.processRooms([room('BEDROOM', E10('BEDROOM'), { ...WARDROBE, dimensions: { wardrobeWidth: 2.4 } })])))
      .toContainEqual(expect.objectContaining({ roomIndex: 0, stepId: 'dimensions' }));
  });

  it('dormitor doar cu pat: fara pas de dimensiuni (fara tavan) pe v7, dar cu tavan pe versiunea etapei 6', () => {
    const bed = { piecesNeeded: ['BED_FRAME'], bedSize: 'D_120', bedStorage: 'NONE', bedUpholstered: false, materialBed: 'LEMN_MASIV' };
    const item = derived('BEDROOM', E10('BEDROOM'), bed).items[0];
    expect(item.description).toContain('saltea 120 × 200');
    expect(issues(() => service.processRooms([room('BEDROOM', E10('BEDROOM'), { ...bed, dimensions: { ceilingHeight: 2.6 } })])))
      .toContainEqual(expect.objectContaining({ roomIndex: 0, stepId: 'dimensions' }));
  });

  it('fiecare flux nou trece publicarea cu raspunsurile fixture-urilor (toate variantele)', () => {
    const rejected = allFixtureFlows({ only: 'etapa10' }).flatMap(({ roomType, version, flow }) =>
      FIXTURE_VARIANTS.flatMap((variant) => {
        try {
          service.processRooms([room(roomType, version, fixtureAnswers(flow, variant))]);
          return [];
        } catch (err) {
          return [{ roomType, version, variant, error: err instanceof BadRequestException ? err.getResponse() : String(err) }];
        }
      }),
    );
    expect(allFixtureFlows({ only: 'etapa10' })).toHaveLength(14);
    expect(rejected).toEqual([]);
  });

  describe('randurile de scor (migrarea 20261115100000 + seed.ts)', () => {
    const NEW_KEYS = [
      'KITCHEN_WALL_CABINETS', 'KITCHEN_SINK_MOUNTING', 'KITCHEN_SINK_MATERIAL', 'KITCHEN_FRIDGE', 'BED_FABRIC', 'WARDROBE_INTERIOR',
      'BATHROOM_BASIN_TYPE', 'BATHROOM_BASIN_SUPPLY', 'LAUNDRY_LOADING', 'HALLWAY_WIDTH', 'SOFA_SEATS', 'SOFA_LAYOUT', 'SOFA_SLEEPER', 'SOFA_STORAGE',
    ];
    const hasRow = (category: string, option: string) => SEED_WEIGHTS.some((r) => r.key === category && r.option === option);
    const missingRows = (entries: ScoreEntry[]) =>
      entries.flatMap((e) => ('optionKeys' in e ? e.optionKeys : [e.optionKey]).filter((o) => !hasRow(e.category, o)).map((o) => `${e.category}:${o}`));

    it('migrarea are exact cele 45 de randuri si sunt identice cu cele din seed (aceeasi ordine, aceleasi ponderi)', () => {
      expect(MIGRATION_ROWS).toHaveLength(45);
      expect(SEED_WEIGHTS.filter((r) => NEW_KEYS.includes(r.key))).toEqual(MIGRATION_ROWS);
      expect(new Set(MIGRATION_ROWS.map((r) => `${r.key}:${r.option}`)).size).toBe(45);
    });

    it('doar randuri adaugate: ON CONFLICT DO NOTHING, fara schimbari de schema sau de ponderi existente', () => {
      expect(MIGRATION_SRC).toMatch(/ON CONFLICT \("key", "option"\) DO NOTHING;/);
      expect(MIGRATION_SRC.replace(/^--.*$/gm, '')).not.toMatch(/\b(ALTER|UPDATE|DELETE|DROP|CREATE)\b/i);
    });

    it('ponderile: 0 peste tot (PO c9-3), cu exceptia canapelei (d3 + c9-3); niciuna negativa', () => {
      const nonZero = MIGRATION_ROWS.filter((r) => r.weight !== 0).map((r) => `${r.key}:${r.option}=${r.weight}`);
      expect(nonZero).toEqual(['SOFA_SEATS:SEATS_3=1', 'SOFA_SEATS:SEATS_4=2', 'SOFA_LAYOUT:CHAISE_LEFT=1', 'SOFA_LAYOUT:CHAISE_RIGHT=1', 'SOFA_SLEEPER:YES=2']);
      expect(MIGRATION_ROWS.every((r) => r.weight >= 0)).toBe(true);
    });

    it('fiecare optiune punctata din fluxurile noi are rand in seed (si deci in migrare)', () => {
      const refs: ScoreEntry[] = allFixtureFlows({ only: 'etapa10' }).flatMap(({ flow }) =>
        flow.steps.flatMap((step): ScoreEntry[] => {
          if (step.type === 'single-choice' || step.type === 'multi-choice') return step.options.flatMap((o) => (o.scoring ? [o.scoring] : []));
          if (step.type === 'boolean' && step.scoringWhenTrue) return [step.scoringWhenTrue];
          return [];
        }),
      );
      expect(missingRows(refs)).toEqual([]);
    });

    it('fiecare intrare de scor emisa pe fixture-uri (si pe canapelele d3) are rand in seed', () => {
      const entries: ScoreEntry[] = allFixtureFlows({ only: 'etapa10' }).flatMap(({ roomType, version, flow }) =>
        FIXTURE_VARIANTS.flatMap((variant) => collectScoreEntries(roomType, fixtureAnswers(flow, variant), version)),
      );
      for (const seats of [2, 3, 4]) {
        for (const layout of ['STRAIGHT', 'CHAISE_LEFT', 'CHAISE_RIGHT']) {
          entries.push(...collectScoreEntries('PIECE_SOFA', { config3d: sofa({ seats, layout, sleeper: true, storage: true }) }, E10('PIECE_SOFA')));
        }
      }
      expect(missingRows(entries)).toEqual([]);
    });
  });
});
