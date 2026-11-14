import { ETAPA6_FLOW_VERSION, getFlow, type AnswerMap, type DimensionGroupStep, type RoomType } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import type { RoomInstance } from '@/stores/configurator-store';
import { conditionQuestionIds, dimensionSlotStatus, screenTotalKnown } from './dimension-check';
import { roomScreens } from './room-screens';
import { toyDimensions } from '@/test/flows-v7';

// etapa 10 (valul 2): fixat pe versiunile etapei 6 (testele etapei 8 nu urmeaza comutarea)
function known(roomType: RoomType, answers: AnswerMap, ownProject = false): boolean {
  const flow = getFlow(roomType, ETAPA6_FLOW_VERSION[roomType]);
  const room: RoomInstance = { localId: 'r1', roomType, flowVersion: flow.version, answers, completed: false };
  return screenTotalKnown(roomScreens(room, ownProject), flow.steps, answers);
}

describe('conditionQuestionIds', () => {
  it('citeste all / any / not recursiv, fara dubluri', () => {
    expect(
      conditionQuestionIds({
        all: [
          { questionId: 'a', equals: true },
          { any: [{ questionId: 'b', in: ['X'] }, { not: { questionId: 'a', equals: 'Y' } }] },
          { not: { questionId: 'c', in: ['Z'], atLeast: 2 } },
        ],
      }).sort(),
    ).toEqual(['a', 'b', 'c']);
    expect(conditionQuestionIds({ questionId: 'solo', equals: 1 })).toEqual(['solo']);
  });
});

describe('screenTotalKnown', () => {
  it('bucataria (fara alegere de piese): total cunoscut de la inceput', () => {
    expect(known('KITCHEN', {})).toBe(true);
    expect(known('KITCHEN', { layout: 'L_SHAPE' })).toBe(true);
  });

  it('piesa ghidata (dulap): "Altul" sta pe ecranul materialului → cunoscut de la inceput', () => {
    expect(known('PIECE_WARDROBE', {})).toBe(true);
  });

  it('dormitor: necunoscut inainte de piese, cunoscut dupa ecranul pieselor', () => {
    expect(known('BEDROOM', {})).toBe(false);
    expect(known('BEDROOM', { piecesNeeded: [] })).toBe(false);
    expect(known('BEDROOM', { piecesNeeded: ['WARDROBE'] })).toBe(true);
    expect(known('BEDROOM', { piecesNeeded: ['BED_FRAME'] })).toBe(true);
    // doua piese cu finisaj: "acelasi finisaj?" (pe ecranul pieselor) schimba ecranele
    expect(known('BEDROOM', { piecesNeeded: ['WARDROBE', 'NIGHTSTANDS'] })).toBe(false);
    expect(known('BEDROOM', { piecesNeeded: ['WARDROBE', 'NIGHTSTANDS'], sameFinishAll: false })).toBe(true);
    expect(known('BEDROOM', { piecesNeeded: ['WARDROBE', 'NIGHTSTANDS'], sameFinishAll: true })).toBe(true);
  });
});

describe('dimensionSlotStatus', () => {
  const kitchen = getFlow('KITCHEN').steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
  const bedroom = getFlow('BEDROOM').steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;

  const cases: [string, DimensionGroupStep, AnswerMap][] = [
    ['KITCHEN', kitchen, { layout: 'L_SHAPE' }],
    ['BEDROOM', bedroom, { piecesNeeded: ['WARDROBE'] }],
  ];
  it.each(cases)('%s: gol → missing, peste interval → outOfRange, in interval → ok', (_rt, step, base) => {
    const answers: AnswerMap = { ...base };
    const slots = step.slots(answers);
    expect(slots.length).toBeGreaterThanOrEqual(2);
    const [first, second, ...rest] = slots;
    const values: Record<string, number> = { [second!.id]: second!.max + 0.01 };
    for (const s of rest) values[s.id] = s.min;
    answers.dimensions = values;

    const status = dimensionSlotStatus(step, answers);
    expect(status.map((s) => s.id)).toEqual(slots.map((s) => s.id));
    expect(status[0]).toEqual({ id: first!.id, labelKey: first!.labelKey, min: first!.min, max: first!.max, state: 'missing' });
    expect(status[1]).toMatchObject({ id: second!.id, state: 'outOfRange', value: second!.max + 0.01 });
    for (const s of status.slice(2)) expect(s.state).toBe('ok');
  });

  it('sub minim → outOfRange; limitele exacte → ok; fara raspuns → toate missing', () => {
    const answers: AnswerMap = { layout: 'L_SHAPE' };
    const [a, b] = kitchen.slots(answers);
    expect(dimensionSlotStatus(kitchen, answers).every((s) => s.state === 'missing')).toBe(true);
    answers.dimensions = { [a!.id]: a!.min - 0.01, [b!.id]: b!.max };
    const st = dimensionSlotStatus(kitchen, answers);
    expect(st[0]!.state).toBe('outOfRange');
    expect(st[1]!.state).toBe('ok');
  });
});

describe('etapa 10 — slot optional (skipped)', () => {
  it('optional gol → skipped (nu missing); obligatoriu gol → missing; optional cu valoare → verificat la fel', () => {
    const empty = dimensionSlotStatus(toyDimensions, {});
    expect(empty.map((s) => [s.id, s.state])).toEqual([
      ['wardrobeWidth', 'missing'],
      ['wardrobeHeight', 'skipped'],
    ]);
    // valoarea tipica si "optional" vin din slot; slotul obligatoriu ramane cu forma etapei 8
    expect(empty[1]).toMatchObject({ optional: true, typicalM: 2.4 });
    expect(empty[0]).not.toHaveProperty('optional');
    expect(empty[0]).not.toHaveProperty('typicalM');

    const out = dimensionSlotStatus(toyDimensions, { dimensions: { wardrobeWidth: 2, wardrobeHeight: 3.5 } });
    expect(out[1]).toMatchObject({ state: 'outOfRange', value: 3.5 });
    const ok = dimensionSlotStatus(toyDimensions, { dimensions: { wardrobeWidth: 2, wardrobeHeight: 2.4 } });
    expect(ok.every((s) => s.state === 'ok')).toBe(true);
  });

  it('null / text intr-un slot optional nu e "gol" (ca motorul: dimensionOutOfRange)', () => {
    const st = dimensionSlotStatus(toyDimensions, { dimensions: { wardrobeWidth: 2, wardrobeHeight: null } as never });
    expect(st[1]!.state).toBe('missing');
  });

  it('fluxurile de azi nu au niciodata skipped', () => {
    for (const rt of ['KITCHEN', 'BEDROOM', 'LIVING', 'HALLWAY'] as RoomType[]) {
      const step = getFlow(rt, ETAPA6_FLOW_VERSION[rt]).steps.find((s) => s.type === 'dimension-group') as DimensionGroupStep | undefined;
      if (!step) continue;
      const answers: AnswerMap = { piecesNeeded: ['WARDROBE', 'BOOKSHELF', 'TV_UNIT', 'SHOE_CABINET'] };
      expect(dimensionSlotStatus(step, answers).some((s) => s.state === 'skipped'), rt).toBe(false);
    }
  });
});
