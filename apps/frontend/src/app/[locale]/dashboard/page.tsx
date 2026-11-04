'use client';

import {
  ArrowRight,
  Coins,
  FileText,
  Handshake,
  Inbox,
  Plus,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useCompanyDashboardStats } from '@/hooks/use-company';
import { useMoney } from '@/hooks/use-money';
import { useClientDashboardStats } from '@/hooks/use-requests';
import { AppShell } from '../_components/app-shell';
import { TodoNowCard } from '../_components/todo-now-card';
import { Avatar } from '@/components/ui/avatar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardSection } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonCard, SkeletonPage, SkeletonStatGrid } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { ApiError } from '@/lib/api';

// Ruta protejata client-side: fara user → redirect la /login.
// Clientul primeste un dashboard real (statistici cereri, activitate recenta);
// firmele primesc statistici dedicate in Faza C.
export default function DashboardPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isPending || me.isError) {
    return (
      <AppShell>
        {/* me.isError -> efectul de mai sus face redirect la /login; skeletonul ramane pana atunci */}
        <QueryState
          pending
          onRetry={() => void me.refetch()}
          skeleton={<SkeletonPage variant="dashboard" />}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader title={t('dashboardTitle')} />
        <Card padding="lg" className="flex items-center gap-4">
          <Avatar name={me.data.name} size={56} />
          <div>
            <p className="heading-section">{me.data.name}</p>
            <p className="text-sm text-muted-foreground">{me.data.email}</p>
            <Badge tone="walnut" className="mt-2">
              {t(`role.${me.data.role}`)}
            </Badge>
          </div>
        </Card>

        {me.data.role === 'CLIENT' && <ClientDashboard />}
        {me.data.role === 'COMPANY_USER' && <CompanyDashboardStats />}
      </div>
    </AppShell>
  );
}

// Dashboardul firmei: claim-uri, oferte + valoare, credite (sold + consum), penalizari.
function CompanyDashboardStats() {
  const t = useTranslations('Dashboard');
  const tm = useTranslations('Marketplace');
  const money = useMoney();
  const stats = useCompanyDashboardStats();

  if (stats.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonStatGrid count={4} />
        <SkeletonCard />
      </div>
    );
  }
  // firma inca ne-creata (onboarding -> 404) -> fara statistici; orice alta eroare se vede, cu Reincearca
  if (stats.isError && !(stats.error instanceof ApiError && stats.error.status === 404)) {
    return <LoadError onRetry={() => void stats.refetch()} />;
  }
  if (!stats.data) return null;

  const s = stats.data;
  const cards = [
    { key: 'claimsTotal', value: s.claimsTotal, Icon: Handshake },
    { key: 'claimsActive', value: s.claimsActive, Icon: FileText },
    { key: 'quotesSent', value: s.quotesSent, Icon: Inbox },
    {
      key: 'quotesTotalRon',
      value: money(s.quotesTotalRon),
      Icon: Coins,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <TodoNowCard items={s.actions ?? []} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, value, Icon }) => (
          <StatCard key={key} label={t(`company.${key}`)} icon={Icon} value={value} />
        ))}
      </div>

      {/* credite: sold + consum recent */}
      <CardSection
        title={t('company.credits')}
        actions={
          <Link
            href="/marketplace/wallet"
            className="flex items-center gap-1 text-sm text-walnut hover:underline"
          >
            <Wallet className="h-3.5 w-3.5" />
            {t('company.walletLink')}
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ['available', s.wallet.available],
              ['reserved', s.wallet.reserved],
              ['consumed7d', s.creditsConsumed7d],
              ['consumed30d', s.creditsConsumed30d],
            ] as const
          ).map(([key, value]) => (
            <StatCard key={key} variant="inline" align="center" label={t(`company.${key}`)} value={value} />
          ))}
        </div>
      </CardSection>

      {/* claim-uri active per membru */}
      {s.perMember.length > 0 && (
        <CardSection title={t('company.perMember')} icon={Users}>
          <ul className="flex flex-col divide-y divide-border-2">
            {s.perMember.map((m) => (
              <li key={m.userId ?? 'unassigned'} className="flex items-center justify-between py-2 text-sm">
                <span>{m.name ?? t('company.unassigned')}</span>
                <Badge tone="walnut">{m.activeClaims}</Badge>
              </li>
            ))}
          </ul>
        </CardSection>
      )}

      {/* statusuri claim-uri + penalizari */}
      <div className="grid gap-3 sm:grid-cols-2">
        <CardSection title={t('company.claimsByStatus')}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.claimsByStatus).map(([status, count]) => (
              <Badge key={status} tone="muted">
                {tm(`claimStatus.${status}`)} · {count}
              </Badge>
            ))}
            {Object.keys(s.claimsByStatus).length === 0 && (
              <EmptyState size="sm" variant="plain" title={t('company.noClaims')} className="w-full py-2" />
            )}
          </div>
        </CardSection>
        <StatCard
          label={t('company.penalties')}
          icon={ShieldAlert}
          value={s.activePenaltyPoints}
          hint={t('company.penaltyPoints')}
          tone={s.activePenaltyPoints > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="flex gap-3">
        <Button asChild variant="walnut">
          <Link href="/marketplace">
            {t('company.toMarketplace')}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/marketplace/claims">{t('company.toClaims')}</Link>
        </Button>
      </div>
    </div>
  );
}

function ClientDashboard() {
  const t = useTranslations('Dashboard');
  const tr = useTranslations('Requests');
  const stats = useClientDashboardStats();

  if (stats.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonStatGrid count={3} className="lg:grid-cols-3" />
        <SkeletonCard />
      </div>
    );
  }
  if (stats.isError) return <LoadError onRetry={() => void stats.refetch()} />;
  if (!stats.data) return null;

  const s = stats.data;
  const cards = [
    { key: 'totalRequests', value: s.totalRequests, Icon: FileText },
    { key: 'activeClaims', value: s.activeClaims, Icon: Handshake },
    { key: 'offersReceived', value: s.offersReceived, Icon: Inbox },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <TodoNowCard items={s.actions ?? []} />

      {/* statistici principale */}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ key, value, Icon }) => (
          <StatCard key={key} label={t(`client.${key}`)} icon={Icon} value={value} />
        ))}
      </div>

      {/* distributia pe statusuri */}
      {Object.keys(s.byStatus).length > 0 && (
        <CardSection title={t('client.byStatus')}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.byStatus).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5">
                <StatusBadge status={status} label={`${tr(`statusValue.${status}`)} · ${count}`} />
              </span>
            ))}
          </div>
        </CardSection>
      )}

      {/* activitate recenta */}
      <CardSection
        title={t('client.recent')}
        actions={
          <Link href="/requests" className="flex items-center gap-1 text-sm text-walnut hover:underline">
            {t('client.allRequests')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {s.recent.length === 0 ? (
          <EmptyState size="sm" variant="plain" title={t('client.noRequests')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border-2">
            {s.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/requests/${r.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {r.title || '—'}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.updatedAt).toLocaleDateString()}
                </span>
                <StatusBadge status={r.status} label={tr(`statusValue.${r.status}`)} />
              </li>
            ))}
          </ul>
        )}
      </CardSection>

      <Button asChild variant="walnut" size="lg" className="self-start">
        <Link href="/requests/new">
          <Plus className="mr-1 h-4 w-4" />
          {t('client.newRequest')}
        </Link>
      </Button>
    </div>
  );
}
