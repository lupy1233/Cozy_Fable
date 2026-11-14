import { FLOW_REGISTRY, type RoomType } from '@marketplace/shared';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { summaryLabel, type Translate } from '@/components/configurator/summary-rows';
import en from './en.json';
import ro from './ro.json';
import { collectFlowKeys, KNOWN_MISSING_OPTIONAL_KEYS, lookupMessage, PRICE_HINTS_REMOVED } from './flow-text-keys';

// Etapa 12 (m2): TOATE versiunile inregistrate, inclusiv cele inghetate. Cererile vechi se afiseaza
// pe versiunea lor, deci o cheie folosita de orice versiune nu are voie sa lipseasca din ro / en
// (protejeaza versiunile vechi la curatenii viitoare).
const allFlows = () =>
  (Object.keys(FLOW_REGISTRY) as RoomType[]).flatMap((roomType) =>
    Object.values(FLOW_REGISTRY[roomType]).map((flow) => ({ roomType, flow })),
  );

const RAW_KEY = /(^|\s)(Configurator\.)?(flows|common|config3d|rooms|dimensions)\.[A-Za-z0-9_.]+/;

function translator(locale: 'ro' | 'en', errors: string[]): Translate {
  const messages = locale === 'ro' ? ro : en;
  const base = createTranslator({
    locale,
    messages,
    namespace: 'Configurator',
    onError: (error: Error) => errors.push(`${locale}: ${error.message}`),
  } as never) as unknown as (key: string) => string;
  const t = ((key: string) => base(key)) as Translate;
  t.has = (key: string) => typeof lookupMessage(messages, key) === 'string';
  return t;
}

describe('cheile de text ale fluxurilor — toate versiunile', () => {
  it('collects keys from every registered version (sanity)', () => {
    const flows = allFlows();
    expect(flows.length).toBeGreaterThan(60);
    // versiunile 1 inghetate sunt in registru
    expect(FLOW_REGISTRY.OFFICE[1]).toBeDefined();
    expect(FLOW_REGISTRY.HALLWAY[1]).toBeDefined();
    expect(collectFlowKeys(FLOW_REGISTRY.OFFICE[1]).has('flows.OFFICE.material.title')).toBe(true);
  });

  it('every key used by any version exists in ro.json and en.json', () => {
    const missing = new Set<string>();
    for (const { roomType, flow } of allFlows()) {
      for (const key of collectFlowKeys(flow)) {
        if (PRICE_HINTS_REMOVED.has(key) || KNOWN_MISSING_OPTIONAL_KEYS.has(key)) continue;
        for (const [locale, messages] of Object.entries({ ro, en })) {
          const value = lookupMessage(messages, key);
          if (typeof value !== 'string' || !value.trim()) missing.add(`${locale} ${roomType} v${flow.version}: ${key}`);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('the intentionally removed price hints stay removed in both languages', () => {
    for (const key of PRICE_HINTS_REMOVED) {
      expect(lookupMessage(ro, key), key).toBeUndefined();
      expect(lookupMessage(en, key), key).toBeUndefined();
    }
  });

  // inlocuieste verificarea de mana „o cerere veche de birou v1 si una de hol v1: niciun cod de cheie pe ecran”
  it.each([
    ['OFFICE', 1],
    ['HALLWAY', 1],
  ] as const)('%s v%s: titles, labels and info texts render as text, never as raw keys', (roomType, version) => {
    const flow = FLOW_REGISTRY[roomType][version];
    for (const locale of ['ro', 'en'] as const) {
      const errors: string[] = [];
      const t = translator(locale, errors);
      const rendered: string[] = [];
      for (const key of collectFlowKeys(flow)) if (!PRICE_HINTS_REMOVED.has(key)) rendered.push(t(key));
      for (const step of flow.steps) if (!step.hidden) rendered.push(summaryLabel(t, step));
      expect(errors).toEqual([]);
      expect(rendered.filter((text) => !text.trim() || RAW_KEY.test(text))).toEqual([]);
    }
  });
});
