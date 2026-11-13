'use client';

import { isBudgetBelowEstimate } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '@/hooks/use-budget-format';

type BudgetSource = {
  budgetRange: string;
  budgetEstimateRon?: number | null;
  budgetDeclared?: boolean;
};

// b11 (PO 2026-11-13): bugetul cum il vede firma — suma in lei sau "Buget nedeclarat"; sub ea,
// cand exista, estimarea automata cu eticheta "Estimare din raspunsuri" si semnul ca bugetul
// declarat e sub estimare. M2: o suma nedeclarata (cerere veche) = "Buget nedeclarat", fara
// estimare. Eticheta randului o pune apelantul (useBudgetFormat().firmLabel).
export function FirmBudgetValue({ budget, estimateMinRon }: { budget: BudgetSource; estimateMinRon?: number | null }) {
  const t = useTranslations('Requests');
  const { firmAmount, lei, firmView } = useBudgetFormat();
  // M2: doar o suma declarata de client; estimarea si avertismentul doar langa ea
  const v = firmView(budget);
  const estimate = v.amountRon !== null && typeof estimateMinRon === 'number' && estimateMinRon > 0 ? estimateMinRon : null;
  const below = isBudgetBelowEstimate(v.amountRon, estimate);
  return (
    <>
      <span className="tabular-nums">{firmAmount(budget)}</span>
      {below && (
        <span className="mt-0.5 block text-xs font-medium text-amber">{t('budgetView.belowEstimate')}</span>
      )}
      {estimate !== null && (
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {t('budgetView.estimateLabel')}: {lei(estimate)}
        </span>
      )}
    </>
  );
}
