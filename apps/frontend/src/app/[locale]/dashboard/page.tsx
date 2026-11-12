'use client';

import {
  CLAIM_SLOT_STATUSES,
  REQUEST_STATUSES,
  type AuthUser,
  type CompanyDto,
  type DashboardActionItemDto,
} from '@marketplace/shared';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useCompanyDashboardStats, useMyCompany } from '@/hooks/use-company';
import { useSubscription } from '@/hooks/use-marketplace';
import { useMoney } from '@/hooks/use-money';
import { usePenaltyStatus } from '@/hooks/use-penalties';
import { useClientDashboardStats } from '@/hooks/use-requests';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { AppShell } from '../_components/app-shell';
import { FirmRulesLink } from '../_components/firm-rules-link';
import { RequestStatusBadge } from '../_components/request-progress';
import { TodoNowCard } from '../_components/todo-now-card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { ApiError } from '@/lib/api';

// Ruta protejata client-side: fara user → redirect la /login.
// Aceeasi pagina serveste ambele roluri: clientul vede ce are de facut si cererile lui,
// firma vede starea verificarii + abonamentul, urgentele si cifrele preluarilor.
// „De facut acum” e mereu primul bloc; „Cerere noua” sta in antetul aplicatiei.
export default function DashboardPage() {
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

  const user = me.data;

  return (
    <AppShell>
      {user.role === 'CLIENT' ? (
        <ClientDashboard user={user} />
      ) : user.role === 'COMPANY_USER' ? (
        <CompanyDashboard user={user} />
      ) : (
        // alte roluri (admin): doar antetul si cardul contului
        <div className="flex flex-col gap-8">
          <DashboardHeader name={user.name} />
          <div className="w-full max-w-md">
            <AccountCard user={user} showRole />
          </div>
        </div>
      )}
    </AppShell>
  );
}

const TWO_COLUMNS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]';

