import {
  CLAIM_CONTACT_REVEAL_POLICIES,
  CLAIM_COST_LIMITS,
  CLAIM_COST_SETTING_KEYS,
  MARKETPLACE_DISTANCE_DISPLAY_MODES,
  PLAN_CODE_RE,
  PRE_CLAIM_CONTACT_TEXT_POLICIES,
} from '@marketplace/shared';

// Catalogul setarilor de sistem (system_settings): pe ce tema sta fiecare cheie, ce fel de
// valoare are si in ce unitate. Limitele oglindesc validarea de pe server (admin.service.ts,
// SETTING_VALUE_RULES); cheile fara regula pe server cer doar formatul (numar intreg / zecimal).
// O cheie care nu e aici apare la „Alte setari”, cu eticheta = cheia si camp text liber.

export type SettingUnit =
  | 'minutes'
  | 'days'
  | 'months'
  | 'points'
  | 'ron'
  | 'ronPerEur'
  | 'percent'
  | 'credits'
  | 'firms'
  | 'locations'
  | 'changes';

export type SettingSpec =
  | { kind: 'int'; unit: SettingUnit; min: number; max: number | null }
  | { kind: 'decimal'; unit: SettingUnit }
  | { kind: 'bool' }
  | { kind: 'enum'; options: readonly string[] }
  | { kind: 'email' }
  | { kind: 'plan' }
  | { kind: 'text' };

export type SettingGroupId = 'billing' | 'claims' | 'quotes' | 'trial' | 'penalties' | 'contact' | 'legal';

export interface SettingDef {
  key: string;
  group: SettingGroupId;
  spec: SettingSpec;
}

const int = (unit: SettingUnit, min: number, max: number | null): SettingSpec => ({ kind: 'int', unit, min, max });

export const SETTING_CATALOG: readonly SettingDef[] = [
  // facturi
  { key: 'vat_rate', group: 'billing', spec: { kind: 'decimal', unit: 'percent' } },
  { key: 'invoice_series', group: 'billing', spec: { kind: 'text' } },
  // preluari si credite
  { key: 'max_claims_per_request', group: 'claims', spec: int('firms', 1, 3) },
  { key: CLAIM_COST_SETTING_KEYS.creditValueRon, group: 'claims', spec: int('ron', 1, CLAIM_COST_LIMITS.creditValueRonMax) },
  { key: CLAIM_COST_SETTING_KEYS.min, group: 'claims', spec: int('credits', 1, CLAIM_COST_LIMITS.minMax) },
  { key: CLAIM_COST_SETTING_KEYS.max, group: 'claims', spec: int('credits', 0, CLAIM_COST_LIMITS.maxMax) },
  { key: 'claims_open_after_first_offer', group: 'claims', spec: { kind: 'bool' } },
  { key: 'bank_transfer_reminder_days', group: 'claims', spec: int('days', 0, 365) },
  { key: 'bank_transfer_expiry_days', group: 'claims', spec: int('days', 0, 365) },
  // oferte si proiecte
  { key: 'quote_validity_default_days', group: 'quotes', spec: int('days', 0, null) },
  { key: 'consultation_invite_expiry_days', group: 'quotes', spec: int('days', 0, null) },
  { key: 'eur_ron_rate', group: 'quotes', spec: { kind: 'decimal', unit: 'ronPerEur' } },
  { key: 'delivery_reminder_days_before', group: 'quotes', spec: int('days', 0, 365) },
  { key: 'expired_offer_autoclose_enabled', group: 'quotes', spec: { kind: 'bool' } },
  { key: 'expired_offer_autoclose_days', group: 'quotes', spec: int('days', 0, 365) },
  {
    key: 'expired_offer_autoclose_credit_outcome',
    group: 'quotes',
    spec: { kind: 'enum', options: ['UNSET', 'REFUND', 'CONSUME'] },
  },
  // perioada de proba
  { key: 'trial_enabled', group: 'trial', spec: { kind: 'bool' } },
  { key: 'trial_plan', group: 'trial', spec: { kind: 'plan' } },
  { key: 'trial_duration_days', group: 'trial', spec: int('days', 0, null) },
  { key: 'trial_bonus_credits', group: 'trial', spec: int('credits', 0, null) },
  // penalizari si suspendare
  { key: 'company_penalty_threshold', group: 'penalties', spec: int('points', 0, null) },
  { key: 'company_suspension_months', group: 'penalties', spec: int('months', 0, null) },
  // date de contact si firme
  { key: 'claim_contact_reveal_policy', group: 'contact', spec: { kind: 'enum', options: CLAIM_CONTACT_REVEAL_POLICIES } },
  { key: 'completed_claim_contact_retention_days', group: 'contact', spec: int('days', 0, 3650) },
  { key: 'pre_claim_contact_text_policy', group: 'contact', spec: { kind: 'enum', options: PRE_CLAIM_CONTACT_TEXT_POLICIES } },
  { key: 'marketplace_distance_display', group: 'contact', spec: { kind: 'enum', options: MARKETPLACE_DISTANCE_DISPLAY_MODES } },
  { key: 'company_locations_max', group: 'contact', spec: int('locations', 1, 100) },
  { key: 'company_location_changes_per_day', group: 'contact', spec: int('changes', 1, 1000) },
  // termeni si identitate juridica
  { key: 'legal_contact_email', group: 'legal', spec: { kind: 'email' } },
  { key: 'legal_identity_published', group: 'legal', spec: { kind: 'bool' } },
  { key: 'legal_reaccept_existing_users', group: 'legal', spec: { kind: 'bool' } },
];

const CATALOG_BY_KEY = new Map(SETTING_CATALOG.map((d) => [d.key, d]));

export function settingDef(key: string): SettingDef | undefined {
  return CATALOG_BY_KEY.get(key);
}

// Problema unei valori, ca si cod (textul se alege in componenta, prin i18n).
export type ValueProblem =
  | { code: 'integer' }
  | { code: 'min'; min: number }
  | { code: 'range'; min: number; max: number }
  | { code: 'decimal' }
  | { code: 'email' }
  | { code: 'planCode' }
  | { code: 'costRange' };

const INT_RE = /^(?:0|[1-9]\d*)$/;
const DECIMAL_RE = /^\d+(?:\.\d+)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Numar intreg scris canonic (fara zerouri in fata), in [min, max]; max null = fara limita.
export function checkInt(raw: string, min: number, max: number | null): ValueProblem | null {
  const v = raw.trim();
  if (!INT_RE.test(v) || !Number.isSafeInteger(Number(v))) return { code: 'integer' };
  const n = Number(v);
  if (max === null) return n < min ? { code: 'min', min } : null;
  return n < min || n > max ? { code: 'range', min, max } : null;
}

export function checkSetting(spec: SettingSpec, raw: string): ValueProblem | null {
  const v = raw.trim();
  switch (spec.kind) {
    case 'int':
      return checkInt(v, spec.min, spec.max);
    case 'decimal':
      return DECIMAL_RE.test(v) && Number.isFinite(Number(v)) ? null : { code: 'decimal' };
    case 'email':
      return v === '' || (v.length <= 254 && EMAIL_RE.test(v)) ? null : { code: 'email' };
    case 'plan':
      return PLAN_CODE_RE.test(v) ? null : { code: 'planCode' };
    case 'bool':
    case 'enum':
    case 'text':
      return null;
  }
}
