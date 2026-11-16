import { resolveBudgetFields, type BudgetRange } from '@marketplace/shared';

type BudgetFields = {
  budgetRange?: string | null;
  budgetEstimateRon?: number | null;
};

// b11 (PO 2026-11-13): bugetul e ales de client — o suma pe glisor sau "Prefer sa nu spun".
// Formularul nu mai pune nimic din oficiu; fara alegere nu se trece de Date generale.
export function isBudgetChosen(d: BudgetFields): boolean {
  if (d.budgetRange === 'UNDISCLOSED') return true;
  return !!d.budgetRange && typeof d.budgetEstimateRon === 'number';
}

// Campurile de buget trimise la publicare / editare. Treapta se deriva din suma (aceeasi regula
// ca serverul, deci acelasi punctaj); budgetDeclared = suma a fost aleasa de client. In ciorna
// raman doar sume alese (cele puse de formularul vechi se golesc la incarcare), deci orice suma
// de aici e declarata. Fara alegere: nedeclarat (nu o treapta pusa din oficiu).
export function budgetPayload(d: BudgetFields): {
  budgetRange: BudgetRange;
  budgetEstimateRon: number | undefined;
  budgetDeclared: boolean;
} {
  if (!isBudgetChosen(d) || d.budgetRange === 'UNDISCLOSED') {
    return { budgetRange: 'UNDISCLOSED', budgetEstimateRon: undefined, budgetDeclared: false };
  }
  const resolved = resolveBudgetFields(d.budgetRange as BudgetRange, d.budgetEstimateRon);
  return {
    budgetRange: resolved.budgetRange,
    budgetEstimateRon: resolved.budgetEstimateRon ?? undefined,
    budgetDeclared: resolved.budgetEstimateRon !== null,
  };
}
