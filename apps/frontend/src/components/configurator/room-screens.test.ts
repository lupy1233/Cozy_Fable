import { getFlow, type AnswerMap, type QuestionStep } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { requiredMessageKey, roomIssue, validateStep, validateStepIssue } from './room-screens';

// Etapa 8 (nr. 39): mesajele de validare dupa tipul intrebarii si per camp

const laundryDims = getFlow('LAUNDRY', 1).steps.find((s) => s.id === 'dimensions') as QuestionStep;
const kitchenDims = getFlow('KITCHEN', 1).steps.find((s) => s.id === 'dimensions') as QuestionStep;

// cheia relativa la Configurator exista in ambele limbi
const has = (key: string) =>
  [ro, en].every((m) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], m.Configurator) !== undefined);

describe('validateStepIssue — dimensiuni', () => {
  it('pasul fara niciun raspuns: toate campurile goale, rezumat cu numarul lor', () => {
    const issue = validateStepIssue(laundryDims, {});
    expect(issue).toEqual({
      key: 'validation.dimensionsMissing',
      values: { count: 2 },
      fields: { runA: { key: 'validation.fillField' }, ceilingHeight: { key: 'validation.fillField' } },
    });
  });

  it('un camp gol si unul in afara intervalului: mesaj pe fiecare camp, rezumatul numara doar golurile', () => {
    const issue = validateStepIssue(kitchenDims, { layout: 'L_SHAPE', hasIsland: false, dimensions: { runA: 99, ceilingHeight: 2.6 } });
    expect(issue?.key).toBe('validation.dimensionsMissing');
    expect(issue?.values).toEqual({ count: 1 });
    expect(issue?.fields).toEqual({ runB: { key: 'validation.fillField' }, runA: { key: 'validation.dimensionRange' } });
  });

  it('doar valori in afara intervalului: mesajul de interval, nu "completeaza"', () => {
    const issue = validateStepIssue(laundryDims, { dimensions: { runA: 0.1, ceilingHeight: 2.6 } });
    expect(issue).toEqual({ key: 'validation.dimensionOutOfRange', fields: { runA: { key: 'validation.dimensionRange' } } });
  });

  it('toate campurile corecte trec; validateStep pastreaza doar cheia', () => {
    expect(validateStepIssue(laundryDims, { dimensions: { runA: 2.4, ceilingHeight: 2.6 } })).toBeUndefined();
    expect(validateStep(laundryDims, { dimensions: { ceilingHeight: 2.6 } })).toBe('validation.dimensionsMissing');
  });
});

describe('validateStepIssue — raspuns lipsa dupa tipul intrebarii', () => {
  const single: QuestionStep = { id: 's', type: 'single-choice', titleKey: 'x', options: [{ value: 'A', labelKey: 'a' }] };
  const multi: QuestionStep = { id: 'm', type: 'multi-choice', titleKey: 'x', options: [{ value: 'A', labelKey: 'a' }] };
  const bool: QuestionStep = { id: 'b', type: 'boolean', titleKey: 'x' };
  const text: QuestionStep = { id: 't', type: 'text', titleKey: 'x', maxLength: 120 };
  const pieces = getFlow('PIECES', 1).steps.find((s) => s.id === 'pieces') as QuestionStep;

  it.each<[string, QuestionStep, AnswerMap, string]>([
    ['alegere unica', single, {}, 'validation.chooseOne'],
    ['da / nu', bool, {}, 'validation.chooseOne'],
    ['alegere multipla', multi, {}, 'validation.minOneOption'],
    ['alegere multipla goala', multi, { m: [] }, 'validation.minOneOption'],
    ['text', text, {}, 'validation.fillThisField'],
    ['text doar cu spatii', text, { t: '   ' }, 'validation.fillThisField'],
    ['piese', pieces, {}, 'validation.minPieces'],
    ['piese, lista goala', pieces, { pieces: [] }, 'validation.minPieces'],
  ])('%s', (_label, step, answers, key) => {
    expect(validateStepIssue(step, answers)?.key).toBe(key);
    expect(has(key)).toBe(true);
  });

  it('requiredMessageKey: 3D si fisierele raman pe mesajul general', () => {
    expect(requiredMessageKey({ id: 'u', type: 'upload', titleKey: 'x', maxFiles: 3 } as QuestionStep)).toBe('validation.answerRequired');
    expect(requiredMessageKey(laundryDims)).toBe('validation.dimensionsMissing');
  });
});

describe('validateStepIssue — "Alta piesa" v1', () => {
  const pieces = getFlow('PIECES', 1).steps.find((s) => s.id === 'pieces') as QuestionStep;
  const row = { name: 'Raft', material: 'PAL' as const, systems: [], quantity: 1, description: '' };

  it('denumirea de 1 caracter pe randul 2 → "Piesa 2: ...", nu "formatul asteptat"', () => {
    const issue = validateStepIssue(pieces, { pieces: [row, { ...row, name: 'E' }] });
    expect(issue).toEqual({ key: 'validation.pieceRow.name', values: { row: 2, max: 999 } });
    expect(has('validation.pieceRow.name')).toBe(true);
  });

  it('cantitatea peste 999 → mesajul de cantitate al randului', () => {
    const issue = validateStepIssue(pieces, { pieces: [{ ...row, quantity: 1500 }] });
    expect(issue?.key).toBe('validation.pieceRow.quantity');
    expect(issue?.values).toMatchObject({ row: 1 });
  });
});

describe('roomIssue — mesajul fara parametri pentru Sumar', () => {
  it('pasul de dimensiuni lipsa → "Completeaza toate dimensiunile"', () => {
    const room = { localId: 'r', roomType: 'LAUNDRY' as const, flowVersion: 1, completed: false, answers: { material: 'PAL' } as AnswerMap };
    const issue = roomIssue(room, { ownProject: false });
    // primul pas fara raspuns poate fi altul; cand e cel de dimensiuni, mesajul e cel nou
    const flowIssue = roomIssue({ ...room, answers: { ...answersBefore('LAUNDRY', 1, 'dimensions') } }, { ownProject: false });
    expect(issue).not.toBeNull();
    expect(flowIssue).toEqual({ stepId: 'dimensions', messageKey: 'validation.dimensionRequired' });
  });
});

// Raspunsuri valide pentru toti pasii vizibili de dinaintea `stopId` (prima optiune / da / text).
function answersBefore(roomType: 'LAUNDRY', version: number, stopId: string): AnswerMap {
  const answers: AnswerMap = {};
  for (const step of getFlow(roomType, version).steps) {
    if (step.id === stopId) break;
    if (step.optional || step.hidden || step.visibleIf) continue;
    if (step.type === 'single-choice') answers[step.id] = step.options[0]!.value;
    else if (step.type === 'multi-choice') answers[step.id] = [step.options[0]!.value];
    else if (step.type === 'boolean') answers[step.id] = true;
    else if (step.type === 'text') answers[step.id] = 'abc';
  }
  return answers;
}
