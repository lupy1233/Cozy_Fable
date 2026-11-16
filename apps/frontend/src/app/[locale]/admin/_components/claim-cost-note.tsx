'use client';

import { resolveClaimCostRules } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useSettings } from '@/hooks/use-admin';

// E-company-21 — valoarea unui credit si intervalul costului unei preluari, citite din
// system_settings (credit_value_ron, claim_cost_min, claim_cost_max; 0 = fara plafon).
// Aceeasi rezolvare ca backend-ul (resolveClaimCostRules din shared).
export function ClaimCostNote() {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const { data } = useSettings();
  const rules = resolveClaimCostRules(Object.fromEntries((data ?? []).map((s) => [s.key, s.value])));
  // cheile de setari sunt coduri tehnice: mici, in mono (mesajele le marcheaza cu <code>)
  const code = (chunks: ReactNode) => <code className="font-mono text-meta">{chunks}</code>;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p>{t('settings.creditCostNote', { creditValue: format.number(rules.creditValueRon) })}</p>
      <p>
        {rules.max === null
          ? t.rich('settings.creditCostNoMax', { min: rules.min, code })
          : t.rich('settings.creditCostRange', { min: rules.min, max: rules.max, code })}
      </p>
    </div>
  );
}
