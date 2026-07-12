import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import type {
  AnswerMap,
  Condition,
  MultiChoiceStep,
  QuestionStep,
  SingleChoiceStep,
  TextStep,
} from '../types';
import { GENERAL_SYSTEMS, materialOptions, OFFERED_MATERIALS, otherMaterialStep, systemOptions } from './common';
import type { PieceDef } from './pieces-flow';

// Generalizarea patternului "configurare per piesa" pentru flow-urile v2 si
// camerele noi. Feedback PO F4: fiecare piesa are intrebarile EI, cu iconul
// piesei in antet — fara intrebari comune pe camera.
// Feedback PO 2026-07-13 (docs/12 S2): materialul si sistemul de deschidere
// sunt DOUA intrebari separate, pe ecrane separate (screenGroup
// 'piece:<VALUE>' pentru material + "Altul", 'piece:<VALUE>:systems' pentru
// deschidere), cu titlu per piesa la ambele.

// Piesa cu intrebari dedicate de material si sisteme de deschidere.
export interface PieceWithMaterialDef extends PieceDef {
  materialStepId: string;
  systemsStepId: string;
}

// Intrebarile de configurare ale unei piese, vizibile doar daca piesa e
// selectata: ecranul de material (carduri + "alt material" conditional pe
// acelasi ecran) urmat de ecranul separat de sisteme de deschidere.
export function pieceConfigSteps(flowKey: string, defs: PieceWithMaterialDef[]): QuestionStep[] {
  return defs.flatMap((d) => {
    const ifSelected: Condition = { questionId: 'piecesNeeded', in: [d.value] };
    const group = `piece:${d.value}`;
    const material: SingleChoiceStep = {
      id: d.materialStepId,
      type: 'single-choice',
      titleKey: `${flowKey}.${d.materialStepId}.title`,
      icon: d.icon,
      visibleIf: ifSelected,
      screenGroup: group,
      options: materialOptions(OFFERED_MATERIALS),
    };
    const other: TextStep = { ...otherMaterialStep(d.materialStepId, group), visibleIf: {
      all: [ifSelected, { questionId: d.materialStepId, equals: 'ALTUL' }],
    } };
    const systems: MultiChoiceStep = {
      id: d.systemsStepId,
      type: 'multi-choice',
      titleKey: `${flowKey}.${d.systemsStepId}.title`,
      subtitleKey: 'common.pieceSystems.subtitle',
      icon: d.icon,
      visibleIf: ifSelected,
      screenGroup: `${group}:systems`,
      minSelected: 1,
      options: systemOptions(GENERAL_SYSTEMS),
    };
    return [material, other, systems];
  });
}

export function selectedPieces(answers: AnswerMap): string[] {
  return Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
}

// Marcheaza un material cu badge "Recomandat" conditionat pe toate intrebarile
// de material din steps (ex. MDF infoliat cand incaperea nu e ventilata,
// lemn masiv cand balconul e deschis). Pur prezentational, nu schimba validarea.
export function withRecommendedMaterial(
  steps: QuestionStep[],
  material: string,
  cond: Condition,
): QuestionStep[] {
  return steps.map((s) =>
    s.type === 'single-choice' && s.id.startsWith('material')
      ? {
          ...s,
          options: s.options.map((o) => (o.value === material ? { ...o, recommendedIf: cond } : o)),
        }
      : s,
  );
}

// Items derivate: fiecare piesa selectata cu materialul si sistemele EI.
// Compatibilitate: daca un draft vechi are inca answers.openingSystems (comun
// pe camera), acela e folosit ca fallback pentru piesele fara raspuns propriu.
export function buildPerPieceItems(
  answers: AnswerMap,
  defs: PieceWithMaterialDef[],
  fallbackName: string,
): RequestItemInput[] {
  const roomSystems = Array.isArray(answers.openingSystems)
    ? (answers.openingSystems as ItemSystem[])
    : [];
  const selected = selectedPieces(answers);
  const items: RequestItemInput[] = defs
    .filter((d) => selected.includes(d.value))
    .map((d) => {
      const material = (answers[d.materialStepId] as Material) ?? 'PAL';
      const own = answers[d.systemsStepId];
      const otherText = answers[`${d.materialStepId}Other`];
      const description =
        material === 'ALTUL' && typeof otherText === 'string' && otherText.trim()
          ? `Material dorit: ${otherText.trim()}`
          : undefined;
      return {
        name: d.itemName,
        material,
        systems: Array.isArray(own) ? (own as ItemSystem[]) : roomSystems,
        description,
        quantity: d.quantity ?? 1,
      };
    });
  // garantie: request_rooms cere minim un item
  if (items.length === 0) {
    items.push({ name: fallbackName, material: 'PAL', systems: roomSystems, quantity: 1 });
  }
  return items;
}
