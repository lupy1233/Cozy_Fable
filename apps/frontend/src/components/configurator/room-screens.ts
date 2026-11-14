import {
  getFlow,
  stepAnswerSchema,
  validateRoomAnswers,
  visibleSteps,
  type AnswerMap,
  type QuestionStep,
} from '@marketplace/shared';
import type { RoomInstance } from '@/stores/configurator-store';
import { dimensionSlotStatus } from './dimension-check';

// Logica pura a ecranelor unei camere, comuna runner-ului, store-ului si
// sumarului (review): ce pasi vede clientul si de ce nu e completa o camera.

type IssueValues = Record<string, string | number>;

// Eroarea unui pas (etapa 8, nr. 39): cheia i18n a mesajului de jos al pasului
// (relativ la Configurator) + parametrii lui; `fields` = mesajul fiecarui camp
// gresit, pe slotId (pasii de dimensiuni). `{field}` si `{range}` le pune apelantul.
export interface StepIssue {
  key: string;
  values?: IssueValues;
  fields?: Record<string, { key: string; values?: IssueValues }>;
}

// Mesajul "raspuns lipsa", dupa tipul intrebarii.
export function requiredMessageKey(step: QuestionStep): string {
  switch (step.type) {
    case 'single-choice':
    case 'boolean':
      return 'validation.chooseOne';
    case 'multi-choice':
      return 'validation.minOneOption';
    case 'pieces':
      return 'validation.minPieces';
    case 'text':
    case 'number':
      return 'validation.fillThisField';
    case 'dimension-group':
      return 'validation.dimensionsMissing';
    default:
      return 'validation.answerRequired';
  }
}

// Varianta fara parametri (Sumarul si store-ul afiseaza cheia fara valori).
function requiredMessageKeyPlain(step: QuestionStep): string {
  return step.type === 'dimension-group' ? 'validation.dimensionRequired' : requiredMessageKey(step);
}

// "Alta piesa" v1 (requestItemSchema): mesajele fara prefix devin "Piesa {row}: ..."
const PIECE_ROW_FIELD_KEYS: Record<string, string> = {
  name: 'validation.pieceRow.name',
  quantity: 'validation.pieceRow.quantity',
};

function dimensionIssue(step: Extract<QuestionStep, { type: 'dimension-group' }>, answers: AnswerMap): StepIssue | undefined {
  const status = dimensionSlotStatus(step, answers);
  const missing = status.filter((s) => s.state === 'missing');
  const outOfRange = status.filter((s) => s.state === 'outOfRange');
  if (missing.length === 0 && outOfRange.length === 0) return undefined;
  const fields: NonNullable<StepIssue['fields']> = {};
  for (const s of missing) fields[s.id] = { key: 'validation.fillField' };
  for (const s of outOfRange) fields[s.id] = { key: 'validation.dimensionRange' };
  // rezumatul de jos: cate campuri lipsesc; doar valori gresite → mesajul de interval
  return missing.length > 0
    ? { key: 'validation.dimensionsMissing', values: { count: missing.length }, fields }
    : { key: 'validation.dimensionOutOfRange', fields };
}

// Valideaza raspunsul unui pas; intoarce eroarea (cheie i18n + parametri) sau undefined.
// Erorile care nu apartin namespace-ului Configurator.validation (ex. mesajele
// interne requestItemSchema pentru pieces) sunt traduse in mesajul randului sau
// normalizate la answerInvalid, ca sa nu apara chei i18n lipsa in UI.
export function validateStepIssue(step: QuestionStep, answers: AnswerMap): StepIssue | undefined {
  const val = answers[step.id];
  if (step.type === 'dimension-group' && !(val === undefined && step.optional)) {
    const issue = dimensionIssue(step, answers);
    if (issue) return issue;
  }
  if (val === undefined) return step.optional ? undefined : { key: requiredMessageKey(step) };
  const parsed = stepAnswerSchema(step, answers).safeParse(val);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message;
    if (msg === 'validation.answerRequired') return { key: requiredMessageKey(step) };
    if (msg && msg.startsWith('validation.')) return { key: msg };
    if (step.type === 'pieces' && first && typeof first.path[0] === 'number') {
      const field = String(first.path[1] ?? '');
      const key = PIECE_ROW_FIELD_KEYS[field] ?? (msg === 'dimensionInvalid' ? 'validation.pieceRow.dimension' : undefined);
      // max = plafonul cantitatii din requestItemSchema
      if (key) return { key, values: { row: first.path[0] + 1, max: 999 } };
    }
    return { key: 'validation.answerInvalid' };
  }
  return undefined;
}

