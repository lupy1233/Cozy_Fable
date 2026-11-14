import { describe, expect, it } from 'vitest';
import type { RoomType } from '../../enums';
import {
  collectScoreEntries,
  firmRecommendations,
  getFlow,
  pruneAnswers,
  summarizeAnswers,
  validateRoomAnswers,
  visibleOptions,
  visibleSteps,
} from '../engine';
import type { AnswerMap, DimensionGroupStep, QuestionStep, ScoreEntry, SingleChoiceStep } from '../types';
import { balconyFlowV3 } from './balcony.v3';
import { balconyFlowV4 } from './balcony.v4';
import { bathroomFlowV3 } from './bathroom.v3';
import { basinNote, bathroomFlowV4 } from './bathroom.v4';
import { BODY_NOTE, FIRM_MATERIAL_NOTE, INTEGRAL_MDF_NOTE } from './finish-sets';
import { CURRENT_FLOW_VERSION, ETAPA10_FLOW_VERSION } from './index';
import { laundryFlowV3 } from './laundry.v3';
import { laundryFlowV4 } from './laundry.v4';
import { FIRM_DECIDES_NOTE_TEXT } from './measure-sets';
import { pantryFlowV3 } from './pantry.v3';
import { pantryFlowV4 } from './pantry.v4';

// Etapa 10, pachetul rooms-b (DESIGN §5.0, §5.6–§5.9, §7c, §10): baie v4, spalatorie v4, balcon v4, debara v4.

type Flow = Parameters<typeof visibleSteps>[0];
const step = (flow: { steps: QuestionStep[] }, id: string) => flow.steps.find((s) => s.id === id) as QuestionStep;
const errors = (roomType: RoomType, answers: AnswerMap, version: number, partial = false) => {
  const r = validateRoomAnswers(roomType, answers, { partial, version });
  return r.ok ? [] : r.errors.map((e) => `${e.stepId}:${e.messageKey}`);
};
const visibleIds = (flow: Flow, answers: AnswerMap) => visibleSteps(flow, answers).map((s) => s.id);
const slotsOf = (flow: { steps: QuestionStep[] }, answers: AnswerMap) =>
  (step(flow, 'dimensions') as DimensionGroupStep).slots(answers);
const slotIds = (flow: { steps: QuestionStep[] }, answers: AnswerMap) => slotsOf(flow, answers).map((s) => s.id);
const roomSize = (roomType: RoomType, answers: AnswerMap, version: number) =>
  (collectScoreEntries(roomType, answers, version).find((e) => e.category === 'ROOM_SIZE') as Extract<
    ScoreEntry,
    { optionKey: string }
  >).optionKey;
const visibleOptionValues = (flow: Flow, id: string, answers: AnswerMap) =>
  visibleOptions(step(flow, id) as SingleChoiceStep, answers).map((o) => o.value);

const ROOMS = ['BATHROOM', 'LAUNDRY', 'BALCONY', 'PANTRY'] as const;

describe('etapa 10 — rooms-b: versiunile noi sunt inregistrate, cele vechi raman pe loc', () => {
  it('getFlow(…, 4) intoarce fluxurile noi; v3 si v2 neschimbate; versiunea curenta nu s-a mutat', () => {
    expect(getFlow('BATHROOM', 4)).toBe(bathroomFlowV4);
    expect(getFlow('LAUNDRY', 4)).toBe(laundryFlowV4);
    expect(getFlow('BALCONY', 4)).toBe(balconyFlowV4);
    expect(getFlow('PANTRY', 4)).toBe(pantryFlowV4);
    for (const rt of ROOMS) {
      expect(ETAPA10_FLOW_VERSION[rt]).toBe(4);
      expect(getFlow(rt, 4).roomType).toBe(rt);
      expect(getFlow(rt, 3).version).toBe(3);
      expect(getFlow(rt, 2).version).toBe(2);
      // etapa 10 (valul 2): comutarea s-a facut
      expect(CURRENT_FLOW_VERSION[rt]).toBe(4);
    }
  });

  it('v4 nu imparte obiecte de pas cu v3 (v3 nu poate fi modificat prin v4)', () => {
    const pairs = [
      [bathroomFlowV3, bathroomFlowV4],
      [laundryFlowV3, laundryFlowV4],
      [balconyFlowV3, balconyFlowV4],
      [pantryFlowV3, pantryFlowV4],
    ] as const;
    for (const [v3, v4] of pairs) {
      for (const s of v4.steps) expect(v3.steps).not.toContain(s);
      expect(v4.deriveRoom).not.toBe(v3.deriveRoom);
    }
  });
});

