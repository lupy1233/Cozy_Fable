'use client';

import type { CompanyRiskFlag } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminCompanies } from '@/hooks/use-company';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonPage, SkeletonTable } from '@/components/ui/skeleton';
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
    return (
      <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="table" />} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />

      <FilterChips
        label={t('filterLabel')}
        value={status}
        onChange={(v) => setStatus(v ?? '')}
        options={STATUSES.map((s) => ({ value: s.key as string, label: t(s.label) }))}
      />

      {list.isPending && <SkeletonTable rows={6} cols={6} />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}

      {list.isSuccess && (
      <Card padding="none">
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
                <TD colSpan={6}>
                  <EmptyState size="sm" variant="plain" title={t('empty')} />
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
      </Card>
      )}
    </div>
  );
}
