import { getFlow, type AnswerMap, type AnswerValue, type QuestionStep } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import type { RoomInstance } from '@/stores/configurator-store';
import { screenTotalKnown } from './dimension-check';
import { roomIssue, roomScreens, validateStepIssue } from './room-screens';

// Etapa 10 (revizuire): parcurgerea dormitorului v4 ecran cu ecran, ca in room-flow-runner —
// fara ecran gol, fara salt inapoi / peste un ecran, iar totalul din "Ecranul X din N",
// odata cunoscut, nu se mai schimba.

const FLOW = getFlow('BEDROOM', 4);
const room = (answers: AnswerMap): RoomInstance => ({ localId: 'r1', roomType: 'BEDROOM', flowVersion: 4, answers, completed: false });

interface Walk {
  ids: string[][];
  // totalul afisat la fiecare ecran (null = "Ecranul X", fara total)
  totals: (number | null)[];
  answers: AnswerMap;
}

function walk(pick: Record<string, AnswerValue>): Walk {
  let answers: AnswerMap = {};
  const ids: string[][] = [];
  const totals: (number | null)[] = [];
  for (let i = 0; i < 30; i++) {
    const screens = roomScreens(room(answers), false);
    // fara ecran gol
    expect(screens.every((s) => s.length > 0)).toBe(true);
    // ecranele deja trecute nu se schimba (fara salt)
    ids.forEach((done, j) => expect(screens[j]!.map((s) => s.id), `ecranul ${j + 1}`).toEqual(done));
    if (i >= screens.length) break;
    totals.push(screenTotalKnown(screens, FLOW.steps, answers) ? screens.length : null);
    const screen = screens[i]!;
    for (const step of screen) {
      if (step.id in pick) answers = { ...answers, [step.id]: pick[step.id]! };
    }
    // "Continua" trece pe fiecare ecran
    for (const step of roomScreens(room(answers), false)[i]!) {
      expect(validateStepIssue(step, answers), `${step.id}`).toBeUndefined();
    }
    ids.push(roomScreens(room(answers), false)[i]!.map((s: QuestionStep) => s.id));
  }
  return { ids, totals, answers };
}

// odata cunoscut, totalul ramane acelasi pana la capat
function expectStableTotal(totals: (number | null)[], expected: number) {
  const first = totals.findIndex((t) => t !== null);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(totals.slice(first)).toEqual(totals.slice(first).map(() => expected));
}

describe('dormitor v4 — parcurgere ecran cu ecran', () => {
  const bed = { bedSize: 'Q_160', bedStorage: 'NONE', materialBed: 'PAL' };

  it('doar pat netapitat: fara ecran de dimensiuni, fara ecranul stofei; 4 ecrane', () => {
    const w = walk({ piecesNeeded: ['BED_FRAME'], ...bed, bedUpholstered: false });
    expect(w.ids.map((s) => s[0])).toEqual(['piecesNeeded', 'bedSize', 'bedStorage', 'sketch']);
    expect(w.ids.flat()).not.toContain('dimensions');
    expect(w.ids.flat()).not.toContain('bedFabric');
    // pe ecranul pieselor totalul nu e sigur; dupa raspunsul "tapitat?" (ecranul 2) devine 4
    expect(w.totals[0]).toBeNull();
    expectStableTotal(w.totals, 4);
    expect(roomIssue(room(w.answers), { ownProject: false })).toBeNull();
  });

  it('pat tapitat: ecranul stofei apare imediat dupa ecranul saltelei; 5 ecrane', () => {
    const w = walk({ piecesNeeded: ['BED_FRAME'], ...bed, bedUpholstered: true, bedFabric: 'VELVET' });
    expect(w.ids.map((s) => s[0])).toEqual(['piecesNeeded', 'bedSize', 'bedFabric', 'bedStorage', 'sketch']);
    expectStableTotal(w.totals, 5);
    expect(roomIssue(room(w.answers), { ownProject: false })).toBeNull();
  });

  it('pat + dulap: dimensiuni (inaltimea dulapului lasata goala), dulap, interior dulap, pat; 7 ecrane', () => {
    const w = walk({
      piecesNeeded: ['WARDROBE', 'BED_FRAME'], ...bed, bedUpholstered: false,
      dimensions: { wardrobeWidth: 2, ceilingHeight: 2.6 },
      wardrobeDoorType: 'SLIDING', materialWardrobe: 'PAL',
    });
    expect(w.ids.map((s) => s[0])).toEqual(['piecesNeeded', 'bedSize', 'dimensions', 'wardrobeDoorType', 'wardrobeInterior', 'bedStorage', 'sketch']);
    expect(w.ids[4]).toEqual(['wardrobeInterior']);
    expectStableTotal(w.totals, 7);
    expect(roomIssue(room(w.answers), { ownProject: false })).toBeNull();
  });
});