describe('etapa 10 — baie v4 (lavoarul, E10-N9; masurile, c5)', () => {
  const F = bathroomFlowV4;
  const vanityOnly: AnswerMap = {
    piecesNeeded: ['VANITY_UNIT'],
    dimensions: { vanityWidth: 1 },
    ventilation: 'WINDOW',
    materialVanity: 'PAL',
    systemsVanity: ['MANER'],
  };

  it('lavoarul: doua intrebari optionale pe ecranul `piece:VANITY_UNIT:details`, cu "Nu stiu" la final', () => {
    for (const id of ['basinType', 'basinSupply']) {
      expect(step(F, id)).toMatchObject({ type: 'single-choice', optional: true, screenGroup: 'piece:VANITY_UNIT:details' });
    }
    expect((step(F, 'basinType') as SingleChoiceStep).options.map((o) => o.value)).toEqual([
      'COUNTERTOP_BASIN', 'INSET_BASIN', 'INTEGRATED_BASIN', 'FIRM_DECIDES',
    ]);
    expect((step(F, 'basinSupply') as SingleChoiceStep).options.map((o) => o.value)).toEqual(['CLIENT', 'FIRM', 'FIRM_DECIDES']);
    expect(step(F, 'basinType').titleKey).toBe('flows.BATHROOM.v4.basinType.title');
    expect((step(F, 'basinType') as SingleChoiceStep).options[1].labelKey).toBe('flows.BATHROOM.v4.basinType.options.INSET_BASIN.label');
    expect((step(F, 'basinSupply') as SingleChoiceStep).options[2].scoring).toEqual({ category: 'BATHROOM_BASIN_SUPPLY', optionKey: 'FIRM_DECIDES' });
    // ecranul de detalii vine imediat dupa ecranul piesei
    const ids = F.steps.map((s) => s.id);
    expect(ids.indexOf('basinType')).toBe(ids.indexOf('systemsVanity') + 1);
    expect(ids.indexOf('basinSupply')).toBe(ids.indexOf('basinType') + 1);
    // doar cu lavoarul bifat; vizibile si la "Da" la intrebarea comuna
    expect(visibleIds(F, { piecesNeeded: ['MIRROR_CABINET'] })).not.toContain('basinType');
    expect(visibleIds(F, vanityOnly)).toEqual(expect.arrayContaining(['basinType', 'basinSupply']));
    expect(
      visibleIds(F, { piecesNeeded: ['VANITY_UNIT', 'TALL_STORAGE'], sameFinishAll: true }),
    ).toEqual(expect.arrayContaining(['basinType', 'basinSupply']));
    // optionale: se poate publica fara ele
    expect(errors('BATHROOM', vanityOnly, 4)).toEqual([]);
  });

  it('lavoarul ajunge in descrierea "Corp lavoar"; "Nu stiu" = nota', () => {
    const derive = (a: AnswerMap) => F.deriveRoom({ ...vanityOnly, ...a }).items[0];
    expect(errors('BATHROOM', { ...vanityOnly, basinType: 'INSET_BASIN', basinSupply: 'CLIENT' }, 4)).toEqual([]);
    expect(derive({ basinType: 'INSET_BASIN', basinSupply: 'CLIENT' })).toEqual({
      name: 'Corp lavoar', material: 'PAL', systems: ['MANER'], quantity: 1,
      description: `${BODY_NOTE}; Lavoar: încastrat în blat, adus de client`,
    });
    // nota e UNA singura (fara "; " in interior) — revizuirea m2
    expect(derive({ basinType: 'COUNTERTOP_BASIN', basinSupply: 'FIRM' }).description).toBe(`${BODY_NOTE}; Lavoar: pe blat, adus de firmă`);
    expect(derive({ basinType: 'FIRM_DECIDES', basinSupply: 'FIRM_DECIDES' }).description).toBe(
      `${BODY_NOTE}; Lavoar: ${FIRM_DECIDES_NOTE_TEXT}`,
    );
    // fara raspuns → descrierea de azi
    expect(derive({}).description).toBe(BODY_NOTE);
    // cu "Integral din MDF" si material "decide firma": nota se adauga dupa notele etapei 6
    const room = F.deriveRoom({
      ...vanityOnly, piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET'],
      dimensions: { vanityWidth: 1, mirrorWidth: 0.8, ceilingHeight: 2.6 }, sameFinishAll: false,
      materialVanity: 'MDF_INTEGRAL', materialMirror: 'FIRM_DECIDES', systemsMirror: ['PUSH'], basinType: 'INSET_BASIN',
    });
    expect(room.items[0].description).toBe(`${INTEGRAL_MDF_NOTE}; Lavoar: încastrat în blat`);
    expect(room.items[1]).toMatchObject({ name: 'Dulap oglindă', description: FIRM_MATERIAL_NOTE });
    // intrebarile noi nu intra in insigna "Recomandarea firmei" (E10-N22)
    expect(firmRecommendations('BATHROOM', { ...vanityOnly, basinType: 'FIRM_DECIDES' }, 4)).toEqual([]);
  });

  it('raspunsurile despre lavoar: respinse fara lavoar, pe v3 si cu valori necunoscute; curatate la debifare', () => {
    expect(errors('BATHROOM', { piecesNeeded: ['MIRROR_CABINET'], basinType: 'INSET_BASIN' }, 4, true)).toEqual([
      'basinType:validation.unknownAnswer',
    ]);
    expect(errors('BATHROOM', { piecesNeeded: ['VANITY_UNIT'], basinType: 'INSET_BASIN' }, 3, true)).toEqual([
      'basinType:validation.unknownAnswer',
    ]);
    expect(errors('BATHROOM', { piecesNeeded: ['VANITY_UNIT'], basinSupply: 'NEIGHBOUR' }, 4, true)).toEqual([
      'basinSupply:validation.optionInvalid',
    ]);
    const pruned = pruneAnswers(F, { ...vanityOnly, piecesNeeded: ['MIRROR_CABINET'], basinType: 'INSET_BASIN', basinSupply: 'FIRM' });
    expect(pruned.basinType).toBeUndefined();
    expect(pruned.basinSupply).toBeUndefined();
  });

  it('scorul: intrarile noi (0 puncte) apar doar cand sunt alese', () => {
    const entries = collectScoreEntries('BATHROOM', { ...vanityOnly, basinType: 'INSET_BASIN', basinSupply: 'FIRM_DECIDES' }, 4);
    expect(entries).toEqual(expect.arrayContaining([
      { category: 'BATHROOM_BASIN_TYPE', optionKey: 'INSET_BASIN' },
      { category: 'BATHROOM_BASIN_SUPPLY', optionKey: 'FIRM_DECIDES' },
    ]));
    expect(collectScoreEntries('BATHROOM', vanityOnly, 4).some((e) => e.category.startsWith('BATHROOM_BASIN'))).toBe(false);
  });

  it('tavanul doar cu dulapul cu oglinda / coloana; inaltimea lor optionala, cu valoarea tipica', () => {
    expect(slotIds(F, { piecesNeeded: ['VANITY_UNIT'] })).toEqual(['vanityWidth']);
    expect(errors('BATHROOM', vanityOnly, 4)).toEqual([]);
    expect(slotIds(F, { piecesNeeded: ['TALL_STORAGE', 'VANITY_UNIT', 'MIRROR_CABINET'] })).toEqual([
      'vanityWidth', 'mirrorWidth', 'mirrorHeight', 'tallStorageWidth', 'tallStorageHeight', 'ceilingHeight',
    ]);
    const slots = slotsOf(F, { piecesNeeded: ['MIRROR_CABINET', 'TALL_STORAGE'] });
    expect(slots.find((s) => s.id === 'mirrorHeight')).toMatchObject({ optional: true, min: 0.4, max: 1.2, typicalM: 0.7 });
    expect(slots.find((s) => s.id === 'tallStorageHeight')).toMatchObject({ optional: true, min: 1.2, max: 2.4, typicalM: 1.8 });
    expect(slots.find((s) => s.id === 'mirrorHeight')?.countsTowardLinear).toBeUndefined();
    expect(slots.find((s) => s.id === 'ceilingHeight')?.optional).toBeUndefined();
    expect(step(F, 'dimensions').subtitleKey).toBe('flows.BATHROOM.v4.dimensions.subtitle');
    expect(step(F, 'dimensions').titleKey).toBe('flows.BATHROOM.dimensions.title');
    // cu coloana: tavanul obligatoriu, inaltimea coloanei nu
    const tall: AnswerMap = {
      piecesNeeded: ['TALL_STORAGE'], ventilation: 'FAN', materialTall: 'PAL', systemsTall: ['PUSH'],
      dimensions: { tallStorageWidth: 0.4 },
    };
    expect(errors('BATHROOM', tall, 4)).toEqual(['dimensions:validation.dimensionRequired']);
    expect(errors('BATHROOM', { ...tall, dimensions: { tallStorageWidth: 0.4, ceilingHeight: 2.6 } }, 4)).toEqual([]);
    expect(errors('BATHROOM', { ...tall, dimensions: { tallStorageWidth: 0.4, tallStorageHeight: 3, ceilingHeight: 2.6 } }, 4)).toEqual([
      'dimensions:validation.dimensionOutOfRange',
    ]);
    // inaltimea nu intra in marime; fara tavan → inaltimea camerei implicita
    const room = F.deriveRoom({ ...vanityOnly, dimensions: { vanityWidth: 1.2 } });
    expect(room.lengthM).toBeCloseTo(1.2);
    expect(F.deriveRoom({ ...tall, dimensions: { tallStorageWidth: 0.4, tallStorageHeight: 2, ceilingHeight: 2.6 } }).lengthM).toBeCloseTo(0.4);
    // rezumatul: inaltimea lasata goala apare la "missing", cu valoarea tipica
    const summary = summarizeAnswers('BATHROOM', { ...tall, dimensions: { tallStorageWidth: 0.4, ceilingHeight: 2.6 } }, 4);
    const dims = summary.find((e) => e.kind === 'dimensions');
    expect(dims).toMatchObject({ missing: [{ labelKey: 'flows.BATHROOM.dimensions.slots.tallStorageHeight', typicalM: 1.8 }] });
  });
});

