import type {
  AnswerMap,
  Condition,
  MultiChoiceStep,
  QuestionStep,
  RoomFlow,
  SingleChoiceStep,
  UploadStep,
} from '../../types';
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
    maxFiles: 7,
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

// Deriva versiunea urmatoare a unui flow de piesa, aliniata la modelul
// bucatariei v2 (item 1): garanteaza textul liber "alt material" (step
// conditional dupa intrebarea de material, inserat DOAR daca lipseste) si
// propaga textul clientului in description-ul itemelor derivate (v1 il colecta
// la 3 piese dar il pierdea la derivare). Flow-ul v1 primit NU e mutat —
// cererile publicate pe v1 raman valide (FROZEN).
export function pieceFlowV2(flow: RoomFlow, version: number): RoomFlow {
  const idx = flow.steps.findIndex((s) => s.id === 'material');
  if (idx < 0) throw new Error(`Flow ${flow.roomType} has no 'material' step`);
  const hasOther = flow.steps.some((s) => s.id === 'materialOther');
  const steps = hasOther
    ? [...flow.steps]
    : [
        ...flow.steps.slice(0, idx + 1),
        otherMaterialStep('material', 'material'),
        ...flow.steps.slice(idx + 1),
      ];
  return {
    ...flow,
    version,
    steps,
    deriveRoom: (answers) => {
      const derived = flow.deriveRoom(answers);
      const text = answers.materialOther;
      if (answers.material !== 'ALTUL' || typeof text !== 'string' || !text.trim()) {
        return derived;
      }
      const wanted = `Material dorit: ${text.trim()}`;
      return {
        ...derived,
        items: derived.items.map((it) => ({
          ...it,
          description: it.description ? `${it.description}; ${wanted}` : wanted,
        })),
      };
    },
  };
}
