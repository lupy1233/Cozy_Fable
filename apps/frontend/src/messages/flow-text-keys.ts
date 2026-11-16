// Cheile de text (spatiul `Configurator`) folosite de un flux de chestionar — pentru testele de chei
// (etapa 12, m2). Parcurge pasii, optiunile, ferestrele de detalii si sloturile de dimensiune
// (cu raspunsuri sintetice care aleg pe rand fiecare optiune / forma).
import type { AnswerMap, QuestionStep, RoomFlow } from '@marketplace/shared';

// c13 (etapa 12): preturi scoase intentionat — „Fără” la depozitarea patului nu are pret.
// Pretul se afiseaza doar daca textul exista (info-dialog / playing-card verifica `has`).
export const PRICE_HINTS_REMOVED: ReadonlySet<string> = new Set([
  'flows.BEDROOM.bedStorage.options.NONE.info.price',
  'flows.PIECE_BED.storage.options.NONE.info.price',
]);

// Chei de avantaje lipsa DINAINTE de etapa 12, doar pe versiuni inghetate: fereastra de detalii
// filtreaza avantajele / dezavantajele cu `has`, deci pe ecran nu apare nicio cheie (KITCHEN v1 cere
// pros1..3 la toate formele; „paralelă” a avut mereu doar doua avantaje).
export const KNOWN_MISSING_OPTIONAL_KEYS: ReadonlySet<string> = new Set(['flows.KITCHEN.layout.options.PARALLEL.info.pros3']);

// toate valorile `...Key` / `...Keys` dintr-un obiect (pas, optiune, info), fara scor si conditii
function collectStatic(value: unknown, out: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'scoring' || key === 'optionKey' || key === 'visibleIf' || key === 'recommendedIf') continue;
    if (key.endsWith('Key') && typeof item === 'string') out.add(item);
    else if (key.endsWith('Keys') && Array.isArray(item)) item.forEach((k) => typeof k === 'string' && out.add(k));
    else collectStatic(item, out);
  }
}

// raspunsuri de baza: toate optiunile la alegere multipla, prima la alegere simpla, booleenele pe `flag`
function baseAnswers(steps: QuestionStep[], flag: boolean): AnswerMap {
  const answers: AnswerMap = {};
  for (const step of steps) {
    if (step.type === 'multi-choice') answers[step.id] = step.options.map((o) => o.value);
    else if (step.type === 'single-choice' && step.options.length > 0) answers[step.id] = step.options[0].value;
    else if (step.type === 'boolean') answers[step.id] = flag;
  }
  return answers;
}

// scenariile pentru sloturi: fiecare optiune a fiecarei alegeri (simple sau multiple, singura),
// cu booleenele o data pe Da si o data pe Nu
export function slotScenarios(flow: RoomFlow): AnswerMap[] {
  const scenarios: AnswerMap[] = [];
  for (const flag of [true, false]) {
    const base = baseAnswers(flow.steps, flag);
    scenarios.push(base);
    for (const step of flow.steps) {
      if (step.type === 'single-choice') step.options.forEach((o) => scenarios.push({ ...base, [step.id]: o.value }));
      else if (step.type === 'multi-choice') step.options.forEach((o) => scenarios.push({ ...base, [step.id]: [o.value] }));
      else if (step.type === 'boolean') scenarios.push({ ...base, [step.id]: !flag });
    }
  }
  return scenarios;
}

export function collectFlowKeys(flow: RoomFlow): Set<string> {
  const keys = new Set<string>();
  const scenarios = slotScenarios(flow);
  for (const step of flow.steps) {
    collectStatic(step, keys);
    if (step.type === 'dimension-group') {
      for (const answers of scenarios) for (const slot of step.slots(answers)) keys.add(slot.labelKey);
    }
  }
  return keys;
}

export function lookupMessage(messages: { Configurator: unknown }, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages.Configurator);
}
