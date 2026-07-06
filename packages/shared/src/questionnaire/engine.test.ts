import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  evalCondition,
  getFlow,
  pruneAnswers,
  stepAnswerSchema,
  summarizeAnswers,
  validateRoomAnswers,
  visibleSteps,
} from './engine';
import { roomSizeBucket } from './mapping';
import type { AnswerMap, ScoringRef } from './types';
import { ROOM_TYPES } from '../enums';

// Un set complet valid de raspunsuri pentru bucatarie L cu insula.
function kitchenLIslandAnswers(): AnswerMap {
  return {
    layout: 'L_SHAPE',
    hasIsland: true,
    dimensions: { runA: 2.4, runB: 1.8, ceilingHeight: 2.6, islandLength: 2.0, islandDepth: 0.9 },
    cabinetZones: ['BASE_UNITS', 'WALL_UNITS', 'ISLAND_UNITS'],
    frontMaterial: 'MDF',
    openingSystems: ['GLISANTE'],
    countertop: 'QUARTZ',
    appliances: ['OVEN', 'HOB'],
    extraPieces: [],
    notes: '',
  };
}

describe('evalCondition', () => {
  it('equals compara strict primitivul', () => {
    expect(evalCondition({ questionId: 'hasIsland', equals: true }, { hasIsland: true })).toBe(true);
    expect(evalCondition({ questionId: 'hasIsland', equals: true }, { hasIsland: false })).toBe(
      false,
    );
  });

  it('in verifica apartenenta pentru primitiv si intersectia pentru array', () => {
    expect(evalCondition({ questionId: 'layout', in: ['L_SHAPE', 'U_SHAPE'] }, { layout: 'L_SHAPE' })).toBe(
      true,
    );
    expect(
      evalCondition({ questionId: 'piecesNeeded', in: ['DESK'] }, { piecesNeeded: ['DESK', 'STORAGE'] }),
    ).toBe(true);
    expect(
      evalCondition({ questionId: 'piecesNeeded', in: ['DESK'] }, { piecesNeeded: ['STORAGE'] }),
    ).toBe(false);
  });

  it('all/any compun conditii', () => {
    const answers = { layout: 'L_SHAPE', hasIsland: true };
    expect(
      evalCondition(
        { all: [{ questionId: 'layout', equals: 'L_SHAPE' }, { questionId: 'hasIsland', equals: true }] },
        answers,
      ),
    ).toBe(true);
    expect(
      evalCondition(
        { any: [{ questionId: 'layout', equals: 'STRAIGHT' }, { questionId: 'hasIsland', equals: true }] },
        answers,
      ),
    ).toBe(true);
  });
});

// NOTA: testele de bucatarie de mai jos valideaza definitia FROZEN v1
// (cererile publicate pe v1 raman valide) — de aceea pin-uiesc versiunea 1.
describe('visibleSteps + sloturi dinamice', () => {
  it('bucataria L fara insula are 3 sloturi (runA, runB, ceilingHeight)', () => {
    const flow = getFlow('KITCHEN', 1);
    const answers: AnswerMap = { layout: 'L_SHAPE', hasIsland: false };
    const dimStep = flow.steps.find((s) => s.id === 'dimensions');
    if (dimStep?.type !== 'dimension-group') throw new Error('missing dim step');
    const ids = dimStep.slots(answers).map((s) => s.id);
    expect(ids).toEqual(['runA', 'runB', 'ceilingHeight']);
  });

  it('bucataria U cu insula are 6 sloturi', () => {
    const flow = getFlow('KITCHEN', 1);
    const answers: AnswerMap = { layout: 'U_SHAPE', hasIsland: true };
    const dimStep = flow.steps.find((s) => s.id === 'dimensions');
    if (dimStep?.type !== 'dimension-group') throw new Error('missing dim step');
    const ids = dimStep.slots(answers).map((s) => s.id);
    expect(ids).toEqual(['runA', 'runB', 'runC', 'ceilingHeight', 'islandLength', 'islandDepth']);
  });

  it('optiunea ISLAND_UNITS e vizibila doar cu insula', () => {
    const flow = getFlow('KITCHEN', 1);
    const step = flow.steps.find((s) => s.id === 'cabinetZones');
    if (step?.type !== 'multi-choice') throw new Error('missing');
    const island = step.options.find((o) => o.value === 'ISLAND_UNITS');
    expect(island?.visibleIf).toBeDefined();
  });

  it('deskShape la birou e vizibil doar daca DESK e selectat', () => {
    const flow = getFlow('OFFICE');
    const withDesk: AnswerMap = { piecesNeeded: ['DESK'] };
    const withoutDesk: AnswerMap = { piecesNeeded: ['STORAGE'] };
    expect(visibleSteps(flow, withDesk).some((s) => s.id === 'deskShape')).toBe(true);
    expect(visibleSteps(flow, withoutDesk).some((s) => s.id === 'deskShape')).toBe(false);
  });
});

