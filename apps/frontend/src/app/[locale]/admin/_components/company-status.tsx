'use client';

import type { CompanyDto, CompanyRiskFlag } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { CodeUnder, Pill } from './core-list-parts';

type CompanyStatus = CompanyDto['status'];

// Tonul starii unei firme (regula din design): chihlimbar = asteapta decizia adminului,
// salvie = in regula, gri = inactiva, carmin = problema.
export const COMPANY_STATUS_TONE: Record<CompanyStatus, NonNullable<BadgeProps['tone']>> = {
  PENDING_VERIFICATION: 'amber',
  APPROVED: 'sage',
  REJECTED: 'muted',
  SUSPENDED: 'crimson',
};

// Starea firmei, tradusa; `withCode` adauga codul tehnic dedesubt (liste, antet de detaliu).
export function CompanyStatusBadge({ status, withCode = true }: { status: CompanyStatus; withCode?: boolean }) {
  const t = useTranslations('AdminCompanies');
  const badge = (
    <Badge tone={COMPANY_STATUS_TONE[status] ?? 'muted'} dot>
      {t.has(`statusValue.${status}`) ? t(`statusValue.${status}`) : status}
    </Badge>
  );
  return withCode ? <CodeUnder code={status}>{badge}</CodeUnder> : badge;
}

export function RiskFlagPills({ flags }: { flags: readonly CompanyRiskFlag[] }) {
  const t = useTranslations('AdminCompanies');
  return (
    <span className="flex flex-wrap gap-1.5">
      {flags.length === 0 ? (
        <Pill>{t('noRisk')}</Pill>
      ) : (
        flags.map((f) => (
          <Pill key={f} tone="crimson">
            {t(`riskFlagValue.${f}`)}
          </Pill>
        ))
      )}
    </span>
  );
}
