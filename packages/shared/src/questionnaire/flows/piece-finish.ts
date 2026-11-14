import type { ItemSystem } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import { evalCondition } from '../condition';
import type {
  AnswerMap,
  BooleanStep,
  ChoiceOption,
  Condition,
  FirmRecommendation,
  MultiChoiceStep,
  QuestionStep,
  SingleChoiceStep,
  TextStep,
} from '../types';
import { otherMaterialStep } from './common';
import {
  BODY_NOTE,
  FIRM_DECIDES,
  finishDescription,
  frontMaterialSubtitleKey,
  MDF_INTEGRAL,
  materialSetOptions,
  NO_FRONTS,
  NO_FRONTS_NOTE,
  openingOptions,
  resolveMaterial,
  resolveOpening,
  type MaterialSetKind,
  type ResolvedOpening,
} from './finish-sets';
import type { PieceDef } from './pieces-flow';

// Etapa 6 (c2, c3, c14): constructorul pasilor de material + deschidere pe piesa, pentru
// versiunile noi ale camerelor cu "ce piese ai nevoie". Fata de per-piece.ts (inghetat):
// - materialul si deschiderea aceleiasi piese stau pe UN ecran (grupul `piece:<VALUE>`);
// - deschiderea apare doar la piesele cu fronturi (YES / MAYBE cu "Fara usi sau sertare");
// - intrebarea comuna "Acelasi material si aceeasi deschidere pentru toate piesele?"
//   (sameFinishAll) + ecranul comun `piece:ALL`, doar pentru corpurile BODY cu fronturi.

export interface FinishPieceDef extends PieceDef {
  // id-urile PASTRATE din versiunea curenta (DESIGN tabelul 3)
  materialStepId: string;
  // lipsa <=> fronts === 'NO'
  systemsStepId?: string;
  materialSet: MaterialSetKind;
  // baie, balcon: "Integral din MDF (corp si fronturi)"
  integralMdf?: boolean;
  fronts: 'YES' | 'NO' | 'MAYBE';
  // YES conditionat (dulap batant, pat cu sertare): pasul de deschidere doar cand e adevarata
  frontsIf?: Condition;
  // dulap glisant → ['GLISANTE']; null = sistemele vin din raspuns
  fixedSystems?: (answers: AnswerMap) => ItemSystem[] | null;
  pistons?: boolean;
  // implicit { questionId: 'piecesNeeded', in: [value] } (debaraua il schimba)
  selectedIf?: Condition;
  // pasii piesei pusi PRIMII pe ecranul ei (wardrobeDoorType, bedStorage, nightstandsCount);
  // screenGroup suprascris cu `piece:<VALUE>`, visibleIf pastrat (lipsa → selectedIf)
  leadSteps?: QuestionStep[];
  // `flows.<ROOM>.v<N>.<materialStepId>.title`
  materialTitleKey: string;
  // implicit `${flowKey}.${systemsStepId}.title` (cheia existenta "Deschidere — dulap")
  systemsTitleKey?: string;
}

export interface FinishOpts {
  // 'flows.BEDROOM'
  flowKey: string;
  // false la debara (si la camerele cu o singura piesa comuna)
  common: boolean;
  // badge-ul "Recomandat" (baie, spalatorie, balcon) pe seturile BODY / PANEL (nu pe WORKTOP)
  recommended?: { material: string; cond: Condition };
}

export interface FinishItemsResult {
  items: RequestItemInput[];
  firmRecommendations: FirmRecommendation[];
}

export const SAME_FINISH_STEP_ID = 'sameFinishAll';
export const MATERIAL_ALL_STEP_ID = 'materialAll';
export const SYSTEMS_ALL_STEP_ID = 'systemsAll';
export const PIECE_ALL_GROUP = 'piece:ALL';

const K = 'common.finish';
const sameIsYes: Condition = { questionId: SAME_FINISH_STEP_ID, equals: true };
const sameIsNotYes: Condition = { not: sameIsYes };

// Piesa intra in intrebarea comuna: doar corpurile BODY cu fronturi (N11).
export function isCommonFinishPiece(def: FinishPieceDef): boolean {
  return def.materialSet === 'BODY' && def.fronts !== 'NO';
}

function selectedCondition(def: FinishPieceDef): Condition {
  return def.selectedIf ?? { questionId: 'piecesNeeded', in: [def.value] };
}

function isSelected(def: FinishPieceDef, answers: AnswerMap): boolean {
  return evalCondition(selectedCondition(def), answers);
}

function allOf(conds: (Condition | undefined)[]): Condition {
  const list = conds.filter((c): c is Condition => c !== undefined);
  return list.length === 1 ? list[0] : { all: list };
}

