'use client';

import { REQUEST_STATUSES, type AdminKpiDto } from '@marketplace/shared';
import { ArrowRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useKpi } from '@/hooks/use-admin';
import { STATUS_TONE } from '@/components/ui/badge';
import { Card, CardSection } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonCard, SkeletonStatGrid } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

// Tabloul de bord (design 2026-11): intai cozile de lucru — ce asteapta o decizie —, apoi
// cifrele platformei. Fiecare cifra e link catre lista ei. Totul vine din /admin/kpi.
export default function AdminDashboardPage() {
  const t = useTranslations('Admin');
  const router = useRouter();
  const me = useMe();
  const kpi = useKpi();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-7">
      <PageHeader title={t('dashboard')} subtitle={t('dashboardSubtitle')} />
      <QueryState
        pending={kpi.isPending}
        error={kpi.error}
        onRetry={() => void kpi.refetch()}
        skeleton={
          <div className="flex flex-col gap-6">
            <SkeletonStatGrid count={3} />
            <SkeletonStatGrid count={6} />
            <SkeletonCard />
          </div>
        }
      >
        {kpi.data && <KpiContent k={kpi.data} />}
      </QueryState>
    </div>
  );
}

type QueueKey = 'companies' | 'payments' | 'disputes';

function KpiContent({ k }: { k: AdminKpiDto }) {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const tCompanies = useTranslations('AdminCompanies');
  const tRequests = useTranslations('Requests');
  const format = useFormatter();

  // cozile de lucru: doar cele pentru care KPI-ul da un numar
  const queues: { key: QueueKey; count: number; href: string }[] = [
    { key: 'companies', count: k.companiesByStatus?.PENDING_VERIFICATION ?? 0, href: '/admin/companies' },
    { key: 'payments', count: k.pendingPayments, href: '/admin/payments' },
    { key: 'disputes', count: k.openDisputes, href: '/admin/disputes' },
  ];

  const companyRows = orderedEntries(k.companiesByStatus, COMPANY_STATUS_ORDER).map(([code, count]) => ({
    code,
    count,
    label: COMPANY_STATUS_LABEL[code] ? tCompanies(COMPANY_STATUS_LABEL[code]) : null,
    bar: COMPANY_STATUS_BAR[code] ?? 'bg-muted-2',
  }));
  const requestRows = orderedEntries(k.requestsByStatus, REQUEST_STATUSES).map(([code, count]) => ({
    code,
    count,
    label: tRequests.has(`statusValue.${code}`) ? tRequests(`statusValue.${code}`) : null,
    bar: TONE_BAR[STATUS_TONE[code] ?? 'muted'] ?? 'bg-muted-2',
  }));
  // E-admin-platform-58: abonamente active pe codul planului (lipsa = backend vechi).
  // Planurile sunt date: KPI-ul da doar codul, deci codul e si eticheta.
  const planRows = (k.activeSubscriptionsByPlan ?? []).map((r) => ({
    code: r.code,
    count: r.count,
    label: null,
    bar: PLAN_BAR[r.code] ?? 'bg-walnut',
  }));

  return (
    <>
      <section aria-labelledby="admin-queues-title" className="flex flex-col gap-3.5">
        <h2 id="admin-queues-title" className="heading-section">
          {t('queues.title')}
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-4">
          {queues.map((q) => {
            const hot = q.count > 0;
            return (
              <Card key={q.key} asChild tone={hot ? 'amber' : 'default'} padding="none" interactive>
                <Link
                  href={q.href}
                  className={cn('flex flex-col gap-1.5 px-5 py-[18px]', hot ? 'text-amber' : 'text-foreground')}
                >
                  <span className="text-meta font-medium uppercase tracking-[0.08em]">{t(`queues.${q.key}.label`)}</span>
                  <span className="font-serif text-4xl leading-tight">{format.number(q.count)}</span>
                  <span className="text-ui">{hot ? t(`queues.${q.key}.waiting`) : t('queues.clear')}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1.5 font-semibold">
                    {hot ? t(`queues.${q.key}.cta`) : t(`queues.${q.key}.view`)}
                    <ArrowRight aria-hidden className="size-4" />
                  </span>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="admin-figures-title" className="flex flex-col gap-3.5">
        <h2 id="admin-figures-title" className="heading-section">
          {t('figures.title')}
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4">
          <StatCard
            href="/admin/requests"
            label={t('kpi.activeClaims')}
            value={format.number(k.activeClaims)}
            hint={t('figures.now')}
          />
          <StatCard
            href="/admin/payments"
            label={t('kpi.activeSubscriptions')}
            value={format.number(k.activeSubscriptions)}
            hint={t('figures.now')}
          />
          <StatCard
            href="/admin/payments"
            label={t('kpi.creditsBalance')}
            value={format.number(k.totalCreditsBalance)}
            hint={t('figures.allCompanies')}
          />
          <StatCard
            href="/admin/requests"
            label={t('kpi.creditsReserved')}
            value={format.number(k.totalCreditsReserved)}
            hint={t('figures.inActiveClaims')}
          />
          <StatCard
            href="/admin/payments"
            label={t('kpi.revenue')}
            value={tCommon('money', { amount: format.number(k.revenueRon) })}
            hint={t('figures.confirmedOrders')}
          />
          <StatCard
            href="/admin/audit"
            label={t('kpi.audit')}
            value={format.number(k.auditEntries)}
            hint={t('figures.sinceLaunch')}
          />
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
        <Breakdown title={t('kpi.companies')} rows={companyRows} />
        <Breakdown title={t('kpi.requests')} rows={requestRows} />
        <Breakdown title={t('kpi.subscriptionsByPlan')} rows={planRows} />
      </div>
    </>
  );
}

const COMPANY_STATUS_ORDER = ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
const COMPANY_STATUS_LABEL: Record<string, 'filterPending' | 'filterApproved' | 'filterRejected' | 'filterSuspended'> = {
  PENDING_VERIFICATION: 'filterPending',
  APPROVED: 'filterApproved',
  REJECTED: 'filterRejected',
  SUSPENDED: 'filterSuspended',
};
const COMPANY_STATUS_BAR: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber',
  APPROVED: 'bg-sage',
  REJECTED: 'bg-muted-2',
  SUSPENDED: 'bg-crimson',
};
// aceeasi culoare ca pastila de stare a cererii (STATUS_TONE)
const TONE_BAR: Record<string, string> = {
  muted: 'bg-muted-2',
  outline: 'bg-muted-2',
  sage: 'bg-sage',
  amber: 'bg-amber',
  crimson: 'bg-crimson',
  info: 'bg-info',
  walnut: 'bg-walnut',
  ink: 'bg-foreground',
};
const PLAN_BAR: Record<string, string> = {
  SILVER: 'bg-muted-2',
  GOLD: 'bg-brass',
  PLATINUM: 'bg-foreground',
};

// Randurile in ordinea fluxului (nu in ordinea intamplatoare din raspuns); codurile
// necunoscute raman la coada, ca sa nu dispara nimic.
function orderedEntries(data: Record<string, number> | undefined, order: readonly string[]): [string, number][] {
  const entries = Object.entries(data ?? {});
  const rank = (code: string) => {
    const i = order.indexOf(code);
    return i === -1 ? order.length : i;
  };
  return entries.sort((a, b) => rank(a[0]) - rank(b[0]));
}

type BreakdownRow = { code: string; count: number; label: string | null; bar: string };

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <CardSection title={title} titleSize="section" padding="lg" bodyClassName="gap-2.5">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('kpi.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.code} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2.5 text-ui">
                <span className="min-w-0">
                  {r.label ? (
                    <>
                      {r.label}
                      {/* codul tehnic, mic, langa eticheta tradusa */}
                      <span className="ml-1.5 font-mono text-micro text-muted-foreground">{r.code}</span>
                    </>
                  ) : (
                    <span className="font-mono text-xs">{r.code}</span>
                  )}
                </span>
                <span className="font-mono">{format.number(r.count)}</span>
              </span>
              <span aria-hidden className="h-1.5 rounded-full bg-background">
                {/* latimea e calculata din date (minim 4% ca bara sa ramana vizibila) */}
                <span
                  className={cn('block h-1.5 rounded-full', r.bar)}
                  style={{ width: `${Math.max(4, Math.round((r.count / max) * 100))}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardSection>
  );
}
