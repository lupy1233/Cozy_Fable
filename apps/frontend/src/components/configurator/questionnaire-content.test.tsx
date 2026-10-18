import { CURRENT_FLOW_VERSION, getFlow, evalCondition, type AnswerMap, type Condition, type RoomType } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { ROOM_ICONS } from '@/lib/room-icons';
import { resolveConfiguratorIcon } from '@/lib/configurator-icons';
import { getDimensionFigure } from './dimension-figures';

function satisfy(condition: Condition | undefined, answers: AnswerMap) {
  if (!condition) return;
  if ('all' in condition) condition.all.forEach((child) => satisfy(child, answers));
  else if ('any' in condition) satisfy(condition.any[0], answers);
  else if ('equals' in condition) answers[condition.questionId] = condition.equals;
  else answers[condition.questionId] = Array.isArray(answers[condition.questionId]) ? condition.in : condition.in[0];
}

describe('current questionnaire content', () => {
  it('resolves every title, description, dimension label and info text in RO and EN', () => {
    const failures: string[] = [];
    const iconNames = new Set<string>(Object.values(ROOM_ICONS));
    const check = (key: string | undefined) => {
      if (!key) return;
      for (const [locale, messages] of Object.entries({ en, ro })) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages.Configurator);
        if (typeof value !== 'string' || !value.trim()) failures.push(`${locale}:${key}`);
      }
    };
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (key.endsWith('Key') && typeof item === 'string' && key !== 'optionKey') check(item);
        else if (key.endsWith('Keys') && Array.isArray(item)) item.forEach(check);
        else if (key === 'icon' && typeof item === 'string') iconNames.add(item);
        else if (key !== 'scoring') inspect(item);
      }
    };
    for (const roomType of Object.keys(CURRENT_FLOW_VERSION) as RoomType[]) {
      const flow = getFlow(roomType);
      check(`rooms.type.${roomType}`);
      check(`rooms.desc.${roomType}`);
      const base: AnswerMap = {};
      for (const step of flow.steps) {
        if (step.type === 'multi-choice') base[step.id] = step.options.map((option) => option.value);
        else if (step.type === 'single-choice') base[step.id] = step.options[0].value;
        else if (step.type === 'boolean') base[step.id] = true;
        inspect(step);
      }
      for (const step of flow.steps) {
        const answers = { ...base };
        satisfy(step.visibleIf, answers);
        expect(!step.visibleIf || evalCondition(step.visibleIf, answers), `${roomType}.${step.id} reachable`).toBe(true);
        if (step.type === 'dimension-group') {
          const scenarios = [answers, ...flow.steps.flatMap((choice) => choice.type === 'single-choice' ? choice.options.map((option) => ({ ...answers, [choice.id]: option.value })) : [])];
          for (const scenario of scenarios) step.slots(scenario).forEach((slot) => check(slot.labelKey));
        }
      }
    }
    expect([...new Set(failures)]).toEqual([]);
    expect([...iconNames].filter((name) => !resolveConfiguratorIcon(name))).toEqual([]);
  });
  it('labels custom mattress width and length on the matching drawing', () => {
    const figure = getDimensionFigure('BEDROOM', { bedSize: 'CUSTOM' }, ['bedCustomWidth', 'bedCustomLength'], {});
    expect(figure?.letters).toEqual({ bedCustomWidth: 'A', bedCustomLength: 'B' });
  });
});