const MATERIAL_SUBTITLE: Record<MaterialSetKind, string> = {
  BODY: `${K}.frontMaterial.subtitle`,
  PANEL: `${K}.panelMaterial.subtitle`,
  WOOD: `${K}.woodMaterial.subtitle`,
  MIRROR: `${K}.mirror.subtitle`,
  WORKTOP: `${K}.worktop.subtitle`,
};

function withRecommended(options: ChoiceOption[], set: MaterialSetKind, opts: FinishOpts): ChoiceOption[] {
  const rec = opts.recommended;
  if (!rec || (set !== 'BODY' && set !== 'PANEL')) return options;
  return options.map((o) => (o.value === rec.material ? { ...o, recommendedIf: rec.cond } : o));
}

function commonDefs(opts: FinishOpts, defs: FinishPieceDef[]): FinishPieceDef[] {
  return opts.common ? defs.filter(isCommonFinishPiece) : [];
}

// Pasul "Acelasi material si aceeasi deschidere pentru toate piesele?" — pe ecranul listei
// de piese (screenGroup 'pieces'; fluxul pune si piecesNeeded pe 'pieces'). Boolean fara
// raspuns implicit (PO c14-2), vizibil cand sunt bifate cel putin 2 piese comune.
export function sameFinishStep(opts: FinishOpts, defs: FinishPieceDef[]): BooleanStep {
  return {
    id: SAME_FINISH_STEP_ID,
    type: 'boolean',
    titleKey: `${K}.sameAll.title`,
    subtitleKey: `${K}.sameAll.subtitle`,
    screenGroup: 'pieces',
    visibleIf: { questionId: 'piecesNeeded', in: commonDefs(opts, defs).map((d) => d.value), atLeast: 2 },
  };
}

// Ecranele pe piese (in ordinea defs) + ecranul comun `piece:ALL` la final.
// NU include sameFinishStep (fluxul il pune langa piecesNeeded).
export function pieceFinishSteps(opts: FinishOpts, defs: FinishPieceDef[]): QuestionStep[] {
  const commons = commonDefs(opts, defs);
  const useCommon = commons.length >= 2;
  const steps: QuestionStep[] = [];

  for (const def of defs) {
    const group = `piece:${def.value}`;
    const selected = selectedCondition(def);
    const commonGate = useCommon && isCommonFinishPiece(def) ? sameIsNotYes : undefined;

    for (const lead of def.leadSteps ?? []) {
      steps.push({ ...lead, screenGroup: group, visibleIf: lead.visibleIf ?? selected });
    }

    const materialVisible = allOf([selected, commonGate]);
    const material: SingleChoiceStep = {
      id: def.materialStepId,
      type: 'single-choice',
      titleKey: def.materialTitleKey,
      subtitleKey:
        def.materialSet === 'BODY' ? frontMaterialSubtitleKey(def.integralMdf === true) : MATERIAL_SUBTITLE[def.materialSet],
      icon: def.icon,
      visibleIf: materialVisible,
      screenGroup: group,
      options: withRecommended(
        materialSetOptions(def.materialSet, { integralMdf: def.integralMdf }),
        def.materialSet,
        opts,
      ),
    };
    steps.push(material);
    if (def.materialSet === 'BODY' || def.materialSet === 'PANEL') {
      const other: TextStep = {
        ...otherMaterialStep(def.materialStepId, group),
        visibleIf: allOf([selected, commonGate, { questionId: def.materialStepId, equals: 'ALTUL' }]),
      };
      steps.push(other);
    }

    if (def.fronts !== 'NO') {
      if (!def.systemsStepId) {
        throw new Error(`piece-finish: ${def.value} are fronturi dar nu are systemsStepId`);
      }
      const systems: MultiChoiceStep = {
        id: def.systemsStepId,
        type: 'multi-choice',
        titleKey: def.systemsTitleKey ?? `${opts.flowKey}.${def.systemsStepId}.title`,
        subtitleKey: `${K}.opening.subtitle`,
        icon: def.icon,
        visibleIf: allOf([selected, def.frontsIf, commonGate]),
        screenGroup: group,
        minSelected: 1,
        options: openingOptions('GENERAL', { pistons: def.pistons, noFronts: def.fronts === 'MAYBE' }),
      };
      steps.push(systems);
    }
  }

  if (useCommon) {
    const integralMdf = commons.some((d) => d.integralMdf === true);
    steps.push({
      id: MATERIAL_ALL_STEP_ID,
      type: 'single-choice',
      titleKey: `${K}.allMaterial.title`,
      subtitleKey: frontMaterialSubtitleKey(integralMdf),
      visibleIf: sameIsYes,
      screenGroup: PIECE_ALL_GROUP,
      options: withRecommended(materialSetOptions('BODY', { integralMdf }), 'BODY', opts),
    });
    steps.push({
      ...otherMaterialStep(MATERIAL_ALL_STEP_ID, PIECE_ALL_GROUP),
      visibleIf: { all: [sameIsYes, { questionId: MATERIAL_ALL_STEP_ID, equals: 'ALTUL' }] },
    });

    // "Fara usi sau sertare" pe ecranul comun doar daca nicio piesa comuna bifata nu e YES;
    // fara pistoane pe ecranul comun (N11)
    const yesValues = commons.filter((d) => d.fronts === 'YES').map((d) => d.value);
    const hasMaybe = commons.some((d) => d.fronts === 'MAYBE');
    const options = openingOptions('GENERAL', { noFronts: hasMaybe }).map((o) =>
      o.value === NO_FRONTS && yesValues.length > 0
        ? { ...o, visibleIf: { not: { questionId: 'piecesNeeded', in: yesValues } } }
        : o,
    );
    steps.push({
      id: SYSTEMS_ALL_STEP_ID,
      type: 'multi-choice',
      titleKey: `${K}.allOpening.title`,
      subtitleKey: `${K}.opening.subtitle`,
      visibleIf: sameIsYes,
      screenGroup: PIECE_ALL_GROUP,
      minSelected: 1,
      options,
    });
  }

  return steps;
}

