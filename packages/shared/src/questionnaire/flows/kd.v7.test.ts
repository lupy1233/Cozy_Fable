import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  firmRecommendations,
  getFlow,
  pruneAnswers,
  stepAnswerSchema,
  validateRoomAnswers,
  visibleOptions,
  visibleSteps,
} from '../engine';
import type { AnswerMap, ChoiceOption, DimensionGroupStep, QuestionStep, RoomFlow, ScoreEntry } from '../types';
import { dressingFlowV4 } from './dressing.v4';
import { dressingFlowV5 } from './dressing.v5';
import { BODY_NOTE, FIRM_DECIDES, FIRM_MATERIAL_NOTE, FIRM_OPENING_NOTE, PISTONS } from './finish-sets';
import { ETAPA10_FLOW_VERSION } from './index';
import { kitchenFlowV4 } from './kitchen.v4';
import { kitchenFlowV5, NO_WALL_CABINETS_NOTE, sinkNote, WALL_CABINETS_FIRM_NOTE } from './kitchen.v5';

// Etapa 10, valul 1, pachetul e10-kd: bucataria v5 si dressingul v5 (DESIGN §5.0, §5.1, §5.2, §7b, §10).

const step = (flow: RoomFlow, id: string): QuestionStep => {
  const s = flow.steps.find((x) => x.id === id);
  if (!s) throw new Error(`pas lipsa: ${id}`);
  return s;
};
const optionValues = (flow: RoomFlow, id: string, answers: AnswerMap = {}): string[] =>
  visibleOptions(step(flow, id) as { options: ChoiceOption[] }, answers).map((o) => o.value);
const errorsOf = (r: ReturnType<typeof validateRoomAnswers>) => (r.ok ? [] : r.errors);
const slotIds = (flow: RoomFlow, answers: AnswerMap): string[] =>
  (step(flow, 'dimensions') as DimensionGroupStep).slots(answers).map((s) => s.id);
const visibleIds = (flow: RoomFlow, answers: AnswerMap): string[] => visibleSteps(flow, answers).map((s) => s.id);
// intrarile de scor ca multime de chei comparabile
const entryKey = (e: ScoreEntry): string =>
  'pick' in e ? `${e.category}:max(${e.optionKeys.join(',')})` : `${e.category}:${e.optionKey}`;
const keys = (entries: ScoreEntry[]): string[] => entries.map(entryKey).sort();
const without = (list: string[], removed: string[]): string[] => {
  const out = [...list];
  for (const r of removed) {
    const i = out.indexOf(r);
    if (i < 0) throw new Error(`intrare lipsa: ${r}`);
    out.splice(i, 1);
  }
  return out;
};

const K5 = 5;
const D5 = 5;

// ---------------------------------------------------------------- bucatarie
// exemplul A din DESIGN §7e: dreapta 3 m, PAL, Maner peste tot, fara insula, blat PAL
const kitchenA: AnswerMap = {
  layout: 'STRAIGHT',
  dimensions: { runA: 3, ceilingHeight: 2.6 },
  frontMaterialBase: 'PAL',
  openingSystemsBase: ['MANER'],
  openingSystemsWall: ['MANER'],
  countertop: 'PAL',
};

