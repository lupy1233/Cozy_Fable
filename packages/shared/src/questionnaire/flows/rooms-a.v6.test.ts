import { describe, expect, it } from 'vitest';
import { getFlow, validateRoomAnswers, visibleOptions, visibleSteps } from '../engine';
import type { AnswerMap, MultiChoiceStep, QuestionStep, RoomFlow, SingleChoiceStep } from '../types';
import { bedroomFlowV3 } from './bedroom.v3';
import {
  BODY_NOTE,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  NO_FRONTS_NOTE,
  PISTONS_NOTE,
} from './finish-sets';
import { hallwayFlowV2 } from './hallway.v2';
import { livingFlowV4 } from './living.v4';
import { officeFlowV3 } from './office.v3';

// Etapa 6, pachetul A: dormitor v3, hol v2, birou v3, living v4 (DESIGN §3, §5.3–5.5, §5.10).

// copie minimala a room-screens.ts (frontend): pasii consecutivi cu acelasi screenGroup = un ecran
function groupScreens(steps: QuestionStep[]): QuestionStep[][] {
  const screens: QuestionStep[][] = [];
  for (const s of steps) {
    const last = screens[screens.length - 1];
    if (last && s.screenGroup && last[0]?.screenGroup === s.screenGroup) last.push(s);
    else screens.push([s]);
  }
  return screens;
}
const screens = (flow: RoomFlow, answers: AnswerMap) =>
  groupScreens(visibleSteps(flow, answers).filter((s) => !s.hidden));
const visibleIds = (flow: RoomFlow, answers: AnswerMap) => visibleSteps(flow, answers).map((s) => s.id);
const step = (flow: RoomFlow, id: string) => flow.steps.find((s) => s.id === id) as QuestionStep;
const optionValues = (flow: RoomFlow, id: string, answers: AnswerMap = {}) =>
  visibleOptions(step(flow, id) as SingleChoiceStep | MultiChoiceStep, answers).map((o) => o.value);
function errors(roomType: RoomFlow['roomType'], version: number, answers: AnswerMap) {
  const r = validateRoomAnswers(roomType, answers, { partial: false, version });
  return r.ok ? [] : r.errors.map((e) => `${e.stepId}:${e.messageKey}`);
}

describe('etapa 6 — versiunile inregistrate', () => {
  it('getFlow intoarce fluxurile noi; versiunile vechi raman', () => {
    expect(getFlow('BEDROOM', 3)).toBe(bedroomFlowV3);
    expect(getFlow('HALLWAY', 2)).toBe(hallwayFlowV2);
    expect(getFlow('OFFICE', 3)).toBe(officeFlowV3);
    expect(getFlow('LIVING', 4)).toBe(livingFlowV4);
    expect(getFlow('BEDROOM', 2).version).toBe(2);
    expect(getFlow('HALLWAY', 1).version).toBe(1);
  });

  it('id-uri unice si titluri de material pe versiune', () => {
    for (const [flow, v] of [[bedroomFlowV3, 'v3'], [hallwayFlowV2, 'v2'], [officeFlowV3, 'v3'], [livingFlowV4, 'v4']] as const) {
      const ids = flow.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of flow.steps) {
        if (/^material[A-Z]/.test(s.id) && s.id !== 'materialAll' && s.type === 'single-choice') {
          expect(s.titleKey).toBe(`flows.${flow.roomType}.${v}.${s.id}.title`);
        }
      }
    }
  });
});

