import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  firmRecommendations,
  validateRoomAnswers,
} from '../../engine';
import { defaultPieceConfig, normalizePieceConfig, type Piece3dKind, type PieceConfig3d } from '../../piece3d';
import type { AnswerMap, ChoiceOption, RoomFlow, SingleChoiceStep } from '../../types';
import {
  BODY_NOTE,
  FIRM_MATERIAL_NOTE,
  FRAME_BY_FIRM_NOTE,
  INTEGRAL_MDF_NOTE,
  PISTONS_NOTE,
} from '../finish-sets';
import { catalogFlowRegistry } from './catalog-v1';
import { catalogFlowRegistryV2, catalogFlowVersionsV2 } from './catalog-v2';
import { pieceBedFlowV4, pieceBenchFlowV4, pieceTableFlowV4 } from './furniture-v4';
import {
  pieceBookcaseFlowV4,
  pieceDeskFlowV4,
  pieceDresserFlowV4,
  pieceNightstandFlowV4,
  pieceShoeCabinetFlowV4,
  pieceTvUnitFlowV4,
  pieceWardrobeFlowV4,
} from './v4';

// Etapa 6 (DESIGN §5.12–5.14, pachetul D): piesele ghidate v4, pat / masa / banca v4,
// piesele de catalog v2.

const stepIds = (flow: RoomFlow) => flow.steps.map((s) => s.id);
const materialStep = (flow: RoomFlow) => flow.steps.find((s) => s.id === 'material') as SingleChoiceStep | undefined;
const values = (opts: ChoiceOption[]) => opts.map((o) => o.value);

function cfg(kind: Piece3dKind, patch: Partial<PieceConfig3d> = {}): PieceConfig3d {
  return normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...patch });
}

const tvWithFronts = (frontStyle: 'HANDLE' | 'PUSH' = 'HANDLE') =>
  cfg('TV_UNIT', {
    widthM: 1.6,
    columns: [{ zones: [{ type: 'DOOR' }] }, { zones: [{ type: 'DRAWERS', count: 1 }] }],
    frontStyle,
  });

const v4Pieces: [string, RoomFlow][] = [
  ['PIECE_WARDROBE', pieceWardrobeFlowV4],
  ['PIECE_TV_UNIT', pieceTvUnitFlowV4],
  ['PIECE_BOOKCASE', pieceBookcaseFlowV4],
  ['PIECE_DESK', pieceDeskFlowV4],
  ['PIECE_DRESSER', pieceDresserFlowV4],
  ['PIECE_SHOE_CABINET', pieceShoeCabinetFlowV4],
  ['PIECE_NIGHTSTAND', pieceNightstandFlowV4],
];

