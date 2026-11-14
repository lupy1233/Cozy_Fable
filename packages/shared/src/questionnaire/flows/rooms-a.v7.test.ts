import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  getFlow,
  pruneAnswers,
  summarizeAnswers,
  validateRoomAnswers,
  visibleOptions,
  visibleSteps,
} from '../engine';
import type {
  AnswerMap,
  DimensionGroupStep,
  MultiChoiceStep,
  QuestionStep,
  RoomFlow,
  SingleChoiceStep,
} from '../types';
import { bedroomFlowV3 } from './bedroom.v3';
import { bedroomFlowV4 } from './bedroom.v4';
import { BODY_NOTE } from './finish-sets';
import { hallwayFlowV2 } from './hallway.v2';
import { hallwayFlowV3 } from './hallway.v3';
import { ETAPA10_FLOW_VERSION } from './index';
import { livingFlowV4 } from './living.v4';
import { livingFlowV5 } from './living.v5';
import { officeFlowV3 } from './office.v3';
import { officeFlowV4 } from './office.v4';

// Etapa 10, pachetul rooms-a: dormitor v4, living v5, birou v4, hol v3 (DESIGN §5.0, §5.3–5.5, §5.10).

const visibleIds = (flow: RoomFlow, answers: AnswerMap) => visibleSteps(flow, answers).map((s) => s.id);
const step = (flow: RoomFlow, id: string) => flow.steps.find((s) => s.id === id) as QuestionStep;
const dims = (flow: RoomFlow) => step(flow, 'dimensions') as DimensionGroupStep;
const slotIds = (flow: RoomFlow, answers: AnswerMap) => dims(flow).slots(answers).map((s) => s.id);
const requiredSlotIds = (flow: RoomFlow, answers: AnswerMap) =>
  dims(flow).slots(answers).filter((s) => s.optional !== true).map((s) => s.id);
const optionValues = (flow: RoomFlow, id: string, answers: AnswerMap = {}) =>
  visibleOptions(step(flow, id) as SingleChoiceStep | MultiChoiceStep, answers).map((o) => o.value);
function errors(roomType: RoomFlow['roomType'], version: number, answers: AnswerMap) {
  const r = validateRoomAnswers(roomType, answers, { partial: false, version });
  return r.ok ? [] : r.errors.map((e) => `${e.stepId}:${e.messageKey}`);
}
const scoreKeys = (roomType: RoomFlow['roomType'], version: number, answers: AnswerMap) =>
  collectScoreEntries(roomType, answers, version).map((e) => `${e.category}:${e.optionKey}`);

describe('etapa 10 rooms-a — versiunile inregistrate', () => {
  it('getFlow intoarce fluxurile noi = ETAPA10_FLOW_VERSION; versiunile vechi raman', () => {
    expect(getFlow('BEDROOM', 4)).toBe(bedroomFlowV4);
    expect(getFlow('LIVING', 5)).toBe(livingFlowV5);
    expect(getFlow('OFFICE', 4)).toBe(officeFlowV4);
    expect(getFlow('HALLWAY', 3)).toBe(hallwayFlowV3);
    expect([ETAPA10_FLOW_VERSION.BEDROOM, ETAPA10_FLOW_VERSION.LIVING, ETAPA10_FLOW_VERSION.OFFICE, ETAPA10_FLOW_VERSION.HALLWAY])
      .toEqual([4, 5, 4, 3]);
    expect(getFlow('BEDROOM', 3)).toBe(bedroomFlowV3);
    expect(getFlow('LIVING', 4)).toBe(livingFlowV4);
    expect(getFlow('OFFICE', 3)).toBe(officeFlowV3);
    expect(getFlow('HALLWAY', 2)).toBe(hallwayFlowV2);
  });

  it('id-uri unice; versiunea si tipul camerei pastrate', () => {
    for (const [flow, rt, v] of [
      [bedroomFlowV4, 'BEDROOM', 4], [livingFlowV5, 'LIVING', 5], [officeFlowV4, 'OFFICE', 4], [hallwayFlowV3, 'HALLWAY', 3],
    ] as const) {
      const ids = flow.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(flow.roomType).toBe(rt);
      expect(flow.version).toBe(v);
    }
  });

  it('subtitlul pasului de dimensiuni are cheie noua pe versiune; titlul ramane', () => {
    expect(dims(bedroomFlowV4).subtitleKey).toBe('flows.BEDROOM.v4.dimensions.subtitle');
    expect(dims(livingFlowV5).subtitleKey).toBe('flows.LIVING.v5.dimensions.subtitle');
    expect(dims(officeFlowV4).subtitleKey).toBe('flows.OFFICE.v4.dimensions.subtitle');
    expect(dims(hallwayFlowV3).subtitleKey).toBe('flows.HALLWAY.v3.dimensions.subtitle');
    for (const f of [bedroomFlowV4, livingFlowV5, officeFlowV4, hallwayFlowV3]) {
      expect(dims(f).titleKey).toBe(`flows.${f.roomType}.dimensions.title`);
    }
  });
});