describe('etapa 10 — spalatorie v4 (incarcarea, E10-N10; aparatele in descriere, E10-N5; masurile, c5)', () => {
  const F = laundryFlowV4;
  const base: AnswerMap = {
    applianceSetup: 'STACKED',
    piecesNeeded: ['APPLIANCE_HOUSING', 'COUNTERTOP'],
    ventilation: 'WINDOW',
    dimensions: { runA: 3, applianceHousingWidth: 0.7, countertopWidth: 1.2, ceilingHeight: 2.6 },
    materialApplianceHousing: 'PAL',
    systemsApplianceHousing: ['MANER'],
    materialCountertop: 'WORKTOP_HPL',
  };

  it('`washerLoading`: optional, pe ecranul aparatelor; "De sus" dispare la aparate suprapuse', () => {
    expect(step(F, 'washerLoading')).toMatchObject({ type: 'single-choice', optional: true, screenGroup: 'applianceScreen' });
    expect(step(F, 'applianceSetup').screenGroup).toBe('applianceScreen');
    expect((step(F, 'washerLoading') as SingleChoiceStep).options.map((o) => o.value)).toEqual(['FRONT', 'TOP', 'FIRM_DECIDES']);
    expect(visibleOptionValues(F, 'washerLoading', { applianceSetup: 'STACKED' })).toEqual(['FRONT', 'FIRM_DECIDES']);
    expect(visibleOptionValues(F, 'washerLoading', { applianceSetup: 'WASHER_ONLY' })).toEqual(['FRONT', 'TOP', 'FIRM_DECIDES']);
    expect(visibleOptionValues(F, 'washerLoading', { applianceSetup: 'SIDE_BY_SIDE' })).toEqual(['FRONT', 'TOP', 'FIRM_DECIDES']);
    expect(errors('LAUNDRY', { ...base, washerLoading: 'TOP' }, 4)).toEqual(['washerLoading:validation.optionInvalid']);
    expect(errors('LAUNDRY', { ...base, applianceSetup: 'WASHER_ONLY', washerLoading: 'TOP' }, 4)).toEqual([]);
    expect(errors('LAUNDRY', base, 4)).toEqual([]);
    // pruneAnswers scoate "De sus" cand clientul trece la aparate suprapuse
    expect(pruneAnswers(F, { ...base, washerLoading: 'TOP' }).washerLoading).toBeUndefined();
    // pe v3 intrebarea nu exista
    expect(errors('LAUNDRY', { applianceSetup: 'WASHER_ONLY', washerLoading: 'FRONT' }, 3, true)).toEqual([
      'washerLoading:validation.unknownAnswer',
    ]);
  });

  it('aparatele si incarcarea: pe "Dulap încastrare electrocasnice", altfel pe prima piesa', () => {
    const items = F.deriveRoom({ ...base, washerLoading: 'FRONT' }).items;
    expect(items[0]).toEqual({
      name: 'Dulap încastrare electrocasnice', material: 'PAL', systems: ['MANER'], quantity: 1,
      description: `${BODY_NOTE}; Aparate: mașină de spălat și uscător suprapuse; Încărcare: frontală`,
    });
    expect(items[1]).toEqual({ name: 'Blat de lucru', material: 'ALTUL', systems: [], quantity: 1, description: 'Blat: HPL' });
    // fara dulapul de electrocasnice → prima piesa (blatul)
    const noHousing: AnswerMap = {
      ...base, applianceSetup: 'SIDE_BY_SIDE', washerLoading: 'TOP', piecesNeeded: ['COUNTERTOP', 'STORAGE'],
      dimensions: { runA: 3, storageWidth: 1, countertopWidth: 1.5, ceilingHeight: 2.6 },
      materialStorage: 'PAL', systemsStorage: ['PUSH'],
    };
    delete noHousing.materialApplianceHousing;
    delete noHousing.systemsApplianceHousing;
    expect(errors('LAUNDRY', noHousing, 4)).toEqual([]);
    const items2 = F.deriveRoom(noHousing).items;
    expect(items2.map((i) => i.name)).toEqual(['Dulapuri depozitare', 'Blat de lucru']);
    expect(items2[0].description).toBe(`${BODY_NOTE}; Aparate: mașină de spălat și uscător alăturate; Încărcare: de sus`);
    expect(items2[1].description).toBe('Blat: HPL');
    // fara raspuns la incarcare → doar aparatele; "Nu stiu" → nota
    expect(F.deriveRoom({ ...base, applianceSetup: 'WASHER_ONLY' }).items[0].description).toBe(
      `${BODY_NOTE}; Aparate: doar mașină de spălat`,
    );
    expect(F.deriveRoom({ ...base, washerLoading: 'FIRM_DECIDES' }).items[0].description).toBe(
      `${BODY_NOTE}; Aparate: mașină de spălat și uscător suprapuse; Încărcare: clientul vrea recomandarea firmei`,
    );
  });

  it('marimea = suma latimilor pieselor; peretele obligatoriu, dar doar informativ', () => {
    expect(slotIds(F, base)).toEqual(['runA', 'applianceHousingWidth', 'applianceHousingHeight', 'countertopWidth', 'ceilingHeight']);
    const runA = slotsOf(F, base).find((s) => s.id === 'runA');
    expect(runA).toMatchObject({ min: 0.8, max: 6 });
    expect(runA?.countsTowardLinear).toBeUndefined();
    expect(runA?.optional).toBeUndefined();
    expect(F.deriveRoom(base).lengthM).toBeCloseTo(1.9);
    expect(errors('LAUNDRY', { ...base, dimensions: { applianceHousingWidth: 0.7, countertopWidth: 1.2, ceilingHeight: 2.6 } }, 4)).toEqual([
      'dimensions:validation.dimensionRequired',
    ]);
    // valoarea tipica a dulapului de electrocasnice depinde de amplasare
    const typical = (setup: string) =>
      slotsOf(F, { ...base, applianceSetup: setup }).find((s) => s.id === 'applianceHousingHeight')?.typicalM;
    expect(typical('STACKED')).toBe(1.9);
    expect(typical('SIDE_BY_SIDE')).toBe(0.9);
    // toate piesele, in ordinea lor; inaltimea depozitarii fara valoare tipica
    const all = slotsOf(F, { ...base, piecesNeeded: ['SINK_UNIT', 'COUNTERTOP', 'STORAGE', 'APPLIANCE_HOUSING'] });
    expect(all.map((s) => s.id)).toEqual([
      'runA', 'applianceHousingWidth', 'applianceHousingHeight', 'storageWidth', 'storageHeight', 'countertopWidth', 'sinkUnitWidth', 'ceilingHeight',
    ]);
    expect(all.find((s) => s.id === 'storageHeight')).toMatchObject({ optional: true, min: 0.6, max: 2.6 });
    expect(all.find((s) => s.id === 'storageHeight')?.typicalM).toBeUndefined();
    expect(all.find((s) => s.id === 'sinkUnitWidth')).toMatchObject({ min: 0.4, max: 1.2, countsTowardLinear: true });
  });

  it('tavanul doar cu dulapul de electrocasnice / depozitare; exemplul F din §7e (perete 3 m, doar dulap 0,7 m)', () => {
    expect(slotIds(F, { ...base, piecesNeeded: ['COUNTERTOP', 'SINK_UNIT'] })).toEqual(['runA', 'countertopWidth', 'sinkUnitWidth']);
    const onlyHousing: AnswerMap = {
      ...base, piecesNeeded: ['APPLIANCE_HOUSING'], dimensions: { runA: 3, applianceHousingWidth: 0.7, ceilingHeight: 2.6 },
    };
    delete onlyHousing.materialCountertop;
    expect(errors('LAUNDRY', onlyHousing, 4)).toEqual([]);
    expect(roomSize('LAUNDRY', onlyHousing, 4)).toBe('UNDER_2M');
    // pe v3, acelasi perete de 3 m da marimea
    expect(roomSize('LAUNDRY', { ...onlyHousing, dimensions: { runA: 3, ceilingHeight: 2.6 } }, 3)).toBe('FROM_2_TO_4M');
    expect(collectScoreEntries('LAUNDRY', { ...onlyHousing, washerLoading: 'FRONT' }, 4)).toEqual(
      expect.arrayContaining([{ category: 'LAUNDRY_LOADING', optionKey: 'FRONT' }]),
    );
  });
});

