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
import { useClientDashboardStats } from '@/hooks/use-requests';
import { AppShell } from '../_components/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="page-title">{t('dashboardTitle')}</h1>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Avatar name={me.data.name} size={56} />
          <div>
            <p className="font-serif text-xl">{me.data.name}</p>
            <p className="text-sm text-muted-foreground">{me.data.email}</p>
            <Badge tone="walnut" className="mt-2">
              {t(`role.${me.data.role}`)}
            </Badge>
          </div>
        </div>

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
  const stats = useCompanyDashboardStats();

  if (stats.isPending) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }
  // firma inca ne-creata (onboarding) → fara statistici
  if (stats.isError || !stats.data) return null;

  const s = stats.data;
  const cards = [
    { key: 'claimsTotal', value: s.claimsTotal, Icon: Handshake },
    { key: 'claimsActive', value: s.claimsActive, Icon: FileText },
    { key: 'quotesSent', value: s.quotesSent, Icon: Inbox },
    {
      key: 'quotesTotalRon',
      value: `${s.quotesTotalRon.toLocaleString('ro-RO')} RON`,
      Icon: Coins,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, value, Icon }) => (
          <div key={key} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t(`company.${key}`)}</span>
              <Icon className="h-4 w-4 text-walnut" />
            </div>
            <p className="mt-2 font-serif text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {/* credite: sold + consum recent */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">{t('company.credits')}</h2>
          <Link
            href="/marketplace/wallet"
            className="flex items-center gap-1 text-sm text-walnut hover:underline"
          >
            <Wallet className="h-3.5 w-3.5" />
            {t('company.walletLink')}
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ['available', s.wallet.available],
              ['reserved', s.wallet.reserved],
              ['consumed7d', s.creditsConsumed7d],
              ['consumed30d', s.creditsConsumed30d],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-surface-2 p-3 text-center">
              <p className="font-serif text-2xl">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`company.${key}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* claim-uri active per membru */}
      {s.perMember.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
            <Users className="h-4 w-4 text-walnut" />
            {t('company.perMember')}
          </h2>
          <ul className="flex flex-col divide-y divide-border-2">
            {s.perMember.map((m) => (
              <li key={m.userId ?? 'unassigned'} className="flex items-center justify-between py-2 text-sm">
                <span>{m.name ?? t('company.unassigned')}</span>
                <Badge tone="walnut">{m.activeClaims}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* statusuri claim-uri + penalizari */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-lg">{t('company.claimsByStatus')}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.claimsByStatus).map(([status, count]) => (
              <Badge key={status} tone="muted">
                {tm(`claimStatus.${status}`)} · {count}
              </Badge>
            ))}
            {Object.keys(s.claimsByStatus).length === 0 && (
              <p className="text-sm text-muted-foreground">{t('company.noClaims')}</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
            <ShieldAlert className="h-4 w-4 text-crimson" />
            {t('company.penalties')}
          </h2>
          <p className="font-serif text-2xl">{s.activePenaltyPoints}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('company.penaltyPoints')}</p>
        </div>
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
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (stats.isError || !stats.data) return null;

  const s = stats.data;
  const cards = [
    { key: 'totalRequests', value: s.totalRequests, Icon: FileText },
    { key: 'activeClaims', value: s.activeClaims, Icon: Handshake },
    { key: 'offersReceived', value: s.offersReceived, Icon: Inbox },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* statistici principale */}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ key, value, Icon }) => (
          <div key={key} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t(`client.${key}`)}</span>
              <Icon className="h-4 w-4 text-walnut" />
            </div>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </div>
        ))}
      </div>

      {/* distributia pe statusuri */}
      {Object.keys(s.byStatus).length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-lg">{t('client.byStatus')}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.byStatus).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5">
                <StatusBadge status={status} label={`${tr(`statusValue.${status}`)} · ${count}`} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* activitate recenta */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">{t('client.recent')}</h2>
          <Link href="/requests" className="flex items-center gap-1 text-sm text-walnut hover:underline">
            {t('client.allRequests')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {s.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('client.noRequests')}</p>
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
      </div>

      <Button asChild variant="walnut" size="lg" className="self-start">
        <Link href="/requests/new">
          <Plus className="mr-1 h-4 w-4" />
          {t('client.newRequest')}
        </Link>
      </Button>
    </div>
  );
}