describe('etapa 10 rooms-a — dormitor v4: masuri (c5)', () => {
  const bedOnly: AnswerMap = {
    piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160', bedUpholstered: false, bedStorage: 'NONE', materialBed: 'LEMN_MASIV',
  };

  it('doar cu pat → fara pas de dimensiuni si fara tavan; lungimea = latimea saltelei', () => {
    expect(visibleIds(bedroomFlowV4, bedOnly)).not.toContain('dimensions');
    expect(slotIds(bedroomFlowV4, bedOnly)).not.toContain('ceilingHeight');
    expect(errors('BEDROOM', 4, bedOnly)).toEqual([]);
    // un tavan trimis oricum e respins (pas invizibil)
    expect(errors('BEDROOM', 4, { ...bedOnly, dimensions: { ceilingHeight: 2.6 } })).toEqual(['dimensions:validation.unknownAnswer']);
    const derived = bedroomFlowV4.deriveRoom(bedOnly);
    expect(derived.lengthM).toBeCloseTo(1.6);
    expect(derived.items).toEqual([
      { name: 'Cadru pat', material: 'LEMN_MASIV', systems: [], quantity: 1, description: 'saltea 160 × 200' },
    ]);
  });

  it('pat + comoda (fara piesa inalta) → latimea comodei, fara tavan', () => {
    const a = { ...bedOnly, piecesNeeded: ['BED_FRAME', 'DRESSER'] };
    expect(slotIds(bedroomFlowV4, a)).toEqual(['dresserWidth']);
  });

  const wardrobe: AnswerMap = { piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', materialWardrobe: 'MDF_VOPSIT' };

  it('cu dulap → tavanul obligatoriu, inaltimea dulapului optionala (tipic 2,4 m), langa latime', () => {
    const slots = dims(bedroomFlowV4).slots(wardrobe);
    expect(slots.map((s) => s.id)).toEqual(['wardrobeWidth', 'wardrobeHeight', 'ceilingHeight']);
    const height = slots[1];
    expect(height).toMatchObject({ optional: true, typicalM: 2.4, min: 1.8, max: 3.2, labelKey: 'flows.BEDROOM.dimensions.slots.wardrobeHeight' });
    expect(height.countsTowardLinear).toBeUndefined();
    expect(slots[0]).toMatchObject({ countsTowardLinear: true, min: 0.6, max: 6 });

    // inaltimea lasata goala trece validarea
    const empty = { ...wardrobe, dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 } };
    expect(errors('BEDROOM', 4, empty)).toEqual([]);
    // tavanul lipsa → obligatoriu
    expect(errors('BEDROOM', 4, { ...wardrobe, dimensions: { wardrobeWidth: 2.4 } })).toEqual(['dimensions:validation.dimensionRequired']);
    // inaltimea data se valideaza pe interval
    expect(errors('BEDROOM', 4, { ...wardrobe, dimensions: { wardrobeWidth: 2.4, wardrobeHeight: 3.5, ceilingHeight: 2.6 } }))
      .toEqual(['dimensions:validation.dimensionOutOfRange']);
    expect(errors('BEDROOM', 4, { ...wardrobe, dimensions: { wardrobeWidth: 2.4, wardrobeHeight: 2.5, ceilingHeight: 2.6 } })).toEqual([]);

    // golul apare in rezumat ca "nespecificat" (missing, cu valoarea tipica) — E10-N21
    const entry = summarizeAnswers('BEDROOM', empty, 4).find((e) => e.stepId === 'dimensions');
    expect(entry).toMatchObject({
      kind: 'dimensions',
      missing: [{ labelKey: 'flows.BEDROOM.dimensions.slots.wardrobeHeight', typicalM: 2.4 }],
    });
    const given = { ...wardrobe, dimensions: { wardrobeWidth: 2.4, wardrobeHeight: 2.5, ceilingHeight: 2.6 } };
    expect(summarizeAnswers('BEDROOM', given, 4).find((e) => e.stepId === 'dimensions')).not.toHaveProperty('missing');

    // inaltimea nu intra in marime; tavanul da inaltimea camerei
    const derived = bedroomFlowV4.deriveRoom(given);
    expect(derived.lengthM).toBeCloseTo(2.4);
    expect(derived.heightM).toBeCloseTo(2.6);
  });
});