const NO_OPENING: ResolvedOpening = { systems: [], notes: [], firmDecides: false };

function stringAnswer(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function stringArrayAnswer(v: unknown): string[] | undefined {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : undefined;
}

// Piesele derivate, in ordinea defs: materialul si deschiderea fiecarei piese (din raspunsul
// comun cand sameFinishAll = true si piesa e comuna), notele pentru firma si marcajele
// "recomandarea firmei". Fara nicio piesa: { fallbackName, ALTUL, [], 1 }.
// Fluxul isi face apoi ajustarile proprii pe items (si renameItem daca redenumeste).
export function buildFinishItems(answers: AnswerMap, defs: FinishPieceDef[], fallbackName: string): FinishItemsResult {
  const items: RequestItemInput[] = [];
  const firmRecommendations: FirmRecommendation[] = [];
  const sameYes = answers[SAME_FINISH_STEP_ID] === true;

  for (const def of defs) {
    if (!isSelected(def, answers)) continue;
    const common = sameYes && isCommonFinishPiece(def);
    const materialId = common ? MATERIAL_ALL_STEP_ID : def.materialStepId;
    const materialValue = stringAnswer(answers[materialId]);
    const m = resolveMaterial(materialValue, def.materialSet, stringAnswer(answers[`${materialId}Other`]));

    const fixed = def.fixedSystems ? def.fixedSystems(answers) : null;
    let o: ResolvedOpening;
    if (fixed) o = { systems: [...fixed], notes: [], firmDecides: false };
    else if (def.fronts === 'NO' || (def.frontsIf && !evalCondition(def.frontsIf, answers))) o = NO_OPENING;
    else {
      const systemsId = common ? SYSTEMS_ALL_STEP_ID : def.systemsStepId;
      o = resolveOpening(systemsId ? stringArrayAnswer(answers[systemsId]) : undefined, {
        pistons: def.pistons === true,
      });
    }

    const bodyNote =
      def.materialSet === 'BODY' &&
      def.fronts !== 'NO' &&
      materialValue !== undefined &&
      materialValue !== MDF_INTEGRAL &&
      materialValue !== FIRM_DECIDES &&
      // revizuire M1: piesa fara usi / sertare nu are fronturi, deci nici nota corpului
      !o.notes.includes(NO_FRONTS_NOTE)
        ? BODY_NOTE
        : undefined;
    const description = finishDescription([bodyNote, ...m.notes, ...o.notes]);
    const item: RequestItemInput = {
      name: def.itemName,
      material: m.material,
      systems: o.systems,
      quantity: def.quantity ?? 1,
    };
    if (description) item.description = description;
    items.push(item);
    if (m.firmDecides || o.firmDecides) {
      firmRecommendations.push({ itemName: def.itemName, material: m.firmDecides, opening: o.firmDecides });
    }
  }

  // garantie: request_rooms cere minim un item
  if (items.length === 0) items.push({ name: fallbackName, material: 'ALTUL', systems: [], quantity: 1 });
  return { items, firmRecommendations };
}

// Redenumeste piesele cu numele `from` (TOATE) si marcajele lor; modifica pe loc si intoarce result.
export function renameItem(result: FinishItemsResult, from: string, to: string): FinishItemsResult {
  for (const item of result.items) if (item.name === from) item.name = to;
  for (const rec of result.firmRecommendations) if (rec.itemName === from) rec.itemName = to;
  return result;
}
