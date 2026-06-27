'use client';

import type { CompanyRiskFlag } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminCompanies } from '@/hooks/use-company';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

const COMPANY_STATUS_TONE: Record<string, 'muted' | 'sage' | 'crimson' | 'amber'> = {
  PENDING_VERIFICATION: 'amber',
  APPROVED: 'sage',
  REJECTED: 'crimson',
  SUSPENDED: 'crimson',
};

const STATUSES = [
  { key: '', label: 'filterAll' },
  { key: 'PENDING_VERIFICATION', label: 'filterPending' },
  { key: 'APPROVED', label: 'filterApproved' },
  { key: 'REJECTED', label: 'filterRejected' },
  { key: 'SUSPENDED', label: 'filterSuspended' },
] as const;

export default function AdminCompaniesPage() {
  const t = useTranslations('AdminCompanies');
  const router = useRouter();
  const me = useMe();
  const [status, setStatus] = useState('');
  const list = useAdminCompanies(status || undefined);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending || me.data?.role !== 'ADMIN') {
    return <p className="py-20 text-center text-muted-foreground">…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('title')}</h1>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={cn(
              'rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors',
              status === s.key
                ? 'bg-foreground text-background'
                : 'bg-surface-2 text-muted-foreground hover:text-foreground',
            )}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <Table>
          <THead>
            <TR>
              <TH>{t('name')}</TH>
              <TH>{t('cui')}</TH>
              <TH>{t('city')}</TH>
              <TH>{t('status')}</TH>
              <TH>{t('riskFlags')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.data?.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t('empty')}
                </TD>
              </TR>
            )}
            {list.data?.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="font-mono text-xs">{c.cui}</TD>
                <TD>{c.city}</TD>
                <TD>
                  <Badge tone={COMPANY_STATUS_TONE[c.status] ?? 'muted'} dot>
                    {c.status}
                  </Badge>
                </TD>
                <TD className="text-muted-foreground">
                  {c.riskFlags.length === 0
                    ? t('noRisk')
                    : c.riskFlags.map((f: CompanyRiskFlag) => t(`riskFlagValue.${f}`)).join(', ')}
                </TD>
                <TD>
                  <Link href={`/admin/companies/${c.id}`} className="text-walnut hover:underline">
                    {t('view')}
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