describe('roomSizeBucket + metri liniari', () => {
  it('suma metrilor liniari L + insula = 6.2 → OVER_4M', () => {
    const derived = getFlow('KITCHEN', 1).deriveRoom(kitchenLIslandAnswers());
    expect(derived.lengthM).toBeCloseTo(6.2, 5);
    expect(roomSizeBucket(derived.lengthM)).toBe('OVER_4M');
  });

  it('bucketurile respecta pragurile', () => {
    expect(roomSizeBucket(1.5)).toBe('UNDER_2M');
    expect(roomSizeBucket(2)).toBe('FROM_2_TO_4M');
    expect(roomSizeBucket(4)).toBe('FROM_2_TO_4M');
    expect(roomSizeBucket(4.1)).toBe('OVER_4M');
  });

  it('islandDepth devine widthM, ceilingHeight devine heightM', () => {
    const derived = getFlow('KITCHEN', 1).deriveRoom(kitchenLIslandAnswers());
    expect(derived.widthM).toBe(0.9);
    expect(derived.heightM).toBe(2.6);
  });
});

describe('validateRoomAnswers', () => {
  it('accepta un set complet valid la publish', () => {
    expect(
      validateRoomAnswers('KITCHEN', kitchenLIslandAnswers(), { partial: false, version: 1 }),
    ).toEqual({
      ok: true,
    });
  });

  it('respinge un step obligatoriu lipsa la publish, dar il accepta la draft', () => {
    const answers = kitchenLIslandAnswers();
    delete answers.layout;
    // fara layout, sloturile dimensiunilor pica pe default STRAIGHT (runA) → dimensions devine
    // invalid (chei necunoscute runB/island*). Verificam ca publish esueaza si contine layout.
    const publish = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(publish.ok).toBe(false);
    if (!publish.ok) {
      expect(publish.errors.some((e) => e.stepId === 'layout')).toBe(true);
    }

    // La draft, doar layout lipsa (fara alte raspunsuri) e permis
    const draftAnswers: AnswerMap = { hasIsland: false };
    expect(validateRoomAnswers('KITCHEN', draftAnswers, { partial: true, version: 1 })).toEqual({
      ok: true,
    });
  });

  it('respinge chei necunoscute', () => {
    const answers = { ...kitchenLIslandAnswers(), fabricated: 'HACK' };
    const res = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.stepId === 'fabricated')).toBe(true);
  });

  it('respinge raspuns pentru un step invizibil', () => {
    const answers = kitchenLIslandAnswers();
    answers.hasIsland = false;
    // cu insula off, ISLAND_UNITS din cabinetZones e invizibil → invalid
    answers.cabinetZones = ['BASE_UNITS'];
    // dar pastram sloturile de insula in dimensions → chei necunoscute in dimension-group
    const res = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(res.ok).toBe(false);
  });

  it('respinge o dimensiune in afara intervalului', () => {
    const answers = kitchenLIslandAnswers();
    (answers.dimensions as Record<string, number>).runA = 999;
    const res = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.stepId === 'dimensions')).toBe(true);
  });

  it('respinge multi-choice sub minim', () => {
    const answers = kitchenLIslandAnswers();
    answers.cabinetZones = [];
    const res = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(res.ok).toBe(false);
  });
});