describe('KITCHEN v5 — inregistrare si pasi', () => {
  it('e versiunea etapei 10, inregistrata; v4 ramane cu pasii ei', () => {
    expect(kitchenFlowV5.version).toBe(5);
    expect(getFlow('KITCHEN', 5)).toBe(kitchenFlowV5);
    expect(ETAPA10_FLOW_VERSION.KITCHEN).toBe(5);
    expect(kitchenFlowV5.steps.map((s) => s.id)).toEqual([
      'layout', 'hasIsland', 'wallCabinets', 'dimensions',
      'frontMaterialBase', 'frontMaterialBaseOther', 'separateFrontMaterials',
      'frontMaterialWall', 'frontMaterialWallOther', 'frontMaterialIsland', 'frontMaterialIslandOther',
      'openingSystemsBase', 'openingSystemsWall', 'openingSystemsIsland',
      'countertop', 'sinkMounting', 'sinkMaterial', 'appliances', 'fridgeType', 'sketch',
    ]);
    // v4 neatinsa: fara intrebarile noi, deschiderea suspendatelor fara conditie
    for (const id of ['wallCabinets', 'sinkMounting', 'sinkMaterial', 'fridgeType']) {
      expect(kitchenFlowV4.steps.some((s) => s.id === id)).toBe(false);
    }
    expect(step(kitchenFlowV4, 'openingSystemsWall').visibleIf).toBeUndefined();
    expect(step(kitchenFlowV4, 'countertop').screenGroup).toBeUndefined();
    expect(step(kitchenFlowV4, 'appliances').screenGroup).toBeUndefined();
  });

  it('ecranele: forma (3 intrebari), blatul + chiuveta (3), electrocasnicele + frigiderul', () => {
    const group = (g: string) => kitchenFlowV5.steps.filter((s) => s.screenGroup === g).map((s) => s.id);
    expect(group('layoutScreen')).toEqual(['layout', 'hasIsland', 'wallCabinets']);
    expect(group('countertopScreen')).toEqual(['countertop', 'sinkMounting', 'sinkMaterial']);
    expect(group('appliancesScreen')).toEqual(['appliances', 'fridgeType']);
  });

  it('intrebarile noi: optionale, valorile din proiect, "Nu stiu" la final, categoriile de scor §7d', () => {
    const expected: Record<string, [string, string[]]> = {
      wallCabinets: ['KITCHEN_WALL_CABINETS', ['WALL_CABINETS', 'NO_WALL_CABINETS']],
      sinkMounting: ['KITCHEN_SINK_MOUNTING', ['INSET', 'UNDERMOUNT']],
      sinkMaterial: ['KITCHEN_SINK_MATERIAL', ['STAINLESS', 'COMPOSITE', 'CERAMIC']],
      fridgeType: ['KITCHEN_FRIDGE', ['BUILT_IN', 'FREESTANDING']],
    };
    for (const [id, [category, values]] of Object.entries(expected)) {
      const s = step(kitchenFlowV5, id);
      expect(s.type).toBe('single-choice');
      expect(s.optional).toBe(true);
      const options = (s as { options: ChoiceOption[] }).options;
      expect(options.map((o) => o.value)).toEqual([...values, FIRM_DECIDES]);
      for (const o of options) expect(o.scoring).toEqual({ category, optionKey: o.value });
      expect(options[0]?.labelKey).toBe(`flows.KITCHEN.v5.${id}.options.${values[0]}.label`);
      expect(s.titleKey).toBe(`flows.KITCHEN.v5.${id}.title`);
    }
    // fara raspunsuri la ele, cererea se publica
    expect(validateRoomAnswers('KITCHEN', kitchenA, { partial: false, version: K5 })).toEqual({ ok: true });
  });

  it('versiunile vechi resping intrebarile noi', () => {
    const errs = errorsOf(
      validateRoomAnswers('KITCHEN', { ...kitchenA, wallCabinets: 'NO_WALL_CABINETS', sinkMounting: 'INSET' }, {
        partial: false,
        version: 4,
      }),
    );
    expect(errs).toContainEqual({ stepId: 'wallCabinets', messageKey: 'validation.unknownAnswer' });
    expect(errs).toContainEqual({ stepId: 'sinkMounting', messageKey: 'validation.unknownAnswer' });
  });
});