describe('etapa 10 rooms-a — dormitor v4: saltea (c9, E10-N6)', () => {
  const bed: AnswerMap = { piecesNeeded: ['BED_FRAME'], bedUpholstered: false, bedStorage: 'NONE', materialBed: 'LEMN_MASIV' };
  const describeBed = (a: AnswerMap) => bedroomFlowV4.deriveRoom(a).items[0].description;

  it('marimea 120 × 200 intre 90 si 140; lungimea doar la o marime standard, pe ecranul saltelei', () => {
    expect(optionValues(bedroomFlowV4, 'bedSize')).toEqual(['S_90', 'D_120', 'M_140', 'Q_160', 'K_180', 'CUSTOM']);
    expect(step(bedroomFlowV4, 'bedLength')).toMatchObject({ optional: true, screenGroup: 'bedSize', type: 'single-choice' });
    expect(optionValues(bedroomFlowV4, 'bedLength')).toEqual(['L_200', 'L_190', 'FIRM_DECIDES']);
    expect(visibleIds(bedroomFlowV4, { ...bed, bedSize: 'D_120' })).toContain('bedLength');
    expect(visibleIds(bedroomFlowV4, { ...bed, bedSize: 'CUSTOM' })).not.toContain('bedLength');
    expect(visibleIds(bedroomFlowV4, bed)).not.toContain('bedLength');
    // ecranul saltelei: cel mult 3 intrebari vizibile (lungimea si dimensiunile custom se exclud)
    for (const bedSize of ['D_120', 'CUSTOM']) {
      const onScreen = visibleSteps(bedroomFlowV4, { ...bed, bedSize }).filter((s) => s.screenGroup === 'bedSize');
      expect(onScreen.length).toBe(3);
    }
    // fara puncte (marimile saltelei nu au scor nici azi)
    expect((step(bedroomFlowV4, 'bedLength') as SingleChoiceStep).options.every((o) => o.scoring === undefined)).toBe(true);
    expect(errors('BEDROOM', 4, { ...bed, bedSize: 'CUSTOM', bedCustomSize: { bedCustomWidth: 1.2, bedCustomLength: 1.9 }, bedLength: 'L_190' }))
      .toEqual(['bedLength:validation.unknownAnswer']);
  });

  it('pat 120 × 200 → "saltea 120 × 200" si 1,2 m in marime; lungimea 190 / "nu stiu" in descriere', () => {
    const d120 = { ...bed, bedSize: 'D_120' };
    expect(errors('BEDROOM', 4, d120)).toEqual([]);
    expect(describeBed(d120)).toBe('saltea 120 × 200');
    expect(bedroomFlowV4.deriveRoom(d120).lengthM).toBeCloseTo(1.2);
    expect(describeBed({ ...d120, bedLength: 'L_200' })).toBe('saltea 120 × 200');
    const l190 = { ...bed, bedSize: 'M_140', bedLength: 'L_190' };
    expect(errors('BEDROOM', 4, l190)).toEqual([]);
    expect(describeBed(l190)).toBe('saltea 140 × 190');
    expect(describeBed({ ...l190, bedLength: 'FIRM_DECIDES' })).toBe('saltea 140, lungimea o recomandă firma');
    expect(describeBed({ ...bed, bedSize: 'CUSTOM', bedCustomSize: { bedCustomWidth: 1.2, bedCustomLength: 1.9 } }))
      .toBe('saltea 120 × 190 cm (altă mărime)');
    expect(scoreKeys('BEDROOM', 4, l190).some((k) => k.startsWith('BED_LENGTH'))).toBe(false);
  });
});

