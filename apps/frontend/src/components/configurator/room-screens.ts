import {
  getFlow,
  stepAnswerSchema,
  validateRoomAnswers,
  visibleSteps,
  type AnswerMap,
  type QuestionStep,
} from '@marketplace/shared';
import type { RoomInstance } from '@/stores/configurator-store';

// Logica pura a ecranelor unei camere, comuna runner-ului, store-ului si
// sumarului (review): ce pasi vede clientul si de ce nu e completa o camera.

// Valideaza raspunsul unui pas; intoarce cheia i18n a erorii sau undefined.
// Erorile care nu apartin namespace-ului Configurator.validation (ex. mesajele
// interne requestItemSchema pentru pieces) sunt normalizate la answerInvalid,
// ca sa nu apara chei i18n lipsa in UI.
export function validateStep(step: QuestionStep, answers: AnswerMap): string | undefined {
  const val = answers[step.id];
  if (val === undefined) return step.optional ? undefined : 'validation.answerRequired';
  const parsed = stepAnswerSchema(step, answers).safeParse(val);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return msg && msg.startsWith('validation.') ? msg : 'validation.answerInvalid';
  }
  return undefined;
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
  try {
    const result = validateRoomAnswers(room.roomType, room.answers, {
      partial: false,
      ownProject: opts.ownProject,
      version: room.flowVersion,
    });
    if (result.ok) return null;
    const first = result.errors[0];
    return { stepId: first?.stepId ?? null, messageKey: first?.messageKey ?? 'validation.answerInvalid' };
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
