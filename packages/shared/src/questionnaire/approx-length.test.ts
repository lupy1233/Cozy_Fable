import { describe, expect, it } from 'vitest';
import { configuratorRoomSchema } from '../request.schemas';
import { approxLengthApplies, collectScoreEntries, deriveRoomForFirms, getFlow } from './engine';
import { CURRENT_FLOW_VERSION } from './flows';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';
import { roomSizeLengthM } from './mapping';
import type { AnswerMap } from './types';

// d3 (etapa 5, PO d3-2): "Lungime aproximativa" cu "Am deja un proiect" — conteaza la treapta
// ROOM_SIZE doar cand lungimea derivata din dimensiuni e 0; gol = "sub 2 m", ca inainte.

const sizeOf = (entries: ReturnType<typeof collectScoreEntries>): string | undefined => {
  const entry = entries.find((e) => e.category === 'ROOM_SIZE');
  return entry && 'optionKey' in entry ? entry.optionKey : undefined;
};

// raspunsurile unei camere cu proiect propriu: pasii de dimensiuni sar (nu au raspuns)
function withoutDimensions(roomType: 'KITCHEN', version: number): AnswerMap {
  const flow = getFlow(roomType, version);
  const answers = fixtureAnswers(flow, 'first');
  const out: AnswerMap = {};
  for (const step of flow.steps) {
    if (step.type !== 'dimension-group' && answers[step.id] !== undefined) out[step.id] = answers[step.id];
  }
  return out;
}

describe('roomSizeLengthM', () => {
  it('lungimea derivata are prioritate; approx doar cand derivata e 0', () => {
    expect(roomSizeLengthM(3.2, 8)).toBe(3.2);
    expect(roomSizeLengthM(0, 8)).toBe(8);
    expect(roomSizeLengthM(0, undefined)).toBe(0);
    expect(roomSizeLengthM(0, null)).toBe(0);
    expect(roomSizeLengthM(0, Number.NaN)).toBe(0);
    expect(roomSizeLengthM(0, -2)).toBe(0);
  });
});

describe('ROOM_SIZE cu lungime aproximativa (bucatarie cu proiect propriu)', () => {
  const version = CURRENT_FLOW_VERSION.KITCHEN;
  const answers = withoutDimensions('KITCHEN', version);

  it('fara dimensiuni lungimea derivata e 0', () => {
    expect(deriveRoomForFirms('KITCHEN', answers, version).lengthM).toBe(0);
  });

  it('approxLengthM = 8 → "peste 4 m"; fara camp → "sub 2 m" (ca azi)', () => {
    expect(sizeOf(collectScoreEntries('KITCHEN', answers, version, { approxLengthM: 8 }))).toBe('OVER_4M');
    expect(sizeOf(collectScoreEntries('KITCHEN', answers, version, { approxLengthM: 3 }))).toBe('FROM_2_TO_4M');
    expect(sizeOf(collectScoreEntries('KITCHEN', answers, version))).toBe('UNDER_2M');
    expect(sizeOf(collectScoreEntries('KITCHEN', answers, version, { approxLengthM: null }))).toBe('UNDER_2M');
  });

  it('doar treapta ROOM_SIZE se schimba; restul intrarilor raman identice', () => {
    const before = collectScoreEntries('KITCHEN', answers, version);
    const after = collectScoreEntries('KITCHEN', answers, version, { approxLengthM: 8 });
    const strip = (list: typeof before) => list.filter((e) => e.category !== 'ROOM_SIZE');
    expect(strip(after)).toEqual(strip(before));
  });

  it('cu dimensiunile completate, approxLengthM nu mai conteaza', () => {
    const full = fixtureAnswers(getFlow('KITCHEN', version), 'first');
    const derived = deriveRoomForFirms('KITCHEN', full, version);
    expect(derived.lengthM).toBeGreaterThan(0);
    expect(collectScoreEntries('KITCHEN', full, version, { approxLengthM: 40 })).toEqual(
      collectScoreEntries('KITCHEN', full, version),
    );
  });

  it('camera cu ajutor ignora lungimea aproximativa', () => {
    expect(collectScoreEntries('KITCHEN', {}, version, { needsDesignHelp: true, approxLengthM: 8 })).toEqual(
      collectScoreEntries('KITCHEN', {}, version, { needsDesignHelp: true }),
    );
  });

  it('fara approxLengthM, scorul oricarui flux e identic cu cel de azi', () => {
    for (const { roomType, version: v, flow } of allFixtureFlows()) {
      for (const variant of FIXTURE_VARIANTS) {
        const a = fixtureAnswers(flow, variant);
        expect(collectScoreEntries(roomType, a, v, { approxLengthM: undefined })).toEqual(collectScoreEntries(roomType, a, v));
      }
    }
  });
});

// revizuire etapa 5 (M1, m10): campul conteaza doar cand are sens pentru raspunsurile de acum
describe('approxLengthApplies', () => {
  const bedroomV = CURRENT_FLOW_VERSION.BEDROOM;
  it('bedroom with a wardrobe (linear step, no answer) → yes; only a bed frame → no', () => {
    expect(approxLengthApplies('BEDROOM', { piecesNeeded: ['WARDROBE'] }, bedroomV)).toBe(true);
    expect(approxLengthApplies('BEDROOM', { piecesNeeded: ['BED_FRAME'] }, bedroomV)).toBe(false);
  });

  it('dimensions already giving a length (e.g. hidden by "own project") win → no', () => {
    expect(approxLengthApplies('BEDROOM', { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 1.5 } }, bedroomV)).toBe(false);
  });

  it('a left-over value never reaches the score (bed frame only)', () => {
    const answers = { piecesNeeded: ['BED_FRAME'] };
    expect(collectScoreEntries('BEDROOM', answers, bedroomV, { approxLengthM: 6 })).toEqual(
      collectScoreEntries('BEDROOM', answers, bedroomV),
    );
  });
});

describe('configuratorRoomSchema.approxLengthM', () => {
  it('at most 2 decimals, like the server ("2,345" refused)', () => {
    const room = { roomType: 'KITCHEN', flowVersion: 1, answers: {} };
    expect(configuratorRoomSchema.safeParse({ ...room, approxLengthM: 2.34 }).success).toBe(true);
    expect(configuratorRoomSchema.safeParse({ ...room, approxLengthM: 0.29 }).success).toBe(true);
    const bad = configuratorRoomSchema.safeParse({ ...room, approxLengthM: 2.345 });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('approxLengthTooManyDecimals');
  });

  const room = { roomType: 'KITCHEN', flowVersion: 1, answers: {} };
  it('accepta zecimale intre 0,1 si 50 m si lipsa campului', () => {
    expect(configuratorRoomSchema.safeParse(room).success).toBe(true);
    expect(configuratorRoomSchema.safeParse({ ...room, approxLengthM: 6.5 }).success).toBe(true);
    expect(configuratorRoomSchema.safeParse({ ...room, approxLengthM: 0.05 }).success).toBe(false);
    expect(configuratorRoomSchema.safeParse({ ...room, approxLengthM: 51 }).success).toBe(false);
  });
});