describe('etapa 10 rooms-a — dormitor v4: stofa patului (c9, E10-N7)', () => {
  const bed: AnswerMap = { piecesNeeded: ['BED_FRAME'], bedSize: 'D_120', bedStorage: 'LIFT_UP', materialBed: 'LEMN_MASIV' };

  it('doar la patul tapitat, pe ecran propriu', () => {
    expect(visibleIds(bedroomFlowV4, { ...bed, bedUpholstered: false })).not.toContain('bedFabric');
    expect(visibleIds(bedroomFlowV4, bed)).not.toContain('bedFabric');
    expect(visibleIds(bedroomFlowV4, { ...bed, bedUpholstered: true })).toContain('bedFabric');
    expect(step(bedroomFlowV4, 'bedFabric')).toMatchObject({ optional: true, screenGroup: 'bedFabric' });
    expect(optionValues(bedroomFlowV4, 'bedFabric')).toEqual(['WOVEN', 'BOUCLE', 'VELVET', 'FIRM_DECIDES']);
    expect(errors('BEDROOM', 4, { ...bed, bedUpholstered: false, bedFabric: 'VELVET' })).toEqual(['bedFabric:validation.unknownAnswer']);
    // optionala
    expect(errors('BEDROOM', 4, { ...bed, bedUpholstered: true })).toEqual([]);
  });

  it('pat tapitat 120 × 200 cu lada si catifea → descrierea din proiect; "nu stiu" → nota firmei', () => {
    const velvet = { ...bed, bedUpholstered: true, bedFabric: 'VELVET' };
    expect(errors('BEDROOM', 4, velvet)).toEqual([]);
    expect(bedroomFlowV4.deriveRoom(velvet).items).toEqual([
      { name: 'Pat tapițat', material: 'LEMN_MASIV', systems: [], quantity: 1, description: 'saltea 120 × 200, ladă rabatabilă; Stofă: catifea' },
    ]);
    expect(bedroomFlowV4.deriveRoom({ ...velvet, bedFabric: 'BOUCLE' }).items[0].description).toBe('saltea 120 × 200, ladă rabatabilă; Stofă: bouclé');
    expect(bedroomFlowV4.deriveRoom({ ...velvet, bedFabric: 'FIRM_DECIDES' }).items[0].description)
      .toBe('saltea 120 × 200, ladă rabatabilă; Stofă: clientul vrea recomandarea firmei');
    expect(bedroomFlowV4.deriveRoom({ ...bed, bedUpholstered: true }).items[0].description).toBe('saltea 120 × 200, ladă rabatabilă');
    expect(scoreKeys('BEDROOM', 4, velvet)).toContain('BED_FABRIC:VELVET');
  });
});

describe('etapa 10 rooms-a — dormitor v4: interiorul dulapului (c9, E10-N8)', () => {
  const wardrobe: AnswerMap = {
    piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', materialWardrobe: 'MDF_VOPSIT',
    dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 },
  };

  it('pe ecranul piece:WARDROBE:details, aceleasi module ca dressingul, "Nu stiu" exclusiv', () => {
    const s = step(bedroomFlowV4, 'wardrobeInterior') as MultiChoiceStep;
    expect(s).toMatchObject({ type: 'multi-choice', optional: true, screenGroup: 'piece:WARDROBE:details' });
    expect(s.options.map((o) => o.value)).toEqual([
      'HANGING_RODS', 'SHELVES', 'DRAWERS', 'SHOE_RACK', 'ACCESSORIES', 'LED_LIGHTING', 'FIRM_DECIDES',
    ]);
    expect(s.options.find((o) => o.value === 'FIRM_DECIDES')?.exclusive).toBe(true);
    expect(s.options[0].labelKey).toBe('flows.BEDROOM.v4.wardrobeInterior.options.HANGING_RODS.label');
    // imediat dupa ecranul dulapului
    const ids = visibleIds(bedroomFlowV4, wardrobe);
    expect(ids.indexOf('wardrobeInterior')).toBe(ids.indexOf('materialWardrobe') + 1);
    expect(visibleIds(bedroomFlowV4, { piecesNeeded: ['DRESSER'] })).not.toContain('wardrobeInterior');

    expect(errors('BEDROOM', 4, wardrobe)).toEqual([]);
    expect(errors('BEDROOM', 4, { ...wardrobe, wardrobeInterior: ['FIRM_DECIDES', 'SHELVES'] }))
      .toEqual(['wardrobeInterior:validation.exclusiveOption']);
    expect(errors('BEDROOM', 4, { ...wardrobe, wardrobeInterior: ['FIRM_DECIDES'] })).toEqual([]);
    expect(errors('BEDROOM', 4, { ...wardrobe, wardrobeInterior: [] })).toEqual([]);
  });

  it('in descrierea dulapului, dupa notele etapei 6', () => {
    const modules = { ...wardrobe, wardrobeInterior: ['HANGING_RODS', 'SHELVES', 'DRAWERS'] };
    expect(bedroomFlowV4.deriveRoom(modules).items).toEqual([
      {
        name: 'Dulap dormitor', material: 'MDF_VOPSIT', systems: ['GLISANTE'], quantity: 1,
        description: `${BODY_NOTE}; Interior dulap: bare de agățat, rafturi, sertare`,
      },
    ]);
    expect(bedroomFlowV4.deriveRoom({ ...wardrobe, wardrobeInterior: ['FIRM_DECIDES'] }).items[0].description)
      .toBe(`${BODY_NOTE}; Interior dulap: clientul vrea recomandarea firmei`);
    expect(bedroomFlowV4.deriveRoom(wardrobe).items[0].description).toBe(BODY_NOTE);
    expect(scoreKeys('BEDROOM', 4, modules)).toEqual(expect.arrayContaining([
      'WARDROBE_INTERIOR:HANGING_RODS', 'WARDROBE_INTERIOR:SHELVES', 'WARDROBE_INTERIOR:DRAWERS',
    ]));
  });
});

