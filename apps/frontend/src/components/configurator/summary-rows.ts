import {
  getFlow,
  summarizeAnswers,
  type AnswerMap,
  type AnswerSummaryEntry,
  type Condition,
  type QuestionStep,
  type RequestItemInput,
  type RoomType,
} from '@marketplace/shared';
import { formatDimension, type DimensionUnit } from '@/lib/dimension-format';
import { dimensionSlotStatus } from './dimension-check';
import { config3dChipItems } from './piece3d/config-chips';

// Randurile de rezumat (etapa 8, problema 38) — aceeasi sursa pentru Fisa cererii
// (RequestSheet), Sumar (ReviewRoomCard / RoomAnswerSummary) si etichetele fisei firmei
// (RoomSpecCard). Sursa = summarizeAnswers (neschimbat) + pasii fluxului pentru etichete.

export type Translate = ((key: string, values?: Record<string, string | number>) => string) & {
  has?: (key: string) => boolean;
};

export interface SummaryRow {
  // unic in camera: stepId sau stepId:slotId la dimensiuni
  key: string;
  stepId: string;
  label: string;
  value: string;
  kind: AnswerSummaryEntry['kind'];
  importance: 'main' | 'extra';
  // dimensiune in afara intervalului (aceeasi verificare ca ecranul)
  invalid?: boolean;
  swatch?: string;
  mono?: boolean;
  // doar la kind 'pieces': randurile cu denumire (cele goale nu se afiseaza)
  pieces?: RequestItemInput[];
  // doar la kind 'files'
  count?: number;
}

// eticheta de rezumat: "<...>.title" / "<...>.cardLabel" → "<...>.summaryLabel";
// ecranul 3D → config3d.summaryLabel ("Configuratia piesei")
export function summaryLabelKey(step: QuestionStep): string {
  if (step.type === 'configurator-3d') return 'config3d.summaryLabel';
  const base = step.type === 'boolean' && step.cardLabelKey ? step.cardLabelKey : step.titleKey;
  return base.replace(/\.(title|cardLabel)$/, '.summaryLabel');
}

// rezerva = eticheta cardului (boolean) sau titlul intreg al intrebarii
function fallbackLabelKey(step: QuestionStep): string {
  return step.type === 'boolean' && step.cardLabelKey ? step.cardLabelKey : step.titleKey;
}

export function summaryLabel(t: Translate, step: QuestionStep): string {
  const key = summaryLabelKey(step);
  const fallback = fallbackLabelKey(step);
  if (key !== fallback && typeof t.has === 'function' && t.has(key)) return t(key);
  return t(fallback);
}

// pasii fluxului dupa id; versiune necunoscuta → harta goala (apelantii cad pe labelKey)
export function flowStepsById(roomType: RoomType, version?: number | null): Map<string, QuestionStep> {
  try {
    return new Map(getFlow(roomType, version ?? 1).steps.map((s) => [s.id, s] as const));
  } catch {
    return new Map();
  }
}

// eticheta scurta pentru un pas dupa id (fisa firmei); fara pas → cheia primita
export function summaryLabelFor(t: Translate, steps: Map<string, QuestionStep>, stepId: string, labelKey: string): string {
  const step = steps.get(stepId);
  return step ? summaryLabel(t, step) : t(labelKey);
}

const OTHER_VALUES = new Set(['ALTUL', 'OTHER']);

// pasii de alegere, de material si de deschidere (lista scurta din Sumar, D12)
const MAIN_STEP_ID = /^(material|frontMaterial|separateFrontMaterials|openingSystems|systems|sameFinish|liftUp|doorType|wardrobeDoorType)/;

// conditiile-frunza care cer "Altul" pe o intrebare: { questionId: X, equals: 'ALTUL' } / in: ['OTHER']
function otherLeaves(cond: Condition, out: string[] = []): string[] {
  if ('all' in cond) cond.all.forEach((c) => otherLeaves(c, out));
  else if ('any' in cond) cond.any.forEach((c) => otherLeaves(c, out));
  else if ('not' in cond) return out;
  else if ('equals' in cond) {
    if (typeof cond.equals === 'string' && OTHER_VALUES.has(cond.equals)) out.push(cond.questionId);
  } else if (cond.in.some((v) => OTHER_VALUES.has(v))) out.push(cond.questionId);
  return out;
}

// pasul text pereche al unei alegeri cu "Altul": textId → choiceId
// (ex. materialOther → material, piecesOtherText → piecesNeeded, materialAllOther → materialAll)
export function otherTextPairs(steps: QuestionStep[]): Map<string, string> {
  const choices = new Map(
    steps
      .filter((s) => (s.type === 'single-choice' || s.type === 'multi-choice') && s.options.some((o) => OTHER_VALUES.has(o.value)))
      .map((s) => [s.id, s] as const),
  );
  const pairs = new Map<string, string>();
  for (const step of steps) {
    if (step.type !== 'text' || !step.visibleIf) continue;
    const choiceId = otherLeaves(step.visibleIf).find((id) => choices.has(id));
    if (choiceId) pairs.set(step.id, choiceId);
  }
  return pairs;
}