// Antetul panoului: salutul cu prenumele, rezumatul lucrurilor de facut, pastilele firmei.
function DashboardHeader({
  name,
  subtitle,
  actions,
}: {
  name: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const ta = useTranslations('Auth');
  const t = useTranslations('Dashboard');
  // numele poate lipsi din raspuns: atunci ramane titlul generic, fara salut
  const firstName = (name ?? '').trim().split(/\s+/)[0];
  if (!firstName) return <PageHeader title={ta('dashboardTitle')} subtitle={subtitle} actions={actions} />;
  return (
    <PageHeader
      kicker={ta('dashboardTitle')}
      title={t('greeting', { name: firstName })}
      subtitle={subtitle}
      actions={actions}
    />
  );
}

// „Ai 3 lucruri de facut. Cel mai apropiat termen este in 2 zile.”
function TodoSummary({ items, variant }: { items: DashboardActionItemDto[]; variant: 'client' | 'firm' }) {
  const t = useTranslations('Dashboard.todo');
  const relative = useRelativeTime();
  // termenul cel mai apropiat dintre cele care nu au trecut (ISO UTC se ordoneaza lexicografic)
  const nearest = items
    .map((a) => a.dueAt)
    .filter((d): d is string => !!d && Date.parse(d) > Date.now())
    .sort()[0];
  return (
    <>
      {t(variant === 'firm' ? 'summaryFirm' : 'summary', { count: items.length })}
      {nearest && ` ${t('nearest', { when: relative(nearest) })}`}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className={TWO_COLUMNS}>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </div>
  );
}

// Link de antet de card: „Toate cererile →”.
function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-walnut hover:text-walnut-deep hover:underline"
    >
      {children}
      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

function AccountCard({
  user,
  showRole,
  showCollections,
}: {
  user: AuthUser;
  showRole?: boolean;
  showCollections?: boolean;
}) {
  const t = useTranslations('Dashboard');
  const ta = useTranslations('Auth');
  const tn = useTranslations('Nav');
  const ti = useTranslations('Inspiration');
  const linkClass =
    'inline-flex min-h-11 items-center text-sm font-medium text-walnut hover:text-walnut-deep hover:underline';
  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="dash-account-title"
      className="flex flex-col gap-3.5 px-5 py-5 sm:px-6"
    >
      <h2 id="dash-account-title" className="heading-section">
        {t('account.title')}
      </h2>
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size={48} />
        <div className="min-w-0">
          <p className="font-semibold">{user.name}</p>
          <p className="text-muted-foreground [overflow-wrap:anywhere]">{user.email}</p>
          {showRole && (
            <Badge tone="walnut" className="mt-2">
              {ta(`role.${user.role}`)}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
        <Link href="/change-password" className={linkClass}>
          {tn('changePassword')}
        </Link>
        {showCollections && (
          <Link href="/inspiration/boards" className={linkClass}>
            {ti('myBoards')}
          </Link>
        )}
      </div>
    </Card>
  );
}

// ───────────────────────── client ─────────────────────────

function ClientDashboard({ user }: { user: AuthUser }) {
  const t = useTranslations('Dashboard');
  const tr = useTranslations('Requests');
  const relative = useRelativeTime();
  const stats = useClientDashboardStats();
  const s = stats.data;

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        name={user.name}
        subtitle={s ? <TodoSummary items={s.actions ?? []} variant="client" /> : undefined}
      />

      {stats.isPending ? (
        <DashboardSkeleton />
      ) : stats.isError ? (
        <LoadError onRetry={() => void stats.refetch()} />
      ) : s ? (
        <div className={TWO_COLUMNS}>
          <div className="flex min-w-0 flex-col gap-6">
            <TodoNowCard items={s.actions ?? []} />

            {/* activitate recenta */}
            <Card as="section" padding="none" aria-labelledby="dash-recent-title">
              <div className="flex flex-wrap items-center justify-between gap-x-3 px-5 pb-2.5 pt-4 sm:px-6">
                <h2 id="dash-recent-title" className="heading-section">
                  {t('client.recent')}
                </h2>
                <ArrowLink href="/requests">{t('client.allRequests')}</ArrowLink>
              </div>
              {s.recent.length === 0 ? (
                <div className="border-t border-border px-5 sm:px-6">
                  {/* fara nicio cerere, crearea primeia e actiunea principala a ecranului */}
                  <EmptyState
                    size="sm"
                    variant="plain"
                    title={t('client.noRequests')}
                    action={
                      <Button asChild variant="walnut" size="lg">
                        <Link href="/requests/new">
                          <Plus aria-hidden />
                          {t('client.newRequest')}
                        </Link>
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {s.recent.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link href={`/requests/${r.id}`} className="break-words font-medium hover:underline">
                          {r.title || tr('untitled')}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground">{relative(r.updatedAt)}</span>
                      </div>
                      <RequestStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <ClientSummaryCard
              totalRequests={s.totalRequests}
              activeClaims={s.activeClaims}
              offersReceived={s.offersReceived}
              byStatus={s.byStatus}
            />
            <AccountCard user={user} showCollections />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

// „Cererile tale, pe scurt”: cifrele principale + distributia pe statusuri.
function ClientSummaryCard({
  totalRequests,
  activeClaims,
  offersReceived,
  byStatus,
}: {
  totalRequests: number;
  activeClaims: number;
  offersReceived: number;
  byStatus: Partial<Record<(typeof REQUEST_STATUSES)[number], number>>;
}) {
  const t = useTranslations('Dashboard.client');
  const tr = useTranslations('Requests');
  // in ordinea drumului cererii, doar statusurile care au cereri
  const statuses = REQUEST_STATUSES.filter((status) => (byStatus[status] ?? 0) > 0);
  const tile = 'min-w-0 [overflow-wrap:anywhere]';

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="dash-summary-title"
      className="flex flex-col gap-4 px-5 pb-6 pt-5 sm:px-6"
    >
      <h2 id="dash-summary-title" className="heading-section">
        {t('summaryTitle')}
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard variant="inline" label={t('totalRequests')} value={totalRequests} className={tile} />
        <StatCard variant="inline" label={t('activeClaims')} value={activeClaims} className={tile} />
        <StatCard variant="inline" label={t('offersReceived')} value={offersReceived} className={tile} />
      </div>
      {statuses.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="label">{t('byStatus')}</h3>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Link key={status} href="/requests" className="rounded-full transition-opacity hover:opacity-80">
                <RequestStatusBadge
                  status={status}
                  label={`${tr(`statusValue.${status}`)} · ${byStatus[status] ?? 0}`}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── firma ─────────────────────────

// culoarea barei pe stadiul preluarii: nuc = in lucru, albastru = asteapta clientul,
// salvie = finalizata, carmin = termen ratat; restul (inchise / retrase) raman neutre
const STAGE_BAR: Record<string, string> = {
  ACTIVE: 'bg-walnut',
  OFFER_SENT: 'bg-info',
  COMPLETED: 'bg-sage',
  SLA_EXPIRED: 'bg-crimson',
};

// stadiile apar in ordinea enum-ului; un stadiu necunoscut ramane la final
const STAGE_ORDER = new Map<string, number>(
  CLAIM_SLOT_STATUSES.map((status, i): [string, number] => [status, i]),
);

const PILL =
  'inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-opacity hover:opacity-85';

const COMPANY_STATUS_PILL: Record<CompanyDto['status'], string> = {
  PENDING_VERIFICATION: 'bg-amber-soft text-amber',
  APPROVED: 'bg-sage-soft text-sage',
  REJECTED: 'bg-crimson-soft text-crimson',
  SUSPENDED: 'bg-crimson-soft text-crimson',
};

// acelasi prag ca bannerul din „Firma mea” si din portofel
const SUBSCRIPTION_WARN_DAYS = 7;

const MAX_PENALTY_EVENTS = 3;

function CompanyDashboard({ user }: { user: AuthUser }) {
  const t = useTranslations('Dashboard');
  const tc = useTranslations('Company');
  const money = useMoney();
  const stats = useCompanyDashboardStats();
  const s = stats.data;
  // firma inca ne-creata (onboarding -> 404) -> fara statistici; orice alta eroare se vede, cu Reincearca
  const noCompany = stats.isError && stats.error instanceof ApiError && stats.error.status === 404;

  return (
    <div className="flex flex-col gap-7">
      <DashboardHeader
        name={user.name}
        subtitle={s ? <TodoSummary items={s.actions ?? []} variant="firm" /> : undefined}
        actions={<CompanyPills />}
      />

      {stats.isPending ? (
        <DashboardSkeleton />
      ) : noCompany ? (
        <EmptyState
          variant="card"
          title={tc('onboardingTitle')}
          hint={tc('onboardingSubtitle')}
          action={
            <Button asChild variant="walnut" size="lg">
              <Link href="/company">{t('company.startOnboarding')}</Link>
            </Button>
          }
        />
      ) : stats.isError ? (
        <LoadError onRetry={() => void stats.refetch()} />
      ) : s ? (
        <div className={TWO_COLUMNS}>
          <div className="flex min-w-0 flex-col gap-6">
            <TodoNowCard
              items={s.actions ?? []}
              emptyAction={
                <Button asChild variant="outline" size="lg">
                  <Link href="/marketplace">
                    {t('company.toMarketplace')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            />

            {/* cifrele preluarilor si ale ofertelor */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4">
              <StatCard label={t('company.claimsTotal')} value={s.claimsTotal} href="/marketplace/claims" />
              <StatCard label={t('company.claimsActive')} value={s.claimsActive} href="/marketplace/claims" />
              <StatCard label={t('company.quotesSent')} value={s.quotesSent} href="/marketplace/claims" />
              <StatCard
                label={t('company.quotesTotalRon')}
                value={money(s.quotesTotalRon)}
                href="/marketplace/claims"
              />
            </div>

            <ClaimStagesCard claimsByStatus={s.claimsByStatus} />
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            {/* credite: sold + consum recent */}
            <Card
              as="section"
              padding="none"
              aria-labelledby="dash-credits-title"
              className="flex flex-col gap-3 px-5 pb-6 pt-3 sm:px-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <h2 id="dash-credits-title" className="heading-section">
                  {t('company.credits')}
                </h2>
                <ArrowLink href="/marketplace/wallet">{t('company.walletLink')}</ArrowLink>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard variant="inline" label={t('company.available')} value={s.wallet.available} />
                <StatCard variant="inline" label={t('company.reserved')} value={s.wallet.reserved} />
              </div>
              <dl className="flex flex-col gap-1.5 text-ui">
                <div className="flex justify-between gap-2.5">
                  <dt className="text-muted-foreground">{t('company.consumed7d')}</dt>
                  <dd className="font-mono">{s.creditsConsumed7d}</dd>
                </div>
                <div className="flex justify-between gap-2.5">
                  <dt className="text-muted-foreground">{t('company.consumed30d')}</dt>
                  <dd className="font-mono">{s.creditsConsumed30d}</dd>
                </div>
              </dl>
            </Card>

            {/* preluari active per membru; cele fara responsabil ies in evidenta */}
            {s.perMember.length > 0 && (
              <Card
                as="section"
                padding="none"
                aria-labelledby="dash-members-title"
                className="flex flex-col gap-3 px-5 py-5 sm:px-6"
              >
                <h2 id="dash-members-title" className="heading-section">
                  {t('company.perMember')}
                </h2>
                <ul className="flex flex-col gap-2">
                  {s.perMember.map((m) => (
                    <li
                      key={m.userId ?? 'unassigned'}
                      className={cn(
                        'flex justify-between gap-2.5',
                        m.userId === null && 'font-medium text-crimson',
                      )}
                    >
                      <span className="min-w-0 break-words">{m.name ?? t('company.unassigned')}</span>
                      <span className="font-mono text-ui">{m.activeClaims}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <PenaltyCard points={s.activePenaltyPoints} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

// Preluari dupa stadiu: o bara per stadiu, proportionala cu cel mai mare numar.
function ClaimStagesCard({ claimsByStatus }: { claimsByStatus: Partial<Record<string, number>> }) {
  const t = useTranslations('Dashboard.company');
  const tm = useTranslations('Marketplace');
  const stages = Object.entries(claimsByStatus)
    .flatMap(([status, count]) => (count ? [{ status, count }] : []))
    .sort((a, b) => (STAGE_ORDER.get(a.status) ?? 99) - (STAGE_ORDER.get(b.status) ?? 99));
  const maxCount = Math.max(1, ...stages.map((stage) => stage.count));

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="dash-stages-title"
      className="flex flex-col gap-3 px-5 pb-6 pt-3 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id="dash-stages-title" className="heading-section">
          {t('claimsByStatus')}
        </h2>
        <ArrowLink href="/marketplace/claims">{t('toClaims')}</ArrowLink>
      </div>
      {stages.length === 0 ? (
        <EmptyState size="sm" variant="plain" title={t('noClaims')} className="py-2" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {stages.map(({ status, count }) => (
            <li key={status} className="flex items-center gap-3.5">
              <span className="w-28 shrink-0 text-ui sm:w-[150px]">
                {tm.has(`claimStatus.${status}`) ? tm(`claimStatus.${status}`) : status}
              </span>
              <span aria-hidden className="h-2 min-w-0 flex-1 rounded-full bg-background">
                <span
                  className={cn('block h-2 rounded-full', STAGE_BAR[status] ?? 'bg-muted-2')}
                  style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-ui">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Starea verificarii firmei + abonamentul, sus in antet; fiecare pastila duce la pagina ei.
function CompanyPills() {
  const t = useTranslations('Dashboard.company');
  const company = useMyCompany();
  const status = company.data?.status;
  if (!status) return null;
  return (
    <>
      <Link href="/company" className={cn(PILL, COMPANY_STATUS_PILL[status])}>
        {status === 'APPROVED' && <Check aria-hidden className="h-3.5 w-3.5" />}
        {t(`statusPill.${status}`)}
      </Link>
      {/* abonamentul se poate citi doar pentru o firma aprobata (altfel API-ul raspunde 403) */}
      {status === 'APPROVED' && <SubscriptionPill />}
    </>
  );
}

function SubscriptionPill() {
  const t = useTranslations('Dashboard.company');
  const tb = useTranslations('Billing');
  const tm = useTranslations('Marketplace');
  const subscription = useSubscription();
  if (subscription.isPending || subscription.isError) return null;
  const sub = subscription.data;
  return (
    <Link
      href="/marketplace/wallet#subscription"
      className={cn(
        PILL,
        !sub
          ? 'bg-crimson-soft text-crimson'
          : sub.daysLeft <= SUBSCRIPTION_WARN_DAYS
            ? 'bg-amber-soft text-amber'
            : 'border border-border-2 bg-surface text-ink-2',
      )}
    >
      {sub
        ? `${tb('planLabel', { tier: sub.tier })} · ${tm('subscription.daysLeft', { n: sub.daysLeft })}`
        : t('noSubscription')}
    </Link>
  );
}

// Penalizari: punctele active vin din statisticile panoului; pragul si ultimele evenimente
// din starea penalizarilor (aceeasi interogare ca in portofel), daca s-a incarcat.
function PenaltyCard({ points }: { points: number }) {
  const t = useTranslations('Dashboard.company');
  const tp = useTranslations('Penalties');
  const format = useFormatter();
  const penalties = usePenaltyStatus();
  const detail = penalties.data;
  const warn = points > 0;

  return (
    <Card
      as="section"
      tone={warn ? 'amber' : 'default'}
      padding="none"
      aria-labelledby="dash-penalties-title"
      className={cn('flex flex-col gap-2 px-5 py-5 sm:px-6', warn && 'text-amber')}
    >
      <h2 id="dash-penalties-title" className="heading-section">
        {t('penalties')}
      </h2>
      <p>
        <span className="font-serif text-3xl leading-none">{points}</span> {t('penaltyPoints')}
        {detail && ` ${t('penaltyOf', { threshold: detail.threshold })}`}
      </p>
      {detail && detail.events.length > 0 && (
        <ul className="flex flex-col gap-1 text-ui">
          {detail.events.slice(0, MAX_PENALTY_EVENTS).map((e) => (
            <li key={e.id}>
              {tp.has(`rule.${e.ruleKey}`) ? tp(`rule.${e.ruleKey}`) : e.ruleKey} · {e.points} {tp('pts')} ·{' '}
              {tp('expires')} {format.dateTime(new Date(e.expiresAt), { dateStyle: 'medium' })}
            </li>
          ))}
        </ul>
      )}
      <FirmRulesLink
        anchor="penalties"
        className={cn(
          'inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium hover:underline',
          warn ? 'text-amber' : 'text-walnut',
        )}
      >
        {t('penaltyRules')}
        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
      </FirmRulesLink>
    </Card>
  );
}