describe('etapa 10 — balcon v4 (marimea din latimea pieselor, c5-3 / d3)', () => {
  const F = balconyFlowV4;
  const oneShelf: AnswerMap = {
    enclosed: 'ENCLOSED',
    piecesNeeded: ['SHELVES'],
    dimensions: { balconyLength: 6, balconyDepth: 1, shelvesWidth: 1 },
    materialShelves: 'PAL',
  };
  const furnished: AnswerMap = {
    enclosed: 'ENCLOSED',
    piecesNeeded: ['STORAGE_BENCH', 'TALL_CABINET', 'WORKTOP', 'SHELVES'],
    dimensions: { balconyLength: 6, balconyDepth: 1, storageBenchWidth: 2, tallCabinetWidth: 1, worktopWidth: 2, shelvesWidth: 1, ceilingHeight: 2.5 },
    sameFinishAll: false,
    materialStorageBench: 'PAL', systemsStorageBench: ['MANER'],
    materialTallCabinet: 'PAL', systemsTallCabinet: ['MANER'],
    materialWorktop: 'WORKTOP_PAL_POSTFORMED',
    materialShelves: 'PAL',
  };

  it('test de scor: un raft de 1 m pe un balcon de 6 m e mai mic decat balconul mobilat pe aceeasi lungime', () => {
    expect(errors('BALCONY', oneShelf, 4)).toEqual([]);
    expect(errors('BALCONY', furnished, 4)).toEqual([]);
    expect(roomSize('BALCONY', oneShelf, 4)).toBe('UNDER_2M');
    expect(roomSize('BALCONY', furnished, 4)).toBe('OVER_4M');
    expect(F.deriveRoom(oneShelf).lengthM).toBeCloseTo(1);
    expect(F.deriveRoom(furnished).lengthM).toBeCloseTo(6);
    // pe v3 acelasi raft costa cat balconul (marimea vine din lungimea balconului) — neschimbat
    const v3Shelf: AnswerMap = { ...oneShelf, dimensions: { balconyLength: 6, balconyDepth: 1, ceilingHeight: 2.5 } };
    expect(errors('BALCONY', v3Shelf, 3)).toEqual([]);
    expect(roomSize('BALCONY', v3Shelf, 3)).toBe('OVER_4M');
    // sloturile pieselor nu exista pe v3
    expect(errors('BALCONY', { ...v3Shelf, dimensions: { ...(v3Shelf.dimensions as object), shelvesWidth: 1 } }, 3)).toEqual([
      'dimensions:validation.unknownAnswer',
    ]);
  });

  it('balconul ramane in fisa (lungime, adancime), dar nu mai intra in marime', () => {
    const slots = slotsOf(F, oneShelf);
    expect(slots.map((s) => s.id)).toEqual(['balconyLength', 'balconyDepth', 'shelvesWidth']);
    for (const id of ['balconyLength', 'balconyDepth']) {
      const s = slots.find((x) => x.id === id);
      expect(s?.countsTowardLinear).toBeUndefined();
      expect(s?.optional).toBeUndefined();
    }
    expect(slots.find((s) => s.id === 'balconyDepth')).toMatchObject({ min: 0.4, max: 2.5, step: 0.05 });
    // obligatorii la publicare
    expect(errors('BALCONY', { ...oneShelf, dimensions: { balconyDepth: 1, shelvesWidth: 1 } }, 4)).toEqual([
      'dimensions:validation.dimensionRequired',
    ]);
    // apar in rezumat (fisa firmei), cu valorile date
    const dims = summarizeAnswers('BALCONY', oneShelf, 4).find((e) => e.kind === 'dimensions');
    expect(dims).toMatchObject({
      slots: [
        { labelKey: 'flows.BALCONY.dimensions.slots.balconyLength', value: 6 },
        { labelKey: 'flows.BALCONY.dimensions.slots.balconyDepth', value: 1 },
        { labelKey: 'flows.BALCONY.dimensions.slots.shelvesWidth', value: 1 },
      ],
    });
    // adancimea mobilierului: ca in v3
    expect(F.deriveRoom(oneShelf).widthM).toBeCloseTo(0.6);
    expect(F.deriveRoom({ ...oneShelf, dimensions: { balconyLength: 6, balconyDepth: 0.45, shelvesWidth: 1 } }).widthM).toBeCloseTo(0.45);
  });

  it('tavanul si inaltimea optionala doar cu dulapul', () => {
    expect(slotIds(F, furnished)).toEqual([
      'balconyLength', 'balconyDepth', 'storageBenchWidth', 'tallCabinetWidth', 'tallCabinetHeight', 'worktopWidth', 'shelvesWidth', 'ceilingHeight',
    ]);
    expect(slotsOf(F, furnished).find((s) => s.id === 'tallCabinetHeight')).toMatchObject({ optional: true, min: 1.2, max: 2.6, typicalM: 2 });
    expect(slotIds(F, { piecesNeeded: ['STORAGE_BENCH', 'WORKTOP'] })).not.toContain('ceilingHeight');
    expect(F.deriveRoom(oneShelf).heightM).toBeGreaterThan(0);
    // piesele si descrierile raman ca in v3
    expect(F.deriveRoom(furnished).items.map((i) => i.name)).toEqual(['Bancă cu ladă', 'Dulap balcon', 'Blat de lucru', 'Rafturi balcon']);
  });
});