// pasii primului ecran al camerei (acelasi screenGroup consecutiv, ca roomScreens)
function firstScreenIds(steps: QuestionStep[]): Set<string> {
  const shown = steps.filter((s) => !s.hidden);
  const first = shown[0];
  if (!first) return new Set();
  if (!first.screenGroup) return new Set([first.id]);
  const ids = new Set<string>();
  for (const s of shown) {
    if (s.screenGroup !== first.screenGroup) break;
    ids.add(s.id);
  }
  return ids;
}

export function rowImportance(step: QuestionStep | undefined, firstScreen: Set<string>): 'main' | 'extra' {
  if (!step) return 'extra';
  if (step.type === 'upload') return 'extra';
  if (step.type === 'pieces' || step.type === 'configurator-3d' || step.type === 'dimension-group') return 'main';
  if (firstScreen.has(step.id)) return 'main';
  return MAIN_STEP_ID.test(step.id) ? 'main' : 'extra';
}

export interface SummaryRoom {
  roomType: RoomType;
  answers: AnswerMap | Record<string, unknown>;
  flowVersion?: number | null;
}

export function buildSummaryRows(room: SummaryRoom, t: Translate, o: { unit: DimensionUnit; locale: string }): SummaryRow[] {
  const answers = room.answers as AnswerMap;
  let steps: QuestionStep[];
  let entries: AnswerSummaryEntry[];
  try {
    steps = getFlow(room.roomType, room.flowVersion ?? 1).steps;
    entries = summarizeAnswers(room.roomType, answers, room.flowVersion ?? 1);
  } catch {
    return [];
  }
  const byId = new Map(steps.map((s) => [s.id, s] as const));
  const pairs = otherTextPairs(steps);
  const firstScreen = firstScreenIds(steps);
  // textul "Altul" scris de client, pe alegerea pereche (doar daca are text)
  const otherText = new Map<string, string>();
  for (const e of entries) {
    const choiceId = pairs.get(e.stepId);
    if (e.kind === 'text' && choiceId) otherText.set(choiceId, e.value.trim());
  }

  const rows: SummaryRow[] = [];
  for (const e of entries) {
    const step = byId.get(e.stepId);
    const label = step ? summaryLabel(t, step) : t(e.labelKey);
    const importance = rowImportance(step, firstScreen);
    const base = { key: e.stepId, stepId: e.stepId, label, kind: e.kind, importance };
    switch (e.kind) {
      case 'choice': {
        let value = e.optionLabelKeys.map((k) => t(k)).join(', ');
        const text = otherText.get(e.stepId);
        if (text && step && (step.type === 'single-choice' || step.type === 'multi-choice')) {
          const raw = answers[step.id];
          const selected = Array.isArray(raw) ? (raw as string[]) : [raw as string];
          value = step.options
            .filter((opt) => selected.includes(opt.value))
            .map((opt) => (OTHER_VALUES.has(opt.value) ? `${t(opt.labelKey)} — ${text}` : t(opt.labelKey)))
            .join(', ');
        }
        rows.push({ ...base, value });
        break;
      }
      case 'boolean':
        rows.push({ ...base, value: t(e.value ? 'common.boolean.yes' : 'common.boolean.no') });
        break;
      case 'dimensions': {
        // un rand pe slot, cu aceeasi verificare de interval ca ecranul
        const slots = step?.type === 'dimension-group' ? dimensionSlotStatus(step, answers) : [];
        if (slots.length === 0) {
          e.slots.forEach((s, i) =>
            rows.push({ ...base, key: `${e.stepId}:${i}`, label: t(s.labelKey), value: formatDimension(s.value, o), mono: true }),
          );
          break;
        }
        for (const s of slots) {
          if (s.state === 'missing' || s.value === undefined) continue;
          rows.push({
            ...base,
            key: `${e.stepId}:${s.id}`,
            label: t(s.labelKey),
            value: formatDimension(s.value, o),
            mono: true,
            ...(s.state === 'outOfRange' ? { invalid: true } : {}),
          });
        }
        break;
      }
      case 'number':
        rows.push({ ...base, value: String(e.value), mono: true });
        break;
      case 'text': {
        // textul "Altul" e deja pe randul alegerii pereche
        const choiceId = pairs.get(e.stepId);
        if (choiceId && entries.some((x) => x.stepId === choiceId && x.kind === 'choice')) break;
        rows.push({ ...base, value: e.value });
        break;
      }
      case 'pieces': {
        const named = e.pieces.filter((p) => typeof p.name === 'string' && p.name.trim() !== '');
        if (named.length === 0) break;
        rows.push({
          ...base,
          value: named.map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.name}` : p.name)).join(', '),
          pieces: named,
        });
        break;
      }
      case 'files':
        rows.push({ ...base, value: t('summaryFiles.count', { n: e.count }), count: e.count });
        break;
      case 'config3d': {
        // "Configuratia piesei": chips-urile 3D + mostra culorii (finisaj / tapiterie)
        const items = config3dChipItems(t, e.config, e.piece, o.locale);
        const swatch = items.find((item) => item.swatch)?.swatch;
        rows.push({ ...base, value: items.map((item) => item.text).join(' · '), ...(swatch ? { swatch } : {}) });
        break;
      }
    }
  }
  return rows;
}
