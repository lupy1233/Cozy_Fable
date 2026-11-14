import { describe, expect, it } from 'vitest';
import type { RoomType } from '../../enums';
import { firmRecommendations, getFlow, validateRoomAnswers, visibleSteps } from '../engine';
import type { AnswerMap, MultiChoiceStep, QuestionStep, SingleChoiceStep } from '../types';
import { balconyFlowV3 } from './balcony.v3';
import { bathroomFlowV3 } from './bathroom.v3';
import {
  BODY_NOTE,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  INTEGRAL_MDF_NOTE,
  NO_FRONTS_NOTE,
  WORKTOP_NOTES,
} from './finish-sets';
import { laundryFlowV3 } from './laundry.v3';
import { pantryFlowV3 } from './pantry.v3';

// Etapa 6, pachetul B (DESIGN §5.6–§5.9): baie v3, debara v3, spalatorie v3, balcon v3.

const step = (flow: { steps: QuestionStep[] }, id: string) => flow.steps.find((s) => s.id === id) as QuestionStep;
const optionValues = (flow: { steps: QuestionStep[] }, id: string) =>
  (step(flow, id) as SingleChoiceStep | MultiChoiceStep).options.map((o) => o.value);
const recommended = (flow: { steps: QuestionStep[] }, id: string) =>
  (step(flow, id) as SingleChoiceStep).options.filter((o) => o.recommendedIf).map((o) => o.value);
const errors = (roomType: RoomType, answers: AnswerMap, version: number, partial = false) => {
  const r = validateRoomAnswers(roomType, answers, { partial, version });
  return r.ok ? [] : r.errors.map((e) => `${e.stepId}:${e.messageKey}`);
};
const visibleIds = (flow: Parameters<typeof visibleSteps>[0], answers: AnswerMap) =>
  visibleSteps(flow, answers).map((s) => s.id);
const groupOf = (flow: { steps: QuestionStep[] }, id: string) => step(flow, id).screenGroup;

describe('etapa 6 — fluxurile pachetului B sunt inregistrate', () => {
  it('getFlow intoarce versiunile noi; cele vechi raman pe loc', () => {
    expect(getFlow('BATHROOM', 3)).toBe(bathroomFlowV3);
    expect(getFlow('LAUNDRY', 3)).toBe(laundryFlowV3);
    expect(getFlow('BALCONY', 3)).toBe(balconyFlowV3);
    expect(getFlow('PANTRY', 3)).toBe(pantryFlowV3);
    for (const rt of ['BATHROOM', 'LAUNDRY', 'BALCONY', 'PANTRY'] as const) {
      expect(getFlow(rt, 2).version).toBe(2);
      expect(getFlow(rt, 3).version).toBe(3);
    }
  });
});