describe('piesele-corp ghidate v4 — o singura sursa de deschidere (3D)', () => {
  it('niciun flux v4 nu are openingSystems sau doorType; materialul e setul BODY cu "decide firma"', () => {
    for (const [rt, flow] of v4Pieces) {
      expect(flow.roomType, rt).toBe(rt);
      expect(flow.version, rt).toBe(4);
      expect(stepIds(flow), rt).not.toContain('openingSystems');
      expect(stepIds(flow), rt).not.toContain('doorType');
      const m = materialStep(flow)!;
      expect(m.titleKey, rt).toBe(`flows.${rt}.v4.material.title`);
      expect(m.subtitleKey).toBe('common.finish.frontMaterial.subtitle');
      expect(values(m.options)).toEqual(['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL', 'FIRM_DECIDES']);
      expect(stepIds(flow)).toContain('materialOther');
      // pasul de pistoane exista doar la comoda TV
      expect(stepIds(flow).includes('liftUpDoors'), rt).toBe(rt === 'PIECE_TV_UNIT');
    }
    // pasii ortogonali pastrati (id-uri neschimbate)
    expect(stepIds(pieceTvUnitFlowV4)).toContain('tvSetup');
    expect(stepIds(pieceNightstandFlowV4)).toContain('count');
    expect(stepIds(pieceDeskFlowV4)).toContain('cableManagement');
  });

  it('comoda TV: sistemul = alegerea din 3D; un raspuns openingSystems e respins pe v4, acceptat pe v3', () => {
    const answers: AnswerMap = { config3d: tvWithFronts('HANDLE'), tvSetup: 'TV_ON_WALL', material: 'MDF_VOPSIT' };
    const res = validateRoomAnswers('PIECE_TV_UNIT', answers, { partial: false, version: 4 });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const item = pieceTvUnitFlowV4.deriveRoom(answers).items[0];
    expect(item.systems).toEqual(['MANER']);
    expect(item.material).toBe('MDF_VOPSIT');
    expect(item.description).toContain(BODY_NOTE);

    const withOld = { ...answers, openingSystems: ['PUSH'] };
    expect(validateRoomAnswers('PIECE_TV_UNIT', withOld, { partial: false, version: 4 }).ok).toBe(false);
    expect(validateRoomAnswers('PIECE_TV_UNIT', withOld, { partial: false, version: 3 }).ok).toBe(true);
  });

  it('comoda TV cu pistoane → AVENTOS + nota; fara bifa → doar sistemul din 3D', () => {
    const answers: AnswerMap = { config3d: tvWithFronts('PUSH'), tvSetup: 'UNDECIDED', material: 'PAL', liftUpDoors: true };
    expect(validateRoomAnswers('PIECE_TV_UNIT', answers, { partial: false, version: 4 }).ok).toBe(true);
    const item = pieceTvUnitFlowV4.deriveRoom(answers).items[0];
    expect(item.systems).toEqual(['PUSH', 'AVENTOS']);
    expect(item.description).toContain(PISTONS_NOTE);
    expect(item.description).toContain(BODY_NOTE);
    const off = pieceTvUnitFlowV4.deriveRoom({ ...answers, liftUpDoors: false }).items[0];
    expect(off.systems).toEqual(['PUSH']);
    expect(off.description).not.toContain(PISTONS_NOTE);
  });

  it('revizuire m3: comoda TV fara fronturi + pistoane bifate → nimic adaugat (nici sistem, nici nota, nici cost)', () => {
    const open = cfg('TV_UNIT', { columns: [{ zones: [{ type: 'OPEN' }] }, { zones: [{ type: 'OPEN' }] }], frontStyle: 'HANDLE' });
    const answers: AnswerMap = { config3d: open, tvSetup: 'UNDECIDED', material: 'PAL', liftUpDoors: true };
    expect(validateRoomAnswers('PIECE_TV_UNIT', answers, { partial: false, version: 4 }).ok).toBe(true);
    const item = pieceTvUnitFlowV4.deriveRoom(answers).items[0];
    expect(item.systems).toEqual([]);
    expect(item.description ?? '').not.toContain(PISTONS_NOTE);
    const sys = collectScoreEntries('PIECE_TV_UNIT', answers, 4).filter((e) => e.category === 'SYSTEM');
    expect(sys.every((e) => 'optionKeys' in e && e.optionKeys.length === 0)).toBe(true);
  });

  it('liftUpDoors nu exista la alte piese ghidate (raspunsul e respins)', () => {
    const answers: AnswerMap = { config3d: cfg('DRESSER'), material: 'PAL', liftUpDoors: true };
    expect(validateRoomAnswers('PIECE_DRESSER', answers, { partial: false, version: 4 }).ok).toBe(false);
  });

  it('biblioteca cu toate zonele deschise → fara sistem si fara "Corp: PAL standard", chiar cu frontStyle setat', () => {
    const config = cfg('BOOKCASE', {
      columns: [{ zones: [{ type: 'OPEN', fill: 'SHELVES', count: 4 }] }, { zones: [{ type: 'OPEN' }] }],
      frontStyle: 'HANDLE',
    });
    const answers: AnswerMap = { config3d: config, material: 'LEMN_MASIV' };
    expect(validateRoomAnswers('PIECE_BOOKCASE', answers, { partial: false, version: 4 }).ok).toBe(true);
    const item = pieceBookcaseFlowV4.deriveRoom(answers).items[0];
    expect(item.systems).toEqual([]);
    expect(item.description ?? '').not.toContain(BODY_NOTE);
    // aceeasi biblioteca, cu o zona cu usi → MANER
    const withDoor = cfg('BOOKCASE', {
      columns: [{ zones: [{ type: 'OPEN' }, { type: 'DOOR' }] }],
      frontStyle: 'HANDLE',
    });
    expect(pieceBookcaseFlowV4.deriveRoom({ config3d: withDoor, material: 'PAL' }).items[0].systems).toEqual(['MANER']);
  });

  it('dulapul: glisant / batant doar din 3D; doorType e respins pe v4', () => {
    const sliding = cfg('WARDROBE', { doorMode: 'SLIDING', frontStyle: 'HANDLE', heightM: 2.6 });
    const answers: AnswerMap = { config3d: sliding, material: 'PAL' };
    expect(validateRoomAnswers('PIECE_WARDROBE', answers, { partial: false, version: 4 }).ok).toBe(true);
    const item = pieceWardrobeFlowV4.deriveRoom(answers).items[0];
    expect(item.systems).toEqual(['GLISANTE', 'MANER']);
    expect(item.name).toBe('Dulap până în tavan (tip dressing)');
    expect(
      validateRoomAnswers('PIECE_WARDROBE', { ...answers, doorType: 'SLIDING' }, { partial: false, version: 4 }).ok,
    ).toBe(false);
    // scorul "pana in tavan" ramane
    expect(
      collectScoreEntries('PIECE_WARDROBE', answers, 4).some(
        (e) => 'optionKey' in e && e.category === 'WARDROBE_TO_CEILING',
      ),
    ).toBe(true);
  });

  it('"decide firma" la material → ALTUL + nota + recomandarea firmei, fara "Corp: PAL standard"; respins pe v3', () => {
    const answers: AnswerMap = { config3d: cfg('DRESSER', { frontStyle: 'PUSH' }), material: 'FIRM_DECIDES' };
    expect(validateRoomAnswers('PIECE_DRESSER', answers, { partial: false, version: 4 }).ok).toBe(true);
    expect(validateRoomAnswers('PIECE_DRESSER', answers, { partial: false, version: 3 }).ok).toBe(false);
    const derived = pieceDresserFlowV4.deriveRoom(answers);
    expect(derived.items[0].material).toBe('ALTUL');
    expect(derived.items[0].systems).toEqual(['PUSH']);
    expect(derived.items[0].description).toContain(FIRM_MATERIAL_NOTE);
    expect(derived.items[0].description).not.toContain(BODY_NOTE);
    expect(firmRecommendations('PIECE_DRESSER', answers, 4)).toEqual([
      { itemName: 'Comodă', material: true, opening: false },
    ]);
    expect(firmRecommendations('PIECE_DRESSER', { ...answers, material: 'PAL' }, 4)).toEqual([]);
  });

  it('"Altul" pastreaza textul clientului, dupa nota corpului', () => {
    const derived = pieceDresserFlowV4.deriveRoom({ config3d: cfg('DRESSER'), material: 'ALTUL', materialOther: 'bambus' });
    expect(derived.items[0].material).toBe('ALTUL');
    expect(derived.items[0].description).toContain(`${BODY_NOTE}; Material dorit: bambus`);
  });

  it('noptierele pereche dubleaza cantitatea si metrii liniari (ca v3)', () => {
    const config = cfg('NIGHTSTAND');
    const derived = pieceNightstandFlowV4.deriveRoom({ config3d: config, count: 'TWO', material: 'MDF_VOPSIT' });
    expect(derived.items[0].quantity).toBe(2);
    expect(derived.items[0].name).toBe('Noptiere');
    expect(derived.lengthM).toBeCloseTo(config.widthM * 2, 6);
  });

  it('exemplul D (DESIGN 6.4): comoda TV PAL cu maner → un singur sistem, MANER', () => {
    const answers: AnswerMap = { config3d: tvWithFronts('HANDLE'), tvSetup: 'TV_ON_UNIT', material: 'PAL' };
    const systems = collectScoreEntries('PIECE_TV_UNIT', answers, 4).filter((e) => e.category === 'SYSTEM');
    expect(systems).toEqual([{ category: 'SYSTEM', optionKeys: ['MANER'], pick: 'max' }]);
  });
});

