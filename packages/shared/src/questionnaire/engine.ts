import { z } from 'zod';
import type { RoomType } from '../enums';
import { requestItemSchema, type RequestItemInput } from '../request.schemas';
import { CURRENT_FLOW_VERSION, FLOW_REGISTRY } from './flows';
import { itemQuantityBucket, roomSizeBucket } from './mapping';
import { isPieceConfig3d, pieceConfig3dSchema } from './piece3d/config';
import type {
  AnswerMap,
  AnswerSummaryEntry,
  ChoiceOption,
  Condition,
  QuestionStep,
  RoomFlow,
  ScoreEntry,
  ValidationIssue,
  ValidationResult,
} from './types';

// Engine-ul chestionarului: evaluare conditii, vizibilitate step-uri/optiuni,
// validare Zod dinamica, rezumat Q→A si emiterea intrarilor de scoring.
// Ruleaza identic pe frontend (UX) si pe backend (sursa de adevar).

// Returneaza flow-ul unei camere la versiunea ceruta (default: versiunea curenta).
// Versiunile publicate raman inregistrate permanent — cererile vechi se valideaza
// si se rezuma contra definitiei lor originale, nu contra celei curente.
export function getFlow(roomType: RoomType, version?: number): RoomFlow {
  const v = version ?? CURRENT_FLOW_VERSION[roomType];
  const flow = FLOW_REGISTRY[roomType]?.[v];
  if (!flow) {
    throw new Error(`Unregistered flow version ${String(version)} for room type ${roomType}`);
  }
  return flow;
}

export function isFlowVersionRegistered(roomType: RoomType, version: number): boolean {
  return FLOW_REGISTRY[roomType]?.[version] !== undefined;
}

export function evalCondition(cond: Condition, answers: AnswerMap): boolean {
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, answers));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, answers));

  const answer = answers[cond.questionId];
  if ('equals' in cond) return answer === cond.equals;
  // `in`: primitiv → apartenenta; string[] → intersectie nevida
  if (Array.isArray(answer)) {
    return answer.some((v) => typeof v === 'string' && cond.in.includes(v));
  }
  return typeof answer === 'string' && cond.in.includes(answer);
}

export function isStepVisible(step: QuestionStep, answers: AnswerMap): boolean {
  return step.visibleIf ? evalCondition(step.visibleIf, answers) : true;
}

export function visibleSteps(flow: RoomFlow, answers: AnswerMap): QuestionStep[] {
  return flow.steps.filter((s) => isStepVisible(s, answers));
}

export function visibleOptions(
  step: { options: ChoiceOption[] },
  answers: AnswerMap,
): ChoiceOption[] {
  return step.options.filter((o) => (o.visibleIf ? evalCondition(o.visibleIf, answers) : true));
}

// Schema Zod a raspunsului unui step, construita in functie de raspunsurile
// anterioare (sloturile de dimensiuni sunt dinamice). Mesajele = chei i18n.
export function stepAnswerSchema(step: QuestionStep, answers: AnswerMap): z.ZodTypeAny {
  switch (step.type) {
    case 'single-choice': {
      const values = visibleOptions(step, answers).map((o) => o.value);
      return z.enum(values as [string, ...string[]], {
        errorMap: () => ({ message: 'validation.optionInvalid' }),
      });
    }
    case 'multi-choice': {
      const values = visibleOptions(step, answers).map((o) => o.value);
      const min = step.minSelected ?? (step.optional ? 0 : 1);
      const max = step.maxSelected ?? values.length;
      return z
        .array(
          z.enum(values as [string, ...string[]], {
            errorMap: () => ({ message: 'validation.optionInvalid' }),
          }),
        )
        .min(min, 'validation.minOneOption')
        .max(max, 'validation.tooManyOptions')
        .refine((arr) => new Set(arr).size === arr.length, 'validation.optionInvalid');
    }
    case 'boolean':
      return z.boolean({ errorMap: () => ({ message: 'validation.answerInvalid' }) });
    case 'dimension-group': {
      const slots = step.slots(answers);
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const slot of slots) {
        shape[slot.id] = z
          .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
          .min(slot.min, 'validation.dimensionOutOfRange')
          .max(slot.max, 'validation.dimensionOutOfRange');
      }
      // strict: sloturi care nu exista in configuratia curenta sunt respinse
      return z.object(shape).strict('validation.unknownAnswer');
    }
    case 'number':
      return z
        .number({ errorMap: () => ({ message: 'validation.numberOutOfRange' }) })
        .min(step.min, 'validation.numberOutOfRange')
        .max(step.max, 'validation.numberOutOfRange');
    case 'text': {
      const base = z.string({ errorMap: () => ({ message: 'validation.answerInvalid' }) }).trim();
      return step.optional
        ? base.max(step.maxLength, 'validation.textTooLong')
        : base.min(1, 'validation.answerRequired').max(step.maxLength, 'validation.textTooLong');
    }
    case 'pieces':
      return z
        .array(requestItemSchema)
        .min(step.minPieces, 'validation.minPieces')
        .max(step.maxPieces, 'validation.maxPieces');
    case 'upload':
      // raspunsul = attachment id-uri (uuid); apartenenta la cerere e verificata pe server
      return z
        .array(z.string().uuid('validation.answerInvalid'))
        .max(step.maxFiles, 'validation.tooManyFiles')
        .refine((arr) => new Set(arr).size === arr.length, 'validation.answerInvalid');
    case 'configurator-3d':
      // config serializabil validat contra regulilor piesei (docs/10 R2)
      return pieceConfig3dSchema(step.piece);
  }
}

