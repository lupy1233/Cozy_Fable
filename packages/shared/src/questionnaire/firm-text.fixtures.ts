// Raspunsuri generate determinist pentru TOATE flow-urile inregistrate (toate versiunile) —
// folosite de testele de invarianta a scorului si de instantaneele textelor pentru firma (d1).
// Variante: first / last / middle (optiuni diferite, dimensiuni diferite) + requiredOnly
// (pasii optionali sar — prinde valorile puse din oficiu).
import { ROOM_TYPES, type RoomType } from '../enums';
import { evalCondition, pruneAnswers, visibleOptions } from './engine';
import { FLOW_REGISTRY, FLOW_VERSIONS_BEFORE_ETAPA6 } from './flows';
import { defaultPieceConfig } from './piece3d';
import type { AnswerMap, QuestionStep, RoomFlow } from './types';

export type FixtureVariant = 'first' | 'last' | 'middle' | 'requiredOnly';
export const FIXTURE_VARIANTS: FixtureVariant[] = ['first', 'last', 'middle', 'requiredOnly'];

function pick<T>(list: T[], variant: FixtureVariant): T | undefined {
  if (list.length === 0) return undefined;
  if (variant === 'last') return list[list.length - 1];
  if (variant === 'middle') return list[Math.floor(list.length / 2)];
  return list[0];
}

function dimValue(min: number, max: number, variant: FixtureVariant): number {
  const f = variant === 'last' ? 0 : variant === 'middle' ? 0.3 : 0.5;
  return Math.round((min + (max - min) * f) * 100) / 100;
}

function answerFor(step: QuestionStep, answers: AnswerMap, variant: FixtureVariant): AnswerMap[string] | undefined {
  switch (step.type) {
    case 'single-choice':
      return pick(visibleOptions(step, answers), variant)?.value;
    case 'multi-choice': {
      // etapa 6: optiunile exclusive ("decide firma", "fara usi") se aleg doar singure —
      // fixture-ul le sare ca sa ramana valid (fluxurile vechi nu au optiuni exclusive)
      const visible = visibleOptions(step, answers);
      const plain = visible.filter((o) => !o.exclusive);
      const values = (plain.length > 0 ? plain : visible.slice(0, 1)).map((o) => o.value);
      if (values.length === 0) return undefined;
      const max = step.maxSelected ?? values.length;
      if (variant === 'last') return values.slice(0, max);
      if (variant === 'middle') return values.slice(Math.floor(values.length / 2)).slice(0, max);
      return values.slice(0, Math.max(1, step.minSelected ?? 1));
    }
    case 'boolean':
      return variant !== 'last';
    case 'dimension-group': {
      const out: Record<string, number> = {};
      for (const slot of step.slots(answers)) out[slot.id] = dimValue(slot.min, slot.max, variant);
      return out;
    }
    case 'number':
      return variant === 'last' ? step.max : step.min;
    case 'text':
      return variant === 'middle' ? 'stejar natur' : 'note client';
    case 'pieces':
      // rowVersion 2 cere deschiderea (sau o iesire) — randul ramane valid
      return step.rowVersion === 2
        ? ([{ name: 'Raft perete', material: 'PAL', systems: [], quantity: 2, openingChoice: 'NO_FRONTS' }] as unknown as AnswerMap[string])
        : [{ name: 'Raft perete', material: 'PAL', systems: [], quantity: 2 }];
    case 'upload':
      return undefined;
    case 'configurator-3d':
      return defaultPieceConfig(step.piece);
  }
}

export function fixtureAnswers(flow: RoomFlow, variant: FixtureVariant): AnswerMap {
  let answers: AnswerMap = {};
  for (const step of flow.steps) {
    if (step.hidden) continue;
    if (step.visibleIf && !evalCondition(step.visibleIf, answers)) continue;
    if (variant === 'requiredOnly' && step.optional) continue;
    const value = answerFor(step, answers, variant);
    if (value !== undefined) answers = { ...answers, [step.id]: value };
  }
  return pruneAnswers(flow, answers);
}

// only: 'legacy' = versiunile de dinainte de etapa 6 (instantaneele vechi, byte-identice);
// 'etapa6' = versiunile noi (instantaneele score-v6 / firm-text-v6, generate in valul 3).
export function allFixtureFlows(
  opts: { only?: 'legacy' | 'etapa6' } = {},
): { roomType: RoomType; version: number; flow: RoomFlow }[] {
  const keep = (roomType: RoomType, version: number) => {
    if (!opts.only) return true;
    const legacy = (FLOW_VERSIONS_BEFORE_ETAPA6[roomType] ?? []).includes(version);
    return opts.only === 'legacy' ? legacy : !legacy;
  };
  return ROOM_TYPES.flatMap((roomType) =>
    Object.values(FLOW_REGISTRY[roomType] ?? {})
      .sort((a, b) => a.version - b.version)
      .filter((flow) => keep(roomType, flow.version))
      .map((flow) => ({ roomType, version: flow.version, flow })),
  );
}
