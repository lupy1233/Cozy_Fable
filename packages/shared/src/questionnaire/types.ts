import type { RoomType } from '../enums';
import type { RequestItemInput } from '../request.schemas';

// Motorul de chestionar al configuratorului de cereri.
// Definitiile flow-urilor sunt typed TS config (decizie user, 2026-07-04) — NU DB.
// Punctele NU stau aici: optiunile refera chei din project_sizing_config (D1),
// punctele raman in DB, editabile din admin fara deploy.
// Toate campurile *Key sunt chei i18n RELATIVE la namespace-ul frontend 'Configurator'.

export type AnswerPrimitive = string | number | boolean;

// Raspunsul unui step: primitive (single-choice/boolean/number/text),
// string[] (multi-choice), Record<slotId, metri> (dimension-group),
// RequestItemInput[] (pieces).
export type AnswerValue =
  | AnswerPrimitive
  | string[]
  | Record<string, number>
  | RequestItemInput[];

export type AnswerMap = Record<string, AnswerValue>;

// Conditii serializabile (date, nu functii) — evaluate identic FE/BE, testabile.
// `equals`: egalitate stricta cu un primitiv.
// `in`: pentru raspuns primitiv = apartenenta; pentru raspuns string[] = intersectie nevida.
export type Condition =
  | { questionId: string; equals: AnswerPrimitive }
  | { questionId: string; in: string[] }
  | { all: Condition[] }
  | { any: Condition[] };

// Pointer catre o optiune de scoring din project_sizing_config (key + option).
export interface ScoringRef {
  category: string;
  optionKey: string;
}

// O intrare de scor emisa de engine; varianta `pick: 'max'` e rezolvata de backend
// cu greutatile din DB (ex. SYSTEM per item = max dintre sistemele selectate).
export type ScoreEntry =
  | ScoringRef
  | { category: string; optionKeys: string[]; pick: 'max' };

// Continutul butonului Info de pe un card de raspuns (pros/cons/pret mediu).
export interface InfoContentRef {
  titleKey: string;
  bodyKey: string;
  prosKeys?: string[];
  consKeys?: string[];
  priceHintKey?: string;
}

export interface ChoiceOption {
  // valoare stabila UPPER_SNAKE, persistata in answers
  value: string;
  labelKey: string;
  descriptionKey?: string;
  // nume icon lucide-react, rezolvat doar in frontend
  icon?: string;
  info?: InfoContentRef;
  // optiunea apare doar daca conditia e satisfacuta (ex. ISLAND_UNITS doar cu insula)
  visibleIf?: Condition;
  // pur prezentational: badge "Recomandat" cand conditia e adevarata
  // (ex. MDF recomandat cand baia nu e ventilata). Nu afecteaza validarea.
  recommendedIf?: Condition;
  scoring?: ScoringRef;
}

export interface DimensionSlot {
  id: string;
  labelKey: string;
  unit: 'm';
  min: number;
  max: number;
  step?: number;
  // intra in suma de metri liniari (front de mobilier) → lengthM + bucket ROOM_SIZE
  countsTowardLinear?: boolean;
}

interface BaseStep {
  id: string;
  titleKey: string;
  subtitleKey?: string;
  info?: InfoContentRef;
  visibleIf?: Condition;
  // optional=true: poate ramane fara raspuns la publish
  optional?: boolean;
  // pur prezentational: step-urile vizibile consecutive cu acelasi screenGroup
  // sunt randate pe un singur ecran (ex. layout + insula la bucatarie).
  // Validarea ramane per-step; engine-ul nu il foloseste.
  screenGroup?: string;
}

export type SingleChoiceStep = BaseStep & { type: 'single-choice'; options: ChoiceOption[] };
export type MultiChoiceStep = BaseStep & {
  type: 'multi-choice';
  options: ChoiceOption[];
  minSelected?: number;
  maxSelected?: number;
};
export type BooleanStep = BaseStep & { type: 'boolean'; scoringWhenTrue?: ScoringRef };
// Sloturile sunt FUNCTIE de raspunsurile anterioare (genuin dinamice) — permis
// pentru ca definitia e cod TS partajat FE/BE, nu config DB.
export type DimensionGroupStep = BaseStep & {
  type: 'dimension-group';
  slots: (answers: AnswerMap) => DimensionSlot[];
};
export type NumberStep = BaseStep & { type: 'number'; min: number; max: number; step?: number };
export type TextStep = BaseStep & { type: 'text'; maxLength: number; multiline?: boolean };
export type PiecesStep = BaseStep & { type: 'pieces'; minPieces: number; maxPieces: number };
// Upload schita/proiect per camera. Raspunsul = string[] de attachment id-uri
// (uuid) deja create prin fluxul presign/confirm; backend-ul verifica la publish
// ca id-urile apartin cererii. Step-urile upload sunt intotdeauna optionale.
export type UploadStep = BaseStep & { type: 'upload'; maxFiles: number };

export type QuestionStep =
  | SingleChoiceStep
  | MultiChoiceStep
  | BooleanStep
  | DimensionGroupStep
  | NumberStep
  | TextStep
  | PiecesStep
  | UploadStep;

// Forma legacy derivata din answers — hraneste persistenta request_rooms/request_items
// si scoringul existent. Derivarea ruleaza DOAR pe server (sursa de adevar) si pe
// client pentru preview in Review.
export interface DerivedRoom {
  lengthM: number;
  widthM: number;
  heightM: number;
  items: RequestItemInput[];
}

export interface RoomFlow {
  roomType: RoomType;
  // bump la orice schimbare breaking de step-uri/sloturi; persistat ca flow_version
  version: number;
  steps: QuestionStep[];
  deriveRoom: (answers: AnswerMap) => DerivedRoom;
}

// Intrare de rezumat Q→A pentru paginile de detaliu (client + marketplace).
export type AnswerSummaryEntry =
  | { kind: 'choice'; stepId: string; labelKey: string; optionLabelKeys: string[] }
  | { kind: 'boolean'; stepId: string; labelKey: string; value: boolean }
  | {
      kind: 'dimensions';
      stepId: string;
      labelKey: string;
      slots: { labelKey: string; value: number }[];
    }
  | { kind: 'number'; stepId: string; labelKey: string; value: number }
  | { kind: 'text'; stepId: string; labelKey: string; value: string }
  | { kind: 'pieces'; stepId: string; labelKey: string; pieces: RequestItemInput[] }
  | { kind: 'files'; stepId: string; labelKey: string; count: number };

export type ValidationIssue = { stepId: string; messageKey: string };
export type ValidationResult = { ok: true } | { ok: false; errors: ValidationIssue[] };
