import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  firmRecommendations,
  getFlow,
  stepAnswerSchema,
  validateRoomAnswers,
  visibleOptions,
  visibleSteps,
} from '../engine';
import type { AnswerMap, ChoiceOption, QuestionStep, RoomFlow } from '../types';
import { dressingFlowV3 } from './dressing.v3';
import { dressingFlowV4 } from './dressing.v4';
import {
  BODY_NOTE,
  FIRM_DECIDES,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  NO_FRONTS,
  NO_FRONTS_NOTE,
  PISTONS,
  PISTONS_NOTE,
} from './finish-sets';
import { kitchenFlowV2 } from './kitchen.v2';
import { kitchenFlowV3 } from './kitchen.v3';
import { kitchenFlowV4 } from './kitchen.v4';
import { piecesFlow } from './pieces';
import { piecesFlowV2 } from './pieces.v2';

// Etapa 6, pachetul C (e6-kd): bucataria v4, dressingul v4, "Alta piesa" v2 (DESIGN §5.1, §5.2, §5.11).

const step = (flow: RoomFlow, id: string): QuestionStep => {
  const s = flow.steps.find((x) => x.id === id);
  if (!s) throw new Error(`pas lipsa: ${id}`);
  return s;
};
const optionValues = (flow: RoomFlow, id: string, answers: AnswerMap = {}): string[] =>
  visibleOptions(step(flow, id) as { options: ChoiceOption[] }, answers).map((o) => o.value);
const errorsOf = (r: ReturnType<typeof validateRoomAnswers>) => (r.ok ? [] : r.errors);

// ---------------------------------------------------------------- bucatarie
const kitchenBase: AnswerMap = {
  layout: 'STRAIGHT',
  dimensions: { runA: 3, ceilingHeight: 2.6 },
  frontMaterialBase: 'MDF_VOPSIT',
  openingSystemsBase: ['MANER'],
  openingSystemsWall: ['PUSH'],
  countertop: 'QUARTZ',
};