describe('etapa 10 — debara v4 (marimea din latimea rafturilor / dulapurilor)', () => {
  const F = pantryFlowV4;
  const uCabinet: AnswerMap = {
    wallsUsed: 'U_SHAPE',
    storageStyle: 'CLOSED_CABINETS',
    dimensions: { runA: 2, runB: 2, runC: 2, cabinetsWidth: 1.2, ceilingHeight: 2.6 },
    materialCabinets: 'PAL',
    systemsCabinets: ['MANER'],
  };

  it('debara U cu un singur dulap de 1,2 m → UNDER_2M (pe v3 laturile dadeau OVER_4M)', () => {
    expect(errors('PANTRY', uCabinet, 4)).toEqual([]);
    expect(F.deriveRoom(uCabinet).lengthM).toBeCloseTo(1.2);
    expect(roomSize('PANTRY', uCabinet, 4)).toBe('UNDER_2M');
    const v3: AnswerMap = { ...uCabinet, dimensions: { runA: 2, runB: 2, runC: 2, ceilingHeight: 2.6 } };
    expect(errors('PANTRY', v3, 3)).toEqual([]);
    expect(roomSize('PANTRY', v3, 3)).toBe('OVER_4M');
  });

  it('sloturile: laturile informative, latimea zonelor alese, inaltimea dulapurilor optionala, tavan doar cu dulapuri', () => {
    expect(slotIds(F, uCabinet)).toEqual(['runA', 'runB', 'runC', 'cabinetsWidth', 'cabinetsHeight', 'ceilingHeight']);
    expect(slotIds(F, { wallsUsed: 'ONE_WALL', storageStyle: 'OPEN_SHELVES' })).toEqual(['runA', 'shelvesWidth']);
    expect(slotIds(F, { wallsUsed: 'L_SHAPE', storageStyle: 'MIXED' })).toEqual([
      'runA', 'runB', 'shelvesWidth', 'cabinetsWidth', 'cabinetsHeight', 'ceilingHeight',
    ]);
    const slots = slotsOf(F, uCabinet);
    for (const id of ['runA', 'runB', 'runC']) {
      expect(slots.find((s) => s.id === id)).toMatchObject({ min: 0.5, max: 5 });
      expect(slots.find((s) => s.id === id)?.countsTowardLinear).toBeUndefined();
    }
    expect(slots.find((s) => s.id === 'cabinetsHeight')).toMatchObject({ optional: true, min: 1, max: 2.8, typicalM: 2.2 });
    // rafturi + dulapuri: marimea = suma lor
    const mixed: AnswerMap = {
      wallsUsed: 'L_SHAPE', storageStyle: 'MIXED',
      dimensions: { runA: 3, runB: 2, shelvesWidth: 1.5, cabinetsWidth: 1, cabinetsHeight: 2.4, ceilingHeight: 2.6 },
      materialShelves: 'PAL', materialCabinets: 'MDF_INFOLIAT', systemsCabinets: ['FIRM_DECIDES'],
    };
    expect(errors('PANTRY', mixed, 4)).toEqual([]);
    expect(F.deriveRoom(mixed).lengthM).toBeCloseTo(2.5);
    expect(roomSize('PANTRY', mixed, 4)).toBe('FROM_2_TO_4M');
    // doar rafturi: fara tavan
    const shelvesOnly: AnswerMap = {
      wallsUsed: 'ONE_WALL', storageStyle: 'OPEN_SHELVES', dimensions: { runA: 2, shelvesWidth: 2 }, materialShelves: 'PAL',
    };
    expect(errors('PANTRY', shelvesOnly, 4)).toEqual([]);
    expect(F.deriveRoom(shelvesOnly).items).toEqual([{ name: 'Rafturi debara', material: 'PAL', systems: [], quantity: 1 }]);
    expect(step(F, 'dimensions').subtitleKey).toBe('flows.PANTRY.v4.dimensions.subtitle');
  });
});

