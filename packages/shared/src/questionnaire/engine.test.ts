import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  evalCondition,
  firmRecommendations,
  getFlow,
  isFlowVersionRegistered,
  pruneAnswers,
  stepAnswerSchema,
  summarizeAnswers,
  validateRoomAnswers,
  visibleOptions,
  visibleSteps,
} from './engine';
import { roomSizeBucket } from './mapping';
import { defaultPieceConfig } from './piece3d';
import type { AnswerMap, ScoringRef } from './types';
import { ROOM_TYPES, type RoomType } from '../enums';
import { ROOM_KIND, ROOM_ORDER, sortByRoomOrder } from '../room-meta';
import { CURRENT_FLOW_VERSION, ETAPA6_FLOW_VERSION, FLOW_REGISTRY, FLOW_VERSIONS_BEFORE_ETAPA6 } from './flows';
// etapa 10 (describe-ul de la final)
import { ETAPA10_FLOW_VERSION, FLOW_VERSIONS_BEFORE_ETAPA10 } from './flows';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';
import { optionalHeightSlot, pieceWidthSlot } from './flows/measure-sets';
import type { Configurator3dStep, DimensionGroupStep, RoomFlow } from './types';

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

  it('ownProject: dimensiunile lipsa nu blocheaza publish-ul, restul raman obligatorii', () => {
    const answers = kitchenLIslandAnswers();
    delete answers.dimensions;
    // fara ownProject, publish-ul pica pe dimensions
    const strict = validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1 });
    expect(strict.ok).toBe(false);
    // cu ownProject (proiect tehnic propriu), dimensiunile devin optionale
    expect(
      validateRoomAnswers('KITCHEN', answers, { partial: false, version: 1, ownProject: true }),
    ).toEqual({ ok: true });

    // alte step-uri obligatorii raman cerute si cu ownProject
    delete answers.layout;
    const res = validateRoomAnswers('KITCHEN', answers, {
      partial: false,
      version: 1,
      ownProject: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.stepId === 'layout')).toBe(true);
  });

  it('ownProject: dimensiunile raspunse se valideaza in continuare', () => {
    const answers = kitchenLIslandAnswers();
    (answers.dimensions as Record<string, number>).runA = 999;
    const res = validateRoomAnswers('KITCHEN', answers, {
      partial: false,
      version: 1,
      ownProject: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.stepId === 'dimensions')).toBe(true);
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
    // raspunsuri minime pentru versiunea ETAPEI 6 a fiecarui flow (fixata explicit la comutarea etapei 10).
    // Record<RoomType, ...> — exhaustiv la compilare: un RoomType nou fara
    // raspunsuri minimale aici nu compileaza.
    const minimal: Record<(typeof ROOM_TYPES)[number], AnswerMap> = {
      PIECE_SIDEBOARD: { config3d: defaultPieceConfig('SIDEBOARD'), material: 'PAL' },
      PIECE_WALL_CABINET: { config3d: defaultPieceConfig('WALL_CABINET'), material: 'PAL' },
      PIECE_BATHROOM_VANITY: { config3d: defaultPieceConfig('BATHROOM_VANITY'), material: 'MDF_VOPSIT' },
      PIECE_ENTRYWAY: { config3d: defaultPieceConfig('ENTRYWAY'), material: 'PAL' },
      // etapa 6: tapitatele de catalog (v2) nu mai au intrebare de material — cadrul il alege firma
      PIECE_SOFA: { config3d: defaultPieceConfig('SOFA') },
      PIECE_ARMCHAIR: { config3d: defaultPieceConfig('ARMCHAIR') },
      PIECE_OTTOMAN: { config3d: defaultPieceConfig('OTTOMAN') },
      KITCHEN: {
        layout: 'STRAIGHT',
        hasIsland: false,
        dimensions: { runA: 3, ceilingHeight: 2.6 },
        frontMaterialBase: 'PAL',
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
        // v3 cere si inaltimea piesei, nu doar latimea
        dimensions: { tvUnitWidth: 3, tvUnitHeight: 0.5, ceilingHeight: 2.6 },
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
        // etapa 6 (v3): la usi glisante nu mai exista intrebarea de deschidere (GLISANTE vine din tipul de usi)
        materialWardrobe: 'MDF_INFOLIAT',
      },
      BATHROOM: {
        piecesNeeded: ['VANITY_UNIT'],
        dimensions: { vanityWidth: 0.8, ceilingHeight: 2.6 },
        ventilation: 'WINDOW',
        materialVanity: 'MDF_INFOLIAT',
        // etapa 6 (v3): deschidere pe fiecare piesa
        systemsVanity: ['MANER'],
      },
      PIECES: {
        // etapa 6 (v2): deschiderea e obligatorie pe rand
        pieces: [{ name: 'Dulap hol', material: 'PAL', systems: ['MANER'], quantity: 1 }],
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
      // etapa 6 (v4): deschiderea si tipul de usi vin doar din 3D (pasul ascuns doorType a disparut)
      PIECE_WARDROBE: {
        config3d: defaultPieceConfig('WARDROBE'),
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
        config3d: defaultPieceConfig('BED'),
        material: 'PAL',
      },
      PIECE_DRESSER: {
        config3d: defaultPieceConfig('DRESSER'),
        material: 'PAL',
      },
      PIECE_TABLE: {
        config3d: defaultPieceConfig('TABLE'),
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
        config3d: defaultPieceConfig('BENCH'),
        material: 'PAL',
      },
    };

    for (const roomType of ROOM_TYPES) {
      const flow = getFlow(roomType, ETAPA6_FLOW_VERSION[roomType]);
      const answers = minimal[roomType];
      // sanity: raspunsurile minime trec validarea la publish
      const valid = validateRoomAnswers(roomType, answers, { partial: false, version: ETAPA6_FLOW_VERSION[roomType] });
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

  it('v2 ramane inregistrata (PARALLEL eliminat)', () => {
    const flow = getFlow('KITCHEN', 2);
    expect(flow.version).toBe(2);
    expect(isFlowVersionRegistered('KITCHEN', 2)).toBe(true);
    const layout = flow.steps.find((s) => s.id === 'layout');
    if (layout?.type !== 'single-choice') throw new Error('missing layout');
    expect(layout.options.map((o) => o.value)).toEqual(['STRAIGHT', 'L_SHAPE', 'U_SHAPE']);
    // layout-ul nu afiseaza pret mediu in v2
    expect(layout.options.every((o) => o.info?.priceHintKey === undefined)).toBe(true);
  });

  it('hasIsland e toggle optional pe acelasi ecran cu formele (feedback PO 2026-07-13)', () => {
    const flow = getFlow('KITCHEN', 2);
    const layout = flow.steps.find((s) => s.id === 'layout');
    const island = flow.steps.find((s) => s.id === 'hasIsland');
    expect(layout?.screenGroup).toBe('layoutScreen');
    expect(island?.screenGroup).toBe('layoutScreen');
    // lipsa raspuns = fara insula; publish nu cere true/false explicit
    expect(island?.optional).toBe(true);
  });

  it('intrebarile sunt grupate pe partea de mobilier: material apoi deschidere per zona', () => {
    const flow = getFlow('KITCHEN', 2);
    const ids = flow.steps.map((s) => s.id);
    const order = [
      'frontMaterialBase',
      'openingSystemsBase',
      'frontMaterialWall',
      'openingSystemsWall',
      'frontMaterialIsland',
      'openingSystemsIsland',
    ].map((id) => ids.indexOf(id));
    expect(order.every((idx) => idx >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('sistemele per zona: jos/insula = maner/push/Gola, suspendate + Aventos', () => {
    const flow = getFlow('KITCHEN', 2);
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
    const invalid = validateRoomAnswers('KITCHEN', withOther, { partial: false, version: 2 });
    expect(invalid.ok).toBe(false);
    withOther.frontMaterialBaseOther = 'sticla mata';
    expect(validateRoomAnswers('KITCHEN', withOther, { partial: false, version: 2 })).toEqual({ ok: true });
    const derived = getFlow('KITCHEN', 2).deriveRoom(withOther);
    const base = derived.items.find((it) => it.name === 'Corpuri de bază');
    expect(base?.material).toBe('ALTUL');
    expect(base?.description).toBe('Material dorit: sticla mata');
  });

  it('set complet v2 trece validarea la publish; fara insula, intrebarile de insula dispar', () => {
    expect(validateRoomAnswers('KITCHEN', kitchenV2Answers(), { partial: false, version: 2 })).toEqual({
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
    expect(validateRoomAnswers('KITCHEN', noIsland, { partial: false, version: 2 })).toEqual({ ok: true });
    const flow = getFlow('KITCHEN', 2);
    const ids = visibleSteps(flow, noIsland).map((s) => s.id);
    expect(ids).not.toContain('frontMaterialIsland');
    expect(ids).not.toContain('openingSystemsIsland');
  });

  it('deriveRoom v2 produce un item per zona cu materialul si sistemele proprii', () => {
    const derived = getFlow('KITCHEN', 2).deriveRoom(kitchenV2Answers());
    expect(derived.items).toHaveLength(3);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Corpuri de bază'].material).toBe('PAL');
    expect(byName['Corpuri suspendate'].material).toBe('MDF_VOPSIT');
    expect(byName['Insulă'].material).toBe('LEMN_MASIV');
    expect(byName['Insulă'].systems).toEqual(['GOLA']);
    // metri liniari: runA + runB + islandLength = 6.2
    expect(derived.lengthM).toBeCloseTo(6.2, 5);
  });

  it('raspunsurile v1 raman valide contra versiunii 1 (regresie compatibilitate)', () => {
    expect(
      validateRoomAnswers('KITCHEN', kitchenLIslandAnswers(), { partial: false, version: 1 }),
    ).toEqual({ ok: true });
    // dar NU trec pe v2 (cabinetZones/frontMaterial nu mai exista)
    const onV2 = validateRoomAnswers('KITCHEN', kitchenLIslandAnswers(), { partial: false, version: 2 });
    expect(onV2.ok).toBe(false);
  });
});

describe('kitchen v3 — 6 sectiuni fixe, acelasi material implicit (PO 2026-11-08)', () => {
  const base: AnswerMap = {
    layout: 'L_SHAPE',
    hasIsland: true,
    dimensions: { runA: 2.4, runB: 1.8, ceilingHeight: 2.6, islandLength: 2.0, islandDepth: 0.9 },
    frontMaterialBase: 'MDF_VOPSIT',
    openingSystemsBase: ['PUSH'],
    openingSystemsWall: ['AVENTOS'],
    openingSystemsIsland: ['GOLA'],
    countertop: 'QUARTZ',
  };
  const screenGroups = (answers: AnswerMap) => {
    const groups: string[] = [];
    for (const s of visibleSteps(getFlow('KITCHEN', 3), answers)) {
      const key = s.screenGroup ?? s.id;
      if (groups[groups.length - 1] !== key) groups.push(key);
    }
    return groups;
  };

  it('bucataria noua a pornit pe v3 pana la etapa 6; acum porneste pe v4, iar v3 ramane inregistrata', () => {
    expect(ETAPA6_FLOW_VERSION.KITCHEN).toBe(4);
    expect(getFlow('KITCHEN', 4).version).toBe(4);
    expect(getFlow('KITCHEN', 3).version).toBe(3);
  });

  it('6 ecrane, indiferent de insula sau de materialele pe zone', () => {
    const six = ['layoutScreen', 'dimensions', 'fronts', 'countertop', 'appliances', 'sketch'];
    expect(screenGroups(base)).toEqual(six);
    expect(screenGroups({ ...base, hasIsland: false })).toEqual(six);
    expect(screenGroups({ ...base, separateFrontMaterials: true })).toEqual(six);
  });

  it('implicit: un singur material, publicabil, copiat pe toate zonele', () => {
    expect(validateRoomAnswers('KITCHEN', base, { partial: false, version: 3 })).toEqual({ ok: true });
    const ids = visibleSteps(getFlow('KITCHEN', 3), base).map((s) => s.id);
    expect(ids).not.toContain('frontMaterialWall');
    expect(ids).not.toContain('frontMaterialIsland');
    const items = getFlow('KITCHEN', 3).deriveRoom(base).items;
    expect(items.map((it) => it.material)).toEqual(['MDF_VOPSIT', 'MDF_VOPSIT', 'MDF_VOPSIT']);
    expect(items.map((it) => it.systems)).toEqual([['PUSH'], ['AVENTOS'], ['GOLA']]);
  });

  it('itemii derivati sunt identici cu v2 pentru aceleasi alegeri (formula de credite neschimbata)', () => {
    const v2Answers: AnswerMap = { ...base, frontMaterialWall: 'MDF_VOPSIT', frontMaterialIsland: 'MDF_VOPSIT' };
    const v2Derived = getFlow('KITCHEN', 2).deriveRoom(v2Answers);
    const v3Derived = getFlow('KITCHEN', 3).deriveRoom(base);
    expect(v3Derived).toEqual(v2Derived);
  });

  it('cu materiale diferite: zonele isi cer materialul si il pastreaza', () => {
    const separate: AnswerMap = { ...base, separateFrontMaterials: true };
    expect(validateRoomAnswers('KITCHEN', separate, { partial: false, version: 3 }).ok).toBe(false);
    const full: AnswerMap = { ...separate, frontMaterialWall: 'PAL', frontMaterialIsland: 'LEMN_MASIV' };
    expect(validateRoomAnswers('KITCHEN', full, { partial: false, version: 3 })).toEqual({ ok: true });
    const byName = Object.fromEntries(getFlow('KITCHEN', 3).deriveRoom(full).items.map((it) => [it.name, it]));
    expect(byName['Corpuri de bază'].material).toBe('MDF_VOPSIT');
    expect(byName['Corpuri suspendate'].material).toBe('PAL');
    expect(byName['Insulă'].material).toBe('LEMN_MASIV');
  });

  it('debifarea sterge materialele pe zone (pruneAnswers), "Altul" de baza se aplica peste tot', () => {
    const pruned = pruneAnswers(getFlow('KITCHEN', 3), {
      ...base,
      separateFrontMaterials: false,
      frontMaterialWall: 'PAL',
      frontMaterialIsland: 'PAL',
    });
    expect(pruned.frontMaterialWall).toBeUndefined();
    expect(pruned.frontMaterialIsland).toBeUndefined();
    const other: AnswerMap = { ...base, frontMaterialBase: 'ALTUL', frontMaterialBaseOther: 'sticla mata' };
    const items = getFlow('KITCHEN', 3).deriveRoom(other).items;
    expect(items.every((it) => it.material === 'ALTUL' && it.description === 'Material dorit: sticla mata')).toBe(true);
  });

  it('v2 nu se schimba: drafturile vechi se valideaza in continuare pe v2', () => {
    expect(getFlow('KITCHEN', 2).steps.find((s) => s.id === 'separateFrontMaterials')).toBeUndefined();
    expect(getFlow('KITCHEN', 2).steps.find((s) => s.id === 'frontMaterialBase')?.screenGroup).toBe('frontBase');
  });
});

describe('bathroom v2 — ventilatie + dimensiuni/material per piesa', () => {
  it('sloturile de dimensiuni urmeaza piesele selectate', () => {
    const flow = getFlow('BATHROOM', 2);
    expect(flow.version).toBe(2);
    const dimStep = flow.steps.find((s) => s.id === 'dimensions');
    if (dimStep?.type !== 'dimension-group') throw new Error('missing dim step');
    const ids = dimStep
      .slots({ piecesNeeded: ['VANITY_UNIT', 'TALL_STORAGE'] })
      .map((s) => s.id);
    expect(ids).toEqual(['vanityWidth', 'tallStorageWidth', 'ceilingHeight']);
  });

  it('intrebarea de material apare doar pentru piesele selectate', () => {
    const flow = getFlow('BATHROOM', 2);
    const answers: AnswerMap = { piecesNeeded: ['MIRROR_CABINET'] };
    const ids = visibleSteps(flow, answers).map((s) => s.id);
    expect(ids).toContain('materialMirror');
    expect(ids).not.toContain('materialVanity');
    expect(ids).not.toContain('materialTall');
  });

  it('MDF infoliat are recommendedIf pe ventilation=NONE (badge, nu restrictie)', () => {
    const flow = getFlow('BATHROOM', 2);
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
    expect(validateRoomAnswers('BATHROOM', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const derived = getFlow('BATHROOM', 2).deriveRoom(answers);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Corp lavoar'].material).toBe('MDF_INFOLIAT');
    expect(byName['Dulap oglindă'].material).toBe('PAL');
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
  it('versiunile curente (etapa 6: toate pe versiunea noua)', () => {
    // inainte de etapa 6: DRESSING/LIVING 3, BEDROOM/OFFICE/PANTRY/LAUNDRY/BALCONY 2, HALLWAY/PIECES 1, piesele ghidate 3
    expect(ETAPA6_FLOW_VERSION.DRESSING).toBe(4);
    expect(ETAPA6_FLOW_VERSION.LIVING).toBe(4);
    expect(ETAPA6_FLOW_VERSION.BEDROOM).toBe(3);
    expect(ETAPA6_FLOW_VERSION.OFFICE).toBe(3);
    expect(ETAPA6_FLOW_VERSION.HALLWAY).toBe(2);
    expect(ETAPA6_FLOW_VERSION.PANTRY).toBe(3);
    expect(ETAPA6_FLOW_VERSION.LAUNDRY).toBe(3);
    expect(ETAPA6_FLOW_VERSION.BALCONY).toBe(3);
    expect(ETAPA6_FLOW_VERSION.PIECE_WARDROBE).toBe(4);
    expect(ETAPA6_FLOW_VERSION.PIECE_BED).toBe(4);
    expect(ETAPA6_FLOW_VERSION.PIECE_TABLE).toBe(4);
    expect(ETAPA6_FLOW_VERSION.PIECE_BENCH).toBe(4);
    expect(ETAPA6_FLOW_VERSION.PIECES).toBe(2);
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

  it('flow-ul PIECES (Alta piesa) v1 ramane neatins: pieces + sketch', () => {
    const flow = getFlow('PIECES', 1);
    expect(flow.version).toBe(1);
    expect(flow.steps.map((s) => s.id)).toEqual(['pieces', 'sketch']);
  });

  it('config per piesa in v2 (F4): material + sisteme, ecran propriu per piesa', () => {
    const flow = getFlow('BEDROOM', 2);
    const answers: AnswerMap = { piecesNeeded: ['WARDROBE', 'DRESSER'] };
    const ids = visibleSteps(flow, answers).map((s) => s.id);
    expect(ids).toContain('materialWardrobe');
    expect(ids).toContain('systemsWardrobe');
    expect(ids).toContain('materialDresser');
    expect(ids).not.toContain('materialBed');
    expect(ids).not.toContain('systemsBed');
    // materialul si sistemele piesei sunt intrebari SEPARATE, pe ecrane
    // separate (feedback PO 2026-07-13, docs/12 S2)
    const matStep = flow.steps.find((s) => s.id === 'materialWardrobe');
    const sysStep = flow.steps.find((s) => s.id === 'systemsWardrobe');
    expect(matStep?.screenGroup).toBe('piece:WARDROBE');
    expect(sysStep?.screenGroup).toBe('piece:WARDROBE:systems');
    expect(sysStep?.titleKey).toBe('flows.BEDROOM.systemsWardrobe.title');
    // "Altul" deschide textul liber pe acelasi ecran
    const withOther: AnswerMap = { piecesNeeded: ['WARDROBE'], materialWardrobe: 'ALTUL' };
    expect(visibleSteps(flow, withOther).map((s) => s.id)).toContain('materialWardrobeOther');
  });
});

describe('v2 pentru pantry/laundry/balcony + piese ghidate (item 1, aliniere bucatarie)', () => {
  it('pantry v2: material per zona, sisteme doar la dulapuri, "Altul" cu text in description', () => {
    const flow = getFlow('PANTRY', 2);
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
    expect(validateRoomAnswers('PANTRY', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect(derived.items.map((i) => i.name)).toEqual(['Rafturi debara', 'Dulapuri debara']);
    expect(derived.items[1].material).toBe('ALTUL');
    expect(derived.items[1].description).toContain('placaj mesteacan');
    expect(derived.items[1].systems).toEqual(['PUSH']);
    expect(derived.items[0].systems).toEqual([]);
    // ALTUL fara text pica la publish (textul liber e obligatoriu cand e vizibil)
    const { materialCabinetsOther, ...noText } = answers;
    void materialCabinetsOther;
    expect(validateRoomAnswers('PANTRY', noText, { partial: false, version: 2 }).ok).toBe(false);
  });

  it('laundry v2: material+sisteme per piesa, blatul fara sisteme, MDF infoliat recomandat fara ventilatie', () => {
    const flow = getFlow('LAUNDRY', 2);
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
    expect(validateRoomAnswers('LAUNDRY', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect(derived.items.map((i) => i.name)).toEqual([
      'Dulap încastrare electrocasnice',
      'Blat de lucru',
    ]);
    expect(derived.items[0].systems).toEqual(['PUSH']);
    expect(derived.items[1].systems).toEqual([]);
  });

  it('balcony v2: piese cu material propriu, lemn masiv recomandat pe balcon deschis', () => {
    const flow = getFlow('BALCONY', 2);
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
    expect(validateRoomAnswers('BALCONY', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    expect(flow.deriveRoom(answers).items[0]).toMatchObject({
      name: 'Rafturi balcon',
      material: 'LEMN_MASIV',
      systems: [],
    });
  });

  it('piesele ghidate v2: "Altul" cere text si textul ajunge in description', () => {
    const flow = getFlow('PIECE_BENCH', 2);
    expect(flow.version).toBe(2);

    // fara ALTUL: textul liber nu e vizibil, raspunsurile v1 raman suficiente
    const plain: AnswerMap = {
      style: 'WITH_STORAGE',
      dimensions: { width: 1 },
      material: 'PAL',
    };
    expect(visibleSteps(flow, plain).map((s) => s.id)).not.toContain('materialOther');
    expect(validateRoomAnswers('PIECE_BENCH', plain, { partial: false, version: 2 })).toEqual({ ok: true });

    // cu ALTUL: textul devine obligatoriu si intra in description
    const withOther: AnswerMap = { ...plain, material: 'ALTUL' };
    expect(visibleSteps(flow, withOther).map((s) => s.id)).toContain('materialOther');
    expect(validateRoomAnswers('PIECE_BENCH', withOther, { partial: false, version: 2 }).ok).toBe(false);
    const complete: AnswerMap = { ...withOther, materialOther: 'ratan si stejar' };
    expect(validateRoomAnswers('PIECE_BENCH', complete, { partial: false, version: 2 })).toEqual({ ok: true });
    const derived = flow.deriveRoom(complete);
    expect(derived.items[0].description).toContain('Material dorit: ratan si stejar');
  });

  it('piesele showroom v3 pastreaza materialul Altul si cer configuratia 3D', () => {
    // etapa 6: v4 are setul de lemn la pat / masa (fara "Altul"); comportamentul v3 ramane pe v3
    for (const kind of ['BED', 'TABLE', 'BENCH'] as const) {
      const roomType = `PIECE_${kind}` as const;
      const flow = getFlow(roomType, 3);
      const answers: AnswerMap = { config3d: defaultPieceConfig(kind), material: 'ALTUL', materialOther: 'ratan si stejar' };
      expect(flow.version).toBe(3);
      expect(validateRoomAnswers(roomType, answers, { partial: false, version: 3 })).toEqual({ ok: true });
      expect(flow.deriveRoom(answers).items[0].description).toContain('Material dorit: ratan si stejar');
      expect(validateRoomAnswers(roomType, { material: 'PAL' }, { partial: false, version: 3 }).ok).toBe(false);
    }
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

describe('v3 dressing + living (feedback PO 2026-07-13, docs/12 S3)', () => {
  it('dressing v3: LED e modul interior, intrebarea separata a disparut', () => {
    const flow = getFlow('DRESSING', 3);
    expect(flow.version).toBe(3);
    expect(flow.steps.find((s) => s.id === 'lighting')).toBeUndefined();
    const modules = flow.steps.find((s) => s.id === 'interiorModules');
    if (modules?.type !== 'multi-choice') throw new Error('missing interiorModules');
    expect(modules.options.map((o) => o.value)).toContain('LED_LIGHTING');

    const answers: AnswerMap = {
      layout: 'LINEAR',
      doorType: 'HINGED',
      dimensions: { runA: 2.5, wardrobeHeight: 2.4 },
      interiorModules: ['HANGING_RODS', 'LED_LIGHTING'],
      material: 'PAL',
    };
    expect(validateRoomAnswers('DRESSING', answers, { partial: false, version: 3 })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect(derived.items[0].description).toContain('iluminare LED');
    // LED-ul nu apare de doua ori (nu e "mobilare", e anotare separata)
    expect(derived.items[0].description).toContain('Interior: bare de agățat');
    expect(derived.items[0].description?.match(/LED/g)?.length).toBe(1);

    // raspunsurile v2 (cu lighting boolean) raman valide contra versiunii 2
    const v2Answers: AnswerMap = { ...answers, interiorModules: ['HANGING_RODS'], lighting: true };
    expect(validateRoomAnswers('DRESSING', v2Answers, { partial: false, version: 2 })).toEqual({
      ok: true,
    });
    expect(validateRoomAnswers('DRESSING', v2Answers, { partial: false, version: 3 }).ok).toBe(false);
  });

  it('living v3: latime + inaltime per piesa selectata', () => {
    const flow = getFlow('LIVING', 3);
    expect(flow.version).toBe(3);
    const dimStep = flow.steps.find((s) => s.id === 'dimensions');
    if (dimStep?.type !== 'dimension-group') throw new Error('missing dimensions');
    const ids = dimStep
      .slots({ piecesNeeded: ['TV_UNIT', 'BOOKSHELF'] })
      .map((s) => s.id);
    expect(ids).toEqual([
      'tvUnitWidth',
      'tvUnitHeight',
      'bookshelfWidth',
      'bookshelfHeight',
      'ceilingHeight',
    ]);
    // inaltimile nu intra in metri liniari
    const slots = dimStep.slots({ piecesNeeded: ['TV_UNIT'] });
    expect(slots.find((s) => s.id === 'tvUnitHeight')?.countsTowardLinear).toBeUndefined();
  });

  it('living v3: LED per corp — doar corpurile selectate apar ca optiuni si anoteaza itemul lor', () => {
    const flow = getFlow('LIVING', 3);
    const led = flow.steps.find((s) => s.id === 'ledPieces');
    if (led?.type !== 'multi-choice') throw new Error('missing ledPieces');
    expect(led.optional).toBe(true);
    expect(flow.steps.find((s) => s.id === 'ledLighting')).toBeUndefined();

    // fara piese eligibile (doar masuta) intrebarea nu e vizibila
    expect(
      visibleSteps(flow, { piecesNeeded: ['COFFEE_TABLE'] }).some((s) => s.id === 'ledPieces'),
    ).toBe(false);
    // optiunile urmeaza piesele selectate
    const answers: AnswerMap = { piecesNeeded: ['TV_UNIT', 'BOOKSHELF', 'COFFEE_TABLE'] };
    const opts = visibleOptions(led, answers).map((o) => o.value);
    expect(opts).toEqual(['TV_UNIT', 'BOOKSHELF']);

    const full: AnswerMap = {
      piecesNeeded: ['TV_UNIT', 'BOOKSHELF'],
      tvStyle: 'ON_FLOOR',
      dimensions: {
        tvUnitWidth: 2,
        tvUnitHeight: 0.5,
        bookshelfWidth: 1.2,
        bookshelfHeight: 2.2,
        ceilingHeight: 2.6,
      },
      materialTvUnit: 'PAL',
      systemsTvUnit: ['PUSH'],
      materialBookshelf: 'PAL',
      systemsBookshelf: ['MANER'],
      ledPieces: ['BOOKSHELF'],
    };
    expect(validateRoomAnswers('LIVING', full, { partial: false, version: 3 })).toEqual({ ok: true });
    const derived = flow.deriveRoom(full);
    const byName = Object.fromEntries(derived.items.map((it) => [it.name, it]));
    expect(byName['Bibliotecă'].description).toContain('Cu iluminare LED');
    expect(byName['Comodă TV'].description ?? '').not.toContain('LED');
  });
});

describe('dimension-group — sloturi strict pozitive (E-client-2)', () => {
  // O dimensiune 0 m nu poate fi raspuns valid pe niciun flow inregistrat (inclusiv
  // FROZEN); lungimea 0 apare doar la camerele care pot sari dimensiunile.
  it('fiecare slot din fiecare versiune inregistrata are min > 0', () => {
    let checked = 0;
    for (const [roomType, versions] of Object.entries(FLOW_REGISTRY)) {
      for (const [version, flow] of Object.entries(versions ?? {})) {
        for (const step of flow.steps) {
          if (step.type !== 'dimension-group') continue;
          for (const slot of step.slots({})) {
            checked += 1;
            expect(slot.min, `${roomType} v${version} ${step.id}.${slot.id}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// Etapa 8 (nr. 39): slot lipsa ≠ valoare in afara intervalului
describe('dimension-group — mesajul pentru slotul lipsa (etapa 8)', () => {
  const flow = getFlow('LAUNDRY', 1);
  const dimStep = flow.steps.find((s) => s.id === 'dimensions')!;
  const message = (value: unknown) => {
    const parsed = stepAnswerSchema(dimStep, {}).safeParse(value);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  };

  it('un slot lipsa da validation.dimensionRequired', () => {
    expect(message({ ceilingHeight: 2.6 })).toBe('validation.dimensionRequired');
  });

  it('valoarea in afara intervalului, un text sau NaN raman validation.dimensionOutOfRange', () => {
    expect(message({ runA: 999, ceilingHeight: 2.6 })).toBe('validation.dimensionOutOfRange');
    expect(message({ runA: '2,4', ceilingHeight: 2.6 })).toBe('validation.dimensionOutOfRange');
    expect(message({ runA: Number.NaN, ceilingHeight: 2.6 })).toBe('validation.dimensionOutOfRange');
    expect(message({ runA: 2.4, ceilingHeight: 2.6 })).toBeUndefined();
  });

  it('validarea camerei raporteaza dimensionRequired pe pasul de dimensiuni', () => {
    const res = validateRoomAnswers('LAUNDRY', { dimensions: { ceilingHeight: 2.6 } }, { partial: true, version: 1 });
    expect(res).toEqual({ ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.dimensionRequired' }] });
  });
});

// Etapa 6 (valul 1, fundatia): capabilitatile noi ale motorului — toate optionale, deci
// fluxurile vechi se comporta identic (acoperit si de score-invariance / firm-text).
describe('etapa 6 — motor', () => {
  it('not neaga conditia; atLeast cere cel putin N potriviri pe raspuns string[]', () => {
    const answers: AnswerMap = { piecesNeeded: ['DESK', 'STORAGE', 'SHELVES'], same: true };
    expect(evalCondition({ not: { questionId: 'same', equals: true } }, answers)).toBe(false);
    expect(evalCondition({ not: { questionId: 'same', equals: true } }, {})).toBe(true);
    expect(evalCondition({ questionId: 'piecesNeeded', in: ['DESK', 'STORAGE'], atLeast: 2 }, answers)).toBe(true);
    expect(evalCondition({ questionId: 'piecesNeeded', in: ['DESK', 'BED'], atLeast: 2 }, answers)).toBe(false);
    // implicit 1 = intersectie nevida, ca inainte
    expect(evalCondition({ questionId: 'piecesNeeded', in: ['DESK', 'BED'] }, answers)).toBe(true);
    // pe primitiv atLeast se ignora
    expect(evalCondition({ questionId: 'layout', in: ['L_SHAPE'], atLeast: 3 }, { layout: 'L_SHAPE' })).toBe(true);
    expect(evalCondition({ all: [{ not: { questionId: 'same', equals: false } }, { any: [{ questionId: 'piecesNeeded', in: ['X'] }] }] }, answers)).toBe(false);
  });

  const multi = (exclusive: boolean) => ({
    id: 'systemsDesk',
    type: 'multi-choice' as const,
    titleKey: 't',
    minSelected: 1,
    options: [
      { value: 'MANER', labelKey: 'a' },
      { value: 'PUSH', labelKey: 'b' },
      { value: 'NO_FRONTS', labelKey: 'c', ...(exclusive ? { exclusive: true } : {}) },
      { value: 'FIRM_DECIDES', labelKey: 'd', ...(exclusive ? { exclusive: true } : {}) },
    ],
  });

  it('optiunea exclusiva e acceptata singura si respinsa impreuna cu altele', () => {
    const schema = stepAnswerSchema(multi(true), {});
    expect(schema.safeParse(['FIRM_DECIDES']).success).toBe(true);
    expect(schema.safeParse(['NO_FRONTS']).success).toBe(true);
    expect(schema.safeParse(['MANER', 'PUSH']).success).toBe(true);
    const mixed = schema.safeParse(['MANER', 'FIRM_DECIDES']);
    expect(mixed.success).toBe(false);
    if (!mixed.success) expect(mixed.error.issues[0].message).toBe('validation.exclusiveOption');
    expect(schema.safeParse(['NO_FRONTS', 'FIRM_DECIDES']).success).toBe(false);
    // fara steagul exclusive: comportamentul de dinainte
    expect(stepAnswerSchema(multi(false), {}).safeParse(['MANER', 'FIRM_DECIDES']).success).toBe(true);
  });

  it('pasul pieces cu rowVersion 2 valideaza randurile cu pieceRowV2Schema', () => {
    const base = { id: 'pieces', type: 'pieces' as const, titleKey: 't', minPieces: 1, maxPieces: 10 };
    const row = { name: 'Dulap hol', material: 'PAL', systems: ['MANER'], quantity: 1, widthCm: 120 };
    expect(stepAnswerSchema({ ...base, rowVersion: 2 }, {}).safeParse([row]).success).toBe(true);
    // v2: fara deschidere → respins; v1 (requestItemSchema) il accepta ca azi
    const noOpening = { name: 'Dulap hol', material: 'PAL', systems: [], quantity: 1 };
    expect(stepAnswerSchema({ ...base, rowVersion: 2 }, {}).safeParse([noOpening]).success).toBe(false);
    expect(stepAnswerSchema(base, {}).safeParse([noOpening]).success).toBe(true);
    // v2 strict: camp necunoscut respins
    expect(stepAnswerSchema({ ...base, rowVersion: 2 }, {}).safeParse([{ ...row, extra: 1 }]).success).toBe(false);
  });

  it('firmRecommendations: fluxurile vechi si camera cu ajutor → []', () => {
    const flow = getFlow('BEDROOM', 2);
    const answers = { piecesNeeded: ['DRESSER'], dimensions: { dresserWidth: 1.2, ceilingHeight: 2.6 }, materialDresser: 'PAL', systemsDresser: ['MANER'] };
    expect(flow.deriveRoom(answers).firmRecommendations).toBeUndefined();
    expect(firmRecommendations('BEDROOM', answers, 2)).toEqual([]);
    expect(firmRecommendations('KITCHEN', {}, 3, { needsDesignHelp: true })).toEqual([]);
  });

  it('versiunile noi sunt inregistrate, iar CURRENT_FLOW_VERSION a trecut pe ele (valul 3)', () => {
    const expected: Partial<Record<RoomType, number>> = {
      KITCHEN: 4, DRESSING: 4, LIVING: 4, OFFICE: 3, BEDROOM: 3, BATHROOM: 3, PANTRY: 3, LAUNDRY: 3, BALCONY: 3,
      HALLWAY: 2, PIECES: 2, PIECE_WARDROBE: 4, PIECE_TV_UNIT: 4, PIECE_BOOKCASE: 4, PIECE_DESK: 4, PIECE_DRESSER: 4,
      PIECE_SHOE_CABINET: 4, PIECE_NIGHTSTAND: 4, PIECE_BED: 4, PIECE_TABLE: 4, PIECE_BENCH: 4, PIECE_SIDEBOARD: 2,
      PIECE_WALL_CABINET: 2, PIECE_BATHROOM_VANITY: 2, PIECE_ENTRYWAY: 2, PIECE_SOFA: 2, PIECE_ARMCHAIR: 2, PIECE_OTTOMAN: 2,
    };
    expect(Object.keys(expected).sort()).toEqual([...ROOM_TYPES].sort());
    for (const roomType of ROOM_TYPES) {
      const v = expected[roomType]!;
      const before = FLOW_VERSIONS_BEFORE_ETAPA6[roomType];
      expect(ETAPA6_FLOW_VERSION[roomType], roomType).toBe(v);
      expect(isFlowVersionRegistered(roomType, v), roomType).toBe(true);
      expect(getFlow(roomType, v).version, roomType).toBe(v);
      expect(getFlow(roomType, v).roomType, roomType).toBe(roomType);
      expect(before, roomType).toEqual(Array.from({ length: v - 1 }, (_, i) => i + 1));
      expect(before.every((old) => isFlowVersionRegistered(roomType, old)), roomType).toBe(true);
      // etapa 10 (valul 2): curentul a trecut mai departe, pe ETAPA10_FLOW_VERSION
      expect(CURRENT_FLOW_VERSION[roomType], roomType).toBe(ETAPA10_FLOW_VERSION[roomType]);
      expect(v, roomType).toBeGreaterThan(Math.max(...before));
    }
  });
});

describe('etapa 10 — motor', () => {
  const dims: DimensionGroupStep = {
    id: 'dimensions',
    type: 'dimension-group',
    titleKey: 'flows.TOY.dimensions.title',
    slots: () => [
      pieceWidthSlot('wardrobeWidth', 'flows.TOY.slots.wardrobeWidth', { min: 0.6, max: 5 }),
      optionalHeightSlot('wardrobeHeight', 'flows.TOY.slots.wardrobeHeight', { min: 1.8, max: 3.2 }, 2.4),
    ],
  };
  const toy: RoomFlow = { roomType: 'BEDROOM', version: 990, steps: [dims], deriveRoom: () => ({ lengthM: 0, widthM: 0, heightM: 0, items: [] }) };
  // fluxul-jucarie intra in registru doar pe durata unui test (summarizeAnswers / validateRoomAnswers cer un flux inregistrat)
  function withToy<T>(fn: () => T): T {
    FLOW_REGISTRY.BEDROOM[990] = toy;
    try {
      return fn();
    } finally {
      delete FLOW_REGISTRY.BEDROOM[990];
    }
  }
  const beforeEtapa10 = allFixtureFlows().filter(({ roomType, version }) => FLOW_VERSIONS_BEFORE_ETAPA10[roomType].includes(version));

  it('slot optional gol acceptat la publicare; valoarea data se valideaza; slotul obligatoriu gol tot dimensionRequired', () => {
    withToy(() => {
      const publish = (d: Record<string, unknown>) =>
        validateRoomAnswers('BEDROOM', { dimensions: d } as AnswerMap, { partial: false, version: 990 });
      expect(publish({ wardrobeWidth: 2 })).toEqual({ ok: true });
      expect(publish({ wardrobeWidth: 2, wardrobeHeight: 2.6 })).toEqual({ ok: true });
      expect(publish({ wardrobeWidth: 2, wardrobeHeight: 3.5 })).toEqual({
        ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' }],
      });
      expect(publish({ wardrobeHeight: 2.4 })).toEqual({
        ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.dimensionRequired' }],
      });
      expect(publish({ wardrobeWidth: 2, wardrobeHeight: null })).toEqual({
        ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' }],
      });
      expect(publish({ wardrobeWidth: 2, wardrobeHeight: 'mult' })).toEqual({
        ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' }],
      });
      expect(publish({ wardrobeWidth: 2, ceilingHeight: 2.5 })).toEqual({
        ok: false, errors: [{ stepId: 'dimensions', messageKey: 'validation.unknownAnswer' }],
      });
    });
    // un pas doar cu sloturi optionale accepta raspunsul gol
    const onlyOptional: DimensionGroupStep = { ...dims, slots: () => [optionalHeightSlot('h', 'l', { min: 1, max: 2 })] };
    expect(stepAnswerSchema(onlyOptional, {}).safeParse({}).success).toBe(true);
  });

  it('fluxurile de dinainte de etapa 10 nu au sloturi optionale si nici valori tipice (schema identica)', () => {
    for (const { roomType, version, flow } of beforeEtapa10) {
      for (const variant of FIXTURE_VARIANTS) {
        const answers = fixtureAnswers(flow, variant);
        for (const step of visibleSteps(flow, answers)) {
          if (step.type !== 'dimension-group') continue;
          for (const slot of step.slots(answers)) {
            expect(slot.optional, `${roomType} v${version} ${slot.id}`).toBeUndefined();
            expect(slot.typicalM, `${roomType} v${version} ${slot.id}`).toBeUndefined();
          }
        }
      }
    }
  });

  it('summarizeAnswers: `missing` doar pentru sloturile optionale lasate goale', () => {
    withToy(() => {
      expect(summarizeAnswers('BEDROOM', { dimensions: { wardrobeWidth: 2 } }, 990)).toEqual([{
        kind: 'dimensions',
        stepId: 'dimensions',
        labelKey: 'flows.TOY.dimensions.title',
        slots: [{ labelKey: 'flows.TOY.slots.wardrobeWidth', value: 2 }],
        missing: [{ labelKey: 'flows.TOY.slots.wardrobeHeight', typicalM: 2.4 }],
      }]);
      const full = summarizeAnswers('BEDROOM', { dimensions: { wardrobeWidth: 2, wardrobeHeight: 2.5 } }, 990);
      expect(full).toHaveLength(1);
      expect('missing' in full[0]).toBe(false);
      // doar sloturi goale: intrarea apare tot (cu slots gol), ca firma sa vada ce lipseste
      expect(summarizeAnswers('BEDROOM', { dimensions: {} }, 990)).toEqual([{
        kind: 'dimensions', stepId: 'dimensions', labelKey: 'flows.TOY.dimensions.title', slots: [],
        missing: [{ labelKey: 'flows.TOY.slots.wardrobeHeight', typicalM: 2.4 }],
      }]);
    });
  });

  it('summarizeAnswers pe fluxurile de dinainte de etapa 10: nicio intrare cu `missing`', () => {
    for (const { roomType, version, flow } of beforeEtapa10) {
      for (const variant of FIXTURE_VARIANTS) {
        const entries = summarizeAnswers(roomType, fixtureAnswers(flow, variant), version);
        for (const e of entries) expect('missing' in e, `${roomType} v${version} ${variant}`).toBe(false);
      }
    }
  });

  it('features: sofa.sleeper respins pe PIECE_SOFA v2 (validation.unknownAnswer), acceptat pe un pas care il declara', () => {
    const sofa = defaultPieceConfig('SOFA');
    const sleeper = { ...sofa, sofa: { ...sofa.sofa!, sleeper: true } };
    const both = { ...sofa, sofa: { ...sofa.sofa!, sleeper: true, storage: true } };
    expect(validateRoomAnswers('PIECE_SOFA', { config3d: sofa }, { partial: true, version: 2 })).toEqual({ ok: true });
    expect(validateRoomAnswers('PIECE_SOFA', { config3d: sleeper }, { partial: true, version: 2 })).toEqual({
      ok: false, errors: [{ stepId: 'config3d', messageKey: 'validation.unknownAnswer' }],
    });
    const v2Step = getFlow('PIECE_SOFA', 2).steps.find((s) => s.type === 'configurator-3d') as Configurator3dStep;
    expect(v2Step.features).toBeUndefined();
    const toyStep: Configurator3dStep = { ...v2Step, features: ['SOFA_SLEEPER', 'SOFA_STORAGE'] };
    expect(stepAnswerSchema(toyStep, {}).safeParse(sofa).success).toBe(true);
    expect(stepAnswerSchema(toyStep, {}).safeParse(sleeper).success).toBe(true);
    expect(stepAnswerSchema(toyStep, {}).safeParse(both).success).toBe(true);
    // doar functiile declarate trec
    const onlyStorage = stepAnswerSchema({ ...v2Step, features: ['SOFA_STORAGE'] }, {}).safeParse(sleeper);
    expect(onlyStorage.success ? null : onlyStorage.error.issues[0].message).toBe('validation.unknownAnswer');
  });

  it('features: campurile noi de pat / masa / bancuta respinse pe versiunile 4', () => {
    const step = (rt: RoomType) => getFlow(rt, 4).steps.find((s) => s.type === 'configurator-3d') as Configurator3dStep;
    const bed = defaultPieceConfig('BED');
    const table = defaultPieceConfig('TABLE');
    const bench = defaultPieceConfig('BENCH');
    expect(stepAnswerSchema(step('PIECE_BED'), {}).safeParse(bed).success).toBe(true);
    expect(stepAnswerSchema(step('PIECE_TABLE'), {}).safeParse(table).success).toBe(true);
    expect(stepAnswerSchema(step('PIECE_BENCH'), {}).safeParse(bench).success).toBe(true);
    expect(stepAnswerSchema(step('PIECE_BED'), {}).safeParse({ ...bed, bed: { ...bed.bed!, customSize: { widthM: 1.2, lengthM: 2 } } }).success).toBe(false);
    expect(stepAnswerSchema(step('PIECE_TABLE'), {}).safeParse({ ...table, table: { ...table.table!, customHeightM: 0.75 } }).success).toBe(false);
    expect(stepAnswerSchema(step('PIECE_TABLE'), {}).safeParse({ ...table, table: { ...table.table!, shape: 'EXTENDABLE', openLengthM: 2 } }).success).toBe(false);
    expect(stepAnswerSchema(step('PIECE_BENCH'), {}).safeParse({ ...bench, bench: { ...bench.bench!, customHeightM: 0.45 } }).success).toBe(false);
  });

  it('ETAPA6_FLOW_VERSION ramane pe valorile etapei 6; cele 14 versiuni noi sunt inregistrate si CURRENT_FLOW_VERSION = ETAPA10 (valul 2)', () => {
    const NEW: Partial<Record<RoomType, number>> = {
      KITCHEN: 5, DRESSING: 5, LIVING: 5, OFFICE: 4, BEDROOM: 4, BATHROOM: 4, PANTRY: 4, LAUNDRY: 4, BALCONY: 4, HALLWAY: 3,
      PIECE_BED: 5, PIECE_TABLE: 5, PIECE_BENCH: 5, PIECE_SOFA: 3,
    };
    expect(Object.keys(NEW)).toHaveLength(14);
    for (const rt of ROOM_TYPES) {
      const v = NEW[rt] ?? ETAPA6_FLOW_VERSION[rt];
      expect(ETAPA10_FLOW_VERSION[rt], rt).toBe(v);
      expect(isFlowVersionRegistered(rt, v), rt).toBe(true);
      expect(getFlow(rt, v).version, rt).toBe(v);
      expect(getFlow(rt, v).roomType, rt).toBe(rt);
      expect(CURRENT_FLOW_VERSION[rt], rt).toBe(ETAPA10_FLOW_VERSION[rt]);
      expect(FLOW_VERSIONS_BEFORE_ETAPA10[rt], rt).toEqual([...FLOW_VERSIONS_BEFORE_ETAPA6[rt], ETAPA6_FLOW_VERSION[rt]]);
      // registrul = versiunile de dinainte + (cel mult) versiunea noua
      const expected = NEW[rt] ? [...FLOW_VERSIONS_BEFORE_ETAPA10[rt], NEW[rt]!] : FLOW_VERSIONS_BEFORE_ETAPA10[rt];
      expect(Object.keys(FLOW_REGISTRY[rt]).map(Number).sort((a, b) => a - b), rt).toEqual(expected);
      if (NEW[rt]) expect(ETAPA6_FLOW_VERSION[rt], rt).toBeLessThan(NEW[rt]!);
    }
  });

  it('allFixtureFlows: legacy / etapa6 neschimbate, etapa10 = doar versiunile noi', () => {
    const key = (l: { roomType: RoomType; version: number }[]) => l.map((f) => `${f.roomType}:${f.version}`);
    expect(key(allFixtureFlows({ only: 'etapa6' }))).toEqual(ROOM_TYPES.map((rt) => `${rt}:${ETAPA6_FLOW_VERSION[rt]}`));
    expect(key(allFixtureFlows({ only: 'legacy' }))).toEqual(ROOM_TYPES.flatMap((rt) => FLOW_VERSIONS_BEFORE_ETAPA6[rt].map((v) => `${rt}:${v}`)));
    expect(key(allFixtureFlows({ only: 'etapa10' }))).toEqual(
      ROOM_TYPES.filter((rt) => ETAPA10_FLOW_VERSION[rt] !== ETAPA6_FLOW_VERSION[rt]).map((rt) => `${rt}:${ETAPA10_FLOW_VERSION[rt]}`),
    );
    expect(allFixtureFlows({ only: 'etapa10' })).toHaveLength(14);
  });

  it('fixture-urile: sloturile optionale completate in first / middle, goale in last / requiredOnly', () => {
    expect(fixtureAnswers(toy, 'first').dimensions).toEqual({ wardrobeWidth: 2.8, wardrobeHeight: 2.5 });
    expect(Object.keys(fixtureAnswers(toy, 'middle').dimensions as object).sort()).toEqual(['wardrobeHeight', 'wardrobeWidth']);
    expect(fixtureAnswers(toy, 'last').dimensions).toEqual({ wardrobeWidth: 0.6 });
    expect(fixtureAnswers(toy, 'requiredOnly').dimensions).toEqual({ wardrobeWidth: 2.8 });
  });
});
