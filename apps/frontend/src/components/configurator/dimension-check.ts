import {
  isStepVisible,
  type AnswerMap,
  type AnswerValue,
  type Condition,
  type DimensionGroupStep,
  type QuestionStep,
} from '@marketplace/shared';

// Functii pure de verificare (etapa 8, val 0), comune ecranelor de intrebari
// (validare per camp, contorul de ecrane) si Fisei cererii (marcajul "de corectat").

export type SlotState = 'ok' | 'missing' | 'outOfRange';

export interface DimensionSlotStatus {
  id: string;
  labelKey: string;
  value?: number;
  min: number;
  max: number;
  state: SlotState;
}

// Starea fiecarui slot al unui pas de dimensiuni, cu aceleasi limite ca motorul
// (comparatie stricta min/max, valorile in metri).
export function dimensionSlotStatus(step: DimensionGroupStep, answers: AnswerMap): DimensionSlotStatus[] {
  const raw = answers[step.id];
  const values = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return step.slots(answers).map((slot) => {
    const v = values[slot.id];
    const base = { id: slot.id, labelKey: slot.labelKey, min: slot.min, max: slot.max };
    if (typeof v !== 'number' || !Number.isFinite(v)) return { ...base, state: 'missing' as const };
    const state: SlotState = v < slot.min || v > slot.max ? 'outOfRange' : 'ok';
    return { ...base, value: v, state };
  });
}

// Id-urile intrebarilor citite de o conditie (all / any / not, recursiv), fara dubluri.
export function conditionQuestionIds(cond: Condition): string[] {
  const out = new Set<string>();
  const walk = (c: Condition) => {
    if ('all' in c) c.all.forEach(walk);
    else if ('any' in c) c.any.forEach(walk);
    else if ('not' in c) walk(c.not);
    else out.add(c.questionId);
  };
  walk(cond);
  return [...out];
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// Totalul de ecrane al camerei e cunoscut cand niciun raspuns inca nedat nu mai
// poate adauga sau scoate un ECRAN. `screens` = ecranele de acum (roomScreens),
// `allSteps` = toti pasii fluxului.
// Un pas care depinde de o intrebare fara raspuns nu schimba numarul de ecrane cand
// sta in acelasi screenGroup cu un pas vizibil a carui vizibilitate nu depinde de
// nicio intrebare fara raspuns (ex. "Altul — care?" langa material, pe acelasi ecran).
// Pe camerele fara alegere de piese totalul e cunoscut de la inceput; la dormitor,
// dupa ecranul pieselor.
export function screenTotalKnown(screens: QuestionStep[][], allSteps: QuestionStep[], answers: AnswerMap): boolean {
  const onScreen = new Set(screens.flat().map((s) => s.id));
  const stepById = new Map(allSteps.map((s) => [s.id, s] as const));
  const depsOf = new Map(allSteps.map((s) => [s.id, s.visibleIf ? conditionQuestionIds(s.visibleIf) : []] as const));
  const controllers = new Set([...depsOf.values()].flat());

  // intrebarile de care depinde vizibilitatea altora si care pot inca primi alt raspuns:
  // cele de pe ecran fara raspuns + cele ascunse acum a caror vizibilitate depinde de ele
  const open = new Set<string>();
  for (const id of controllers) {
    if (onScreen.has(id) && !hasAnswer(answers[id])) open.add(id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of controllers) {
      if (open.has(id) || onScreen.has(id) || !stepById.has(id)) continue;
      if ((depsOf.get(id) ?? []).some((d) => open.has(d))) {
        open.add(id);
        grew = true;
      }
    }
  }
  if (open.size === 0) return true;

  const uncertain = (s: QuestionStep) => (depsOf.get(s.id) ?? []).some((d) => open.has(d));
  for (const step of allSteps) {
    if (step.hidden || !uncertain(step)) continue;
    const group = step.screenGroup;
    // pasul isi poate face (sau pierde) un ecran al lui → totalul nu e sigur
    const anchored =
      group !== undefined &&
      allSteps.some(
        (other) =>
          other !== step &&
          other.screenGroup === group &&
          !other.hidden &&
          onScreen.has(other.id) &&
          isStepVisible(other, answers) &&
          !uncertain(other),
      );
    if (!anchored) return false;
  }
  return true;
}
