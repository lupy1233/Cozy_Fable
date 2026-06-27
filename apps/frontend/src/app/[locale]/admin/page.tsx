'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useKpi } from '@/hooks/use-admin';

export default function AdminDashboardPage() {
  const t = useTranslations('Admin');
  const router = useRouter();
  const me = useMe();
  const kpi = useKpi();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (kpi.isPending) return <p className="text-muted-foreground">{t('loading')}</p>;
  if (!kpi.data) return <p className="text-muted-foreground">{t('loading')}</p>;
  const k = kpi.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('dashboard')}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label={t('kpi.activeClaims')} value={k.activeClaims} />
        <Card label={t('kpi.openDisputes')} value={k.openDisputes} highlight={k.openDisputes > 0} />
        <Card label={t('kpi.pendingPayments')} value={k.pendingPayments} highlight={k.pendingPayments > 0} />
        <Card label={t('kpi.activeSubscriptions')} value={k.activeSubscriptions} />
        <Card label={t('kpi.creditsBalance')} value={k.totalCreditsBalance} />
        <Card label={t('kpi.creditsReserved')} value={k.totalCreditsReserved} />
        <Card label={t('kpi.revenue')} value={`${k.revenueRon} RON`} />
        <Card label={t('kpi.audit')} value={k.auditEntries} />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Breakdown title={t('kpi.companies')} data={k.companiesByStatus} />
        <Breakdown title={t('kpi.requests')} data={k.requestsByStatus} />
      </section>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        highlight ? 'border-amber/30 bg-amber-soft' : 'border-border bg-surface'
      }`}
    >
      <div className="font-serif text-3xl tracking-[-0.02em]">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-3 font-serif text-lg">{title}</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between border-b border-border pb-1.5 last:border-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono font-medium">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