describe('etapa 10 rooms-a — living v5 (c5, E10-N12)', () => {
  const ALL = ['TV_UNIT', 'BOOKSHELF', 'DISPLAY_CABINET', 'COFFEE_TABLE', 'WALL_SHELVES', 'OTHER'];

  it('toate piesele → doar latimile (6) + tavanul obligatorii; inaltimea doar la biblioteca / vitrina, optionala', () => {
    const a: AnswerMap = { piecesNeeded: ALL };
    expect(slotIds(livingFlowV5, a)).toEqual([
      'tvUnitWidth', 'bookshelfWidth', 'bookshelfHeight', 'displayWidth', 'displayHeight',
      'coffeeTableLength', 'shelvesTotal', 'otherWidth', 'ceilingHeight',
    ]);
    expect(requiredSlotIds(livingFlowV5, a)).toEqual([
      'tvUnitWidth', 'bookshelfWidth', 'displayWidth', 'coffeeTableLength', 'shelvesTotal', 'otherWidth', 'ceilingHeight',
    ]);
    const slots = dims(livingFlowV5).slots(a);
    expect(slots.find((s) => s.id === 'bookshelfHeight')).toMatchObject({ optional: true, typicalM: 2, min: 0.6, max: 3 });
    expect(slots.find((s) => s.id === 'displayHeight')).toMatchObject({ optional: true, typicalM: 1.9, min: 0.8, max: 2.8 });
    // inaltimile vechi (comoda TV, masuta, rafturi, piesa libera) nu mai exista
    const widths = { tvUnitWidth: 2, bookshelfWidth: 1, displayWidth: 0.8, coffeeTableLength: 1, shelvesTotal: 1.5, otherWidth: 0.5 };
    const full: AnswerMap = {
      piecesNeeded: ALL, piecesOtherText: 'Bar', sameFinishAll: true, tvStyle: 'ON_FLOOR',
      dimensions: { ...widths, ceilingHeight: 2.7 },
      materialAll: 'PAL', systemsAll: ['MANER'], materialCoffeeTable: 'LEMN_MASIV', materialShelves: 'PAL',
    };
    expect(errors('LIVING', 5, full)).toEqual([]);
    expect(errors('LIVING', 5, { ...full, dimensions: { ...widths, ceilingHeight: 2.7, tvUnitHeight: 0.5 } }))
      .toEqual(['dimensions:validation.unknownAnswer']);
    const derived = livingFlowV5.deriveRoom(full);
    expect(derived.lengthM).toBeCloseTo(6.8);
    expect(derived.heightM).toBeCloseTo(2.7);
    // piesele = cele din v4 pe aceleasi raspunsuri
    expect(derived.items).toEqual(livingFlowV4.deriveRoom({ ...full, dimensions: { ...widths, ceilingHeight: 2.7 } }).items);
  });

  it('fara biblioteca / vitrina → fara tavan', () => {
    const a: AnswerMap = { piecesNeeded: ['TV_UNIT', 'COFFEE_TABLE'] };
    expect(slotIds(livingFlowV5, a)).toEqual(['tvUnitWidth', 'coffeeTableLength']);
    const full = { ...a, tvStyle: 'FLOATING', dimensions: { tvUnitWidth: 2, coffeeTableLength: 1 }, materialTvUnit: 'PAL', systemsTvUnit: ['PUSH'], materialCoffeeTable: 'PAL' };
    expect(errors('LIVING', 5, full)).toEqual([]);
    expect(livingFlowV5.deriveRoom(full).lengthM).toBeCloseTo(3);
  });
});

describe('etapa 10 rooms-a — birou v4 (c5)', () => {
  it('doar birou → latimile biroului, fara tavan', () => {
    expect(slotIds(officeFlowV4, { piecesNeeded: ['DESK'], deskShape: 'L_SHAPE' })).toEqual(['deskWidthA', 'deskWidthB']);
    const full = { piecesNeeded: ['DESK'], deskShape: 'STRAIGHT', dimensions: { deskWidthA: 1.4 }, materialDesk: 'PAL', systemsDesk: ['NO_FRONTS'] };
    expect(errors('OFFICE', 4, full)).toEqual([]);
    expect(officeFlowV4.deriveRoom(full).lengthM).toBeCloseTo(1.4);
  });

  it('biblioteca / dulap → tavan obligatoriu si inaltimea lor optionala (tipic 2,0 m)', () => {
    const a: AnswerMap = { piecesNeeded: ['BOOKSHELF', 'STORAGE', 'WALL_SHELVES'] };
    expect(slotIds(officeFlowV4, a)).toEqual(['bookshelfWidth', 'bookshelfHeight', 'storageWidth', 'storageHeight', 'shelvesTotal', 'ceilingHeight']);
    expect(requiredSlotIds(officeFlowV4, a)).toEqual(['bookshelfWidth', 'storageWidth', 'shelvesTotal', 'ceilingHeight']);
    const slots = dims(officeFlowV4).slots(a);
    expect(slots.find((s) => s.id === 'storageHeight')).toMatchObject({
      optional: true, typicalM: 2, labelKey: 'flows.OFFICE.dimensions.slots.storageHeight',
    });
    expect(slotIds(officeFlowV4, { piecesNeeded: ['STORAGE'] })).toContain('ceilingHeight');
    expect(slotIds(officeFlowV4, { piecesNeeded: ['WALL_SHELVES'] })).toEqual(['shelvesTotal']);
  });
});

