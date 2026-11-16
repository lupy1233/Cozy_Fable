'use client';

import type { CompanyPermission } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useBudgetFormat } from '@/hooks/use-budget-format';
import { companyCan } from '@/lib/company-permissions';

// a7 (etapa 7): randurile mici din panoul de preluare.

type CompanyLike = Parameters<typeof companyCan>[0];

// Angajatul fara acces complet (fara CLAIMS_CREATE) nu poate prelua: butonul ramane dezactivat,
// cu explicatia. Cat timp firma se incarca nu blocam (serverul verifica oricum).
export function claimBlockedByRole(company: CompanyLike, permission: CompanyPermission = 'CLAIMS_CREATE'): boolean {
  return !!company && !companyCan(company, permission);
}

// De unde vine costul: bugetul minim estimat de client (scorul de baza × 1.000 lei, ca la d3) si,
// cand regulile il trimit, cat valoreaza un credit. Fara estimare → nimic.
export function ClaimCostSource({
  estimateMinRon,
  creditValueRon,
}: {
  estimateMinRon: number | null | undefined;
  creditValueRon: number | null | undefined;
}) {
  const t = useTranslations('Marketplace.claimPanel');
  const { lei } = useBudgetFormat();
  if (typeof estimateMinRon !== 'number' || estimateMinRon <= 0) return null;
  const amount = lei(estimateMinRon);
  return (
    <p className="text-xs text-muted-foreground">
      {typeof creditValueRon === 'number' && creditValueRon > 0
        ? t('costSource', { amount, creditValue: lei(creditValueRon) })
        : t('costSourceNoRate', { amount })}
    </p>
  );
}