// Valideaza answers-ul unei camere contra flow-ului ei.
// partial=true (draft): step-urile fara raspuns sunt OK; cele cu raspuns se valideaza.
// partial=false (publish): step-urile vizibile ne-optionale trebuie sa aiba raspuns.
// In ambele moduri: chei necunoscute sau raspunsuri pentru step-uri invizibile → eroare
// (inchide clasa de atac "answers fabricate").
export function validateRoomAnswers(
  roomType: RoomType,
  answers: AnswerMap,
  opts: { partial: boolean; version?: number },
): ValidationResult {
  const flow = getFlow(roomType, opts.version);
  const errors: ValidationIssue[] = [];
  const knownIds = new Set(flow.steps.map((s) => s.id));

  for (const key of Object.keys(answers)) {
    if (!knownIds.has(key)) errors.push({ stepId: key, messageKey: 'validation.unknownAnswer' });
  }

  for (const step of flow.steps) {
    const visible = isStepVisible(step, answers);
    const answer = answers[step.id];
    const answered = answer !== undefined;

    if (!visible) {
      if (answered) errors.push({ stepId: step.id, messageKey: 'validation.unknownAnswer' });
      continue;
    }
    if (!answered) {
      if (!opts.partial && !step.optional) {
        errors.push({ stepId: step.id, messageKey: 'validation.answerRequired' });
      }
      continue;
    }

    const parsed = stepAnswerSchema(step, answers).safeParse(answer);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ stepId: step.id, messageKey: first?.message ?? 'validation.answerInvalid' });
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// Curata raspunsurile devenite invalide dupa o schimbare (step invizibil, slot disparut,
// optiune invizibila). Folosit de frontend la fiecare modificare; itereaza pana la
// punct fix pentru ca vizibilitatile pot cascada.
export function pruneAnswers(flow: RoomFlow, answers: AnswerMap): AnswerMap {
  let current: AnswerMap = { ...answers };
  const knownIds = new Set(flow.steps.map((s) => s.id));
  for (const key of Object.keys(current)) {
    if (!knownIds.has(key)) delete current[key];
  }

  for (let pass = 0; pass < flow.steps.length + 1; pass++) {
    let changed = false;
    for (const step of flow.steps) {
      const answer = current[step.id];
      if (answer === undefined) continue;

      if (!isStepVisible(step, current)) {
        delete current[step.id];
        changed = true;
        continue;
      }
      if (step.type === 'dimension-group' && typeof answer === 'object' && !Array.isArray(answer)) {
        const validIds = new Set(step.slots(current).map((s) => s.id));
        const entries = Object.entries(answer as Record<string, number>).filter(([id]) =>
          validIds.has(id),
        );
        if (entries.length !== Object.keys(answer).length) {
          current = { ...current, [step.id]: Object.fromEntries(entries) };
          changed = true;
        }
      }
      if ((step.type === 'single-choice' || step.type === 'multi-choice') && answer !== undefined) {
        const valid = new Set(visibleOptions(step, current).map((o) => o.value));
        if (typeof answer === 'string' && !valid.has(answer)) {
          delete current[step.id];
          changed = true;
        } else if (Array.isArray(answer)) {
          const kept = (answer as string[]).filter((v) => valid.has(v));
          if (kept.length !== answer.length) {
            current = { ...current, [step.id]: kept };
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return current;
}

// Rezumat Q→A pentru randare pe paginile de detaliu. Sare peste step-urile
// fara raspuns sau cu raspuns gol (text '', multi-choice []).
export function summarizeAnswers(
  roomType: RoomType,
  answers: AnswerMap,
  version?: number,
): AnswerSummaryEntry[] {
  const flow = getFlow(roomType, version);
  const entries: AnswerSummaryEntry[] = [];

  for (const step of visibleSteps(flow, answers)) {
    const answer = answers[step.id];
    if (answer === undefined) continue;

    switch (step.type) {
      case 'single-choice': {
        const opt = step.options.find((o) => o.value === answer);
        if (opt) {
          entries.push({
            kind: 'choice',
            stepId: step.id,
            labelKey: step.titleKey,
            optionLabelKeys: [opt.labelKey],
          });
        }
        break;
      }
      case 'multi-choice': {
        const selected = Array.isArray(answer) ? (answer as string[]) : [];
        const labels = step.options.filter((o) => selected.includes(o.value)).map((o) => o.labelKey);
        if (labels.length > 0) {
          entries.push({
            kind: 'choice',
            stepId: step.id,
            labelKey: step.titleKey,
            optionLabelKeys: labels,
          });
        }
        break;
      }
      case 'boolean':
        entries.push({
          kind: 'boolean',
          stepId: step.id,
          labelKey: step.titleKey,
          value: answer === true,
        });
        break;
      case 'dimension-group': {
        const values = answer as Record<string, number>;
        const slots = step
          .slots(answers)
          .filter((s) => typeof values[s.id] === 'number')
          .map((s) => ({ labelKey: s.labelKey, value: values[s.id] }));
        if (slots.length > 0) {
          entries.push({ kind: 'dimensions', stepId: step.id, labelKey: step.titleKey, slots });
        }
        break;
      }
      case 'number':
        entries.push({
          kind: 'number',
          stepId: step.id,
          labelKey: step.titleKey,
          value: answer as number,
        });
        break;
      case 'text':
        if (typeof answer === 'string' && answer.trim().length > 0) {
          entries.push({ kind: 'text', stepId: step.id, labelKey: step.titleKey, value: answer });
        }
        break;
      case 'pieces': {
        if (Array.isArray(answer) && answer.length > 0) {
          entries.push({
            kind: 'pieces',
            stepId: step.id,
            labelKey: step.titleKey,
            pieces: answer as RequestItemInput[],
          });
        }
        break;
      }
      case 'upload': {
        if (Array.isArray(answer) && answer.length > 0) {
          entries.push({
            kind: 'files',
            stepId: step.id,
            labelKey: step.titleKey,
            count: answer.length,
          });
        }
        break;
      }
      case 'configurator-3d': {
        if (isPieceConfig3d(answer)) {
          entries.push({
            kind: 'config3d',
            stepId: step.id,
            labelKey: step.titleKey,
            piece: step.piece,
            config: answer,
          });
        }
        break;
      }
    }
  }
  return entries;
}

// Emite intrarile de scoring ale unei camere. Reproduce semantica actuala din
// SizingService.compute pe forma derivata (ROOM_TYPE + ROOM_SIZE + ITEM_QUANTITY
// per camera; MATERIAL + max SYSTEM per item) si adauga referintele declarate
// pe optiuni (scoring) si pe boolean (scoringWhenTrue). Pur, fara DB —
// punctele sunt rezolvate de SizingService din project_sizing_config.
export function collectScoreEntries(
  roomType: RoomType,
  answers: AnswerMap,
  version?: number,
): ScoreEntry[] {
  const flow = getFlow(roomType, version);
  const derived = flow.deriveRoom(answers);
  const entries: ScoreEntry[] = [];

  entries.push({ category: 'ROOM_TYPE', optionKey: roomType });
  entries.push({ category: 'ROOM_SIZE', optionKey: roomSizeBucket(derived.lengthM) });

  const totalQty = derived.items.reduce((acc, it) => acc + it.quantity, 0);
  entries.push({ category: 'ITEM_QUANTITY', optionKey: itemQuantityBucket(totalQty) });

  for (const item of derived.items) {
    entries.push({ category: 'MATERIAL', optionKey: item.material });
    if (item.systems.length > 0) {
      entries.push({ category: 'SYSTEM', optionKeys: [...item.systems], pick: 'max' });
    }
  }

  for (const step of visibleSteps(flow, answers)) {
    const answer = answers[step.id];
    if (answer === undefined) continue;

    if (step.type === 'single-choice') {
      const opt = step.options.find((o) => o.value === answer);
      if (opt?.scoring) entries.push(opt.scoring);
    } else if (step.type === 'multi-choice' && Array.isArray(answer)) {
      for (const opt of step.options) {
        if (opt.scoring && (answer as string[]).includes(opt.value)) entries.push(opt.scoring);
      }
    } else if (step.type === 'boolean' && answer === true && step.scoringWhenTrue) {
      entries.push(step.scoringWhenTrue);
    }
  }

  return entries;
}
