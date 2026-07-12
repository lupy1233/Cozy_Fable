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
import { defaultPieceConfig } from './piece3d';
import type { AnswerMap, ScoringRef } from './types';
import { ROOM_TYPES, type RoomType } from '../enums';
import { ROOM_KIND, ROOM_ORDER, sortByRoomOrder } from '../room-meta';
import { CURRENT_FLOW_VERSION } from './flows';

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
    // raspunsuri minime pentru VERSIUNEA CURENTA a fiecarui flow.
    // Record<RoomType, ...> — exhaustiv la compilare: un RoomType nou fara
    // raspunsuri minimale aici nu compileaza.
    const minimal: Record<(typeof ROOM_TYPES)[number], AnswerMap> = {
      KITCHEN: {
        layout: 'STRAIGHT',
        hasIsland: false,
        dimensions: { runA: 3, ceilingHeight: 2.6 },
        frontMaterialBase: 'PAL',
        frontMaterialWall: 'PAL',
        openingSystemsBase: ['PUSH'],
        openingSystemsWall: ['PUSH'],
        countertop: 'PAL',
      },
      DRESSING: {
        layout: 'LINEAR',
        doorType: 'SLIDING',
        dimensions: { runA: 2.5, wardrobeHeight: 2.4 },
        interiorModules: ['HANGING_RODS'],
        material: 'PAL',
      },
      LIVING: {
        piecesNeeded: ['TV_UNIT'],
        tvStyle: 'ON_FLOOR',
        dimensions: { tvUnitWidth: 3, ceilingHeight: 2.6 },
        materialTvUnit: 'MDF_VOPSIT',
        systemsTvUnit: ['MANER'],
      },
      OFFICE: {
        piecesNeeded: ['DESK'],
        deskShape: 'STRAIGHT',
        dimensions: { deskWidthA: 1.4, ceilingHeight: 2.6 },
        materialDesk: 'PAL',
        systemsDesk: ['MANER'],
      },
      BEDROOM: {
        piecesNeeded: ['WARDROBE'],
        wardrobeDoorType: 'SLIDING',
        dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 },
        materialWardrobe: 'MDF_INFOLIAT',
        systemsWardrobe: ['GLISANTE'],
      },
      BATHROOM: {
        piecesNeeded: ['VANITY_UNIT'],
        dimensions: { vanityWidth: 0.8, ceilingHeight: 2.6 },
        ventilation: 'WINDOW',
        materialVanity: 'MDF_INFOLIAT',
      },
      PIECES: {
        pieces: [{ name: 'Dulap hol', material: 'PAL', systems: [], quantity: 1 }],
      },
      HALLWAY: {
        piecesNeeded: ['SHOE_CABINET'],
        dimensions: { shoeCabinetWidth: 1 },
        materialShoeCabinet: 'PAL',
        systemsShoeCabinet: ['MANER'],
      },
      PANTRY: {
        wallsUsed: 'ONE_WALL',
        storageStyle: 'OPEN_SHELVES',
        dimensions: { runA: 2, ceilingHeight: 2.6 },
        materialShelves: 'PAL',
      },
      LAUNDRY: {
        applianceSetup: 'WASHER_ONLY',
        piecesNeeded: ['STORAGE'],
        ventilation: 'FAN',
        dimensions: { runA: 2, ceilingHeight: 2.6 },
        materialStorage: 'MDF_INFOLIAT',
        systemsStorage: ['MANER'],
      },
      BALCONY: {
        enclosed: 'ENCLOSED',
        piecesNeeded: ['STORAGE_BENCH'],
        dimensions: { balconyLength: 2, balconyDepth: 1, ceilingHeight: 2.6 },
        materialStorageBench: 'PAL',
        systemsStorageBench: ['MANER'],
      },
      // piesele-carcasa sunt pe v3: config3d + material (+ ortogonalele cerute)
      PIECE_WARDROBE: {
        config3d: defaultPieceConfig('WARDROBE'),
        doorType: 'HINGED',
        material: 'PAL',
      },
      PIECE_TV_UNIT: {
        config3d: defaultPieceConfig('TV_UNIT'),
        tvSetup: 'UNDECIDED',
        material: 'PAL',
      },
      PIECE_BOOKCASE: {
        config3d: defaultPieceConfig('BOOKCASE'),
        material: 'PAL',
      },
      PIECE_DESK: {
        config3d: defaultPieceConfig('DESK'),
        material: 'PAL',
      },
      PIECE_BED: {
        bedSize: 'Q_160',
        storage: 'NONE',
        material: 'PAL',
      },
      PIECE_DRESSER: {
        config3d: defaultPieceConfig('DRESSER'),
        material: 'PAL',
      },
      PIECE_TABLE: {
        tableType: 'DINING',
        shape: 'RECTANGULAR',
        seats: 'SIX',
        dimensions: { length: 1.6, width: 0.9 },
        material: 'LEMN_MASIV',
      },
      PIECE_SHOE_CABINET: {
        config3d: defaultPieceConfig('SHOE_CABINET'),
        material: 'PAL',
      },
      PIECE_NIGHTSTAND: {
        config3d: defaultPieceConfig('NIGHTSTAND'),
        count: 'TWO',
        material: 'PAL',
      },
      PIECE_BENCH: {
        style: 'WITH_STORAGE',
        dimensions: { width: 1 },
        material: 'PAL',
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
      frontMaterialWall: 'MDF_VOPSIT',
      frontMaterialIsland: 'LEMN_MASIV',
      openingSystemsBase: ['PUSH'],
      openingSystemsWall: ['AVENTOS'],
      openingSystemsIsland: ['GOLA'],
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

  it('hasIsland e intrebare de sine statatoare si obligatorie (feedback PO F3)', () => {
    const flow = getFlow('KITCHEN');
    const layout = flow.steps.find((s) => s.id === 'layout');
    const island = flow.steps.find((s) => s.id === 'hasIsland');
    expect(layout?.screenGroup).toBeUndefined();
    expect(island?.screenGroup).toBeUndefined();
    expect(island?.optional).toBeUndefined();
  });

  it('sistemele per zona: jos/insula = maner/push/Gola, suspendate + Aventos', () => {
    const flow = getFlow('KITCHEN');
    const values = (id: string) => {
      const s = flow.steps.find((st) => st.id === id);
      return s?.type === 'multi-choice' ? s.options.map((o) => o.value) : [];
    };
    expect(values('openingSystemsBase')).toEqual(['MANER', 'PUSH', 'GOLA']);
    expect(values('openingSystemsWall')).toEqual(['MANER', 'PUSH', 'GOLA', 'AVENTOS']);
    expect(values('openingSystemsIsland')).toEqual(['MANER', 'PUSH', 'GOLA']);
  });

  it('material "Altul": textul liber e obligatoriu si intra in description-ul itemului', () => {
    const withOther: AnswerMap = {
      ...kitchenV2Answers(),
      frontMaterialBase: 'ALTUL',
    };
    // fara text → stepul conditional devine vizibil si obligatoriu
    const invalid = validateRoomAnswers('KITCHEN', withOther, { partial: false });
    expect(invalid.ok).toBe(false);
    withOther.frontMaterialBaseOther = 'sticla mata';
    expect(validateRoomAnswers('KITCHEN', withOther, { partial: false })).toEqual({ ok: true });
    const derived = getFlow('KITCHEN').deriveRoom(withOther);
    const base = derived.items.find((it) => it.name === 'Corpuri baza');
    expect(base?.material).toBe('ALTUL');
    expect(base?.description).toBe('Material dorit: sticla mata');
  });

  it('set complet v2 trece validarea la publish; fara insula, intrebarile de insula dispar', () => {
    expect(validateRoomAnswers('KITCHEN', kitchenV2Answers(), { partial: false })).toEqual({
      ok: true,
    });
    const noIsland: AnswerMap = {
      layout: 'STRAIGHT',
      hasIsland: false,
      dimensions: { runA: 3, ceilingHeight: 2.6 },
      frontMaterialBase: 'PAL',
      frontMaterialWall: 'PAL',
      openingSystemsBase: ['PUSH'],
      openingSystemsWall: ['PUSH'],
      countertop: 'HPL',
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
    expect(byName['Corpuri suspendate'].material).toBe('MDF_VOPSIT');
    expect(byName['Insula bucatarie'].material).toBe('LEMN_MASIV');
    expect(byName['Insula bucatarie'].systems).toEqual(['GOLA']);
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

  it('MDF infoliat are recommendedIf pe ventilation=NONE (badge, nu restrictie)', () => {
    const flow = getFlow('BATHROOM');
    const step = flow.steps.find((s) => s.id === 'materialVanity');
    if (step?.type !== 'single-choice') throw new Error('missing material step');
    const mdf = step.options.find((o) => o.value === 'MDF_INFOLIAT');
    expect(mdf?.recommendedIf).toEqual({ questionId: 'ventilation', equals: 'NONE' });
    expect(evalCondition(mdf!.recommendedIf!, { ventilation: 'NONE' })).toBe(true);
    expect(evalCondition(mdf!.recommendedIf!, { ventilation: 'WINDOW' })).toBe(false);
  });

  it('deriveRoom v2: un item per piesa cu materialul propriu', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET'],
      dimensions: { vanityWidth: 0.8, mirrorWidth: 0.6, ceilingHeight: 2.5 },
      ventilation: 'NONE',
      materialVanity: 'MDF_INFOLIAT',
      materialMirror: 'PAL',
    };
    expect(validateRoomAnswers('BATHROOM', answers, { partial: false })).toEqual({ ok: true });
    const derived = getFlow('BATHROOM').deriveRoom(answers);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Corp lavoar'].material).toBe('MDF_INFOLIAT');
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

describe('v2 pentru dressing/living/bedroom/office — versiuni si compatibilitate FROZEN', () => {
  it('versiunea curenta este 2 (aliniere item 1); hallway ramane conform la 1', () => {
    expect(CURRENT_FLOW_VERSION.DRESSING).toBe(2);
    expect(CURRENT_FLOW_VERSION.LIVING).toBe(2);
    expect(CURRENT_FLOW_VERSION.BEDROOM).toBe(2);
    expect(CURRENT_FLOW_VERSION.OFFICE).toBe(2);
    // hallway a fost scris de la inceput pe modelul per-piesa → ramane v1
    expect(CURRENT_FLOW_VERSION.HALLWAY).toBe(1);
    expect(CURRENT_FLOW_VERSION.PANTRY).toBe(2);
    expect(CURRENT_FLOW_VERSION.LAUNDRY).toBe(2);
    expect(CURRENT_FLOW_VERSION.BALCONY).toBe(2);
    // piesele-carcasa au avansat la v3 (configurator 3D, docs/10)
    expect(CURRENT_FLOW_VERSION.PIECE_WARDROBE).toBe(3);
    expect(CURRENT_FLOW_VERSION.PIECE_BENCH).toBe(2);
    // "Alta piesa" ramane pe flow-ul v1 neschimbat
    expect(CURRENT_FLOW_VERSION.PIECES).toBe(1);
  });

  it('raspunsurile v1 raman valide contra versiunii 1 (FROZEN), dar nu contra v2', () => {
    const dressingV1: AnswerMap = {
      layout: 'LINEAR',
      doorType: 'SLIDING',
      dimensions: { runA: 2.5, ceilingHeight: 2.6 },
      material: 'PAL',
    };
    expect(validateRoomAnswers('DRESSING', dressingV1, { partial: false, version: 1 })).toEqual({
      ok: true,
    });
    // v2 cere interiorModules (min 1) → acelasi set pica pe versiunea curenta
    expect(validateRoomAnswers('DRESSING', dressingV1, { partial: false }).ok).toBe(false);

    const livingV1: AnswerMap = {
      piecesNeeded: ['TV_UNIT'],
      material: 'MDF',
      dimensions: { wallWidth: 3, ceilingHeight: 2.6 },
    };
    expect(validateRoomAnswers('LIVING', livingV1, { partial: false, version: 1 })).toEqual({
      ok: true,
    });
    expect(validateRoomAnswers('LIVING', livingV1, { partial: false }).ok).toBe(false);
  });

  it('flow-ul PIECES (Alta piesa) ramane neatins: pieces + sketch', () => {
    const flow = getFlow('PIECES');
    expect(flow.version).toBe(1);
    expect(flow.steps.map((s) => s.id)).toEqual(['pieces', 'sketch']);
  });

  it('config per piesa in v2 (F4): material + sisteme, ecran propriu per piesa', () => {
    const flow = getFlow('BEDROOM');
    const answers: AnswerMap = { piecesNeeded: ['WARDROBE', 'DRESSER'] };
    const ids = visibleSteps(flow, answers).map((s) => s.id);
    expect(ids).toContain('materialWardrobe');
    expect(ids).toContain('systemsWardrobe');
    expect(ids).toContain('materialDresser');
    expect(ids).not.toContain('materialBed');
    expect(ids).not.toContain('systemsBed');
    // materialul si sistemele piesei impart acelasi ecran (screenGroup piece:X)
    const matStep = flow.steps.find((s) => s.id === 'materialWardrobe');
    const sysStep = flow.steps.find((s) => s.id === 'systemsWardrobe');
    expect(matStep?.screenGroup).toBe('piece:WARDROBE');
    expect(sysStep?.screenGroup).toBe('piece:WARDROBE');
    // "Altul" deschide textul liber pe acelasi ecran
    const withOther: AnswerMap = { piecesNeeded: ['WARDROBE'], materialWardrobe: 'ALTUL' };
    expect(visibleSteps(flow, withOther).map((s) => s.id)).toContain('materialWardrobeOther');
  });
});

describe('v2 pentru pantry/laundry/balcony + piese ghidate (item 1, aliniere bucatarie)', () => {
  it('pantry v2: material per zona, sisteme doar la dulapuri, "Altul" cu text in description', () => {
    const flow = getFlow('PANTRY');
    expect(flow.version).toBe(2);

    // rafturi deschise: fara intrebare de sisteme
    const shelvesOnly: AnswerMap = { storageStyle: 'OPEN_SHELVES' };
    const idsShelves = visibleSteps(flow, shelvesOnly).map((s) => s.id);
    expect(idsShelves).toContain('materialShelves');
    expect(idsShelves).not.toContain('materialCabinets');
    expect(idsShelves).not.toContain('systemsCabinets');

    // mixt: ambele zone, cu sisteme la dulapuri
    const mixed: AnswerMap = { storageStyle: 'MIXED' };
    const idsMixed = visibleSteps(flow, mixed).map((s) => s.id);
    expect(idsMixed).toContain('materialShelves');
    expect(idsMixed).toContain('materialCabinets');
    expect(idsMixed).toContain('systemsCabinets');

    const answers: AnswerMap = {
      wallsUsed: 'L_SHAPE',
      storageStyle: 'MIXED',
      dimensions: { runA: 2, runB: 1.5, ceilingHeight: 2.6 },
      materialShelves: 'PAL',
      materialCabinets: 'ALTUL',
      materialCabinetsOther: 'placaj mesteacan',
      systemsCabinets: ['PUSH'],
    };
    expect(validateRoomAnswers('PANTRY', answers, { partial: false })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect(derived.items.map((i) => i.name)).toEqual(['Rafturi debara', 'Dulapuri debara']);
    expect(derived.items[1].material).toBe('ALTUL');
    expect(derived.items[1].description).toContain('placaj mesteacan');
    expect(derived.items[1].systems).toEqual(['PUSH']);
    expect(derived.items[0].systems).toEqual([]);
    // ALTUL fara text pica la publish (textul liber e obligatoriu cand e vizibil)
    const { materialCabinetsOther, ...noText } = answers;
    void materialCabinetsOther;
    expect(validateRoomAnswers('PANTRY', noText, { partial: false }).ok).toBe(false);
  });

  it('laundry v2: material+sisteme per piesa, blatul fara sisteme, MDF infoliat recomandat fara ventilatie', () => {
    const flow = getFlow('LAUNDRY');
    expect(flow.version).toBe(2);

    const picked: AnswerMap = { piecesNeeded: ['APPLIANCE_HOUSING', 'COUNTERTOP'] };
    const ids = visibleSteps(flow, picked).map((s) => s.id);
    expect(ids).toContain('materialApplianceHousing');
    expect(ids).toContain('systemsApplianceHousing');
    expect(ids).toContain('materialCountertop');
    expect(ids).not.toContain('systemsCountertop');
    expect(ids).not.toContain('materialStorage');

    // badge-ul "Recomandat" pe MDF infoliat depinde de ventilatie
    const matStep = flow.steps.find((s) => s.id === 'materialApplianceHousing');
    if (matStep?.type !== 'single-choice') throw new Error('missing material step');
    const mdf = matStep.options.find((o) => o.value === 'MDF_INFOLIAT');
    expect(mdf?.recommendedIf).toEqual({ questionId: 'ventilation', equals: 'NONE' });

    const answers: AnswerMap = {
      applianceSetup: 'STACKED',
      piecesNeeded: ['APPLIANCE_HOUSING', 'COUNTERTOP'],
      ventilation: 'NONE',
      dimensions: { runA: 2.4, ceilingHeight: 2.6 },
      materialApplianceHousing: 'MDF_INFOLIAT',
      systemsApplianceHousing: ['PUSH'],
      materialCountertop: 'PAL',
    };
    expect(validateRoomAnswers('LAUNDRY', answers, { partial: false })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect(derived.items.map((i) => i.name)).toEqual([
      'Dulap incastrare electrocasnice',
      'Blat de lucru',
    ]);
    expect(derived.items[0].systems).toEqual(['PUSH']);
    expect(derived.items[1].systems).toEqual([]);
  });

  it('balcony v2: piese cu material propriu, lemn masiv recomandat pe balcon deschis', () => {
    const flow = getFlow('BALCONY');
    expect(flow.version).toBe(2);

    const picked: AnswerMap = { piecesNeeded: ['SHELVES', 'TALL_CABINET'] };
    const ids = visibleSteps(flow, picked).map((s) => s.id);
    expect(ids).toContain('materialShelves');
    expect(ids).not.toContain('systemsShelves');
    expect(ids).toContain('materialTallCabinet');
    expect(ids).toContain('systemsTallCabinet');

    const matStep = flow.steps.find((s) => s.id === 'materialTallCabinet');
    if (matStep?.type !== 'single-choice') throw new Error('missing material step');
    const wood = matStep.options.find((o) => o.value === 'LEMN_MASIV');
    expect(wood?.recommendedIf).toEqual({ questionId: 'enclosed', equals: 'OPEN' });

    const answers: AnswerMap = {
      enclosed: 'OPEN',
      piecesNeeded: ['SHELVES'],
      dimensions: { balconyLength: 2.2, balconyDepth: 1, ceilingHeight: 2.6 },
      materialShelves: 'LEMN_MASIV',
    };
    expect(validateRoomAnswers('BALCONY', answers, { partial: false })).toEqual({ ok: true });
    expect(flow.deriveRoom(answers).items[0]).toMatchObject({
      name: 'Rafturi balcon',
      material: 'LEMN_MASIV',
      systems: [],
    });
  });

  it('piesele ghidate v2: "Altul" cere text si textul ajunge in description', () => {
    const flow = getFlow('PIECE_BENCH');
    expect(flow.version).toBe(2);

    // fara ALTUL: textul liber nu e vizibil, raspunsurile v1 raman suficiente
    const plain: AnswerMap = {
      style: 'WITH_STORAGE',
      dimensions: { width: 1 },
      material: 'PAL',
    };
    expect(visibleSteps(flow, plain).map((s) => s.id)).not.toContain('materialOther');
    expect(validateRoomAnswers('PIECE_BENCH', plain, { partial: false })).toEqual({ ok: true });

    // cu ALTUL: textul devine obligatoriu si intra in description
    const withOther: AnswerMap = { ...plain, material: 'ALTUL' };
    expect(visibleSteps(flow, withOther).map((s) => s.id)).toContain('materialOther');
    expect(validateRoomAnswers('PIECE_BENCH', withOther, { partial: false }).ok).toBe(false);
    const complete: AnswerMap = { ...withOther, materialOther: 'ratan si stejar' };
    expect(validateRoomAnswers('PIECE_BENCH', complete, { partial: false })).toEqual({ ok: true });
    const derived = flow.deriveRoom(complete);
    expect(derived.items[0].description).toContain('Material dorit: ratan si stejar');
  });

  it('piesele care colectau deja "Altul" (tv-unit) propaga acum textul la derivare', () => {
    // v2 ramane FROZEN in registru (curenta e v3 — configurator 3D)
    const flow = getFlow('PIECE_TV_UNIT', 2);
    expect(flow.version).toBe(2);
    const answers: AnswerMap = {
      style: 'LOW_UNIT',
      tvSetup: 'UNDECIDED',
      dimensions: { width: 2 },
      material: 'ALTUL',
      materialOther: 'furnir nuc',
    };
    expect(validateRoomAnswers('PIECE_TV_UNIT', answers, { partial: false, version: 2 })).toEqual({
      ok: true,
    });
    expect(flow.deriveRoom(answers).items[0].description ?? '').toContain('furnir nuc');
    // v1 FROZEN: acelasi flow la versiunea 1 exista in continuare in registru
    expect(getFlow('PIECE_TV_UNIT', 1).version).toBe(1);
  });

  it('raspunsurile v1 (material comun) raman valide contra versiunii 1, dar nu contra v2', () => {
    const laundryV1: AnswerMap = {
      applianceSetup: 'WASHER_ONLY',
      piecesNeeded: ['STORAGE'],
      ventilation: 'FAN',
      dimensions: { runA: 2, ceilingHeight: 2.6 },
      material: 'MDF',
    };
    expect(validateRoomAnswers('LAUNDRY', laundryV1, { partial: false, version: 1 })).toEqual({
      ok: true,
    });
    expect(validateRoomAnswers('LAUNDRY', laundryV1, { partial: false }).ok).toBe(false);
  });
});

describe('room-meta — ordinea fixa a intrebarilor', () => {
  it('ROOM_ORDER: camerele inaintea pieselor, PIECES mereu ultima, bucataria prima', () => {
    const rooms = ROOM_TYPES.filter((rt) => ROOM_KIND[rt] === 'room');
    const pieces = ROOM_TYPES.filter((rt) => ROOM_KIND[rt] === 'piece' && rt !== 'PIECES');
    for (const room of rooms) {
      for (const piece of pieces) {
        expect(ROOM_ORDER[room]).toBeLessThan(ROOM_ORDER[piece]);
      }
    }
    for (const rt of ROOM_TYPES.filter((r) => r !== 'PIECES')) {
      expect(ROOM_ORDER[rt]).toBeLessThan(ROOM_ORDER.PIECES);
      expect(ROOM_ORDER.KITCHEN).toBeLessThanOrEqual(ROOM_ORDER[rt]);
    }
  });

  it('sortByRoomOrder e stabila: instantele de acelasi tip pastreaza ordinea intre ele', () => {
    const list: { roomType: RoomType; tag: string }[] = [
      { roomType: 'BATHROOM', tag: 'baie1' },
      { roomType: 'PIECES', tag: 'liber' },
      { roomType: 'PIECE_WARDROBE', tag: 'dulap1' },
      { roomType: 'KITCHEN', tag: 'buc1' },
      { roomType: 'PIECE_WARDROBE', tag: 'dulap2' },
      { roomType: 'BATHROOM', tag: 'baie2' },
    ];
    const sorted = sortByRoomOrder(list);
    expect(sorted.map((e) => e.tag)).toEqual([
      'buc1',
      'baie1',
      'baie2',
      'dulap1',
      'dulap2',
      'liber',
    ]);
    // nu muteaza inputul
    expect(list[0].tag).toBe('baie1');
  });
});
