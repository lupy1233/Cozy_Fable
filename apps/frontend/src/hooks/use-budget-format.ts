'use client';

import { budgetView, firmBudgetView, type BudgetView } from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import { formatLei } from '@/lib/money';

type BudgetSource = Parameters<typeof budgetView>[0];

// b11 (PO 2026-11-13): bugetul arata la fel peste tot — suma in lei ("12.000 lei") sau "Buget
// nedeclarat"; treptele nu mai apar pe ecrane.
// - clientul (amount): isi vede suma salvata, sub eticheta neutra "Buget" — sunt datele lui;
// - firma (firmAmount / firmLabel, M2): doar o suma aleasa de client, cu eticheta "Bugetul
//   declarat de client"; o suma nedeclarata (cerere veche) = "Buget nedeclarat". Serverul nici
//   nu o trimite firmei; aici e a doua plasa de siguranta.
export function useBudgetFormat() {
  const locale = useLocale();
  const t = useTranslations('Requests');
  const lei = (n: number) => formatLei(n, locale);
  const text = (v: BudgetView) => (v.amountRon === null ? t('budgetView.undisclosed') : lei(v.amountRon));
  const view = (source: BudgetSource): BudgetView => budgetView(source);
  const amount = (source: BudgetSource) => text(budgetView(source));
  const firmView = (source: BudgetSource): BudgetView => firmBudgetView(source);
  const firmAmount = (source: BudgetSource) => text(firmBudgetView(source));
  const firmLabel = (source: BudgetSource) =>
    firmBudgetView(source).kind === 'DECLARED' ? t('budgetView.declaredLabel') : t('field.budgetRange');
  return { lei, view, amount, firmView, firmAmount, firmLabel };
}
