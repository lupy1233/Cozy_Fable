import type { AnswerMap, Condition, MultiChoiceStep, QuestionStep, SingleChoiceStep, UploadStep } from '../../types';
import {
  GENERAL_SYSTEMS,
  materialOptions,
  OFFERED_MATERIALS,
  otherMaterialStep,
  systemOptions,
} from '../common';

// Scheletul comun al mini-flow-urilor de piese ghidate (PIECE_*):
// configuratie → dimensiuni → material → sisteme → schita.
// Feedback PO F4 (item 17): materialul si sistemele de deschidere sunt
// intrebari SEPARATE (ecrane proprii); materialul foloseste setul nou
// (PAL / variante MDF / lemn masiv / Altul cu text liber pe acelasi ecran).

export function pieceMaterialStep(flowKey: string): SingleChoiceStep {
  return {
    id: 'material',
    type: 'single-choice',
    titleKey: `${flowKey}.material.title`,
    subtitleKey: `${flowKey}.material.subtitle`,
    screenGroup: 'material',
    options: materialOptions(OFFERED_MATERIALS),
  };
}

// Sisteme de deschidere — ecran propriu, optional (unele piese nu au
// usi/sertare); vizibilitate conditionata unde configuratia o cere.
export function pieceSystemsStep(flowKey: string, visibleIf?: Condition): MultiChoiceStep {
  return {
    id: 'openingSystems',
    type: 'multi-choice',
    titleKey: `${flowKey}.openingSystems.title`,
    optional: true,
    ...(visibleIf ? { visibleIf } : {}),
    options: systemOptions(GENERAL_SYSTEMS),
  };
}

export function pieceSketchStep(flowKey: string): UploadStep {
  return {
    id: 'sketch',
    type: 'upload',
    titleKey: `${flowKey}.sketch.title`,
    subtitleKey: `${flowKey}.sketch.subtitle`,
    optional: true,
    maxFiles: 3,
  };
}

// Material (cu "Altul" pe acelasi ecran) urmat de sistemele de deschidere pe
// ecran separat — inlocuieste vechiul ecran combinat material+sisteme.
export function pieceMaterialWithSystems(
  flowKey: string,
  systemsVisibleIf?: Condition,
): QuestionStep[] {
  return [
    pieceMaterialStep(flowKey),
    otherMaterialStep('material', 'material'),
    pieceSystemsStep(flowKey, systemsVisibleIf),
  ];
}

export function answerString(answers: AnswerMap, id: string, fallback: string): string {
  return typeof answers[id] === 'string' ? (answers[id] as string) : fallback;
}