describe('pruneAnswers', () => {
  it('elimina raspunsurile devenite invizibile si sloturile disparute', () => {
    const flow = getFlow('KITCHEN', 1);
    const answers = kitchenLIslandAnswers();
    // schimba pe STRAIGHT fara insula: runB, islandLength, islandDepth trebuie sa dispara,
    // ISLAND_UNITS din cabinetZones trebuie eliminat
    answers.layout = 'STRAIGHT';
    answers.hasIsland = false;
    const pruned = pruneAnswers(flow, answers);
    const dims = pruned.dimensions as Record<string, number>;
    expect(Object.keys(dims).sort()).toEqual(['ceilingHeight', 'runA']);
    expect(pruned.cabinetZones).not.toContain('ISLAND_UNITS');
  });
});

describe('summarizeAnswers', () => {
  it('produce intrari Q→A pentru raspunsurile completate', () => {
    const summary = summarizeAnswers('KITCHEN', kitchenLIslandAnswers(), 1);
    const layout = summary.find((e) => e.stepId === 'layout');
    expect(layout?.kind).toBe('choice');
    const dims = summary.find((e) => e.stepId === 'dimensions');
    expect(dims?.kind).toBe('dimensions');
    // notes '' si extraPieces [] sunt sarite
    expect(summary.find((e) => e.stepId === 'notes')).toBeUndefined();
    expect(summary.find((e) => e.stepId === 'extraPieces')).toBeUndefined();
  });
});