describe('etapa 10 rooms-a — hol v3 (c5, E10-N13, E10-N15)', () => {
  const base: AnswerMap = { piecesNeeded: ['SHOE_CABINET'], materialShoeCabinet: 'PAL', systemsShoeCabinet: ['MANER'], dimensions: { shoeCabinetWidth: 1 } };

  it('latimea holului: optionala, pe ecranul pieselor, cu "Nu stiu — o masoara firma"', () => {
    const s = step(hallwayFlowV3, 'hallWidth') as SingleChoiceStep;
    expect(s).toMatchObject({ type: 'single-choice', optional: true, screenGroup: 'pieces' });
    expect(s.options.map((o) => o.value)).toEqual(['NARROW', 'WIDE', 'FIRM_DECIDES']);
    expect(s.options[2].labelKey).toBe('flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label');
    expect(hallwayFlowV3.steps.slice(0, 3).map((x) => x.id)).toEqual(['piecesNeeded', 'sameFinishAll', 'hallWidth']);
    expect(errors('HALLWAY', 3, base)).toEqual([]);
    for (const hallWidth of ['NARROW', 'WIDE', 'FIRM_DECIDES']) {
      expect(errors('HALLWAY', 3, { ...base, hallWidth })).toEqual([]);
    }
    // informatie de camera: nu intra in descrierea pieselor, apare in rezumat
    const unsure = { ...base, hallWidth: 'FIRM_DECIDES' };
    expect(hallwayFlowV3.deriveRoom(unsure)).toEqual(hallwayFlowV3.deriveRoom(base));
    expect(summarizeAnswers('HALLWAY', unsure, 3).find((e) => e.stepId === 'hallWidth')).toMatchObject({
      kind: 'choice', optionLabelKeys: ['flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label'],
    });
    expect(scoreKeys('HALLWAY', 3, unsure)).toContain('HALLWAY_WIDTH:FIRM_DECIDES');
    // pe v2 intrebarea nu exista
    expect(errors('HALLWAY', 2, unsure)).toEqual(['hallWidth:validation.unknownAnswer']);
  });

  it('inaltime optionala la dulapul de hol si la cuier; tavanul doar la ele', () => {
    expect(slotIds(hallwayFlowV3, { piecesNeeded: ['SHOE_CABINET', 'BENCH', 'MIRROR'] })).toEqual(['shoeCabinetWidth', 'benchWidth', 'mirrorWidth']);
    const a: AnswerMap = { piecesNeeded: ['WARDROBE', 'COAT_UNIT'] };
    expect(slotIds(hallwayFlowV3, a)).toEqual(['wardrobeWidth', 'wardrobeHeight', 'coatUnitWidth', 'coatUnitHeight', 'ceilingHeight']);
    expect(requiredSlotIds(hallwayFlowV3, a)).toEqual(['wardrobeWidth', 'coatUnitWidth', 'ceilingHeight']);
    const slots = dims(hallwayFlowV3).slots(a);
    expect(slots.find((s) => s.id === 'wardrobeHeight')).toMatchObject({ optional: true, typicalM: 2.4, min: 1.8, max: 3 });
    expect(slots.find((s) => s.id === 'coatUnitHeight')).toMatchObject({ optional: true, typicalM: 2, min: 1.4, max: 2.6 });
    const full: AnswerMap = {
      piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', materialWardrobe: 'PAL',
      dimensions: { wardrobeWidth: 1.2, ceilingHeight: 2.6 },
    };
    expect(errors('HALLWAY', 3, full)).toEqual([]);
    expect(hallwayFlowV3.deriveRoom(full)).toMatchObject({ lengthM: 1.2, widthM: 0.5, heightM: 2.6 });
  });
});