describe('KITCHEN v5 — "Fara corpuri suspendate"', () => {
  const noWall: AnswerMap = { ...kitchenA, wallCabinets: 'NO_WALL_CABINETS' };
  delete noWall.openingSystemsWall;

  it('intrebarile suspendatelor dispar (si cu "materiale diferite"); un raspuns trimis pentru ele e respins', () => {
    const separate = { ...noWall, separateFrontMaterials: true };
    const visible = visibleIds(kitchenFlowV5, separate);
    for (const id of ['frontMaterialWall', 'frontMaterialWallOther', 'openingSystemsWall']) {
      expect(visible).not.toContain(id);
    }
    expect(visible).toContain('openingSystemsBase');
    expect(validateRoomAnswers('KITCHEN', noWall, { partial: false, version: K5 })).toEqual({ ok: true });
    const errs = errorsOf(
      validateRoomAnswers(
        'KITCHEN',
        { ...separate, frontMaterialWall: 'PAL', openingSystemsWall: ['MANER'] },
        { partial: false, version: K5 },
      ),
    );
    expect(errs).toEqual([
      { stepId: 'frontMaterialWall', messageKey: 'validation.unknownAnswer' },
      { stepId: 'openingSystemsWall', messageKey: 'validation.unknownAnswer' },
    ]);
    // cu corpuri / "Nu stiu" / fara raspuns: deschiderea suspendatelor ramane obligatorie
    for (const wallCabinets of ['WALL_CABINETS', FIRM_DECIDES, undefined]) {
      const answers: AnswerMap = { ...noWall, ...(wallCabinets ? { wallCabinets } : {}) };
      if (!wallCabinets) delete answers.wallCabinets;
      expect(errorsOf(validateRoomAnswers('KITCHEN', answers, { partial: false, version: K5 }))).toEqual([
        { stepId: 'openingSystemsWall', messageKey: 'validation.answerRequired' },
      ]);
    }
  });

  it('piesa "Corpuri suspendate" nu se creeaza; nota pe corpurile de baza; nicio recomandare pe ea', () => {
    const room = kitchenFlowV5.deriveRoom(noWall);
    expect(room.items).toEqual([
      {
        name: 'Corpuri de bază',
        material: 'PAL',
        systems: ['MANER'],
        description: `${BODY_NOTE}; ${NO_WALL_CABINETS_NOTE}`,
        quantity: 1,
      },
    ]);
    expect(NO_WALL_CABINETS_NOTE).toBe('Fără corpuri suspendate');
    const firmWall = { ...noWall, separateFrontMaterials: true, frontMaterialBase: FIRM_DECIDES };
    expect(firmRecommendations('KITCHEN', firmWall, K5)).toEqual([
      { itemName: 'Corpuri de bază', material: true, opening: false },
    ]);
  });

  it('scorul scade exact cu piesa: MATERIAL + SYSTEM ai piesei si treapta de cantitate (exemplul A: 18 → 14)', () => {
    const withWall = keys(collectScoreEntries('KITCHEN', { ...kitchenA, wallCabinets: 'WALL_CABINETS' }, K5));
    const noWallKeys = keys(collectScoreEntries('KITCHEN', noWall, K5));
    const expected = [
      ...without(withWall, [
        'MATERIAL:PAL',
        'SYSTEM:max(MANER)',
        'ITEM_QUANTITY:QTY_2_3',
        'KITCHEN_WALL_CABINETS:WALL_CABINETS',
      ]),
      'ITEM_QUANTITY:QTY_1',
      'KITCHEN_WALL_CABINETS:NO_WALL_CABINETS',
    ].sort();
    expect(noWallKeys).toEqual(expected);

    // ponderile din DESIGN §7 / seed.ts pentru exemplul A (blatul nu intra in exemplu; randurile noi = 0)
    const W: Record<string, number> = {
      'ROOM_TYPE:KITCHEN': 8,
      'ROOM_SIZE:FROM_2_TO_4M': 3,
      'ITEM_QUANTITY:QTY_1': 0,
      'ITEM_QUANTITY:QTY_2_3': 2,
      'KITCHEN_LAYOUT:STRAIGHT': 1,
      'MATERIAL:PAL': 1,
      'SYSTEM:max(MANER)': 1,
      'KITCHEN_WALL_CABINETS:WALL_CABINETS': 0,
      'KITCHEN_WALL_CABINETS:NO_WALL_CABINETS': 0,
    };
    const cost = (list: string[]) => list.filter((k) => !k.startsWith('KITCHEN_COUNTERTOP:')).reduce((a, k) => {
      if (!(k in W)) throw new Error(`pondere lipsa in test: ${k}`);
      return a + W[k];
    }, 0);
    expect(cost(withWall)).toBe(18);
    expect(cost(noWallKeys)).toBe(14);
  });

  it('"Nu stiu" pastreaza piesa (cu materialul / deschiderea date) si pune nota pe ea', () => {
    const answers = { ...kitchenA, wallCabinets: FIRM_DECIDES };
    expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: K5 })).toEqual({ ok: true });
    const room = kitchenFlowV5.deriveRoom(answers);
    expect(room.items.map((i) => i.name)).toEqual(['Corpuri de bază', 'Corpuri suspendate']);
    expect(room.items[1]).toEqual({
      name: 'Corpuri suspendate',
      material: 'PAL',
      systems: ['MANER'],
      description: `${BODY_NOTE}; ${WALL_CABINETS_FIRM_NOTE}`,
      quantity: 1,
    });
    expect(WALL_CABINETS_FIRM_NOTE).toBe('Corpuri suspendate: clientul vrea recomandarea firmei');
    expect(room.items[0]?.description).toBe(BODY_NOTE);
    // nu intra in insigna "Recomandarea firmei" (E10-N22)
    expect(room.firmRecommendations).toEqual([]);
    expect(keys(collectScoreEntries('KITCHEN', answers, K5))).toContain('KITCHEN_WALL_CABINETS:FIRM_DECIDES');
  });
});

