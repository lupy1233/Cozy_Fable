import { getFlow, type AnswerMap, type DimensionGroupStep, type RoomType } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import type { RoomInstance } from '@/stores/configurator-store';
import { conditionQuestionIds, dimensionSlotStatus, screenTotalKnown } from './dimension-check';
import { roomScreens } from './room-screens';

function known(roomType: RoomType, answers: AnswerMap, ownProject = false): boolean {
  const flow = getFlow(roomType);
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