describe('etapa 10 — versiunile vechi ale celor patru fluxuri raman neschimbate', () => {
  it('v3: aceleasi sloturi ca inainte (peretele / balconul dau marimea, tavanul mereu)', () => {
    expect(slotsOf(balconyFlowV3, {}).map((s) => [s.id, s.countsTowardLinear === true])).toEqual([
      ['balconyLength', true], ['balconyDepth', false], ['ceilingHeight', false],
    ]);
    expect(slotsOf(laundryFlowV3, {}).map((s) => [s.id, s.countsTowardLinear === true])).toEqual([
      ['runA', true], ['ceilingHeight', false],
    ]);
    expect(slotsOf(pantryFlowV3, { wallsUsed: 'U_SHAPE' }).map((s) => s.id)).toEqual(['runA', 'runB', 'runC', 'ceilingHeight']);
    expect(slotsOf(bathroomFlowV3, { piecesNeeded: ['VANITY_UNIT'] }).map((s) => s.id)).toEqual(['vanityWidth', 'ceilingHeight']);
    for (const flow of [bathroomFlowV3, laundryFlowV3, balconyFlowV3, pantryFlowV3]) {
      for (const s of flow.steps) expect(['basinType', 'basinSupply', 'washerLoading']).not.toContain(s.id);
      expect(step(flow, 'dimensions').subtitleKey).toBe(`flows.${flow.roomType}.dimensions.subtitle`);
    }
  });

  it('v3: aceleasi piese, aceeasi marime si acelasi text pe aceleasi raspunsuri', () => {
    const laundry: AnswerMap = {
      applianceSetup: 'STACKED', piecesNeeded: ['APPLIANCE_HOUSING'], ventilation: 'NONE',
      dimensions: { runA: 3, ceilingHeight: 2.6 }, materialApplianceHousing: 'PAL', systemsApplianceHousing: ['MANER'],
    };
    expect(laundryFlowV3.deriveRoom(laundry)).toEqual({
      lengthM: 3, widthM: 0.6, heightM: 2.6,
      items: [{ name: 'Dulap încastrare electrocasnice', material: 'PAL', systems: ['MANER'], quantity: 1, description: BODY_NOTE }],
      firmRecommendations: [],
    });
    const bath: AnswerMap = {
      piecesNeeded: ['VANITY_UNIT'], dimensions: { vanityWidth: 1, ceilingHeight: 2.6 }, ventilation: 'WINDOW',
      materialVanity: 'PAL', systemsVanity: ['MANER'],
    };
    expect(bathroomFlowV3.deriveRoom(bath).items).toEqual([
      { name: 'Corp lavoar', material: 'PAL', systems: ['MANER'], quantity: 1, description: BODY_NOTE },
    ]);
    expect(collectScoreEntries('BATHROOM', bath, 3)).toEqual([
      { category: 'ROOM_TYPE', optionKey: 'BATHROOM' },
      { category: 'ROOM_SIZE', optionKey: 'UNDER_2M' },
      { category: 'ITEM_QUANTITY', optionKey: 'QTY_1' },
      { category: 'MATERIAL', optionKey: 'PAL' },
      { category: 'SYSTEM', optionKeys: ['MANER'], pick: 'max' },
    ]);
  });
});

describe('etapa 10 — dupa revizuire: marimea plafonata la perete (M3)', () => {
  const BUCKET = { UNDER_2M: 0, FROM_2_TO_4M: 1, OVER_4M: 2 } as Record<string, number>;

  it('balcon: 1,5 m cu banca de 3 m + blat de 4 m → marimea de 1,5 m (nu 7 m); raftul de 1 m pe 6 m ramane 1 m; mobilat 6 pe 6 ramane 6', () => {
    const small: AnswerMap = {
      enclosed: 'ENCLOSED', piecesNeeded: ['STORAGE_BENCH', 'WORKTOP'],
      dimensions: { balconyLength: 1.5, balconyDepth: 1, storageBenchWidth: 3, worktopWidth: 4 },
      materialStorageBench: 'PAL', systemsStorageBench: ['MANER'], materialWorktop: 'WORKTOP_PAL_POSTFORMED',
    };
    // validarea nu blocheaza (piesele pot sta pe alt perete / suprapuse)
    expect(errors('BALCONY', small, 4)).toEqual([]);
    expect(balconyFlowV4.deriveRoom(small).lengthM).toBeCloseTo(1.5);
    expect(roomSize('BALCONY', small, 4)).toBe('UNDER_2M');
    expect(roomSize('BALCONY', { ...small, dimensions: { balconyLength: 1.5, balconyDepth: 1, ceilingHeight: 2.5 } }, 3)).toBe('UNDER_2M');
    const shelf = { enclosed: 'ENCLOSED', piecesNeeded: ['SHELVES'], materialShelves: 'PAL', dimensions: { balconyLength: 6, balconyDepth: 1, shelvesWidth: 1 } };
    expect(balconyFlowV4.deriveRoom(shelf).lengthM).toBeCloseTo(1);
    const full: AnswerMap = {
      enclosed: 'ENCLOSED', piecesNeeded: ['STORAGE_BENCH', 'WORKTOP', 'SHELVES'], sameFinishAll: false,
      dimensions: { balconyLength: 6, balconyDepth: 1, storageBenchWidth: 2, worktopWidth: 2, shelvesWidth: 2 },
    };
    expect(balconyFlowV4.deriveRoom(full).lengthM).toBeCloseTo(6);
  });

  it('spalatorie: perete 0,8 m cu piese de 10,2 m → 0,8 m; piesele mai mici decat peretele raman suma lor', () => {
    const answers: AnswerMap = {
      applianceSetup: 'SIDE_BY_SIDE', ventilation: 'WINDOW', sameFinishAll: false,
      piecesNeeded: ['APPLIANCE_HOUSING', 'STORAGE', 'COUNTERTOP', 'SINK_UNIT'],
      dimensions: { runA: 0.8, applianceHousingWidth: 2, storageWidth: 3, countertopWidth: 4, sinkUnitWidth: 1.2, ceilingHeight: 2.6 },
    };
    expect(errors('LAUNDRY', answers, 4, true)).toEqual([]);
    expect(laundryFlowV4.deriveRoom(answers).lengthM).toBeCloseTo(0.8);
    expect(roomSize('LAUNDRY', answers, 4)).toBe('UNDER_2M');
    expect(laundryFlowV4.deriveRoom({ ...answers, dimensions: { runA: 6, applianceHousingWidth: 0.7, storageWidth: 1, countertopWidth: 1, sinkUnitWidth: 0.5, ceilingHeight: 2.6 } }).lengthM).toBeCloseTo(3.2);
  });

  it('debara: plafonul = suma laturilor folosite (ca marimea de pe v3)', () => {
    const one: AnswerMap = { wallsUsed: 'ONE_WALL', storageStyle: 'MIXED', dimensions: { runA: 1, shelvesWidth: 3, cabinetsWidth: 3, ceilingHeight: 2.6 } };
    expect(errors('PANTRY', one, 4, true)).toEqual([]);
    expect(pantryFlowV4.deriveRoom(one).lengthM).toBeCloseTo(1);
    const u: AnswerMap = { wallsUsed: 'U_SHAPE', storageStyle: 'MIXED', dimensions: { runA: 1, runB: 1, runC: 1, shelvesWidth: 5, cabinetsWidth: 5, ceilingHeight: 2.6 } };
    expect(pantryFlowV4.deriveRoom(u).lengthM).toBeCloseTo(3);
    expect(roomSize('PANTRY', u, 4)).toBe('FROM_2_TO_4M');
  });

  it('fara nicio latime de piesa (ciorna partiala) → marimea peretelui, ca pe v3; fara nicio masura → 0', () => {
    expect(balconyFlowV4.deriveRoom({ enclosed: 'OPEN', dimensions: { balconyLength: 6, balconyDepth: 1 } }).lengthM).toBeCloseTo(6);
    expect(laundryFlowV4.deriveRoom({ applianceSetup: 'STACKED', piecesNeeded: ['STORAGE'], dimensions: { runA: 3 } }).lengthM).toBeCloseTo(3);
    expect(pantryFlowV4.deriveRoom({ wallsUsed: 'L_SHAPE', dimensions: { runA: 1.5, runB: 1 } }).lengthM).toBeCloseTo(2.5);
    // "Am deja un proiect" (dimensiunile sarite): 0, deci lungimea aproximativa poate intra (d3), ca inainte
    for (const flow of [balconyFlowV4, laundryFlowV4, pantryFlowV4]) {
      expect(flow.deriveRoom({ piecesNeeded: ['SHELVES'], storageStyle: 'OPEN_SHELVES' }).lengthM).toBe(0);
    }
  });

  it('pe aceleasi masuri, v4 nu da niciodata o marime mai mare decat v3', () => {
    const lengths = [0.8, 1.5, 2, 3, 4.5, 6, 8];
    const widths = [0.6, 1, 2, 3, 4];
    for (const L of lengths) {
      for (const w of widths) {
        const v4 = { enclosed: 'OPEN', piecesNeeded: ['STORAGE_BENCH', 'WORKTOP', 'SHELVES'], dimensions: { balconyLength: L, balconyDepth: 1, storageBenchWidth: Math.min(w, 3), worktopWidth: w, shelvesWidth: w } };
        const v3 = { ...v4, dimensions: { balconyLength: L, balconyDepth: 1, ceilingHeight: 2.5 } };
        expect(BUCKET[roomSize('BALCONY', v4, 4)]).toBeLessThanOrEqual(BUCKET[roomSize('BALCONY', v3, 3)]);
      }
      const lv4 = { applianceSetup: 'WASHER_ONLY', piecesNeeded: ['COUNTERTOP', 'STORAGE'], dimensions: { runA: Math.min(L, 6), countertopWidth: 4, storageWidth: 3 } };
      const lv3 = { ...lv4, dimensions: { runA: Math.min(L, 6), ceilingHeight: 2.6 } };
      expect(BUCKET[roomSize('LAUNDRY', lv4, 4)]).toBeLessThanOrEqual(BUCKET[roomSize('LAUNDRY', lv3, 3)]);
    }
  });
});