describe('KITCHEN v5 — chiuveta, frigiderul, electrocasnicele in descriere', () => {
  it('exemplul complet din proiect (RO, cu diacritice)', () => {
    const answers: AnswerMap = {
      ...kitchenA,
      wallCabinets: 'NO_WALL_CABINETS',
      appliances: ['OVEN', 'HOB', 'HOOD', 'FRIDGE'],
      fridgeType: 'BUILT_IN',
      sinkMounting: 'UNDERMOUNT',
      sinkMaterial: 'COMPOSITE',
    };
    delete answers.openingSystemsWall;
    expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: K5 })).toEqual({ ok: true });
    const room = kitchenFlowV5.deriveRoom(answers);
    expect(room.items).toHaveLength(1);
    expect(room.items[0]?.description).toBe(
      'Corp: PAL standard; Electrocasnice: cuptor, plită, hotă, frigider; Frigider: încorporabil; ' +
        'Chiuvetă: compozit (granit), montată sub blat; Fără corpuri suspendate',
    );
  });

  it('toate electrocasnicele, in ordinea bifelor; doar pe corpurile de baza', () => {
    const answers: AnswerMap = {
      ...kitchenA,
      appliances: ['MICROWAVE', 'DISHWASHER', 'OVEN', 'HOB', 'HOOD', 'FRIDGE'],
      fridgeType: 'FREESTANDING',
    };
    const room = kitchenFlowV5.deriveRoom(answers);
    expect(room.items[0]?.description).toBe(
      `${BODY_NOTE}; Electrocasnice: cuptor cu microunde, mașină de spălat vase, cuptor, plită, hotă, frigider; Frigider: independent`,
    );
    expect(room.items[1]?.description).toBe(BODY_NOTE);
  });

  it('frigiderul: intrebarea apare doar cu "Frigider" bifat; altfel raspunsul e respins', () => {
    expect(visibleIds(kitchenFlowV5, { ...kitchenA, appliances: ['OVEN'] })).not.toContain('fridgeType');
    expect(visibleIds(kitchenFlowV5, kitchenA)).not.toContain('fridgeType');
    expect(visibleIds(kitchenFlowV5, { ...kitchenA, appliances: ['FRIDGE'] })).toContain('fridgeType');
    const errs = errorsOf(
      validateRoomAnswers('KITCHEN', { ...kitchenA, appliances: ['OVEN'], fridgeType: 'BUILT_IN' }, {
        partial: false,
        version: K5,
      }),
    );
    expect(errs).toEqual([{ stepId: 'fridgeType', messageKey: 'validation.unknownAnswer' }]);
    const firm = kitchenFlowV5.deriveRoom({ ...kitchenA, appliances: ['FRIDGE'], fridgeType: FIRM_DECIDES });
    expect(firm.items[0]?.description).toBe(
      `${BODY_NOTE}; Electrocasnice: frigider; Frigider: clientul vrea recomandarea firmei`,
    );
  });

  it('chiuveta: material, montaj, doar unul sau "Nu stiu"', () => {
    const desc = (extra: AnswerMap) => kitchenFlowV5.deriveRoom({ ...kitchenA, ...extra }).items[0]?.description;
    expect(desc({ sinkMaterial: 'STAINLESS', sinkMounting: 'INSET' })).toBe(
      `${BODY_NOTE}; Chiuvetă: inox, încastrată în blat`,
    );
    expect(desc({ sinkMaterial: 'CERAMIC' })).toBe(`${BODY_NOTE}; Chiuvetă: ceramică`);
    expect(desc({ sinkMounting: 'UNDERMOUNT' })).toBe(`${BODY_NOTE}; Chiuvetă: montată sub blat`);
    expect(desc({ sinkMaterial: FIRM_DECIDES, sinkMounting: FIRM_DECIDES })).toBe(
      `${BODY_NOTE}; Chiuvetă: clientul vrea recomandarea firmei`,
    );
    expect(desc({ sinkMounting: FIRM_DECIDES })).toBe(`${BODY_NOTE}; Chiuvetă: clientul vrea recomandarea firmei`);
    expect(sinkNote('COMPOSITE', FIRM_DECIDES)).toBe('Chiuvetă: compozit (granit), montajul îl recomandă firma');
    expect(sinkNote(FIRM_DECIDES, 'INSET')).toBe('Chiuvetă: materialul îl recomandă firma, încastrată în blat');
    expect(sinkNote(undefined, undefined)).toBeUndefined();
  });

  it('valorile noi au intrari de scor (0 puncte, randuri e10-seed), fara alte schimbari', () => {
    const answers: AnswerMap = {
      ...kitchenA,
      wallCabinets: 'WALL_CABINETS',
      appliances: ['FRIDGE'],
      fridgeType: 'BUILT_IN',
      sinkMounting: 'INSET',
      sinkMaterial: 'STAINLESS',
    };
    const v4Keys = keys(collectScoreEntries('KITCHEN', { ...kitchenA, appliances: ['FRIDGE'] }, 4));
    expect(keys(collectScoreEntries('KITCHEN', answers, K5))).toEqual(
      [
        ...v4Keys,
        'KITCHEN_WALL_CABINETS:WALL_CABINETS',
        'KITCHEN_FRIDGE:BUILT_IN',
        'KITCHEN_SINK_MOUNTING:INSET',
        'KITCHEN_SINK_MATERIAL:STAINLESS',
      ].sort(),
    );
  });
});