// Pastrat pentru apelanti: doar cheia erorii.
export function validateStep(step: QuestionStep, answers: AnswerMap): string | undefined {
  return validateStepIssue(step, answers)?.key;
}

// Grupeaza step-urile vizibile consecutive cu acelasi screenGroup pe un singur
// ecran (ex. layout + insula la bucatarie). Validarea ramane per-step.
export function groupScreens(steps: QuestionStep[]): QuestionStep[][] {
  const screens: QuestionStep[][] = [];
  for (const s of steps) {
    const last = screens[screens.length - 1];
    if (last && s.screenGroup && last[0]?.screenGroup === s.screenGroup) {
      last.push(s);
    } else {
      screens.push([s]);
    }
  }
  return screens;
}

// O noptiera asezata in Studio = o singura piesa: pasul "cate bucati" e ascuns
// si fortat pe ONE (aceeasi regula ca studio-publication.ts pe server).
export function isStudioNightstand(room: Pick<RoomInstance, 'sourceStudio' | 'roomType'>): boolean {
  return Boolean(room.sourceStudio) && room.roomType === 'PIECE_NIGHTSTAND';
}

// Ecranele camerei: step-urile hidden (ex. snapshot3d, scris programatic) nu
// primesc ecran; cu proiect propriu (PO 2026-07-31) sar si pasii de dimensiuni +
// schite — proiectul incarcat la pasul Fisiere e sursa de adevar.
export function roomScreens(room: RoomInstance, hasOwnProject: boolean): QuestionStep[][] {
  const flow = getFlow(room.roomType, room.flowVersion);
  const studioNightstand = isStudioNightstand(room);
  return groupScreens(
    visibleSteps(flow, room.answers).filter(
      (s) =>
        !s.hidden &&
        !(hasOwnProject && (s.type === 'dimension-group' || s.type === 'upload')) &&
        !(studioNightstand && s.id === 'count'),
    ),
  );
}

export interface RoomIssue {
  stepId: string | null;
  messageKey: string;
}

// Prima problema a camerei dupa validarea stricta de publicare (aceeasi functie
// ca serverul) sau null cand camera e completa. Versiune de flow necunoscuta →
// camera trebuie reluata.
export function roomIssue(room: RoomInstance, opts: { ownProject: boolean }): RoomIssue | null {
  // b8: camera la care clientul cere ajutor sare intrebarile — nu are ce sa-i lipseasca
  if (room.needsDesignHelp) return null;
  try {
    const result = validateRoomAnswers(room.roomType, room.answers, {
      partial: false,
      ownProject: opts.ownProject,
      version: room.flowVersion,
    });
    if (result.ok) return null;
    const first = result.errors[0];
    let messageKey = first?.messageKey ?? 'validation.answerInvalid';
    // raspuns lipsa: mesajul dupa tipul intrebarii (39), fara parametri
    if (messageKey === 'validation.answerRequired' && first?.stepId) {
      const step = getFlow(room.roomType, room.flowVersion).steps.find((s) => s.id === first.stepId);
      if (step) messageKey = requiredMessageKeyPlain(step);
    }
    return { stepId: first?.stepId ?? null, messageKey };
  } catch {
    return { stepId: null, messageKey: 'validation.flowVersionUnsupported' };
  }
}

// Indexul ecranului care contine pasul (pentru "Completeaza" din sumar); 0 cand
// pasul nu are ecran (ascuns, invizibil) sau lipseste.
export function screenIndexForStep(room: RoomInstance, stepId: string | null | undefined, hasOwnProject: boolean): number {
  if (!stepId) return 0;
  try {
    const index = roomScreens(room, hasOwnProject).findIndex((screen) => screen.some((s) => s.id === stepId));
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}
