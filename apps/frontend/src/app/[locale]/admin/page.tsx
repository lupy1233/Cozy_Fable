'use client';

import type { AdminKpiDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useKpi } from '@/hooks/use-admin';
import { CardSection } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonCard, SkeletonStatGrid } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

export default function AdminDashboardPage() {
  const router = useRouter();
  const me = useMe();
  const kpi = useKpi();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  return (
    <QueryState
      pending={kpi.isPending}
      error={kpi.error}
      onRetry={() => void kpi.refetch()}
      skeleton={
        <div className="flex flex-col gap-6">
          <SkeletonStatGrid count={8} />
          <SkeletonCard />
        </div>
      }
    >
      {kpi.data && <KpiContent k={kpi.data} />}
    </QueryState>
  );
}

function KpiContent({ k }: { k: AdminKpiDto }) {
  const t = useTranslations('Admin');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('dashboard')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('kpi.activeClaims')} value={k.activeClaims} />
        <StatCard label={t('kpi.openDisputes')} value={k.openDisputes} tone={k.openDisputes > 0 ? 'warning' : 'default'} />
        <StatCard label={t('kpi.pendingPayments')} value={k.pendingPayments} tone={k.pendingPayments > 0 ? 'warning' : 'default'} />
        <StatCard label={t('kpi.activeSubscriptions')} value={k.activeSubscriptions} />
        <StatCard label={t('kpi.creditsBalance')} value={k.totalCreditsBalance} />
        <StatCard label={t('kpi.creditsReserved')} value={k.totalCreditsReserved} />
        <StatCard label={t('kpi.revenue')} value={`${k.revenueRon} RON`} />
        <StatCard label={t('kpi.audit')} value={k.auditEntries} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Breakdown title={t('kpi.companies')} data={k.companiesByStatus} />
        <Breakdown title={t('kpi.requests')} data={k.requestsByStatus} />
        {/* E-admin-platform-58: abonamente active pe codul planului (lipsa = backend vechi) */}
        <Breakdown
          title={t('kpi.subscriptionsByPlan')}
          data={Object.fromEntries((k.activeSubscriptionsByPlan ?? []).map((r) => [r.code, r.count]))}
        />
      </div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <CardSection title={title}>
      <ul className="flex flex-col gap-1.5 text-sm">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between border-b border-border pb-1.5 last:border-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono font-medium">{v}</span>
          </li>
        ))}
      </ul>
    </CardSection>
  );
}
