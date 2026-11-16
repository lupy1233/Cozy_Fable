import type { AnswerMap, Condition } from './types';

// Evaluarea conditiilor serializabile, identica FE/BE. Sta separat de engine.ts ca
// fluxurile (constructorul piece-finish) sa o poata folosi fara import circular
// engine → flows → engine. engine.ts o re-exporta (API public neschimbat).
// Etapa 6: `not` si `atLeast` (optionale — conditiile vechi se evalueaza exact ca inainte).
export function evalCondition(cond: Condition, answers: AnswerMap): boolean {
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, answers));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, answers));
  if ('not' in cond) return !evalCondition(cond.not, answers);

  const answer = answers[cond.questionId];
  if ('equals' in cond) return answer === cond.equals;
  // `in`: primitiv → apartenenta (atLeast ignorat); string[] → cel putin `atLeast`
  // potriviri (implicit 1 = intersectie nevida, comportamentul de dinainte)
  if (Array.isArray(answer)) {
    const hits = answer.filter((v) => typeof v === 'string' && cond.in.includes(v)).length;
    return hits >= (cond.atLeast ?? 1);
  }
  return typeof answer === 'string' && cond.in.includes(answer);
}