describe('deriveRoom pentru toate flow-urile → forma valida', () => {
  it('fiecare flow deriva o camera cu minim un item si dimensiuni pozitive', () => {
    // raspunsuri minime pentru VERSIUNEA CURENTA a fiecarui flow
    const minimal: Record<string, AnswerMap> = {
      KITCHEN: {
        layout: 'STRAIGHT',
        dimensions: { runA: 3, ceilingHeight: 2.6 },
        frontMaterialBase: 'PAL',
        frontMaterialWall: 'PAL',
        openingSystemsBase: ['PUSH'],
        openingSystemsWall: ['PUSH'],
        countertop: 'LAMINATE',
      },
      DRESSING: {
        layout: 'LINEAR',
        doorType: 'SLIDING',
        dimensions: { runA: 2.5, ceilingHeight: 2.6 },
        material: 'PAL',
      },
      LIVING: {
        piecesNeeded: ['TV_UNIT'],
        material: 'MDF',
        dimensions: { wallWidth: 3, ceilingHeight: 2.6 },
      },
      OFFICE: {
        piecesNeeded: ['DESK'],
        deskShape: 'STRAIGHT',
        material: 'PAL',
        dimensions: { spaceWidth: 2.5, ceilingHeight: 2.6, deskWidth: 1.4 },
      },
      BEDROOM: {
        piecesNeeded: ['WARDROBE'],
        material: 'MDF',
        dimensions: { spaceWidth: 3.5, ceilingHeight: 2.6, wardrobeWidth: 2.4 },
      },
      BATHROOM: {
        piecesNeeded: ['VANITY_UNIT'],
        dimensions: { vanityWidth: 0.8, ceilingHeight: 2.6 },
        ventilation: 'WINDOW',
        materialVanity: 'MDF',
      },
      PIECES: {
        pieces: [{ name: 'Dulap hol', material: 'PAL', systems: [], quantity: 1 }],
      },
    };

    for (const roomType of ROOM_TYPES) {
      const flow = getFlow(roomType);
      const answers = minimal[roomType];
      // sanity: raspunsurile minime trec validarea la publish
      const valid = validateRoomAnswers(roomType, answers, { partial: false });
      expect(valid, `${roomType} answers valide`).toEqual({ ok: true });

      const derived = flow.deriveRoom(answers);
      expect(derived.items.length, `${roomType} minim un item`).toBeGreaterThanOrEqual(1);
      expect(derived.lengthM).toBeGreaterThan(0);
      expect(derived.widthM).toBeGreaterThan(0);
      expect(derived.heightM).toBeGreaterThan(0);
      for (const item of derived.items) {
        expect(item.name.length).toBeGreaterThanOrEqual(2);
        expect(item.quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('kitchen v2 — insula ca add-on, intrebari per zona', () => {
  function kitchenV2Answers(): AnswerMap {
    return {
      layout: 'L_SHAPE',
      hasIsland: true,
      dimensions: { runA: 2.4, runB: 1.8, ceilingHeight: 2.6, islandLength: 2.0, islandDepth: 0.9 },
      frontMaterialBase: 'PAL',
      frontMaterialWall: 'MDF',
      frontMaterialIsland: 'LEMN_MASIV',
      openingSystemsBase: ['PUSH'],
      openingSystemsWall: ['GLISANTE'],
      openingSystemsIsland: ['BUTON_PRESIUNE'],
      countertop: 'QUARTZ',
    };
  }

  it('versiunea curenta pentru bucatarie este 2 (PARALLEL eliminat)', () => {
    const flow = getFlow('KITCHEN');
    expect(flow.version).toBe(2);
    const layout = flow.steps.find((s) => s.id === 'layout');
    if (layout?.type !== 'single-choice') throw new Error('missing layout');
    expect(layout.options.map((o) => o.value)).toEqual(['STRAIGHT', 'L_SHAPE', 'U_SHAPE']);
    // layout-ul nu afiseaza pret mediu in v2
    expect(layout.options.every((o) => o.info?.priceHintKey === undefined)).toBe(true);
  });

  it('layout + hasIsland impart acelasi ecran (screenGroup), hasIsland e optional', () => {
    const flow = getFlow('KITCHEN');
    const layout = flow.steps.find((s) => s.id === 'layout');
    const island = flow.steps.find((s) => s.id === 'hasIsland');
    expect(layout?.screenGroup).toBe('layoutScreen');
    expect(island?.screenGroup).toBe('layoutScreen');
    expect(island?.optional).toBe(true);
  });

  it('set complet v2 trece validarea la publish; fara insula, intrebarile de insula dispar', () => {
    expect(validateRoomAnswers('KITCHEN', kitchenV2Answers(), { partial: false })).toEqual({
      ok: true,
    });
    const noIsland: AnswerMap = {
      layout: 'STRAIGHT',
      dimensions: { runA: 3, ceilingHeight: 2.6 },
      frontMaterialBase: 'PAL',
      frontMaterialWall: 'PAL',
      openingSystemsBase: ['PUSH'],
      openingSystemsWall: ['PUSH'],
      countertop: 'LAMINATE',
    };
    expect(validateRoomAnswers('KITCHEN', noIsland, { partial: false })).toEqual({ ok: true });
    const flow = getFlow('KITCHEN');
    const ids = visibleSteps(flow, noIsland).map((s) => s.id);
    expect(ids).not.toContain('frontMaterialIsland');
    expect(ids).not.toContain('openingSystemsIsland');
  });

  it('deriveRoom v2 produce un item per zona cu materialul si sistemele proprii', () => {
    const derived = getFlow('KITCHEN').deriveRoom(kitchenV2Answers());
    expect(derived.items).toHaveLength(3);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Corpuri baza'].material).toBe('PAL');
    expect(byName['Corpuri suspendate'].material).toBe('MDF');
    expect(byName['Insula bucatarie'].material).toBe('LEMN_MASIV');
    expect(byName['Insula bucatarie'].systems).toEqual(['BUTON_PRESIUNE']);
    // metri liniari: runA + runB + islandLength = 6.2
    expect(derived.lengthM).toBeCloseTo(6.2, 5);
  });

  it('raspunsurile v1 raman valide contra versiunii 1 (regresie compatibilitate)', () => {
    expect(
      validateRoomAnswers('KITCHEN', kitchenLIslandAnswers(), { partial: false, version: 1 }),
    ).toEqual({ ok: true });
    // dar NU trec pe v2 (cabinetZones/frontMaterial nu mai exista)
    const onV2 = validateRoomAnswers('KITCHEN', kitchenLIslandAnswers(), { partial: false });
    expect(onV2.ok).toBe(false);
  });
});

describe('bathroom v2 — ventilatie + dimensiuni/material per piesa', () => {
  it('sloturile de dimensiuni urmeaza piesele selectate', () => {
    const flow = getFlow('BATHROOM');
    expect(flow.version).toBe(2);
    const dimStep = flow.steps.find((s) => s.id === 'dimensions');
    if (dimStep?.type !== 'dimension-group') throw new Error('missing dim step');
    const ids = dimStep
      .slots({ piecesNeeded: ['VANITY_UNIT', 'TALL_STORAGE'] })
      .map((s) => s.id);
    expect(ids).toEqual(['vanityWidth', 'tallStorageWidth', 'ceilingHeight']);
  });

  it('intrebarea de material apare doar pentru piesele selectate', () => {
    const flow = getFlow('BATHROOM');
    const answers: AnswerMap = { piecesNeeded: ['MIRROR_CABINET'] };
    const ids = visibleSteps(flow, answers).map((s) => s.id);
    expect(ids).toContain('materialMirror');
    expect(ids).not.toContain('materialVanity');
    expect(ids).not.toContain('materialTall');
  });

  it('MDF are recommendedIf pe ventilation=NONE (badge, nu restrictie)', () => {
    const flow = getFlow('BATHROOM');
    const step = flow.steps.find((s) => s.id === 'materialVanity');
    if (step?.type !== 'single-choice') throw new Error('missing material step');
    const mdf = step.options.find((o) => o.value === 'MDF');
    expect(mdf?.recommendedIf).toEqual({ questionId: 'ventilation', equals: 'NONE' });
    expect(evalCondition(mdf!.recommendedIf!, { ventilation: 'NONE' })).toBe(true);
    expect(evalCondition(mdf!.recommendedIf!, { ventilation: 'WINDOW' })).toBe(false);
  });

  it('deriveRoom v2: un item per piesa cu materialul propriu', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET'],
      dimensions: { vanityWidth: 0.8, mirrorWidth: 0.6, ceilingHeight: 2.5 },
      ventilation: 'NONE',
      materialVanity: 'MDF',
      materialMirror: 'PAL',
    };
    expect(validateRoomAnswers('BATHROOM', answers, { partial: false })).toEqual({ ok: true });
    const derived = getFlow('BATHROOM').deriveRoom(answers);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Corp lavoar'].material).toBe('MDF');
    expect(byName['Dulap oglinda'].material).toBe('PAL');
    expect(derived.lengthM).toBeCloseTo(1.4, 5);
    expect(derived.heightM).toBe(2.5);
  });

  it('raspunsurile v1 raman valide contra versiunii 1', () => {
    const v1: AnswerMap = {
      piecesNeeded: ['VANITY_UNIT'],
      dimensions: { vanityWidth: 0.8, ceilingHeight: 2.6 },
      material: 'MDF',
    };
    expect(validateRoomAnswers('BATHROOM', v1, { partial: false, version: 1 })).toEqual({
      ok: true,
    });
    expect(validateRoomAnswers('BATHROOM', v1, { partial: false }).ok).toBe(false);
  });
});

describe('collectScoreEntries — regresie fata de semantica SizingService', () => {
  // Reproducem exemplul documentat (docs/sprint-0 §7):
  // bucatarie 3.5ml, 2 corpuri MDF cu glisante, buget 12k → 8+3+(2+3+2)+3 = 21 → MEDIUM.
  // Simulam un rezolvator de greutati identic cu seed-ul.
  const WEIGHTS: Record<string, number> = {
    'ROOM_TYPE:KITCHEN': 8,
    'ROOM_SIZE:UNDER_2M': 1,
    'ROOM_SIZE:FROM_2_TO_4M': 3,
    'ROOM_SIZE:OVER_4M': 5,
    'MATERIAL:PAL': 1,
    'MATERIAL:MDF': 2,
    'MATERIAL:LEMN_MASIV': 4,
    'SYSTEM:BUTON_PRESIUNE': 1,
    'SYSTEM:PUSH': 2,
    'SYSTEM:GLISANTE': 3,
    'ITEM_QUANTITY:QTY_1': 0,
    'ITEM_QUANTITY:QTY_2_3': 2,
    'ITEM_QUANTITY:QTY_4_PLUS': 4,
    'KITCHEN_LAYOUT:STRAIGHT': 1,
    'KITCHEN_ISLAND:YES': 2,
  };

  function scoreOf(entries: (ScoringRef | { category: string; optionKeys: string[]; pick: 'max' })[]): number {
    let total = 0;
    for (const e of entries) {
      if ('optionKeys' in e) {
        total += Math.max(0, ...e.optionKeys.map((k) => WEIGHTS[`${e.category}:${k}`] ?? 0));
      } else {
        total += WEIGHTS[`${e.category}:${e.optionKey}`] ?? 0;
      }
    }
    return total;
  }

  it('bucatarie STRAIGHT 3.5ml, 2 corpuri MDF glisante → 8+3+2(qty)+ (2+3)*... layout 1 = componente asteptate', () => {
    // Construim answers care deriva exact 2 corpuri MDF cu glisante si 3.5ml liniari.
    const answers: AnswerMap = {
      layout: 'STRAIGHT',
      hasIsland: false,
      dimensions: { runA: 3.5, ceilingHeight: 2.6 },
      cabinetZones: ['BASE_UNITS', 'WALL_UNITS'],
      frontMaterial: 'MDF',
      openingSystems: ['GLISANTE'],
      countertop: 'LAMINATE',
    };
    const entries = collectScoreEntries('KITCHEN', answers, 1);
    // ROOM_TYPE(8) + ROOM_SIZE FROM_2_TO_4M(3) + ITEM_QUANTITY QTY_2_3(2)
    // + 2 items MDF(2 each=4) + 2 items SYSTEM max glisante(3 each=6) + KITCHEN_LAYOUT STRAIGHT(1)
    // = 8+3+2+4+6+1 = 24
    expect(scoreOf(entries)).toBe(24);
  });

  it('U_SHAPE cu insula puncteaza strict mai mult decat STRAIGHT fara insula', () => {
    const straight: AnswerMap = {
      layout: 'STRAIGHT',
      hasIsland: false,
      dimensions: { runA: 3, ceilingHeight: 2.6 },
      cabinetZones: ['BASE_UNITS'],
      frontMaterial: 'PAL',
      openingSystems: ['PUSH'],
      countertop: 'LAMINATE',
    };
    const uIsland: AnswerMap = {
      layout: 'U_SHAPE',
      hasIsland: true,
      dimensions: { runA: 3, runB: 2, runC: 2, ceilingHeight: 2.6, islandLength: 2, islandDepth: 0.9 },
      cabinetZones: ['BASE_UNITS', 'ISLAND_UNITS'],
      frontMaterial: 'PAL',
      openingSystems: ['PUSH'],
      countertop: 'LAMINATE',
    };
    const wU: Record<string, number> = { ...WEIGHTS, 'KITCHEN_LAYOUT:U_SHAPE': 3 };
    const scoreWith = (entries: ReturnType<typeof collectScoreEntries>, w: Record<string, number>) => {
      let total = 0;
      for (const e of entries) {
        if ('optionKeys' in e) total += Math.max(0, ...e.optionKeys.map((k) => w[`${e.category}:${k}`] ?? 0));
        else total += w[`${e.category}:${e.optionKey}`] ?? 0;
      }
      return total;
    };
    expect(scoreWith(collectScoreEntries('KITCHEN', uIsland, 1), wU)).toBeGreaterThan(
      scoreWith(collectScoreEntries('KITCHEN', straight, 1), wU),
    );
  });
});