describe('etapa 10 — dupa revizuire: nota lavoarului (m2), toate combinatiile', () => {
  const TYPES = [undefined, 'COUNTERTOP_BASIN', 'INSET_BASIN', 'INTEGRATED_BASIN', 'FIRM_DECIDES'] as const;
  const SUPPLIES = [undefined, 'CLIENT', 'FIRM', 'FIRM_DECIDES'] as const;
  const RO_T: Record<string, string> = { COUNTERTOP_BASIN: 'pe blat', INSET_BASIN: 'încastrat în blat', INTEGRATED_BASIN: 'integrat în blat' };
  const RO_S: Record<string, string> = { CLIENT: 'adus de client', FIRM: 'adus de firmă' };
  const EN_T: Record<string, string> = { COUNTERTOP_BASIN: 'countertop', INSET_BASIN: 'inset into the top', INTEGRATED_BASIN: 'integrated into the top' };
  const EN_S: Record<string, string> = { CLIENT: 'supplied by the client', FIRM: 'supplied by the company' };
  const expected = (t: string | undefined, s: string | undefined, loc: 'ro' | 'en'): string | undefined => {
    const [T, S, label] = loc === 'ro' ? [RO_T, RO_S, 'Lavoar'] : [EN_T, EN_S, 'Basin'];
    if (t === undefined && s === undefined) return undefined;
    const tk = t && t !== 'FIRM_DECIDES' ? T[t] : undefined;
    const sk = s && s !== 'FIRM_DECIDES' ? S[s] : undefined;
    if (tk && sk) return `${label}: ${tk}, ${sk}`;
    if (tk) return s === 'FIRM_DECIDES'
      ? `${label}: ${tk} ${loc === 'ro' ? '(cine îl aduce: recomandă firma)' : '(who supplies it: the company recommends)'}`
      : `${label}: ${tk}`;
    if (sk) return t === 'FIRM_DECIDES'
      ? `${label}: ${loc === 'ro' ? 'tipul îl recomandă firma' : 'the company recommends the type'}, ${sk}`
      : `${label}: ${sk}`;
    return `${label}: ${loc === 'ro' ? 'clientul vrea recomandarea firmei' : "the client wants the company's recommendation"}`;
  };

  it('fiecare combinatie (5 × 4), RO si EN: o singura nota, fara "; " si fara "tipul: …"', () => {
    for (const t of TYPES) {
      for (const s of SUPPLIES) {
        const a: AnswerMap = { ...(t ? { basinType: t } : {}), ...(s ? { basinSupply: s } : {}) };
        for (const loc of ['ro', 'en'] as const) {
          const note = basinNote(a, loc);
          expect(note, `${t}/${s}/${loc}`).toBe(expected(t, s, loc));
          if (note) {
            expect(note).not.toContain(';');
            expect(note).not.toContain('tipul:');
          }
        }
      }
    }
    // exemplele cerute de revizie
    expect(basinNote({ basinType: 'INSET_BASIN', basinSupply: 'CLIENT' })).toBe('Lavoar: încastrat în blat, adus de client');
    expect(basinNote({ basinType: 'COUNTERTOP_BASIN', basinSupply: 'FIRM' })).toBe('Lavoar: pe blat, adus de firmă');
    expect(basinNote({ basinType: 'INSET_BASIN', basinSupply: 'FIRM_DECIDES' })).toBe('Lavoar: încastrat în blat (cine îl aduce: recomandă firma)');
    expect(basinNote({ basinType: 'FIRM_DECIDES', basinSupply: 'CLIENT' })).toBe('Lavoar: tipul îl recomandă firma, adus de client');
    expect(basinNote({ basinType: 'FIRM_DECIDES', basinSupply: 'FIRM_DECIDES' })).toBe('Lavoar: clientul vrea recomandarea firmei');
    // in descrierea piesei: exact o nota in plus fata de descrierea de azi
    const room = bathroomFlowV4.deriveRoom({
      piecesNeeded: ['VANITY_UNIT'], dimensions: { vanityWidth: 1 }, ventilation: 'WINDOW', materialVanity: 'PAL', systemsVanity: ['MANER'],
      basinType: 'INSET_BASIN', basinSupply: 'FIRM_DECIDES',
    });
    expect(room.items[0].description?.split('; ')).toEqual([BODY_NOTE, 'Lavoar: încastrat în blat (cine îl aduce: recomandă firma)']);
  });
});

