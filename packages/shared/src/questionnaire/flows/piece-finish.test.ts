import { describe, expect, it } from 'vitest';
import { pruneAnswers, stepAnswerSchema, visibleOptions, visibleSteps } from '../engine';
import type { AnswerMap, MultiChoiceStep, QuestionStep, RoomFlow, SingleChoiceStep } from '../types';
import { BODY_NOTE, FIRM_MATERIAL_NOTE, FIRM_OPENING_NOTE, NO_FRONTS_NOTE, PISTONS_NOTE } from './finish-sets';
import {
  buildFinishItems,
  pieceFinishSteps,
  renameItem,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Flux-jucarie: dulap (YES conditionat, cu pas-lead si glisante fixe), corp (YES, pistoane),
// birou si banca (MAYBE), rafturi (PANEL, NO), masa (WOOD, NO).
const F = 'flows.TOY';
const DEFS: FinishPieceDef[] = [
  {
    value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap', materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe',
    materialSet: 'BODY', fronts: 'YES', materialTitleKey: `${F}.v2.materialWardrobe.title`,
    frontsIf: { questionId: 'wardrobeDoorType', equals: 'HINGED' },
    fixedSystems: (a) => (a.wardrobeDoorType === 'SLIDING' ? ['GLISANTE'] : null),
    leadSteps: [{
      id: 'wardrobeDoorType', type: 'single-choice', titleKey: `${F}.wardrobeDoorType.title`,
      visibleIf: { questionId: 'piecesNeeded', in: ['WARDROBE'] },
      options: [{ value: 'SLIDING', labelKey: 's' }, { value: 'HINGED', labelKey: 'h' }],
    }],
  },
  { value: 'CABINET', icon: 'archive', itemName: 'Corp', materialStepId: 'materialCabinet', systemsStepId: 'systemsCabinet', materialSet: 'BODY', fronts: 'YES', pistons: true, materialTitleKey: `${F}.v2.materialCabinet.title` },
  { value: 'DESK', icon: 'monitor', itemName: 'Birou', materialStepId: 'materialDesk', systemsStepId: 'systemsDesk', materialSet: 'BODY', fronts: 'MAYBE', materialTitleKey: `${F}.v2.materialDesk.title` },
  { value: 'BENCH', icon: 'sofa', itemName: 'Bancă', materialStepId: 'materialBench', systemsStepId: 'systemsBench', materialSet: 'BODY', fronts: 'MAYBE', materialTitleKey: `${F}.v2.materialBench.title` },
  { value: 'SHELVES', icon: 'library', itemName: 'Rafturi', materialStepId: 'materialShelves', materialSet: 'PANEL', fronts: 'NO', materialTitleKey: `${F}.v2.materialShelves.title` },
  { value: 'TABLE', icon: 'table', itemName: 'Masă', materialStepId: 'materialTable', materialSet: 'WOOD', fronts: 'NO', materialTitleKey: `${F}.v2.materialTable.title` },
];
const OPTS: FinishOpts = { flowKey: F, common: true, recommended: { material: 'MDF_INFOLIAT', cond: { questionId: 'humid', equals: true } } };

const toyFlow: RoomFlow = {
  roomType: 'BEDROOM',
  version: 99,
  steps: [
    { id: 'piecesNeeded', type: 'multi-choice', titleKey: `${F}.piecesNeeded.title`, minSelected: 1, screenGroup: 'pieces', options: pieceChoiceOptions(F, DEFS) },
    sameFinishStep(OPTS, DEFS),
    ...pieceFinishSteps(OPTS, DEFS),
  ],
  deriveRoom: (answers) => ({ lengthM: 1, widthM: 1, heightM: 1, ...buildFinishItems(answers, DEFS, 'Mobilier') }),
};

const step = (id: string) => toyFlow.steps.find((s) => s.id === id) as QuestionStep;
const visibleIds = (answers: AnswerMap) => visibleSteps(toyFlow, answers).map((s) => s.id);
// validare minimala pe fluxul-jucarie (validateRoomAnswers cere un flux inregistrat)
function errors(answers: AnswerMap): string[] {
  const out: string[] = [];
  const vis = new Set(visibleIds(answers));
  for (const [id, value] of Object.entries(answers)) {
    if (!vis.has(id)) { out.push(`${id}:invisible`); continue; }
    const r = stepAnswerSchema(step(id), answers).safeParse(value);
    if (!r.success) out.push(`${id}:${r.error.issues[0].message}`);
  }
  for (const s of visibleSteps(toyFlow, answers)) if (!s.optional && answers[s.id] === undefined) out.push(`${s.id}:required`);
  return out;
}

describe('etapa 6 — constructorul piece-finish (flux-jucarie)', () => {
  it('pasii, ordinea si grupurile de ecran', () => {
    expect(toyFlow.steps.map((s) => `${s.id}@${s.screenGroup ?? ''}`)).toEqual([
      'piecesNeeded@pieces', 'sameFinishAll@pieces',
      'wardrobeDoorType@piece:WARDROBE', 'materialWardrobe@piece:WARDROBE', 'materialWardrobeOther@piece:WARDROBE', 'systemsWardrobe@piece:WARDROBE',
      'materialCabinet@piece:CABINET', 'materialCabinetOther@piece:CABINET', 'systemsCabinet@piece:CABINET',
      'materialDesk@piece:DESK', 'materialDeskOther@piece:DESK', 'systemsDesk@piece:DESK',
      'materialBench@piece:BENCH', 'materialBenchOther@piece:BENCH', 'systemsBench@piece:BENCH',
      'materialShelves@piece:SHELVES', 'materialShelvesOther@piece:SHELVES',
      'materialTable@piece:TABLE',
      'materialAll@piece:ALL', 'materialAllOther@piece:ALL', 'systemsAll@piece:ALL',
    ]);
    const same = step('sameFinishAll');
    expect(same).toMatchObject({ type: 'boolean', titleKey: 'common.finish.sameAll.title', subtitleKey: 'common.finish.sameAll.subtitle' });
    expect(same.optional).toBeUndefined();
    expect(step('materialCabinet')).toMatchObject({ titleKey: `${F}.v2.materialCabinet.title`, subtitleKey: 'common.finish.frontMaterial.subtitle' });
    expect(step('systemsCabinet')).toMatchObject({ titleKey: `${F}.systemsCabinet.title`, subtitleKey: 'common.finish.opening.subtitle', minSelected: 1 });
    expect(step('materialShelves').subtitleKey).toBe('common.finish.panelMaterial.subtitle');
    expect(step('materialTable').subtitleKey).toBe('common.finish.woodMaterial.subtitle');
  });

  it('optiunile de deschidere: pistoane doar la corpul cu pistoane, "fara usi" doar la MAYBE; fara pas la NO', () => {
    const opts = (id: string) => (step(id) as MultiChoiceStep).options.map((o) => o.value);
    expect(opts('systemsCabinet')).toEqual(['MANER', 'PUSH', 'PISTONS', 'FIRM_DECIDES']);
    expect(opts('systemsDesk')).toEqual(['MANER', 'PUSH', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(opts('systemsWardrobe')).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
    expect(opts('systemsAll')).toEqual(['MANER', 'PUSH', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(toyFlow.steps.some((s) => s.id === 'systemsShelves' || s.id === 'systemsTable')).toBe(false);
    // "Recomandat" pe BODY / PANEL, nu pe WOOD
    const rec = (id: string) => (step(id) as SingleChoiceStep).options.filter((o) => o.recommendedIf).map((o) => o.value);
    expect(rec('materialCabinet')).toEqual(['MDF_INFOLIAT']);
    expect(rec('materialShelves')).toEqual(['MDF_INFOLIAT']);
    expect(rec('materialAll')).toEqual(['MDF_INFOLIAT']);
    expect(rec('materialTable')).toEqual([]);
  });

  it('intrebarea comuna apare doar cu cel putin 2 piese comune bifate', () => {
    expect(visibleIds({ piecesNeeded: ['CABINET', 'SHELVES', 'TABLE'] })).not.toContain('sameFinishAll');
    expect(visibleIds({ piecesNeeded: ['CABINET', 'DESK'] })).toContain('sameFinishAll');
  });

  it('fara "Da": cate un ecran pe piesa; cu "Da": ecranul comun, iar rafturile / masa / tipul usilor raman', () => {
    const base: AnswerMap = { piecesNeeded: ['WARDROBE', 'CABINET', 'DESK', 'SHELVES', 'TABLE'], wardrobeDoorType: 'HINGED' };
    for (const same of [undefined, false]) {
      const ids = visibleIds(same === undefined ? base : { ...base, sameFinishAll: same });
      expect(ids).toEqual(expect.arrayContaining(['materialWardrobe', 'systemsWardrobe', 'materialCabinet', 'systemsCabinet', 'materialDesk', 'systemsDesk', 'materialShelves', 'materialTable']));
      expect(ids).not.toContain('materialAll');
    }
    const yes = visibleIds({ ...base, sameFinishAll: true });
    expect(yes).toEqual(['piecesNeeded', 'sameFinishAll', 'wardrobeDoorType', 'materialShelves', 'materialTable', 'materialAll', 'systemsAll']);
    // dulapul glisant nu are pas de deschidere (glisantele = tip de usi)
    expect(visibleIds({ ...base, wardrobeDoorType: 'SLIDING' })).not.toContain('systemsWardrobe');
    // "Da" curata raspunsurile pe piesa ale pieselor comune, nu si pe ale rafturilor / mesei
    const pruned = pruneAnswers(toyFlow, { ...base, sameFinishAll: true, materialCabinet: 'PAL', systemsCabinet: ['MANER'], materialShelves: 'PAL', materialTable: 'PAL' });
    expect(pruned).toEqual({ ...base, sameFinishAll: true, materialShelves: 'PAL', materialTable: 'PAL' });
  });

  it('"Fara usi sau sertare" pe ecranul comun doar cand nicio piesa comuna bifata nu are fronturi sigure', () => {
    const all = step('systemsAll') as MultiChoiceStep;
    expect(visibleOptions(all, { piecesNeeded: ['DESK', 'BENCH'], sameFinishAll: true }).map((o) => o.value)).toContain('NO_FRONTS');
    expect(visibleOptions(all, { piecesNeeded: ['DESK', 'CABINET'], sameFinishAll: true }).map((o) => o.value)).not.toContain('NO_FRONTS');
    expect(visibleOptions(all, { piecesNeeded: ['DESK', 'WARDROBE'], sameFinishAll: true }).map((o) => o.value)).not.toContain('NO_FRONTS');
  });

  it('derivarea copiaza raspunsul comun pe fiecare piesa comuna si NU pe cea WOOD / PANEL', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['WARDROBE', 'CABINET', 'DESK', 'SHELVES', 'TABLE'], wardrobeDoorType: 'SLIDING', sameFinishAll: true,
      materialAll: 'MDF_VOPSIT', systemsAll: ['PUSH'], materialShelves: 'PAL', materialTable: 'LEMN_MASIV',
    };
    expect(errors(answers)).toEqual([]);
    const { items, firmRecommendations } = toyFlow.deriveRoom(answers);
    expect(items).toEqual([
      { name: 'Dulap', material: 'MDF_VOPSIT', systems: ['GLISANTE'], quantity: 1, description: BODY_NOTE },
      { name: 'Corp', material: 'MDF_VOPSIT', systems: ['PUSH'], quantity: 1, description: BODY_NOTE },
      { name: 'Birou', material: 'MDF_VOPSIT', systems: ['PUSH'], quantity: 1, description: BODY_NOTE },
      { name: 'Rafturi', material: 'PAL', systems: [], quantity: 1 },
      { name: 'Masă', material: 'LEMN_MASIV', systems: [], quantity: 1 },
    ]);
    expect(firmRecommendations).toEqual([]);
  });

  it('pe piesa: decide firma, pistoane, fara usi, Altul — note si marcaje', () => {
    const answers: AnswerMap = {
      piecesNeeded: ['CABINET', 'DESK', 'BENCH', 'TABLE'], sameFinishAll: false,
      materialCabinet: 'PAL', systemsCabinet: ['MANER', 'PISTONS'],
      materialDesk: 'FIRM_DECIDES', systemsDesk: ['FIRM_DECIDES'],
      materialBench: 'ALTUL', materialBenchOther: 'furnir nuc', systemsBench: ['NO_FRONTS'],
      materialTable: 'FIRM_DECIDES',
    };
    expect(errors(answers)).toEqual([]);
    const result = toyFlow.deriveRoom(answers);
    expect(result.items).toEqual([
      { name: 'Corp', material: 'PAL', systems: ['MANER', 'AVENTOS'], quantity: 1, description: `${BODY_NOTE}; ${PISTONS_NOTE}` },
      { name: 'Birou', material: 'ALTUL', systems: [], quantity: 1, description: `${FIRM_MATERIAL_NOTE}; ${FIRM_OPENING_NOTE}` },
      { name: 'Bancă', material: 'ALTUL', systems: [], quantity: 1, description: `Material dorit: furnir nuc; ${NO_FRONTS_NOTE}` },
      { name: 'Masă', material: 'ALTUL', systems: [], quantity: 1, description: FIRM_MATERIAL_NOTE },
    ]);
    expect(result.firmRecommendations).toEqual([
      { itemName: 'Birou', material: true, opening: true },
      { itemName: 'Masă', material: true, opening: false },
    ]);
    expect(renameItem({ items: result.items, firmRecommendations: result.firmRecommendations! }, 'Birou', 'Birou de colț')).toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ name: 'Birou de colț' })]),
      firmRecommendations: [{ itemName: 'Birou de colț', material: true, opening: true }, { itemName: 'Masă', material: true, opening: false }],
    });
  });

  it('revizuire M1: fara usi sau sertare → fara nota corpului, pe piesa si de pe ecranul comun', () => {
    const own = buildFinishItems({ piecesNeeded: ['BENCH'], materialBench: 'MDF_VOPSIT', systemsBench: ['NO_FRONTS'] }, DEFS, 'Mobilier');
    expect(own.items).toEqual([{ name: 'Bancă', material: 'MDF_VOPSIT', systems: [], quantity: 1, description: NO_FRONTS_NOTE }]);
    const answers: AnswerMap = { piecesNeeded: ['DESK', 'BENCH'], sameFinishAll: true, materialAll: 'MDF_VOPSIT', systemsAll: ['NO_FRONTS'] };
    expect(errors(answers)).toEqual([]);
    expect(buildFinishItems(answers, DEFS, 'Mobilier').items.map((i) => i.description)).toEqual([NO_FRONTS_NOTE, NO_FRONTS_NOTE]);
    // cu deschidere aleasa, nota corpului ramane
    expect(buildFinishItems({ piecesNeeded: ['BENCH'], materialBench: 'PAL', systemsBench: ['PUSH'] }, DEFS, 'M').items[0].description).toBe(BODY_NOTE);
  });

  it('revizuire m4: subtitlul materialului nu mai spune "corp din PAL" cand se poate alege Integral din MDF', () => {
    const defs: FinishPieceDef[] = [{ ...DEFS[1], integralMdf: true }, DEFS[2]];
    const steps = pieceFinishSteps({ flowKey: F, common: true }, defs);
    const sub = (id: string) => steps.find((s) => s.id === id)?.subtitleKey;
    expect(sub('materialCabinet')).toBe('common.finish.frontMaterial.subtitleIntegral');
    expect(sub('materialDesk')).toBe('common.finish.frontMaterial.subtitle');
    expect(sub('materialAll')).toBe('common.finish.frontMaterial.subtitleIntegral');
    expect(step('materialAll').subtitleKey).toBe('common.finish.frontMaterial.subtitle');
  });

  it('optiunile exclusive se aleg singure; o piesa fara bifa da piesa de rezerva', () => {
    const answers: AnswerMap = { piecesNeeded: ['DESK'], materialDesk: 'PAL', systemsDesk: ['MANER', 'NO_FRONTS'] };
    expect(errors(answers)).toEqual(['systemsDesk:validation.exclusiveOption']);
    expect(buildFinishItems({}, DEFS, 'Mobilier')).toEqual({
      items: [{ name: 'Mobilier', material: 'ALTUL', systems: [], quantity: 1 }],
      firmRecommendations: [],
    });
  });

  it('common: false → fara ecran comun si fara poarta pe sameFinishAll; selectedIf personalizat', () => {
    const defs: FinishPieceDef[] = [
      { ...DEFS[1], selectedIf: { questionId: 'storageStyle', in: ['CABINETS', 'MIXED'] } },
      { ...DEFS[4], selectedIf: { questionId: 'storageStyle', in: ['SHELVES', 'MIXED'] } },
    ];
    const steps = pieceFinishSteps({ flowKey: F, common: false }, defs);
    expect(steps.map((s) => s.id)).toEqual(['materialCabinet', 'materialCabinetOther', 'systemsCabinet', 'materialShelves', 'materialShelvesOther']);
    expect(steps[0].visibleIf).toEqual({ questionId: 'storageStyle', in: ['CABINETS', 'MIXED'] });
    const derived = buildFinishItems({ storageStyle: 'CABINETS', materialCabinet: 'PAL', systemsCabinet: ['PUSH'] }, defs, 'Debara');
    expect(derived.items).toEqual([{ name: 'Corp', material: 'PAL', systems: ['PUSH'], quantity: 1, description: BODY_NOTE }]);
  });
});