describe('KITCHEN v4', () => {
  it('pastreaza aceiasi pasi, in aceeasi ordine, ca v3 (ecranul Fronturi pe zone merge pe id-uri)', () => {
    expect(kitchenFlowV4.version).toBe(4);
    expect(kitchenFlowV4.steps.map((s) => s.id)).toEqual(kitchenFlowV3.steps.map((s) => s.id));
    expect(kitchenFlowV4.steps.map((s) => s.screenGroup)).toEqual(kitchenFlowV3.steps.map((s) => s.screenGroup));
    expect(getFlow('KITCHEN', 4)).toBe(kitchenFlowV4);
  });

  it('materialul fronturilor = setul BODY cu "decide firma", fara MDF integral; titlul nou pe baza', () => {
    for (const id of ['frontMaterialBase', 'frontMaterialWall', 'frontMaterialIsland']) {
      expect(optionValues(kitchenFlowV4, id)).toEqual([
        'PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL', FIRM_DECIDES,
      ]);
      expect(step(kitchenFlowV4, id).subtitleKey).toBe('common.finish.frontMaterial.subtitle');
    }
    expect(step(kitchenFlowV4, 'frontMaterialBase').titleKey).toBe('flows.KITCHEN.v4.frontMaterial.title');
  });

  it('Gola la toate zonele; Aventos si Pistoane DOAR la suspendate; fara Usi glisante', () => {
    expect(optionValues(kitchenFlowV4, 'openingSystemsBase')).toEqual(['MANER', 'PUSH', 'GOLA', FIRM_DECIDES]);
    expect(optionValues(kitchenFlowV4, 'openingSystemsIsland')).toEqual(['MANER', 'PUSH', 'GOLA', FIRM_DECIDES]);
    expect(optionValues(kitchenFlowV4, 'openingSystemsWall')).toEqual([
      'MANER', 'PUSH', 'GOLA', 'AVENTOS', PISTONS, FIRM_DECIDES,
    ]);
    for (const id of ['openingSystemsBase', 'openingSystemsWall', 'openingSystemsIsland']) {
      expect(optionValues(kitchenFlowV4, id)).not.toContain('GLISANTE');
      expect(optionValues(kitchenFlowV4, id)).not.toContain(NO_FRONTS);
    }
    // pistoanele nu se pot trimite la corpurile de baza
    const r = validateRoomAnswers('KITCHEN', { ...kitchenBase, openingSystemsBase: [PISTONS] }, { partial: false, version: 4 });
    expect(errorsOf(r)).toEqual([{ stepId: 'openingSystemsBase', messageKey: 'validation.optionInvalid' }]);
  });

  it('"decide firma" la deschidere e exclusiva', () => {
    const schema = stepAnswerSchema(step(kitchenFlowV4, 'openingSystemsWall'), kitchenBase);
    expect(schema.safeParse([FIRM_DECIDES]).success).toBe(true);
    const bad = schema.safeParse([FIRM_DECIDES, 'MANER']);
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('validation.exclusiveOption');
  });

  it('blatul accepta FIRM_DECIDES pe v4 si ramane obligatoriu; v2 / v3 il resping', () => {
    expect(optionValues(kitchenFlowV4, 'countertop')).toEqual(['PAL', 'HPL', 'QUARTZ', 'GRANITE', FIRM_DECIDES]);
    expect(step(kitchenFlowV4, 'countertop').optional).toBeFalsy();
    const answers = { ...kitchenBase, countertop: FIRM_DECIDES };
    expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: 4 })).toEqual({ ok: true });
    for (const version of [2, 3]) {
      const errs = errorsOf(validateRoomAnswers('KITCHEN', { countertop: FIRM_DECIDES }, { partial: true, version }));
      expect(errs).toContainEqual({ stepId: 'countertop', messageKey: 'validation.optionInvalid' });
    }
    const { countertop: _c, ...noCountertop } = kitchenBase;
    expect(errorsOf(validateRoomAnswers('KITCHEN', noCountertop, { partial: false, version: 4 }))).toContainEqual({
      stepId: 'countertop',
      messageKey: 'validation.answerRequired',
    });
    // randul de scor nou, 0 puncte (seed / migrare)
    expect(collectScoreEntries('KITCHEN', answers, 4)).toContainEqual(
      expect.objectContaining({ category: 'KITCHEN_COUNTERTOP', optionKey: FIRM_DECIDES }),
    );
  });

  it('versiunile vechi resping "decide firma" la material si deschidere', () => {
    for (const [flow, version] of [[kitchenFlowV2, 2], [kitchenFlowV3, 3]] as const) {
      expect(optionValues(flow, 'frontMaterialBase')).not.toContain(FIRM_DECIDES);
      const errs = errorsOf(
        validateRoomAnswers('KITCHEN', { frontMaterialBase: FIRM_DECIDES, openingSystemsBase: [FIRM_DECIDES] }, { partial: true, version }),
      );
      expect(errs).toContainEqual({ stepId: 'frontMaterialBase', messageKey: 'validation.optionInvalid' });
      expect(errs).toContainEqual({ stepId: 'openingSystemsBase', messageKey: 'validation.optionInvalid' });
    }
  });

  it('derivare: materialul de baza copiat pe zone, nota "Corp: PAL standard", pistoane → AVENTOS + nota', () => {
    const answers = { ...kitchenBase, openingSystemsWall: ['MANER', PISTONS] };
    expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: 4 })).toEqual({ ok: true });
    const room = kitchenFlowV4.deriveRoom(answers);
    expect(room.items).toEqual([
      { name: 'Corpuri de bază', material: 'MDF_VOPSIT', systems: ['MANER'], description: BODY_NOTE, quantity: 1 },
      {
        name: 'Corpuri suspendate',
        material: 'MDF_VOPSIT',
        systems: ['MANER', 'AVENTOS'],
        description: `${BODY_NOTE}; ${PISTONS_NOTE}`,
        quantity: 1,
      },
    ]);
    expect(room.firmRecommendations).toEqual([]);
    expect(room.lengthM).toBe(3);
  });

  it('derivare: "decide firma" → ALTUL, fara sisteme, fara "Corp: PAL standard", cu recomandarea firmei', () => {
    const answers: AnswerMap = {
      ...kitchenBase,
      hasIsland: true,
      dimensions: { runA: 3, ceilingHeight: 2.6, islandLength: 1.6, islandDepth: 0.9 },
      separateFrontMaterials: true,
      frontMaterialBase: 'ALTUL',
      frontMaterialBaseOther: 'MDF lucios',
      frontMaterialWall: FIRM_DECIDES,
      frontMaterialIsland: 'PAL',
      openingSystemsWall: [FIRM_DECIDES],
      openingSystemsIsland: ['GOLA'],
    };
    expect(validateRoomAnswers('KITCHEN', answers, { partial: false, version: 4 })).toEqual({ ok: true });
    const room = kitchenFlowV4.deriveRoom(answers);
    expect(room.items).toEqual([
      {
        name: 'Corpuri de bază',
        material: 'ALTUL',
        systems: ['MANER'],
        description: `${BODY_NOTE}; Material dorit: MDF lucios`,
        quantity: 1,
      },
      {
        name: 'Corpuri suspendate',
        material: 'ALTUL',
        systems: [],
        description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}`,
        quantity: 1,
      },
      { name: 'Insulă', material: 'PAL', systems: ['GOLA'], description: BODY_NOTE, quantity: 1 },
    ]);
    expect(firmRecommendations('KITCHEN', answers, 4)).toEqual([
      { itemName: 'Corpuri suspendate', material: true, opening: true },
    ]);
    expect(room.widthM).toBe(0.9);
  });
});

// ---------------------------------------------------------------- dressing
const dressingBase: AnswerMap = {
  layout: 'LINEAR',
  dimensions: { runA: 2.5, wardrobeHeight: 2.4 },
  interiorModules: ['SHELVES', 'LED_LIGHTING'],
  material: 'MDF_INFOLIAT',
};

describe('DRESSING v4', () => {
  it('uși batante → pasul de deschidere pe ecranul materialului (fara "Fara usi", fara glisante)', () => {
    expect(dressingFlowV4.version).toBe(4);
    expect(getFlow('DRESSING', 4)).toBe(dressingFlowV4);
    const answers = { ...dressingBase, doorType: 'HINGED' };
    const visible = visibleSteps(dressingFlowV4, answers);
    const opening = visible.find((s) => s.id === 'openingSystems');
    expect(opening).toBeDefined();
    expect(opening?.screenGroup).toBe(step(dressingFlowV4, 'material').screenGroup);
    expect(optionValues(dressingFlowV4, 'openingSystems')).toEqual(['MANER', 'PUSH', FIRM_DECIDES]);
    // obligatoriu la batante
    expect(errorsOf(validateRoomAnswers('DRESSING', answers, { partial: false, version: 4 }))).toEqual([
      { stepId: 'openingSystems', messageKey: 'validation.answerRequired' },
    ]);
    const full = { ...answers, openingSystems: ['PUSH'] };
    expect(validateRoomAnswers('DRESSING', full, { partial: false, version: 4 })).toEqual({ ok: true });
    expect(dressingFlowV4.deriveRoom(full).items).toEqual([
      {
        name: 'Dressing',
        material: 'MDF_INFOLIAT',
        systems: ['PUSH'],
        description: `Interior: rafturi; iluminare LED; ${BODY_NOTE}`,
        quantity: 1,
      },
    ]);
  });

  it('uși glisante → GLISANTE fara pas de deschidere; un raspuns trimis e respins', () => {
    const answers = { ...dressingBase, doorType: 'SLIDING' };
    expect(visibleSteps(dressingFlowV4, answers).map((s) => s.id)).not.toContain('openingSystems');
    expect(validateRoomAnswers('DRESSING', answers, { partial: false, version: 4 })).toEqual({ ok: true });
    expect(dressingFlowV4.deriveRoom(answers).items[0]).toMatchObject({ systems: ['GLISANTE'], material: 'MDF_INFOLIAT' });
    expect(errorsOf(validateRoomAnswers('DRESSING', { ...answers, openingSystems: ['MANER'] }, { partial: false, version: 4 }))).toEqual([
      { stepId: 'openingSystems', messageKey: 'validation.unknownAnswer' },
    ]);
  });

  it('fara uși → fara deschidere, fara "Corp: PAL standard"', () => {
    const answers = { ...dressingBase, doorType: 'OPEN' };
    expect(visibleSteps(dressingFlowV4, answers).map((s) => s.id)).not.toContain('openingSystems');
    const item = dressingFlowV4.deriveRoom(answers).items[0];
    expect(item?.systems).toEqual([]);
    expect(item?.description).toBe('Interior: rafturi; iluminare LED');
  });

  it('"decide firma" la material si deschidere → ALTUL, [] si recomandarea firmei; v3 il respinge', () => {
    expect(optionValues(dressingFlowV4, 'material')).toContain(FIRM_DECIDES);
    expect(optionValues(dressingFlowV4, 'material')).not.toContain('MDF_INTEGRAL');
    const answers = { ...dressingBase, doorType: 'HINGED', material: FIRM_DECIDES, openingSystems: [FIRM_DECIDES] };
    expect(validateRoomAnswers('DRESSING', answers, { partial: false, version: 4 })).toEqual({ ok: true });
    const item = dressingFlowV4.deriveRoom(answers).items[0];
    expect(item).toMatchObject({ material: 'ALTUL', systems: [] });
    expect(item?.description).toBe(`Interior: rafturi; iluminare LED; ${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}`);
    expect(firmRecommendations('DRESSING', answers, 4)).toEqual([{ itemName: 'Dressing', material: true, opening: true }]);
    expect(optionValues(dressingFlowV3, 'material')).not.toContain(FIRM_DECIDES);
    expect(errorsOf(validateRoomAnswers('DRESSING', { material: FIRM_DECIDES }, { partial: true, version: 3 }))).toContainEqual({
      stepId: 'material',
      messageKey: 'validation.optionInvalid',
    });
  });
});

// ---------------------------------------------------------------- "Alta piesa" v2
const row = (extra: Record<string, unknown> = {}) => ({
  name: 'Comodă hol',
  material: 'PAL',
  systems: ['MANER'],
  quantity: 1,
  ...extra,
});

describe('PIECES v2 ("Altă piesă")', () => {
  it('pasul pieces are rowVersion 2; schita neschimbata', () => {
    expect(piecesFlowV2.version).toBe(2);
    expect(getFlow('PIECES', 2)).toBe(piecesFlowV2);
    expect(step(piecesFlowV2, 'pieces')).toMatchObject({ type: 'pieces', rowVersion: 2 });
    expect(step(piecesFlowV2, 'sketch')).toEqual(step(piecesFlow, 'sketch'));
    expect(step(piecesFlow, 'pieces')).not.toHaveProperty('rowVersion');
  });

  it('120 × 80 × 40 → descrierea contine dimensiunile', () => {
    const answers = { pieces: [row({ description: 'Cu blat de stejar', widthCm: 120, heightCm: 80, depthCm: 40 })] };
    expect(validateRoomAnswers('PIECES', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const room = piecesFlowV2.deriveRoom(answers);
    expect(room.items).toEqual([
      {
        name: 'Comodă hol',
        material: 'PAL',
        systems: ['MANER'],
        description: 'Cu blat de stejar; Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)',
        quantity: 1,
      },
    ]);
    expect(room.lengthM).toBe(1);
  });

  it('fara dimensiuni → nimic in plus in descriere', () => {
    const answers = { pieces: [row({ description: 'Cu blat de stejar' }), row({ name: 'Raft', quantity: 2 })] };
    expect(validateRoomAnswers('PIECES', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const room = piecesFlowV2.deriveRoom(answers);
    expect(room.items[0]?.description).toBe('Cu blat de stejar');
    expect(room.items[1]).not.toHaveProperty('description');
    expect(room.lengthM).toBe(3);
  });

  it('dimensiuni partiale → doar cele date', () => {
    const room = piecesFlowV2.deriveRoom({ pieces: [row({ widthCm: 120, depthCm: 40 })] });
    expect(room.items[0]?.description).toBe('Lățime 120 cm, adâncime 40 cm');
  });

  it('liste fara "Usi glisante": GLISANTE respins pe v2 (acceptat pe v1)', () => {
    const answers = { pieces: [row({ systems: ['GLISANTE'] })] };
    expect(validateRoomAnswers('PIECES', answers, { partial: false, version: 1 })).toEqual({ ok: true });
    const errs = errorsOf(validateRoomAnswers('PIECES', answers, { partial: false, version: 2 }));
    expect(errs).toEqual([{ stepId: 'pieces', messageKey: 'validation.optionInvalid' }]);
  });

  it('deschiderea e obligatorie, cu iesirile "decide firma" / "fara usi sau sertare"', () => {
    expect(errorsOf(validateRoomAnswers('PIECES', { pieces: [row({ systems: [] })] }, { partial: false, version: 2 }))).toEqual([
      { stepId: 'pieces', messageKey: 'validation.minOneOption' },
    ]);
    const answers = {
      pieces: [
        row({ name: 'Dulap', material: 'ALTUL', materialChoice: FIRM_DECIDES, systems: [], openingChoice: FIRM_DECIDES }),
        row({ name: 'Raft', systems: [], openingChoice: NO_FRONTS }),
      ],
    };
    expect(validateRoomAnswers('PIECES', answers, { partial: false, version: 2 })).toEqual({ ok: true });
    const room = piecesFlowV2.deriveRoom(answers);
    expect(room.items).toEqual([
      { name: 'Dulap', material: 'ALTUL', systems: [], description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}`, quantity: 1 },
      { name: 'Raft', material: 'PAL', systems: [], description: NO_FRONTS_NOTE, quantity: 1 },
    ]);
    expect(firmRecommendations('PIECES', answers, 2)).toEqual([{ itemName: 'Dulap', material: true, opening: true }]);
  });

  it('campuri necunoscute pe rand respinse pe v2 (randul e strict)', () => {
    const errs = errorsOf(validateRoomAnswers('PIECES', { pieces: [row({ colour: 'alb' })] }, { partial: false, version: 2 }));
    expect(errs).toEqual([{ stepId: 'pieces', messageKey: 'validation.unknownAnswer' }]);
  });

  it('dimensiuni in afara limitelor (1–600, intregi) respinse', () => {
    for (const widthCm of [0, 601, 12.5]) {
      const errs = errorsOf(validateRoomAnswers('PIECES', { pieces: [row({ widthCm })] }, { partial: false, version: 2 }));
      expect(errs).toEqual([{ stepId: 'pieces', messageKey: 'validation.dimensionOutOfRange' }]);
    }
  });
});