describe('etapa 10 — dupa revizuire: ordinea ecranelor la baie (m7)', () => {
  const F = bathroomFlowV4;
  const screens = (answers: AnswerMap) => {
    const out: string[] = [];
    for (const s of visibleSteps(F, answers)) {
      const g = s.screenGroup ?? s.id;
      if (out[out.length - 1] !== g) out.push(g);
    }
    return out;
  };

  it('"Da" la acelasi material: ecranul comun vine inaintea intrebarilor despre lavoar', () => {
    const ids = screens({ piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET', 'TALL_STORAGE'], sameFinishAll: true });
    expect(ids.indexOf('piece:ALL')).toBeGreaterThan(-1);
    expect(ids.indexOf('piece:ALL')).toBeLessThan(ids.indexOf('piece:VANITY_UNIT:details'));
    expect(ids.slice(-3)).toEqual(['piece:ALL', 'piece:VANITY_UNIT:details', 'sketch']);
  });

  it('"Nu": detaliile lavoarului raman imediat dupa ecranul lavoarului; fiecare ecran apare o singura data', () => {
    const ids = screens({ piecesNeeded: ['VANITY_UNIT', 'MIRROR_CABINET', 'TALL_STORAGE'], sameFinishAll: false });
    expect(ids).toEqual([
      'pieces', 'dimensions', 'ventilation',
      'piece:VANITY_UNIT', 'piece:VANITY_UNIT:details', 'piece:MIRROR_CABINET', 'piece:TALL_STORAGE', 'sketch',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    // o singura piesa (fara intrebarea comuna)
    expect(screens({ piecesNeeded: ['VANITY_UNIT'] })).toEqual(['pieces', 'dimensions', 'ventilation', 'piece:VANITY_UNIT', 'piece:VANITY_UNIT:details', 'sketch']);
  });

  it('aceiasi pasi ca inainte, doar ordinea ecranului comun s-a schimbat', () => {
    const ids = F.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...bathroomFlowV3.steps.map((s) => s.id), 'basinType', 'basinSupply'].sort());
  });
});

describe('etapa 10 — dupa revizuire: raspunsuri minime pe versiunile noi; TOP → STACKED', () => {
  const MINIMAL: Record<'BATHROOM' | 'LAUNDRY' | 'BALCONY' | 'PANTRY', AnswerMap> = {
    BATHROOM: { piecesNeeded: ['VANITY_UNIT'], dimensions: { vanityWidth: 0.6 }, ventilation: 'FAN', materialVanity: 'FIRM_DECIDES', systemsVanity: ['FIRM_DECIDES'] },
    LAUNDRY: { applianceSetup: 'WASHER_ONLY', piecesNeeded: ['COUNTERTOP'], ventilation: 'WINDOW', dimensions: { runA: 2, countertopWidth: 1 }, materialCountertop: 'FIRM_DECIDES' },
    BALCONY: { enclosed: 'OPEN', piecesNeeded: ['SHELVES'], dimensions: { balconyLength: 3, balconyDepth: 0.8, shelvesWidth: 1 }, materialShelves: 'FIRM_DECIDES' },
    PANTRY: { wallsUsed: 'ONE_WALL', storageStyle: 'OPEN_SHELVES', dimensions: { runA: 2, shelvesWidth: 2 }, materialShelves: 'FIRM_DECIDES' },
  };

  it('cele mai sarace raspunsuri publicabile trec, au piese, marime si scor; fara tavan si fara intrebarile noi', () => {
    for (const rt of ROOMS) {
      const a = MINIMAL[rt];
      expect(errors(rt, a, 4), rt).toEqual([]);
      expect(slotIds(getFlow(rt, 4), a)).not.toContain('ceilingHeight');
      const room = getFlow(rt, 4).deriveRoom(a);
      expect(room.items.length, rt).toBeGreaterThan(0);
      expect(room.lengthM, rt).toBeGreaterThan(0);
      expect(room.heightM, rt).toBeGreaterThan(0);
      for (const it of room.items) expect(it.description ?? '', rt).not.toMatch(/undefined|null|FIRM_DECIDES|[A-Z]{3,}_[A-Z]/);
      const entries = collectScoreEntries(rt, a, 4);
      expect(entries[0]).toEqual({ category: 'ROOM_TYPE', optionKey: rt });
      expect(entries.some((e) => ['BATHROOM_BASIN_TYPE', 'BATHROOM_BASIN_SUPPLY', 'LAUNDRY_LOADING'].includes(e.category))).toBe(false);
      // pe ciorna goala nu crapa nimic
      expect(() => getFlow(rt, 4).deriveRoom({})).not.toThrow();
    }
    // spalatoria minima: aparatele tot ajung pe piesa
    expect(laundryFlowV4.deriveRoom(MINIMAL.LAUNDRY).items[0].description).toContain('Aparate: doar mașină de spălat');
  });

  it('"De sus" salvat, apoi trecerea pe "suprapuse": respins clar la publicare si curatat de pruneAnswers', () => {
    const before: AnswerMap = { ...MINIMAL.LAUNDRY, washerLoading: 'TOP' };
    expect(errors('LAUNDRY', before, 4)).toEqual([]);
    expect(laundryFlowV4.deriveRoom(before).items[0].description).toContain('Încărcare: de sus');
    const switched: AnswerMap = { ...before, applianceSetup: 'STACKED' };
    expect(errors('LAUNDRY', switched, 4)).toEqual(['washerLoading:validation.optionInvalid']);
    expect(errors('LAUNDRY', switched, 4, true)).toEqual(['washerLoading:validation.optionInvalid']);
    const cleaned = pruneAnswers(laundryFlowV4, switched);
    expect(cleaned.washerLoading).toBeUndefined();
    expect(cleaned.applianceSetup).toBe('STACKED');
    expect(errors('LAUNDRY', cleaned, 4)).toEqual([]);
    expect(laundryFlowV4.deriveRoom(cleaned).items[0].description).not.toContain('Încărcare');
    // "Frontala" ramane valabila la trecere
    expect(pruneAnswers(laundryFlowV4, { ...switched, washerLoading: 'FRONT' }).washerLoading).toBe('FRONT');
  });
});