describe('pat, masa, banca v4 — seturile de lemn si de placi, fara deschidere', () => {
  it('pat si masa: setul de lemn (fara "Altul", fara pret pe metru), fara pas materialOther', () => {
    for (const flow of [pieceBedFlowV4, pieceTableFlowV4]) {
      expect(flow.version).toBe(4);
      const m = materialStep(flow)!;
      expect(m.titleKey).toBe(`flows.${flow.roomType}.v4.material.title`);
      expect(m.subtitleKey).toBe('common.finish.woodMaterial.subtitle');
      expect(values(m.options)).toEqual(['LEMN_MASIV', 'MDF_FURNIR', 'PAL', 'FIRM_DECIDES']);
      expect(m.options.some((o) => o.info?.priceHintKey)).toBe(false);
      expect(stepIds(flow)).not.toContain('materialOther');
      expect(stepIds(flow)).not.toContain('openingSystems');
    }
  });

  it('banca: setul de placi, cu "Altul" si pasul materialOther', () => {
    const m = materialStep(pieceBenchFlowV4)!;
    expect(m.subtitleKey).toBe('common.finish.panelMaterial.subtitle');
    expect(values(m.options)).toContain('ALTUL');
    expect(values(m.options)).not.toContain('MDF_INTEGRAL');
    expect(stepIds(pieceBenchFlowV4)).toContain('materialOther');
  });

  it('patul: derivarea v2 pastrata (saltea, descriere 3D), material din setul de lemn, systems []', () => {
    const answers: AnswerMap = { config3d: cfg('BED'), material: 'LEMN_MASIV' };
    expect(validateRoomAnswers('PIECE_BED', answers, { partial: false, version: 4 }).ok).toBe(true);
    const item = pieceBedFlowV4.deriveRoom(answers).items[0];
    expect(item.material).toBe('LEMN_MASIV');
    expect(item.systems).toEqual([]);
    expect(item.description).toContain('Configurat 3D');
    expect(item.description ?? '').not.toContain(BODY_NOTE);
    // "Altul" nu exista in setul de lemn
    expect(validateRoomAnswers('PIECE_BED', { ...answers, material: 'ALTUL' }, { partial: false, version: 4 }).ok).toBe(false);
  });

  it('masa "decide firma" → ALTUL + nota + recomandarea firmei', () => {
    const answers: AnswerMap = { config3d: cfg('TABLE'), material: 'FIRM_DECIDES' };
    expect(validateRoomAnswers('PIECE_TABLE', answers, { partial: false, version: 4 }).ok).toBe(true);
    const derived = pieceTableFlowV4.deriveRoom(answers);
    expect(derived.items[0].material).toBe('ALTUL');
    expect(derived.items[0].description).toContain(FIRM_MATERIAL_NOTE);
    expect(firmRecommendations('PIECE_TABLE', answers, 4)).toEqual([
      { itemName: derived.items[0].name, material: true, opening: false },
    ]);
  });

  it('banca "Altul": textul clientului apare o singura data', () => {
    const item = pieceBenchFlowV4.deriveRoom({ config3d: cfg('BENCH'), material: 'ALTUL', materialOther: 'stejar reciclat' }).items[0];
    expect(item.material).toBe('ALTUL');
    expect(item.description!.split('Material dorit: stejar reciclat').length - 1).toBe(1);
  });
});

