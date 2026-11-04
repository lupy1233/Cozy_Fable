// E-admin-platform-58 — planurile de abonament ca date: registrul functiilor per plan.
// Doar MARKETPLACE_ACCESS e inregistrat (= ce verifica SubscriptionActiveGuard: lista/detaliu
// marketplace + preluari). Functiile uneltelor (Ofertare Rapida, citiri AI) se adauga doar dupa
// decizia PO; coloana limit_value e pregatita pentru cote.

export const PLAN_FEATURE_KEYS = ['MARKETPLACE_ACCESS'] as const;
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export interface PlanFeatureValue {
  enabled: boolean;
  limit: number | null; // null = fara limita
}

export type PlanFeaturesDto = Record<PlanFeatureKey, PlanFeatureValue>;

// Rand lipsa = functie dezactivata (un plan nou nu primeste nimic implicit).
export const PLAN_FEATURE_DEFAULTS: Readonly<PlanFeaturesDto> = Object.freeze({
  MARKETPLACE_ACCESS: Object.freeze({ enabled: false, limit: null }),
});

// Codul planului (identitatea lui): majuscule, cifre, underscore; 2..32 caractere.
export const PLAN_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;
export type PlanCode = string;

export function isPlanFeatureKey(key: string): key is PlanFeatureKey {
  return (PLAN_FEATURE_KEYS as readonly string[]).includes(key);
}

// Randurile subscription_plan_features → map complet pe registru. Cheile necunoscute se ignora.
export function resolvePlanFeatures(
  rows: readonly { featureKey: string; enabled: boolean; limitValue: number | null }[],
): PlanFeaturesDto {
  const out = {} as PlanFeaturesDto;
  for (const key of PLAN_FEATURE_KEYS) out[key] = { ...PLAN_FEATURE_DEFAULTS[key] };
  for (const row of rows) {
    if (!isPlanFeatureKey(row.featureKey)) continue;
    out[row.featureKey] = { enabled: row.enabled, limit: row.limitValue ?? null };
  }
  return out;
}
