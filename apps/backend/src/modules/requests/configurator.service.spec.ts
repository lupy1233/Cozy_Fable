import { collectScoreEntries, CURRENT_FLOW_VERSION, ERROR_CODES, type AnswerMap } from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
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
      roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN,
      answers: { layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 }, frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], openingSystemsWall: ['PUSH'], countertop: 'PAL' },
    } as unknown as ConfiguratorRoomInputDto;
    const room2 = bedroom({ piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_INFOLIAT', systemsWardrobe: ['GLISANTE'] });
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