describe('piesele de catalog v2', () => {
  const flowOf = (rt: keyof typeof catalogFlowRegistryV2) => catalogFlowRegistryV2[rt][2];

  it('toate cele 7 sunt pe versiunea 2; v1 ramane neschimbat (are pas de material)', () => {
    for (const rt of Object.keys(catalogFlowRegistryV2) as (keyof typeof catalogFlowRegistryV2)[]) {
      expect(catalogFlowVersionsV2[rt]).toBe(2);
      expect(flowOf(rt).version).toBe(2);
      expect(stepIds(catalogFlowRegistry[rt][1])).toContain('material');
    }
    expect(Object.keys(catalogFlowRegistryV2)).toHaveLength(7);
  });

  it('tapitatele: fara pas de material → ALTUL + "Cadru: il alege firma" + recomandarea firmei', () => {
    for (const rt of ['PIECE_SOFA', 'PIECE_ARMCHAIR', 'PIECE_OTTOMAN'] as const) {
      const flow = flowOf(rt);
      expect(stepIds(flow), rt).toEqual(['config3d', 'sketch', 'snapshot3d']);
      const kind = rt.replace('PIECE_', '') as Piece3dKind;
      const answers: AnswerMap = { config3d: defaultPieceConfig(kind) };
      const res = validateRoomAnswers(rt, answers, { partial: false, version: 2 });
      expect(res.ok, `${rt} ${JSON.stringify(res)}`).toBe(true);
      expect(validateRoomAnswers(rt, { ...answers, material: 'PAL' }, { partial: false, version: 2 }).ok).toBe(false);
      const derived = flow.deriveRoom(answers);
      expect(derived.items[0].material).toBe('ALTUL');
      expect(derived.items[0].description).toContain(FRAME_BY_FIRM_NOTE);
      expect(firmRecommendations(rt, answers, 2)).toEqual([
        { itemName: derived.items[0].name, material: true, opening: false },
      ]);
    }
  });

  it('exemplul E (DESIGN 6.4): canapeaua punctata pe ALTUL', () => {
    const entries = collectScoreEntries('PIECE_SOFA', { config3d: defaultPieceConfig('SOFA') }, 2);
    const material = entries.filter((e) => 'optionKey' in e && e.category === 'MATERIAL');
    expect(material.map((e) => ('optionKey' in e ? e.optionKey : ''))).toEqual(['ALTUL']);
  });

  it('bufet si corp suspendat: setul BODY + pistoane → AVENTOS + nota', () => {
    for (const rt of ['PIECE_SIDEBOARD', 'PIECE_WALL_CABINET'] as const) {
      const flow = flowOf(rt);
      expect(stepIds(flow), rt).toContain('liftUpDoors');
      const m = materialStep(flow)!;
      expect(m.titleKey).toBe(`flows.${rt}.v2.material.title`);
      expect(values(m.options)).not.toContain('MDF_INTEGRAL');
      const kind = rt.replace('PIECE_', '') as Piece3dKind;
      const answers: AnswerMap = { config3d: { ...defaultPieceConfig(kind), frontStyle: 'HANDLE' }, material: 'MDF_VOPSIT', liftUpDoors: true };
      const res = validateRoomAnswers(rt, answers, { partial: false, version: 2 });
      expect(res.ok, `${rt} ${JSON.stringify(res)}`).toBe(true);
      const item = flow.deriveRoom(answers).items[0];
      expect(item.systems).toEqual(['MANER', 'AVENTOS']);
      expect(item.description).toContain(PISTONS_NOTE);
      expect(item.description).toContain(BODY_NOTE);
    }
  });

  it('mobilierul de lavoar: "Integral din MDF" → MDF + nota, fara "Corp: PAL standard"; doar la lavoar', () => {
    const flow = flowOf('PIECE_BATHROOM_VANITY');
    expect(values(materialStep(flow)!.options)).toContain('MDF_INTEGRAL');
    expect(materialStep(flow)!.subtitleKey).toBe('common.finish.frontMaterial.subtitleIntegral');
    expect(materialStep(flowOf('PIECE_SIDEBOARD'))!.subtitleKey).toBe('common.finish.frontMaterial.subtitle');
    expect(stepIds(flow)).not.toContain('liftUpDoors');
    const answers: AnswerMap = { config3d: defaultPieceConfig('BATHROOM_VANITY'), material: 'MDF_INTEGRAL' };
    expect(validateRoomAnswers('PIECE_BATHROOM_VANITY', answers, { partial: false, version: 2 }).ok).toBe(true);
    const item = flow.deriveRoom(answers).items[0];
    expect(item.material).toBe('MDF');
    expect(item.systems).toEqual(['PUSH']);
    expect(item.description).toContain(INTEGRAL_MDF_NOTE);
    expect(item.description).not.toContain(BODY_NOTE);
    // la hol si bufet nu exista
    expect(
      validateRoomAnswers('PIECE_ENTRYWAY', { config3d: defaultPieceConfig('ENTRYWAY'), material: 'MDF_INTEGRAL' }, { partial: false, version: 2 }).ok,
    ).toBe(false);
    // v1 respinge si "decide firma"
    expect(
      validateRoomAnswers('PIECE_BATHROOM_VANITY', { ...answers, material: 'FIRM_DECIDES' }, { partial: false, version: 1 }).ok,
    ).toBe(false);
  });

  it('revizuire m2 + m3: bufet / corp suspendat fara fronturi → fara maner, fara pistoane, fara punct de sistem', () => {
    for (const rt of ['PIECE_SIDEBOARD', 'PIECE_WALL_CABINET'] as const) {
      const kind = rt.replace('PIECE_', '') as Piece3dKind;
      const open: PieceConfig3d = {
        ...defaultPieceConfig(kind),
        columns: [{ zones: [{ type: 'OPEN' }] }, { zones: [{ type: 'OPEN' }] }],
        frontStyle: 'HANDLE',
      };
      const answers: AnswerMap = { config3d: open, material: 'PAL', liftUpDoors: true };
      const res = validateRoomAnswers(rt, answers, { partial: false, version: 2 });
      expect(res.ok, `${rt} ${JSON.stringify(res)}`).toBe(true);
      const item = catalogFlowRegistryV2[rt][2].deriveRoom(answers).items[0];
      expect(item.systems, rt).toEqual([]);
      expect(item.description ?? '').not.toContain(PISTONS_NOTE);
      expect(item.description ?? '').not.toContain(BODY_NOTE);
      const sys = collectScoreEntries(rt, answers, 2).filter((e) => e.category === 'SYSTEM');
      expect(sys.every((e) => 'optionKeys' in e && e.optionKeys.length === 0), rt).toBe(true);
    }
  });

  it('mobilierul de hol: setul BODY, pantofarul deschis → fara sistem si fara nota corpului', () => {
    const flow = flowOf('PIECE_ENTRYWAY');
    expect(stepIds(flow)).not.toContain('liftUpDoors');
    const item = flow.deriveRoom({ config3d: defaultPieceConfig('ENTRYWAY'), material: 'PAL' }).items[0];
    expect(item.systems).toEqual([]);
    expect(item.description ?? '').not.toContain(BODY_NOTE);
  });
});