describe('etapa 6 — baie v3', () => {
  const F = bathroomFlowV3;
  const base: AnswerMap = {
    piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET', 'TALL_STORAGE'],
    dimensions: { vanityWidth: 1, mirrorWidth: 0.8, tallStorageWidth: 0.4, ceilingHeight: 2.6 },
    ventilation: 'WINDOW',
  };

  it('pas de deschidere pe fiecare piesa, pe acelasi ecran cu materialul', () => {
    for (const [p, m, s] of [
      ['VANITY_UNIT', 'materialVanity', 'systemsVanity'],
      ['MIRROR_CABINET', 'materialMirror', 'systemsMirror'],
      ['TALL_STORAGE', 'materialTall', 'systemsTall'],
    ]) {
      expect(groupOf(F, m)).toBe(`piece:${p}`);
      expect(groupOf(F, s)).toBe(`piece:${p}`);
      expect(step(F, s)).toMatchObject({ type: 'multi-choice', minSelected: 1, titleKey: `flows.BATHROOM.v3.${s}.title` });
      expect(step(F, m).titleKey).toBe(`flows.BATHROOM.v3.${m}.title`);
      // fara pistoane la baie (N7); fara "fara usi" (piese YES)
      expect(optionValues(F, s)).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
    }
    expect(groupOf(F, 'piecesNeeded')).toBe('pieces');
    expect(groupOf(F, 'sameFinishAll')).toBe('pieces');
    const ids = visibleIds(F, { ...base, sameFinishAll: false });
    expect(ids).toEqual(expect.arrayContaining(['systemsVanity', 'systemsMirror', 'systemsTall']));
    // doar piesa bifata are ecranul ei
    const one = visibleIds(F, { piecesNeeded: ['MIRROR_CABINET'] });
    expect(one).toContain('systemsMirror');
    expect(one).not.toContain('systemsVanity');
    expect(one).not.toContain('sameFinishAll');
  });

  it('"Integral din MDF" → MDF + nota (fara "Corp: PAL standard")', () => {
    expect(optionValues(F, 'materialVanity')).toContain('MDF_INTEGRAL');
    expect(optionValues(F, 'materialAll')).toContain('MDF_INTEGRAL');
    const answers: AnswerMap = {
      ...base,
      sameFinishAll: false,
      materialVanity: 'MDF_INTEGRAL', systemsVanity: ['PUSH'],
      materialMirror: 'MDF_VOPSIT', systemsMirror: ['MANER'],
      materialTall: 'FIRM_DECIDES', systemsTall: ['FIRM_DECIDES'],
    };
    expect(errors('BATHROOM', answers, 3)).toEqual([]);
    const room = F.deriveRoom(answers);
    expect(room.items).toEqual([
      { name: 'Corp lavoar', material: 'MDF', systems: ['PUSH'], quantity: 1, description: INTEGRAL_MDF_NOTE },
      { name: 'Dulap oglindă', material: 'MDF_VOPSIT', systems: ['MANER'], quantity: 1, description: BODY_NOTE },
      { name: 'Coloană baie', material: 'ALTUL', systems: [], quantity: 1, description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}` },
    ]);
    expect(firmRecommendations('BATHROOM', answers, 3)).toEqual([{ itemName: 'Coloană baie', material: true, opening: true }]);
    expect(room.lengthM).toBeCloseTo(2.2);
  });

  it('"Recomandat" MDF infoliat la ventilation = NONE, pe piese si pe materialAll', () => {
    for (const id of ['materialVanity', 'materialMirror', 'materialTall', 'materialAll']) {
      expect(recommended(F, id)).toEqual(['MDF_INFOLIAT']);
      const opt = (step(F, id) as SingleChoiceStep).options.find((o) => o.value === 'MDF_INFOLIAT');
      expect(opt?.recommendedIf).toEqual({ questionId: 'ventilation', equals: 'NONE' });
    }
  });

  it('"Da" la intrebarea comuna → acelasi material si aceeasi deschidere pe toate piesele', () => {
    const answers: AnswerMap = { ...base, sameFinishAll: true, materialAll: 'MDF_INTEGRAL', systemsAll: ['MANER', 'PUSH'] };
    expect(errors('BATHROOM', answers, 3)).toEqual([]);
    expect(visibleIds(F, answers)).not.toContain('materialVanity');
    const items = F.deriveRoom(answers).items;
    expect(items).toHaveLength(3);
    for (const it of items) expect(it).toMatchObject({ material: 'MDF', systems: ['MANER', 'PUSH'], description: INTEGRAL_MDF_NOTE });
    // "Fara usi sau sertare" nu exista pe ecranul comun (toate piesele au fronturi)
    expect(optionValues(F, 'systemsAll')).not.toContain('NO_FRONTS');
  });

  it('valorile noi sunt respinse pe v2; deschiderea e obligatorie pe v3', () => {
    expect(errors('BATHROOM', { piecesNeeded: ['VANITY_UNIT'], materialVanity: 'FIRM_DECIDES' }, 2, true)).toEqual([
      'materialVanity:validation.optionInvalid',
    ]);
    expect(errors('BATHROOM', { piecesNeeded: ['VANITY_UNIT'], materialVanity: 'MDF_INTEGRAL' }, 2, true)).toEqual([
      'materialVanity:validation.optionInvalid',
    ]);
    expect(errors('BATHROOM', { piecesNeeded: ['VANITY_UNIT'], systemsVanity: ['PUSH'] }, 2, true)).toEqual([
      'systemsVanity:validation.unknownAnswer',
    ]);
    const missing = errors('BATHROOM', { ...base, piecesNeeded: ['VANITY_UNIT'], dimensions: { vanityWidth: 1, ceilingHeight: 2.6 }, materialVanity: 'PAL' }, 3);
    expect(missing).toEqual(['systemsVanity:validation.answerRequired']);
  });
});

describe('etapa 6 — spalatorie v3', () => {
  const F = laundryFlowV3;
  const base: AnswerMap = {
    applianceSetup: 'STACKED',
    piecesNeeded: ['STORAGE', 'COUNTERTOP'],
    ventilation: 'NONE',
    dimensions: { runA: 2, ceilingHeight: 2.6 },
  };

  it('blatul: setul de blaturi, fara deschidere, fara "Recomandat"; HPL → ALTUL + "Blat: HPL"', () => {
    expect(F.steps.some((s) => s.id === 'systemsCountertop')).toBe(false);
    expect(optionValues(F, 'materialCountertop')).toEqual([
      'WORKTOP_PAL_POSTFORMED', 'WORKTOP_HPL', 'WORKTOP_HPL_COMPACT', 'WORKTOP_QUARTZ', 'WORKTOP_SOLID_WOOD', 'FIRM_DECIDES',
    ]);
    expect(recommended(F, 'materialCountertop')).toEqual([]);
    expect(groupOf(F, 'materialCountertop')).toBe('piece:COUNTERTOP');
    expect(F.steps.some((s) => s.id === 'materialCountertopOther')).toBe(false);
    const answers: AnswerMap = { ...base, materialStorage: 'PAL', systemsStorage: ['MANER'], materialCountertop: 'WORKTOP_HPL' };
    expect(errors('LAUNDRY', answers, 3)).toEqual([]);
    expect(F.deriveRoom(answers).items).toEqual([
      { name: 'Dulapuri depozitare', material: 'PAL', systems: ['MANER'], quantity: 1, description: BODY_NOTE },
      { name: 'Blat de lucru', material: 'ALTUL', systems: [], quantity: 1, description: WORKTOP_NOTES.WORKTOP_HPL },
    ]);
    expect(WORKTOP_NOTES.WORKTOP_HPL).toBe('Blat: HPL');
    // o singura piesa comuna → fara intrebarea comuna
    expect(visibleIds(F, answers)).not.toContain('sameFinishAll');
  });

  it('celelalte piese pastreaza "Recomandat" MDF infoliat la ventilation = NONE; fara "Integral din MDF"', () => {
    for (const id of ['materialApplianceHousing', 'materialStorage', 'materialSinkUnit', 'materialAll']) {
      expect(recommended(F, id)).toEqual(['MDF_INFOLIAT']);
      expect(optionValues(F, id)).not.toContain('MDF_INTEGRAL');
    }
    for (const id of ['systemsApplianceHousing', 'systemsStorage', 'systemsSinkUnit']) {
      expect(groupOf(F, id)).toBe(`piece:${id === 'systemsApplianceHousing' ? 'APPLIANCE_HOUSING' : id === 'systemsStorage' ? 'STORAGE' : 'SINK_UNIT'}`);
      expect(optionValues(F, id)).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
    }
    expect(errors('LAUNDRY', { piecesNeeded: ['STORAGE'], materialStorage: 'MDF_INTEGRAL' }, 3, true)).toEqual([
      'materialStorage:validation.optionInvalid',
    ]);
  });

  it('intrebarea comuna: blatul isi pastreaza ecranul', () => {
    const answers: AnswerMap = {
      ...base,
      piecesNeeded: ['APPLIANCE_HOUSING', 'SINK_UNIT', 'COUNTERTOP'],
      sameFinishAll: true, materialAll: 'MDF_INFOLIAT', systemsAll: ['PUSH'], materialCountertop: 'FIRM_DECIDES',
    };
    expect(errors('LAUNDRY', answers, 3)).toEqual([]);
    const room = F.deriveRoom(answers);
    expect(room.items).toEqual([
      { name: 'Dulap încastrare electrocasnice', material: 'MDF_INFOLIAT', systems: ['PUSH'], quantity: 1, description: BODY_NOTE },
      { name: 'Blat de lucru', material: 'ALTUL', systems: [], quantity: 1, description: WORKTOP_NOTES.FIRM_DECIDES },
      { name: 'Corp cu cuvă', material: 'MDF_INFOLIAT', systems: ['PUSH'], quantity: 1, description: BODY_NOTE },
    ]);
    expect(room.firmRecommendations).toEqual([{ itemName: 'Blat de lucru', material: true, opening: false }]);
  });

  it('v2 respinge valorile blatului nou', () => {
    expect(errors('LAUNDRY', { piecesNeeded: ['COUNTERTOP'], materialCountertop: 'WORKTOP_HPL' }, 2, true)).toEqual([
      'materialCountertop:validation.optionInvalid',
    ]);
  });
});

describe('etapa 6 — balcon v3', () => {
  const F = balconyFlowV3;
  const base: AnswerMap = {
    enclosed: 'OPEN',
    piecesNeeded: ['STORAGE_BENCH', 'TALL_CABINET', 'WORKTOP', 'SHELVES'],
    dimensions: { balconyLength: 3, balconyDepth: 1, ceilingHeight: 2.6 },
  };

  it('fara systemsWorktop / systemsShelves; blat WORKTOP, rafturi PANEL', () => {
    expect(F.steps.some((s) => s.id === 'systemsWorktop' || s.id === 'systemsShelves')).toBe(false);
    expect(optionValues(F, 'materialWorktop')[0]).toBe('WORKTOP_PAL_POSTFORMED');
    expect(optionValues(F, 'materialShelves')).toEqual(['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL', 'FIRM_DECIDES']);
    expect(step(F, 'materialShelves').subtitleKey).toBe('common.finish.panelMaterial.subtitle');
  });

  it('"Integral din MDF" la banca si dulap; banca poate fi "Fara usi sau sertare"', () => {
    expect(optionValues(F, 'materialStorageBench')).toContain('MDF_INTEGRAL');
    expect(optionValues(F, 'materialTallCabinet')).toContain('MDF_INTEGRAL');
    expect(optionValues(F, 'materialShelves')).not.toContain('MDF_INTEGRAL');
    expect(optionValues(F, 'systemsStorageBench')).toEqual(['MANER', 'PUSH', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(optionValues(F, 'systemsTallCabinet')).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
    const answers: AnswerMap = {
      ...base,
      sameFinishAll: false,
      materialStorageBench: 'LEMN_MASIV', systemsStorageBench: ['NO_FRONTS'],
      materialTallCabinet: 'MDF_INTEGRAL', systemsTallCabinet: ['MANER'],
      materialWorktop: 'WORKTOP_HPL_COMPACT',
      materialShelves: 'ALTUL', materialShelvesOther: 'lemn tratat',
    };
    expect(errors('BALCONY', answers, 3)).toEqual([]);
    expect(F.deriveRoom(answers).items).toEqual([
      { name: 'Bancă cu ladă', material: 'LEMN_MASIV', systems: [], quantity: 1, description: NO_FRONTS_NOTE },
      { name: 'Dulap balcon', material: 'MDF', systems: ['MANER'], quantity: 1, description: INTEGRAL_MDF_NOTE },
      { name: 'Blat de lucru', material: 'ALTUL', systems: [], quantity: 1, description: WORKTOP_NOTES.WORKTOP_HPL_COMPACT },
      { name: 'Rafturi balcon', material: 'ALTUL', systems: [], quantity: 1, description: 'Material dorit: lemn tratat' },
    ]);
    // "fara usi" se alege singura
    expect(errors('BALCONY', { ...answers, systemsStorageBench: ['MANER', 'NO_FRONTS'] }, 3)).toEqual([
      'systemsStorageBench:validation.exclusiveOption',
    ]);
  });

  it('"Recomandat" lemn masiv la balcon deschis pe BODY / PANEL, nu pe blat', () => {
    for (const id of ['materialStorageBench', 'materialTallCabinet', 'materialShelves', 'materialAll']) {
      expect(recommended(F, id)).toEqual(['LEMN_MASIV']);
    }
    expect(recommended(F, 'materialWorktop')).toEqual([]);
  });

  it('intrebarea comuna: banca + dulap; "fara usi" ascunsa pe ecranul comun cand dulapul e bifat', () => {
    const answers: AnswerMap = {
      ...base, sameFinishAll: true, materialAll: 'PAL', systemsAll: ['PUSH'],
      materialWorktop: 'WORKTOP_QUARTZ', materialShelves: 'PAL',
    };
    expect(errors('BALCONY', answers, 3)).toEqual([]);
    expect(errors('BALCONY', { ...answers, systemsAll: ['NO_FRONTS'] }, 3)).toEqual(['systemsAll:validation.optionInvalid']);
    // doar banca + rafturi → o singura piesa comuna, fara intrebare comuna
    expect(visibleIds(F, { ...base, piecesNeeded: ['STORAGE_BENCH', 'SHELVES'] })).not.toContain('sameFinishAll');
  });
});

describe('etapa 6 — debara v3', () => {
  const F = pantryFlowV3;
  const base: AnswerMap = { wallsUsed: 'L_SHAPE', dimensions: { runA: 1.5, runB: 1, ceilingHeight: 2.6 } };

  it('material + deschidere pe acelasi ecran `piece:CABINETS`; rafturile fara deschidere; fara intrebare comuna', () => {
    expect(groupOf(F, 'materialCabinets')).toBe('piece:CABINETS');
    expect(groupOf(F, 'materialCabinetsOther')).toBe('piece:CABINETS');
    expect(groupOf(F, 'systemsCabinets')).toBe('piece:CABINETS');
    expect(groupOf(F, 'materialShelves')).toBe('piece:SHELVES');
    expect(F.steps.some((s) => s.id === 'systemsShelves' || s.id === 'sameFinishAll' || s.id === 'materialAll')).toBe(false);
    expect(step(F, 'materialCabinets').titleKey).toBe('flows.PANTRY.v3.materialCabinets.title');
    expect(step(F, 'systemsCabinets').titleKey).toBe('flows.PANTRY.systemsCabinets.title');
    expect(optionValues(F, 'materialCabinets')).not.toContain('MDF_INTEGRAL');
  });

  it('zonele vin din storageStyle', () => {
    expect(visibleIds(F, { ...base, storageStyle: 'OPEN_SHELVES' })).not.toContain('materialCabinets');
    expect(visibleIds(F, { ...base, storageStyle: 'CLOSED_CABINETS' })).not.toContain('materialShelves');
    const answers: AnswerMap = {
      ...base, storageStyle: 'MIXED',
      materialShelves: 'PAL', materialCabinets: 'MDF_INFOLIAT', systemsCabinets: ['FIRM_DECIDES'],
    };
    expect(errors('PANTRY', answers, 3)).toEqual([]);
    const room = F.deriveRoom(answers);
    expect(room.items).toEqual([
      { name: 'Rafturi debara', material: 'PAL', systems: [], quantity: 1 },
      { name: 'Dulapuri debara', material: 'MDF_INFOLIAT', systems: [], quantity: 1, description: `${BODY_NOTE}; ${FIRM_OPENING_NOTE}` },
    ]);
    expect(room.firmRecommendations).toEqual([{ itemName: 'Dulapuri debara', material: false, opening: true }]);
    expect(room.lengthM).toBeCloseTo(2.5);
  });

  it('v2 respinge "decide firma" la deschiderea dulapurilor', () => {
    expect(errors('PANTRY', { storageStyle: 'CLOSED_CABINETS', systemsCabinets: ['FIRM_DECIDES'] }, 2, true)).toEqual([
      'systemsCabinets:validation.optionInvalid',
    ]);
  });
});
