'use client';

import { createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';
import type { SettingDef, SettingUnit, ValueProblem } from './setting-catalog';

// Valorile de lucru ale paginii Setari: UI state local, pana la salvare (nu e server state).
// Cheia = campul: `setting.<cheie>`, `rule.<id>.points`, `plan.<id>.priceRon` etc.
// Un camp lipsa = neatins (se afiseaza valoarea de pe server).
export type DraftValue = string | boolean;
export type Drafts = Record<string, DraftValue>;

export type SectionId =
  | 'fiscal'
  | 'billing'
  | 'claims'
  | 'quotes'
  | 'trial'
  | 'penalties'
  | 'plans'
  | 'packages'
  | 'thresholds'
  | 'contact'
  | 'legal'
  | 'other'
  | 'tools';

export interface ChangeItem {
  label: string;
  from: string;
  to: string;
}

// O operatie = un apel API (o setare, o regula, un plan, un pachet, un prag).
export interface PendingOp {
  id: string;
  section: SectionId;
  title: string;
  /** codul tehnic, afisat mic, in font-mono */
  code: string | null;
  items: ChangeItem[];
  /** campurile acoperite (se golesc dupa salvarea reusita) */
  fields: string[];
  invalid: boolean;
  run: () => Promise<unknown>;
}

export interface SettingsDraftApi {
  drafts: Drafts;
  setField: (field: string, value: DraftValue, server: DraftValue) => void;
  /** probleme de validare, pe camp */
  problems: Record<string, string>;
  /** esecuri la ultima salvare, pe operatie */
  failures: Record<string, string>;
  /** adevarat cat timp se trimit modificarile */
  busy: boolean;
}

const SettingsDraftContext = createContext<SettingsDraftApi | null>(null);
export const SettingsDraftProvider = SettingsDraftContext.Provider;

export function useSettingsDraft(): SettingsDraftApi {
  const ctx = useContext(SettingsDraftContext);
  if (!ctx) throw new Error('useSettingsDraft: lipseste SettingsDraftProvider');
  return ctx;
}

export function textValue(drafts: Drafts, field: string, server: string): string {
  const d = drafts[field];
  return typeof d === 'string' ? d : server;
}

export function boolValue(drafts: Drafts, field: string, server: boolean): boolean {
  const d = drafts[field];
  return typeof d === 'boolean' ? d : server;
}

// Numele campurilor, intr-un singur loc (randurile si constructorul de operatii le folosesc pe aceleasi).
export type PlanProp = 'nameRo' | 'nameEn' | 'priceRon' | 'includedCredits' | 'gating' | 'access' | 'isActive';
export const FIELD = {
  setting: (key: string) => `setting.${key}`,
  rule: (id: string, prop: 'points' | 'isActive') => `rule.${id}.${prop}`,
  plan: (id: string, prop: PlanProp) => `plan.${id}.${prop}`,
  pkg: (id: string, prop: 'credits' | 'priceRon' | 'isActive') => `package.${id}.${prop}`,
  threshold: (id: string, prop: 'minScore' | 'maxScore') => `threshold.${id}.${prop}`,
};

// operatia de care tine un camp: `plan.<id>.priceRon` → `plan.<id>`; `setting.<cheie>` ramane la fel
export function opIdOfField(field: string): string {
  return field.split('.').slice(0, 2).join('.');
}

// Valoarea trimisa pentru o setare: cele din catalog (numere, coduri) pleaca fara spatii la capete;
// textul liber si cheile necunoscute pleaca exact cum au fost scrise.
export function normalizeSetting(def: SettingDef | undefined, raw: string): string {
  return def && def.spec.kind !== 'text' ? raw.trim() : raw;
}

// Textele setarilor (nume omenesc, explicatie, unitate, optiuni), cu rezerva = codul tehnic.
export function useSettingText() {
  const t = useTranslations('Admin.settings');
  return {
    label: (key: string) => (t.has(`items.${key}.label`) ? t(`items.${key}.label`) : key),
    help: (key: string) => (t.has(`items.${key}.help`) ? t(`items.${key}.help`) : null),
    hasLabel: (key: string) => t.has(`items.${key}.label`),
    unit: (unit: SettingUnit) => t(`units.${unit}`),
    option: (key: string, option: string) =>
      t.has(`items.${key}.options.${option}`) ? t(`items.${key}.options.${option}`) : option,
    onOff: (on: boolean) => (on ? t('on') : t('off')),
    shown: (value: string) => (value.trim() === '' ? t('emptyValue') : value),
    problem: (p: ValueProblem) => {
      switch (p.code) {
        case 'min':
          return t('problems.min', { min: p.min });
        case 'range':
          return t('problems.range', { min: p.min, max: p.max });
        default:
          return t(`problems.${p.code}`);
      }
    },
  };
}

export type SettingText = ReturnType<typeof useSettingText>;
