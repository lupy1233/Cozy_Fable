'use client';

import { resolveClaimCostRules } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useSettings } from '@/hooks/use-admin';

// E-company-21 — valoarea unui credit si intervalul costului unei preluari, citite din
// system_settings (credit_value_ron, claim_cost_min, claim_cost_max; 0 = fara plafon).
// Aceeasi rezolvare ca backend-ul (resolveClaimCostRules din shared).
export function ClaimCostNote() {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const { data } = useSettings();
  const rules = resolveClaimCostRules(Object.fromEntries((data ?? []).map((s) => [s.key, s.value])));
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p>{t('settings.creditCostNote', { creditValue: format.number(rules.creditValueRon) })}</p>
      <p>
        {rules.max === null
          ? t('settings.creditCostNoMax', { min: rules.min })
          : t('settings.creditCostRange', { min: rules.min, max: rules.max })}
      </p>
    </div>
  );
}