describe('etapa 10 rooms-a — versiunile anterioare neschimbate', () => {
  it('dormitor v3: fara 120 × 200, fara intrebarile noi, tavanul mereu; aceeasi descriere', () => {
    expect(optionValues(bedroomFlowV3, 'bedSize')).toEqual(['S_90', 'M_140', 'Q_160', 'K_180', 'CUSTOM']);
    expect(bedroomFlowV3.steps.map((s) => s.id).filter((id) => ['bedLength', 'bedFabric', 'wardrobeInterior'].includes(id))).toEqual([]);
    expect(slotIds(bedroomFlowV3, { piecesNeeded: ['BED_FRAME'] })).toEqual(['ceilingHeight']);
    const bed = { piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160', bedUpholstered: true, bedStorage: 'LIFT_UP', materialBed: 'LEMN_MASIV', dimensions: { ceilingHeight: 2.6 } };
    expect(errors('BEDROOM', 3, bed)).toEqual([]);
    expect(bedroomFlowV3.deriveRoom(bed).items).toEqual([
      { name: 'Pat tapițat', material: 'LEMN_MASIV', systems: [], quantity: 1, description: 'saltea 160 × 200, ladă rabatabilă' },
    ]);
    expect(errors('BEDROOM', 3, { ...bed, bedSize: 'D_120' })).toEqual(['bedSize:validation.optionInvalid']);
    expect(errors('BEDROOM', 3, { ...bed, bedFabric: 'VELVET' })).toEqual(['bedFabric:validation.unknownAnswer']);
    // pe v4, aceleasi raspunsuri (fara tavan, fara stofa) dau aceleasi piese
    const { dimensions: _d, ...v4bed } = bed;
    expect(bedroomFlowV4.deriveRoom(v4bed).items).toEqual(bedroomFlowV3.deriveRoom(bed).items);
  });

  it('living v4, birou v3, hol v2: masurile de dinainte (inaltimi obligatorii, tavan mereu)', () => {
    const living = { piecesNeeded: ['TV_UNIT'] };
    expect(slotIds(livingFlowV4, living)).toEqual(['tvUnitWidth', 'tvUnitHeight', 'ceilingHeight']);
    expect(dims(livingFlowV4).slots(living).every((s) => s.optional === undefined)).toBe(true);
    expect(slotIds(officeFlowV3, { piecesNeeded: ['DESK'] })).toEqual(['deskWidthA', 'ceilingHeight']);
    expect(slotIds(hallwayFlowV2, { piecesNeeded: ['WARDROBE'] })).toEqual(['wardrobeWidth', 'ceilingHeight']);
    expect(hallwayFlowV2.steps.some((s) => s.id === 'hallWidth')).toBe(false);
    for (const f of [bedroomFlowV3, livingFlowV4, officeFlowV3, hallwayFlowV2]) {
      expect(dims(f).subtitleKey).toBe(`flows.${f.roomType}.dimensions.subtitle`);
    }
  });
});

describe('etapa 10 rooms-a — dupa revizuire', () => {
  it('dormitor v4: textul de ajutor al saltelei are cheie noua; v3 ramane cu cea veche', () => {
    expect((step(bedroomFlowV4, 'bedSize') as SingleChoiceStep).info).toEqual({
      titleKey: 'flows.BEDROOM.bedSize.info.title', bodyKey: 'flows.BEDROOM.v4.bedSize.info.body',
    });
    expect((step(bedroomFlowV3, 'bedSize') as SingleChoiceStep).info?.bodyKey).toBe('flows.BEDROOM.bedSize.info.body');
  });

  it('dormitor: "altă mărime" doar pe v4; v3 pastreaza "saltea custom"', () => {
    const custom = {
      piecesNeeded: ['BED_FRAME'], bedSize: 'CUSTOM', bedCustomSize: { bedCustomWidth: 0.7, bedCustomLength: 1.6 },
      bedUpholstered: false, bedStorage: 'NONE', materialBed: 'PAL',
    };
    expect(bedroomFlowV4.deriveRoom(custom).items[0].description).toBe('saltea 70 × 160 cm (altă mărime)');
    expect(bedroomFlowV3.deriveRoom({ ...custom, dimensions: { ceilingHeight: 2.6 } }).items[0].description)
      .toBe('saltea custom 70 × 160 cm');
  });

  it('hol v3: "Nu stiu — o masoara firma" are descriere proprie', () => {
    const fd = (step(hallwayFlowV3, 'hallWidth') as SingleChoiceStep).options.find((o) => o.value === 'FIRM_DECIDES');
    expect(fd).toMatchObject({
      labelKey: 'flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label',
      descriptionKey: 'flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.description',
      scoring: { category: 'HALLWAY_WIDTH', optionKey: 'FIRM_DECIDES' },
    });
  });

  const bed: AnswerMap = { piecesNeeded: ['BED_FRAME'], bedUpholstered: false, bedStorage: 'NONE', materialBed: 'LEMN_MASIV' };

  it('dormitor: lungimea 190, apoi "Dimensiuni custom" → lungimea se curata si nu apare in descriere', () => {
    const before = { ...bed, bedSize: 'M_140', bedLength: 'L_190' };
    expect(errors('BEDROOM', 4, before)).toEqual([]);
    const switched = { ...before, bedSize: 'CUSTOM', bedCustomSize: { bedCustomWidth: 1.4, bedCustomLength: 1.9 } };
    // derivarea ignora lungimea ramasa chiar inainte de curatare
    expect(bedroomFlowV4.deriveRoom(switched).items[0].description).toBe('saltea 140 × 190 cm (altă mărime)');
    const pruned = pruneAnswers(bedroomFlowV4, switched);
    expect(pruned).not.toHaveProperty('bedLength');
    expect(errors('BEDROOM', 4, pruned)).toEqual([]);
    expect(bedroomFlowV4.deriveRoom(pruned).items[0].description).toBe('saltea 140 × 190 cm (altă mărime)');
  });

  it('dormitor: dulapul debifat dupa interior / inaltime → raspunsurile ramase se curata, nu blocheaza, nu apar', () => {
    const withWardrobe: AnswerMap = {
      piecesNeeded: ['WARDROBE', 'DRESSER'], sameFinishAll: false,
      wardrobeDoorType: 'SLIDING', materialWardrobe: 'PAL', wardrobeInterior: ['SHELVES', 'DRAWERS'],
      materialDresser: 'PAL', systemsDresser: ['MANER'],
      dimensions: { wardrobeWidth: 2, wardrobeHeight: 2.4, dresserWidth: 1.2, ceilingHeight: 2.6 },
    };
    expect(errors('BEDROOM', 4, withWardrobe)).toEqual([]);
    const pruned = pruneAnswers(bedroomFlowV4, { ...withWardrobe, piecesNeeded: ['DRESSER'] });
    for (const id of ['wardrobeDoorType', 'materialWardrobe', 'wardrobeInterior', 'sameFinishAll']) {
      expect(pruned).not.toHaveProperty(id);
    }
    expect(pruned.dimensions).toEqual({ dresserWidth: 1.2 });
    expect(errors('BEDROOM', 4, pruned)).toEqual([]);
    const derived = bedroomFlowV4.deriveRoom(pruned);
    expect(derived.items.map((i) => i.name)).toEqual(['Comodă']);
    expect(JSON.stringify(derived.items)).not.toContain('Interior dulap');

    // doar patul ramas → tot pasul de dimensiuni dispare
    const bedOnly = pruneAnswers(bedroomFlowV4, { ...withWardrobe, ...bed, piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160' });
    for (const id of ['dimensions', 'wardrobeInterior', 'materialDresser', 'systemsDresser']) {
      expect(bedOnly).not.toHaveProperty(id);
    }
    expect(errors('BEDROOM', 4, bedOnly)).toEqual([]);
  });

  it('raspunsuri minime pe fiecare versiune noua: publicarea trece, derivarea / rezumatul / scorul merg', () => {
    const minimal: [RoomFlow['roomType'], number, AnswerMap][] = [
      ['BEDROOM', 4, { piecesNeeded: ['DRESSER'], dimensions: { dresserWidth: 1 }, materialDresser: 'FIRM_DECIDES', systemsDresser: ['FIRM_DECIDES'] }],
      ['LIVING', 5, { piecesNeeded: ['COFFEE_TABLE'], dimensions: { coffeeTableLength: 1 }, materialCoffeeTable: 'PAL' }],
      ['OFFICE', 4, { piecesNeeded: ['WALL_SHELVES'], dimensions: { shelvesTotal: 1.5 }, materialShelves: 'PAL' }],
      ['HALLWAY', 3, { piecesNeeded: ['MIRROR'], dimensions: { mirrorWidth: 0.6 }, materialMirror: 'FIRM_DECIDES' }],
    ];
    for (const [rt, v, a] of minimal) {
      expect(errors(rt, v, a)).toEqual([]);
      const derived = getFlow(rt, v).deriveRoom(a);
      expect(derived.items).toHaveLength(1);
      expect(derived.lengthM).toBeGreaterThan(0);
      expect(summarizeAnswers(rt, a, v).length).toBeGreaterThan(0);
      expect(scoreKeys(rt, v, a)).toContain(`ROOM_TYPE:${rt}`);
      // fara intrebarile noi si fara tavan (nicio piesa inalta)
      expect(JSON.stringify(a)).not.toContain('ceilingHeight');
    }
  });
});
