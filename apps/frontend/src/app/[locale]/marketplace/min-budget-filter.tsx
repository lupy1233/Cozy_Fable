'use client';

import { MARKETPLACE_MIN_BUDGET_MAX_RON, MARKETPLACE_MIN_BUDGET_STEP_RON } from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { formatLei } from '@/lib/money';

// b11-3 (PO 2026-11-13): firma alege bugetul minim pe un glisor (nu pe trepte). Valoarea
// trimisa serverului se schimba la ~350 ms dupa ultima miscare, ca sa nu plece o cerere la
// fiecare pas; eticheta se schimba pe loc. 0 = oricare.
export const MIN_BUDGET_DEBOUNCE_MS = 350;

export function MinBudgetFilter({ value, onChange }: { value: number; onChange: (ron: number) => void }) {
  const t = useTranslations('Marketplace');
  const locale = useLocale();
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // o schimbare din afara (resetarea filtrelor) castiga: anuleaza mutarea in asteptare (m7).
  // Pagina monteaza din nou componenta la reset (key), ca sa prinda si cazul value 0 → 0.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDraft(value);
  }, [value]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const schedule = (ron: number) => {
    setDraft(ron);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(ron), MIN_BUDGET_DEBOUNCE_MS);
  };
  const valueText = draft > 0 ? t('minBudgetFrom', { amount: formatLei(draft, locale) }) : t('minBudgetAny');

  return (
    <div className="flex min-w-[12rem] flex-col gap-1">
      <label htmlFor="mk-min-budget" className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('minBudget')}</span>
        <span className="font-medium text-foreground tabular-nums">{valueText}</span>
      </label>
      <input
        id="mk-min-budget"
        type="range"
        min={0}
        max={MARKETPLACE_MIN_BUDGET_MAX_RON}
        step={MARKETPLACE_MIN_BUDGET_STEP_RON}
        value={draft}
        onChange={(e) => schedule(Number(e.target.value))}
        aria-valuetext={valueText}
        title={t('minBudgetHint')}
        className="h-10 accent-walnut"
      />
    </div>
  );
}