describe('KITCHEN v5 — dimensiuni (c5)', () => {
  const uShape = (runB: number, runC = 1.2): AnswerMap => ({
    ...kitchenA,
    layout: 'U_SHAPE',
    dimensions: { runA: 3, runB, runC, ceilingHeight: 2.6 },
  });

  it('latura B / C de 0,6 m acceptata pe v5, respinsa pe v4; A tot de la 1 m; tavanul ramane', () => {
    expect(validateRoomAnswers('KITCHEN', uShape(0.6, 0.6), { partial: false, version: K5 })).toEqual({ ok: true });
    expect(errorsOf(validateRoomAnswers('KITCHEN', uShape(0.6), { partial: false, version: 4 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    expect(errorsOf(validateRoomAnswers('KITCHEN', uShape(0.5), { partial: false, version: K5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    const shortA = { ...kitchenA, dimensions: { runA: 0.8, ceilingHeight: 2.6 } };
    expect(errorsOf(validateRoomAnswers('KITCHEN', shortA, { partial: false, version: K5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    // aceleasi sloturi ca v4, pe toate formele, cu si fara insula
    for (const layout of ['STRAIGHT', 'L_SHAPE', 'U_SHAPE']) {
      for (const hasIsland of [true, false]) {
        const a = { layout, hasIsland };
        expect(slotIds(kitchenFlowV5, a)).toEqual(slotIds(kitchenFlowV4, a));
      }
    }
    expect(slotIds(kitchenFlowV5, { layout: 'STRAIGHT' })).toContain('ceilingHeight');
    expect(kitchenFlowV5.deriveRoom(uShape(0.6, 0.6)).lengthM).toBeCloseTo(4.2);
    // aceleasi chei de text ca v4 (textul ramane adevarat)
    expect(step(kitchenFlowV5, 'dimensions').titleKey).toBe(step(kitchenFlowV4, 'dimensions').titleKey);
    expect(step(kitchenFlowV5, 'dimensions').subtitleKey).toBe(step(kitchenFlowV4, 'dimensions').subtitleKey);
  });
});

describe('KITCHEN v4 → v5: aceleasi raspunsuri, acelasi rezultat', () => {
  const samples: AnswerMap[] = [
    kitchenA,
    {
      ...kitchenA,
      layout: 'L_SHAPE',
      hasIsland: true,
      dimensions: { runA: 3, runB: 2, ceilingHeight: 2.6, islandLength: 1.6, islandDepth: 0.9 },
      separateFrontMaterials: true,
      frontMaterialBase: 'ALTUL',
      frontMaterialBaseOther: 'MDF lucios',
      frontMaterialWall: FIRM_DECIDES,
      frontMaterialIsland: 'LEMN_MASIV',
      openingSystemsWall: [FIRM_DECIDES],
      openingSystemsIsland: ['GOLA'],
      countertop: FIRM_DECIDES,
    },
    { ...kitchenA, openingSystemsWall: ['MANER', PISTONS],frontMaterialBase: 'MDF_VOPSIT' },
  ];

  it('fara raspunsuri noi si fara electrocasnice: piese / scor identice; v4 da textele de dinainte', () => {
    for (const answers of samples) {
      expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: 4 })).toEqual({ ok: true });
      expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: K5 })).toEqual({ ok: true });
      expect(kitchenFlowV5.deriveRoom(answers)).toEqual(kitchenFlowV4.deriveRoom(answers));
      expect(keys(collectScoreEntries('KITCHEN', answers, K5))).toEqual(keys(collectScoreEntries('KITCHEN', answers, 4)));
    }
    // v4 neschimbata: electrocasnicele NU ajung in piese (ca inainte)
    const withAppliances = { ...kitchenA, appliances: ['OVEN', 'FRIDGE'] };
    expect(kitchenFlowV4.deriveRoom(withAppliances).items).toEqual([
      { name: 'Corpuri de bază', material: 'PAL', systems: ['MANER'], description: BODY_NOTE, quantity: 1 },
      { name: 'Corpuri suspendate', material: 'PAL', systems: ['MANER'], description: BODY_NOTE, quantity: 1 },
    ]);
    expect(kitchenFlowV4.deriveRoom(samples[1] as AnswerMap).items[1]).toEqual({
      name: 'Corpuri suspendate',
      material: 'ALTUL',
      systems: [],
      description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}`,
      quantity: 1,
    });
  });
});

// ---------------------------------------------------------------- dressing
const dressingBase: AnswerMap = {
  layout: 'LINEAR',
  dimensions: { runA: 2.5, wardrobeHeight: 2.4 },
  doorType: 'SLIDING',
  interiorModules: ['SHELVES', 'LED_LIGHTING'],
  material: 'MDF_INFOLIAT',
};

describe('DRESSING v5', () => {
  it('e versiunea etapei 10; aceiasi pasi ca v4, doar pasul de dimensiuni e nou (subtitlu nou)', () => {
    expect(dressingFlowV5.version).toBe(5);
    expect(getFlow('DRESSING', 5)).toBe(dressingFlowV5);
    expect(ETAPA10_FLOW_VERSION.DRESSING).toBe(5);
    expect(dressingFlowV5.steps.map((s) => s.id)).toEqual(dressingFlowV4.steps.map((s) => s.id));
    dressingFlowV5.steps.forEach((s, i) => {
      if (s.id === 'dimensions') expect(s).not.toBe(dressingFlowV4.steps[i]);
      else expect(s).toBe(dressingFlowV4.steps[i]);
    });
    expect(step(dressingFlowV5, 'dimensions').subtitleKey).toBe('flows.DRESSING.v5.dimensions.subtitle');
    expect(step(dressingFlowV4, 'dimensions').subtitleKey).toBe('flows.DRESSING.dimensions.subtitle');
  });

  it('walk-in cere A / B / C pe v5; "In L" doar A / B; v4 walk-in tot A / B', () => {
    expect(slotIds(dressingFlowV5, { layout: 'WALK_IN' })).toEqual(['runA', 'runB', 'runC', 'wardrobeHeight']);
    expect(slotIds(dressingFlowV5, { layout: 'L_SHAPE' })).toEqual(['runA', 'runB', 'wardrobeHeight']);
    expect(slotIds(dressingFlowV5, { layout: 'U_SHAPE' })).toEqual(['runA', 'runB', 'runC', 'wardrobeHeight']);
    expect(slotIds(dressingFlowV5, { layout: 'LINEAR' })).toEqual(['runA', 'wardrobeHeight']);
    expect(slotIds(dressingFlowV4, { layout: 'WALK_IN' })).toEqual(['runA', 'runB', 'wardrobeHeight']);

    const walkIn = (dims: Record<string, number>): AnswerMap => ({ ...dressingBase, layout: 'WALK_IN', dimensions: dims });
    expect(errorsOf(validateRoomAnswers('DRESSING', walkIn({ runA: 2, runB: 1.5, wardrobeHeight: 2.4 }), { partial: false, version: D5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionRequired' },
    ]);
    const full = walkIn({ runA: 2, runB: 1.5, runC: 2, wardrobeHeight: 2.4 });
    expect(validateRoomAnswers('DRESSING', full, { partial: false, version: D5 })).toEqual({ ok: true });
    // pe v4 latura C nu exista la walk-in
    expect(errorsOf(validateRoomAnswers('DRESSING', full, { partial: false, version: 4 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.unknownAnswer' },
    ]);
    // lungimea = suma celor trei laturi
    expect(dressingFlowV5.deriveRoom(full).lengthM).toBeCloseTo(5.5);
  });

  it('latura B / C de la 0,6 m pe v5 (respinsa pe v4); A tot de la 1 m; inaltimea dulapului obligatorie', () => {
    const l = (runB: number): AnswerMap => ({ ...dressingBase, layout: 'L_SHAPE', dimensions: { runA: 2, runB, wardrobeHeight: 2.4 } });
    expect(validateRoomAnswers('DRESSING', l(0.6), { partial: false, version: D5 })).toEqual({ ok: true });
    expect(errorsOf(validateRoomAnswers('DRESSING', l(0.6), { partial: false, version: 4 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    expect(errorsOf(validateRoomAnswers('DRESSING', l(0.5), { partial: false, version: D5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    const u = { ...dressingBase, layout: 'WALK_IN', dimensions: { runA: 2, runB: 0.6, runC: 0.6, wardrobeHeight: 2.4 } };
    expect(validateRoomAnswers('DRESSING', u, { partial: false, version: D5 })).toEqual({ ok: true });
    const shortA = { ...dressingBase, dimensions: { runA: 0.9, wardrobeHeight: 2.4 } };
    expect(errorsOf(validateRoomAnswers('DRESSING', shortA, { partial: false, version: D5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' },
    ]);
    const noHeight = { ...dressingBase, dimensions: { runA: 2 } };
    expect(errorsOf(validateRoomAnswers('DRESSING', noHeight, { partial: false, version: D5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionRequired' },
    ]);
    const heightSlot = (step(dressingFlowV5, 'dimensions') as DimensionGroupStep)
      .slots(dressingBase)
      .find((s) => s.id === 'wardrobeHeight');
    expect(heightSlot?.optional).toBeUndefined();
    expect(stepAnswerSchema(step(dressingFlowV5, 'dimensions'), { layout: 'WALK_IN' }).safeParse({ runA: 2, runB: 0.6, runC: 0.6, wardrobeHeight: 2 }).success).toBe(true);
  });

  it('v4 → v5: aceleasi raspunsuri (fara walk-in cu C) → aceleasi piese / scor / text; v4 ca inainte', () => {
    const samples: AnswerMap[] = [
      dressingBase,
      { ...dressingBase, layout: 'L_SHAPE', dimensions: { runA: 2, runB: 1.5, wardrobeHeight: 2.6 }, doorType: 'HINGED', openingSystems: ['PUSH'] },
      { ...dressingBase, layout: 'U_SHAPE', dimensions: { runA: 2, runB: 1.5, runC: 1.5, wardrobeHeight: 2.4 }, doorType: 'OPEN' },
      { ...dressingBase, doorType: 'HINGED', material: FIRM_DECIDES, openingSystems: [FIRM_DECIDES] },
    ];
    for (const answers of samples) {
      expect(validateRoomAnswers('DRESSING', answers, { partial: false, version: 4 })).toEqual({ ok: true });
      expect(validateRoomAnswers('DRESSING', answers, { partial: false, version: D5 })).toEqual({ ok: true });
      expect(dressingFlowV5.deriveRoom(answers)).toEqual(dressingFlowV4.deriveRoom(answers));
      expect(keys(collectScoreEntries('DRESSING', answers, D5))).toEqual(keys(collectScoreEntries('DRESSING', answers, 4)));
    }
    expect(dressingFlowV4.deriveRoom(samples[1] as AnswerMap)).toMatchObject({
      lengthM: 3.5,
      heightM: 2.6,
      items: [
        {
          name: 'Dressing',
          material: 'MDF_INFOLIAT',
          systems: ['PUSH'],
          description: `Interior: rafturi; iluminare LED; ${BODY_NOTE}`,
          quantity: 1,
        },
      ],
    });
  });
});

// ---------------------------------------------------------------- dupa revizuire (review-fluxuri.md)
describe('dupa revizuire — bucataria: ciorna cu raspunsuri ramase pentru suspendate', () => {
  // ciorna completata cu suspendatele (material separat, "Altul", deschidere), apoi "Fara corpuri suspendate"
  const draft: AnswerMap = {
    ...kitchenA,
    separateFrontMaterials: true,
    frontMaterialWall: 'ALTUL',
    frontMaterialWallOther: 'MDF lucios',
    openingSystemsWall: ['AVENTOS', PISTONS],
    wallCabinets: 'NO_WALL_CABINETS',
  };

  it('pruneAnswers scoate cei trei pasi ai suspendatelor; publicarea trece', () => {
    const pruned = pruneAnswers(kitchenFlowV5, draft);
    for (const id of ['frontMaterialWall', 'frontMaterialWallOther', 'openingSystemsWall']) {
      expect(pruned).not.toHaveProperty(id);
    }
    expect(pruned).toEqual({ ...kitchenA, separateFrontMaterials: true, wallCabinets: 'NO_WALL_CABINETS', openingSystemsWall: undefined });
    expect(validateRoomAnswers('KITCHEN', pruned, { partial: false, version: K5 })).toEqual({ ok: true });
    expect(validateRoomAnswers('KITCHEN', pruned, { partial: true, version: K5 })).toEqual({ ok: true });
    // ecranul Fronturi (pasii vizibili) nu mai are zona suspendatelor
    expect(visibleSteps(kitchenFlowV5, pruned).filter((s) => s.screenGroup === 'fronts').map((s) => s.id)).toEqual([
      'frontMaterialBase', 'separateFrontMaterials', 'openingSystemsBase',
    ]);
  });

  it('raspunsurile ramase nu ajung in piese, in descriere sau in scor (nici nescoase)', () => {
    const pruned = pruneAnswers(kitchenFlowV5, draft);
    const clean: AnswerMap = { ...kitchenA, separateFrontMaterials: true, wallCabinets: 'NO_WALL_CABINETS' };
    delete clean.openingSystemsWall;
    for (const answers of [draft, pruned]) {
      const room = kitchenFlowV5.deriveRoom(answers);
      expect(room).toEqual(kitchenFlowV5.deriveRoom(clean));
      expect(room.items).toEqual([
        {
          name: 'Corpuri de bază',
          material: 'PAL',
          systems: ['MANER'],
          description: `${BODY_NOTE}; ${NO_WALL_CABINETS_NOTE}`,
          quantity: 1,
        },
      ]);
      expect(JSON.stringify(room)).not.toMatch(/MDF lucios|AVENTOS|rabatabile/);
      expect(keys(collectScoreEntries('KITCHEN', answers, K5))).toEqual(keys(collectScoreEntries('KITCHEN', clean, K5)));
      expect(keys(collectScoreEntries('KITCHEN', answers, K5))).not.toContain('MATERIAL:ALTUL');
    }
  });
});

describe('dupa revizuire — M2: dressingul walk-in, latura C intra in marime', () => {
  // ponderile ROOM_SIZE din seed.ts / DESIGN §7: UNDER_2M 1 · FROM_2_TO_4M 3 · OVER_4M 5
  const ROOM_SIZE_POINTS: Record<string, number> = { UNDER_2M: 1, FROM_2_TO_4M: 3, OVER_4M: 5 };
  const walkIn = (dims: Record<string, number>): AnswerMap => ({
    ...dressingBase,
    layout: 'WALK_IN',
    dimensions: { ...dims, wardrobeHeight: 2.4 },
  });
  const roomSize = (answers: AnswerMap, version: number): string => {
    const e = collectScoreEntries('DRESSING', answers, version).find((x) => x.category === 'ROOM_SIZE');
    return e && 'optionKey' in e ? e.optionKey : 'lipsa';
  };

  it('A 1,5 + B 1,5: v4 = 3 m (FROM_2_TO_4M, 3 p); v5 cu C 1,5 = 4,5 m (OVER_4M, 5 p) → +2 credite (hotarare coordonator, de confirmat de PO)', () => {
    const v4 = walkIn({ runA: 1.5, runB: 1.5 });
    const v5 = walkIn({ runA: 1.5, runB: 1.5, runC: 1.5 });
    expect(validateRoomAnswers('DRESSING', v4, { partial: false, version: 4 })).toEqual({ ok: true });
    expect(validateRoomAnswers('DRESSING', v5, { partial: false, version: D5 })).toEqual({ ok: true });
    // aceleasi raspunsuri A / B pe v5 nu se pot publica fara C
    expect(errorsOf(validateRoomAnswers('DRESSING', v4, { partial: false, version: D5 }))).toEqual([
      { stepId: 'dimensions', messageKey: 'validation.dimensionRequired' },
    ]);
    expect(dressingFlowV4.deriveRoom(v4).lengthM).toBeCloseTo(3);
    expect(dressingFlowV5.deriveRoom(v5).lengthM).toBeCloseTo(4.5);
    expect(roomSize(v4, 4)).toBe('FROM_2_TO_4M');
    expect(roomSize(v5, D5)).toBe('OVER_4M');
    expect(ROOM_SIZE_POINTS[roomSize(v5, D5)] - ROOM_SIZE_POINTS[roomSize(v4, 4)]).toBe(2);
    // singura diferenta de scor e treapta de marime (piesa, materialul, sistemele raman)
    expect(without(keys(collectScoreEntries('DRESSING', v5, D5)), ['ROOM_SIZE:OVER_4M'])).toEqual(
      without(keys(collectScoreEntries('DRESSING', v4, 4)), ['ROOM_SIZE:FROM_2_TO_4M']),
    );
  });

  it('walk-in cu C mic (0,6 m): 3,6 m, ramane in aceeasi treapta ca pe v4; pragul e la C > 1 m', () => {
    const v4 = walkIn({ runA: 1.5, runB: 1.5 });
    const small = walkIn({ runA: 1.5, runB: 1.5, runC: 0.6 });
    expect(validateRoomAnswers('DRESSING', small, { partial: false, version: D5 })).toEqual({ ok: true });
    expect(dressingFlowV5.deriveRoom(small).lengthM).toBeCloseTo(3.6);
    expect(roomSize(small, D5)).toBe(roomSize(v4, 4));
    expect(keys(collectScoreEntries('DRESSING', small, D5))).toEqual(keys(collectScoreEntries('DRESSING', v4, 4)));
    // pragul FROM_2_TO_4M e "<= 4 m": C = 1 m → 4 m tot 3 p; C = 1,1 m → 4,1 m → OVER_4M
    expect(roomSize(walkIn({ runA: 1.5, runB: 1.5, runC: 1 }), D5)).toBe('FROM_2_TO_4M');
    expect(roomSize(walkIn({ runA: 1.5, runB: 1.5, runC: 1.1 }), D5)).toBe('OVER_4M');
  });
});