describe('etapa 6 — hol v2', () => {
  const dims = { coatUnitWidth: 1, mirrorWidth: 0.6, ceilingHeight: 2.6 };

  it('cuier + oglinda → niciun pas de deschidere; oglinda cu setul ramei', () => {
    const answers: AnswerMap = { piecesNeeded: ['COAT_UNIT', 'MIRROR'] };
    const ids = visibleIds(hallwayFlowV2, answers);
    expect(ids.filter((id) => id.startsWith('systems'))).toEqual([]);
    expect(ids).not.toContain('sameFinishAll');
    expect(hallwayFlowV2.steps.some((s) => s.id === 'systemsCoatUnit' || s.id === 'systemsMirror')).toBe(false);
    expect(optionValues(hallwayFlowV2, 'materialMirror')).toEqual([
      'MIRROR_FRAMELESS', 'MIRROR_FRAME_WOOD', 'MIRROR_FRAME_MDF', 'MIRROR_FRAME_METAL', 'FIRM_DECIDES',
    ]);
    const full = { ...answers, dimensions: dims, materialCoatUnit: 'PAL', materialMirror: 'MIRROR_FRAME_METAL' };
    expect(errors('HALLWAY', 2, full)).toEqual([]);
    expect(hallwayFlowV2.deriveRoom(full).items).toEqual([
      { name: 'Cuier cu panou', material: 'PAL', systems: [], quantity: 1 },
      { name: 'Oglindă cu poliță', material: 'ALTUL', systems: [], quantity: 1, description: 'Ramă: metal' },
    ]);
  });

  it('banca → pas cu "Fara usi sau sertare", care lasa piesa fara sisteme', () => {
    expect(optionValues(hallwayFlowV2, 'systemsBench')).toEqual(['MANER', 'PUSH', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(optionValues(hallwayFlowV2, 'systemsShoeCabinet')).not.toContain('NO_FRONTS');
    const answers: AnswerMap = {
      piecesNeeded: ['BENCH'], dimensions: { benchWidth: 1 }, materialBench: 'PAL', systemsBench: ['NO_FRONTS'],
    };
    expect(errors('HALLWAY', 2, answers)).toEqual([]);
    expect(hallwayFlowV2.deriveRoom(answers).items).toEqual([
      { name: 'Băncuță hol', material: 'PAL', systems: [], quantity: 1, description: NO_FRONTS_NOTE },
    ]);
  });

  it('dulapul de hol: tipul usilor pe ecranul lui; glisante → GLISANTE, batante → deschidere', () => {
    const base: AnswerMap = { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 1.2, ceilingHeight: 2.6 }, materialWardrobe: 'PAL' };
    expect(step(hallwayFlowV2, 'wardrobeDoorType')).toMatchObject({ titleKey: 'flows.HALLWAY.wardrobeDoorType.title', screenGroup: 'piece:WARDROBE' });
    const sliding = { ...base, wardrobeDoorType: 'SLIDING' };
    expect(visibleIds(hallwayFlowV2, sliding)).not.toContain('systemsWardrobe');
    expect(errors('HALLWAY', 2, sliding)).toEqual([]);
    expect(hallwayFlowV2.deriveRoom(sliding).items[0].systems).toEqual(['GLISANTE']);
    expect(errors('HALLWAY', 2, { ...sliding, systemsWardrobe: ['MANER'] })).toEqual(['systemsWardrobe:validation.unknownAnswer']);
    const hinged = { ...base, wardrobeDoorType: 'HINGED', systemsWardrobe: ['MANER'] };
    expect(errors('HALLWAY', 2, hinged)).toEqual([]);
    expect(hallwayFlowV2.deriveRoom(hinged).items[0].systems).toEqual(['MANER']);
  });
});

describe('etapa 6 — dormitor v3', () => {
  const ALL6 = ['WARDROBE', 'BED_FRAME', 'NIGHTSTANDS', 'DRESSER', 'TV_UNIT', 'VANITY'];
  const dims = { wardrobeWidth: 2.4, nightstandWidth: 0.5, dresserWidth: 1.2, tvUnitWidth: 1.6, vanityWidth: 1, ceilingHeight: 2.6 };

  it('ordinea ecranelor: piese (+ intrebarea comuna), saltea (3 intrebari), dimensiuni, piesele, comun, schita', () => {
    expect(bedroomFlowV3.steps.map((s) => `${s.id}@${s.screenGroup ?? ''}`)).toEqual([
      'piecesNeeded@pieces', 'sameFinishAll@pieces',
      'bedSize@bedSize', 'bedCustomSize@bedSize', 'bedUpholstered@bedSize',
      'dimensions@',
      'wardrobeDoorType@piece:WARDROBE', 'materialWardrobe@piece:WARDROBE', 'materialWardrobeOther@piece:WARDROBE', 'systemsWardrobe@piece:WARDROBE',
      'bedStorage@piece:BED_FRAME', 'materialBed@piece:BED_FRAME', 'systemsBed@piece:BED_FRAME',
      'nightstandsCount@piece:NIGHTSTANDS', 'materialNightstands@piece:NIGHTSTANDS', 'materialNightstandsOther@piece:NIGHTSTANDS', 'systemsNightstands@piece:NIGHTSTANDS',
      'materialDresser@piece:DRESSER', 'materialDresserOther@piece:DRESSER', 'systemsDresser@piece:DRESSER',
      'materialTvUnit@piece:TV_UNIT', 'materialTvUnitOther@piece:TV_UNIT', 'systemsTvUnit@piece:TV_UNIT',
      'materialVanity@piece:VANITY', 'materialVanityOther@piece:VANITY', 'systemsVanity@piece:VANITY',
      'materialAll@piece:ALL', 'materialAllOther@piece:ALL', 'systemsAll@piece:ALL',
      'sketch@',
    ]);
    expect(optionValues(bedroomFlowV3, 'materialBed')).toEqual(['LEMN_MASIV', 'MDF_FURNIR', 'PAL', 'FIRM_DECIDES']);
    expect(optionValues(bedroomFlowV3, 'systemsTvUnit')).toEqual(['MANER', 'PUSH', 'PISTONS', 'FIRM_DECIDES']);
    expect(optionValues(bedroomFlowV3, 'systemsVanity')).toEqual(['MANER', 'PUSH', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(optionValues(bedroomFlowV3, 'systemsWardrobe')).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
  });

  it('patul: fara depozitare / lada → fara deschidere; cu sertare → deschidere vizibila', () => {
    const base: AnswerMap = { piecesNeeded: ['BED_FRAME'] };
    expect(visibleIds(bedroomFlowV3, { ...base, bedStorage: 'NONE' })).not.toContain('systemsBed');
    expect(visibleIds(bedroomFlowV3, { ...base, bedStorage: 'LIFT_UP' })).not.toContain('systemsBed');
    expect(visibleIds(bedroomFlowV3, { ...base, bedStorage: 'DRAWERS' })).toContain('systemsBed');
    const none = { ...base, bedSize: 'Q_160', bedUpholstered: false, dimensions: { ceilingHeight: 2.6 }, bedStorage: 'NONE', materialBed: 'LEMN_MASIV' };
    expect(errors('BEDROOM', 3, none)).toEqual([]);
    expect(bedroomFlowV3.deriveRoom(none).items).toEqual([
      { name: 'Cadru pat', material: 'LEMN_MASIV', systems: [], quantity: 1, description: 'saltea 160 × 200' },
    ]);
    const drawers = { ...none, bedStorage: 'DRAWERS', systemsBed: ['PUSH'], bedUpholstered: true };
    expect(errors('BEDROOM', 3, drawers)).toEqual([]);
    const derived = bedroomFlowV3.deriveRoom(drawers);
    expect(derived.items).toEqual([
      { name: 'Pat tapițat', material: 'LEMN_MASIV', systems: ['PUSH'], quantity: 1, description: 'saltea 160 × 200, sertare laterale' },
    ]);
    expect(derived.lengthM).toBeCloseTo(1.6);
  });

  it('dulap glisant → GLISANTE, deschiderea respinsa; batant + Push → PUSH', () => {
    const base: AnswerMap = { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_VOPSIT' };
    const sliding = { ...base, wardrobeDoorType: 'SLIDING' };
    expect(errors('BEDROOM', 3, sliding)).toEqual([]);
    expect(bedroomFlowV3.deriveRoom(sliding).items).toEqual([
      { name: 'Dulap dormitor', material: 'MDF_VOPSIT', systems: ['GLISANTE'], quantity: 1, description: BODY_NOTE },
    ]);
    expect(errors('BEDROOM', 3, { ...sliding, systemsWardrobe: ['MANER'] })).toEqual(['systemsWardrobe:validation.unknownAnswer']);
    const hinged = { ...base, wardrobeDoorType: 'HINGED', systemsWardrobe: ['PUSH'] };
    expect(errors('BEDROOM', 3, hinged)).toEqual([]);
    expect(bedroomFlowV3.deriveRoom(hinged).items[0].systems).toEqual(['PUSH']);
    // GLISANTE nu mai e in lista de deschidere
    expect(errors('BEDROOM', 3, { ...base, wardrobeDoorType: 'HINGED', systemsWardrobe: ['GLISANTE'] })).toEqual([
      'systemsWardrobe:validation.optionInvalid',
    ]);
  });

  it('6 piese: "Nu" → 10 ecrane, "Da" → 8 ecrane cu un singur ecran de material pentru corpuri', () => {
    const base: AnswerMap = { piecesNeeded: ALL6, wardrobeDoorType: 'HINGED', bedStorage: 'DRAWERS', nightstandsCount: 'TWO' };
    const no = screens(bedroomFlowV3, { ...base, sameFinishAll: false });
    expect(no.map((s) => s[0].screenGroup ?? s[0].id)).toEqual([
      'pieces', 'bedSize', 'dimensions',
      'piece:WARDROBE', 'piece:BED_FRAME', 'piece:NIGHTSTANDS', 'piece:DRESSER', 'piece:TV_UNIT', 'piece:VANITY',
      'sketch',
    ]);
    expect(no.length).toBeLessThanOrEqual(10);
    // cel mult 3 intrebari pe ecran; textul "Altul" nu se numara (N12)
    for (const sc of screens(bedroomFlowV3, { ...base, sameFinishAll: false, bedSize: 'CUSTOM' })) {
      expect(sc.filter((s) => !s.id.endsWith('Other')).length).toBeLessThanOrEqual(3);
    }

    const yes = screens(bedroomFlowV3, { ...base, sameFinishAll: true });
    expect(yes.map((s) => s.map((x) => x.id))).toEqual([
      ['piecesNeeded', 'sameFinishAll'], ['bedSize', 'bedUpholstered'], ['dimensions'],
      ['wardrobeDoorType'], ['bedStorage', 'materialBed', 'systemsBed'], ['nightstandsCount'],
      ['materialAll', 'systemsAll'], ['sketch'],
    ]);
    const bodyMaterialScreens = yes.filter((sc) =>
      sc.some((s) => s.type === 'single-choice' && s.id.startsWith('material') && s.id !== 'materialBed'),
    );
    expect(bodyMaterialScreens).toHaveLength(1);
  });

  it('"Da" → toate piesele comune cu acelasi material si aceeasi deschidere (patul ramane al lui)', () => {
    const answers: AnswerMap = {
      piecesNeeded: ALL6, sameFinishAll: true, wardrobeDoorType: 'SLIDING', bedStorage: 'NONE', nightstandsCount: 'ONE',
      bedSize: 'K_180', bedUpholstered: false, dimensions: dims,
      materialBed: 'PAL', materialAll: 'MDF_INFOLIAT', systemsAll: ['MANER'],
    };
    expect(errors('BEDROOM', 3, answers)).toEqual([]);
    const items = bedroomFlowV3.deriveRoom(answers).items;
    expect(items.map((i) => [i.name, i.material, i.systems, i.quantity])).toEqual([
      ['Dulap dormitor', 'MDF_INFOLIAT', ['GLISANTE'], 1],
      ['Cadru pat', 'PAL', [], 1],
      ['Noptiere', 'MDF_INFOLIAT', ['MANER'], 1],
      ['Comodă', 'MDF_INFOLIAT', ['MANER'], 1],
      ['Comodă TV', 'MDF_INFOLIAT', ['MANER'], 1],
      ['Măsuță toaletă', 'MDF_INFOLIAT', ['MANER'], 1],
    ]);
    // pe ecranul comun "Fara usi sau sertare" nu apare (sunt piese cu fronturi sigure)
    expect(optionValues(bedroomFlowV3, 'systemsAll', answers)).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
  });

  it('"decide firma" fara text acceptat pe v3 si respins pe v2', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['DRESSER'], dimensions: { dresserWidth: 1.2, ceilingHeight: 2.6 },
      materialDresser: 'FIRM_DECIDES', systemsDresser: ['FIRM_DECIDES'],
    };
    expect(errors('BEDROOM', 3, answers)).toEqual([]);
    const derived = bedroomFlowV3.deriveRoom(answers);
    expect(derived.items).toEqual([
      { name: 'Comodă', material: 'ALTUL', systems: [], quantity: 1, description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}` },
    ]);
    expect(derived.firmRecommendations).toEqual([{ itemName: 'Comodă', material: true, opening: true }]);
    expect(errors('BEDROOM', 2, answers)).toEqual([
      'materialDresser:validation.optionInvalid',
      'systemsDresser:validation.optionInvalid',
    ]);
    // "Decide firma" e exclusiva la deschidere
    expect(errors('BEDROOM', 3, { ...answers, systemsDresser: ['MANER', 'FIRM_DECIDES'] })).toEqual([
      'systemsDresser:validation.exclusiveOption',
    ]);
  });

  it('pistoane la comoda TV → AVENTOS + nota', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['TV_UNIT'], dimensions: { tvUnitWidth: 1.6, ceilingHeight: 2.6 },
      materialTvUnit: 'PAL', systemsTvUnit: ['MANER', 'PISTONS'],
    };
    expect(errors('BEDROOM', 3, answers)).toEqual([]);
    expect(bedroomFlowV3.deriveRoom(answers).items).toEqual([
      { name: 'Comodă TV', material: 'PAL', systems: ['MANER', 'AVENTOS'], quantity: 1, description: `${BODY_NOTE}; ${PISTONS_NOTE}` },
    ]);
  });
});

describe('etapa 6 — birou v3', () => {
  it('biroul si biblioteca cu "Fara usi sau sertare", dulapul fara; rafturile fara deschidere', () => {
    expect(optionValues(officeFlowV3, 'systemsDesk')).toContain('NO_FRONTS');
    expect(optionValues(officeFlowV3, 'systemsBookshelf')).toContain('NO_FRONTS');
    expect(optionValues(officeFlowV3, 'systemsStorage')).not.toContain('NO_FRONTS');
    expect(officeFlowV3.steps.some((s) => s.id === 'systemsShelves')).toBe(false);
    const answers: AnswerMap = {
      piecesNeeded: ['DESK', 'WALL_SHELVES'], deskShape: 'STRAIGHT',
      dimensions: { deskWidthA: 1.4, shelvesTotal: 2, ceilingHeight: 2.6 },
      materialDesk: 'MDF_FURNIR', systemsDesk: ['NO_FRONTS'], materialShelves: 'FIRM_DECIDES',
    };
    expect(errors('OFFICE', 3, answers)).toEqual([]);
    const derived = officeFlowV3.deriveRoom(answers);
    expect(derived.items).toEqual([
      { name: 'Birou', material: 'MDF_FURNIR', systems: [], quantity: 1, description: NO_FRONTS_NOTE },
      { name: 'Rafturi perete', material: 'ALTUL', systems: [], quantity: 1, description: FIRM_MATERIAL_NOTE },
    ]);
    expect(derived.firmRecommendations).toEqual([{ itemName: 'Rafturi perete', material: true, opening: false }]);
  });

  it('"Da" cu birou + biblioteca → raspunsul comun pe ambele; "Fara usi" pe ecranul comun', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['DESK', 'BOOKSHELF'], sameFinishAll: true, deskShape: 'L_SHAPE',
      dimensions: { deskWidthA: 1.4, deskWidthB: 1, bookshelfWidth: 1, ceilingHeight: 2.6 },
      materialAll: 'PAL', systemsAll: ['NO_FRONTS'],
    };
    expect(errors('OFFICE', 3, answers)).toEqual([]);
    expect(officeFlowV3.deriveRoom(answers).items.map((i) => [i.name, i.material, i.systems])).toEqual([
      ['Birou', 'PAL', []],
      ['Bibliotecă', 'PAL', []],
    ]);
    // cu dulapul bifat, "Fara usi" dispare de pe ecranul comun
    expect(optionValues(officeFlowV3, 'systemsAll', { ...answers, piecesNeeded: ['DESK', 'STORAGE'] })).not.toContain('NO_FRONTS');
  });
});

describe('etapa 6 — living v4', () => {
  it('ecranul pieselor: lista, textul piesei libere si intrebarea comuna; masuta (lemn) si rafturi fara deschidere', () => {
    const sc = screens(livingFlowV4, { piecesNeeded: ['TV_UNIT', 'OTHER'] });
    expect(sc[0].map((s) => s.id)).toEqual(['piecesNeeded', 'piecesOtherText', 'sameFinishAll']);
    expect(livingFlowV4.steps.some((s) => s.id === 'systemsCoffeeTable' || s.id === 'systemsShelves')).toBe(false);
    expect(optionValues(livingFlowV4, 'materialCoffeeTable')).toEqual(['LEMN_MASIV', 'MDF_FURNIR', 'PAL', 'FIRM_DECIDES']);
    expect(optionValues(livingFlowV4, 'systemsTvUnit')).toEqual(['MANER', 'PUSH', 'PISTONS', 'FIRM_DECIDES']);
    expect(optionValues(livingFlowV4, 'systemsOtherPiece')).toContain('NO_FRONTS');
    expect(optionValues(livingFlowV4, 'systemsDisplay')).not.toContain('NO_FRONTS');
    // LED si schita dupa ecranul comun
    const ids = livingFlowV4.steps.map((s) => s.id);
    expect(ids.indexOf('ledPieces')).toBeGreaterThan(ids.indexOf('systemsAll'));
  });

  it('derivarea: LED, numele TV dupa stil, piesa libera, recomandarea firmei redenumita', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['TV_UNIT', 'COFFEE_TABLE', 'OTHER'], piecesOtherText: 'Bar de colț', sameFinishAll: false,
      tvStyle: 'FLOATING',
      dimensions: { tvUnitWidth: 2, tvUnitHeight: 0.4, coffeeTableLength: 1, coffeeTableHeight: 0.4, otherWidth: 1, otherHeight: 1, ceilingHeight: 2.6 },
      materialTvUnit: 'MDF_VOPSIT', systemsTvUnit: ['PISTONS'],
      materialCoffeeTable: 'LEMN_MASIV',
      materialOtherPiece: 'PAL', systemsOtherPiece: ['FIRM_DECIDES'],
      ledPieces: ['TV_UNIT'],
    };
    expect(errors('LIVING', 4, answers)).toEqual([]);
    const derived = livingFlowV4.deriveRoom(answers);
    expect(derived.items).toEqual([
      { name: 'Comodă TV suspendată', material: 'MDF_VOPSIT', systems: ['AVENTOS'], quantity: 1, description: `${BODY_NOTE}; ${PISTONS_NOTE}; Cu iluminare LED` },
      { name: 'Măsuță cafea', material: 'LEMN_MASIV', systems: [], quantity: 1 },
      { name: 'Bar de colț', material: 'PAL', systems: [], quantity: 1, description: `${BODY_NOTE}; ${FIRM_OPENING_NOTE}` },
    ]);
    expect(derived.firmRecommendations).toEqual([{ itemName: 'Bar de colț', material: false, opening: true }]);
  });

  it('"Da": toate corpurile comune primesc materialul si deschiderea comune', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['TV_UNIT', 'BOOKSHELF', 'DISPLAY_CABINET', 'WALL_SHELVES'], sameFinishAll: true, tvStyle: 'ON_FLOOR',
      dimensions: { tvUnitWidth: 2, tvUnitHeight: 0.5, bookshelfWidth: 1, bookshelfHeight: 2, displayWidth: 1, displayHeight: 2, shelvesTotal: 1, shelvesHeight: 0.5, ceilingHeight: 2.6 },
      materialAll: 'LEMN_MASIV', systemsAll: ['PUSH'], materialShelves: 'PAL',
    };
    expect(errors('LIVING', 4, answers)).toEqual([]);
    expect(livingFlowV4.deriveRoom(answers).items.map((i) => [i.name, i.material, i.systems])).toEqual([
      ['Comodă TV', 'LEMN_MASIV', ['PUSH']],
      ['Bibliotecă', 'LEMN_MASIV', ['PUSH']],
      ['Vitrină', 'LEMN_MASIV', ['PUSH']],
      ['Rafturi suspendate', 'PAL', []],
    ]);
  });

  it('"Fara usi sau sertare" si "decide firma" respinse pe v3', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['BOOKSHELF'], dimensions: { bookshelfWidth: 1, bookshelfHeight: 2, ceilingHeight: 2.6 },
      materialBookshelf: 'PAL', systemsBookshelf: ['NO_FRONTS'],
    };
    expect(errors('LIVING', 4, answers)).toEqual([]);
    expect(errors('LIVING', 3, answers)).toEqual(['systemsBookshelf:validation.optionInvalid']);
  });
});
