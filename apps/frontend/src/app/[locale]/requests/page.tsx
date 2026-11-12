'use client';

import type { RequestListItemDto, RequestStatus } from '@marketplace/shared';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyRequests } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import { RequestStatusBadge, isClientTurn, useRequestNextStep } from '../_components/request-progress';

// "Cererile mele" pe carduri: fiecare card spune ce urmeaza (un rand derivat din starea
// cererii, firmele active si ofertele primite), iar culoarea starii arata cine are mutarea.
// Taburi de filtrare dupa stadiu (idee 2 PO r2) + cautare si ordonare — toate pe client,
// lista vine oricum integral (fara paginare).

const MAX_ROOM_CHIPS = 4;

type RequestTab = 'ALL' | 'ACTIVE' | 'IN_PROGRESS' | 'DONE' | 'EXPIRED';

const TABS: RequestTab[] = ['ALL', 'ACTIVE', 'IN_PROGRESS', 'DONE', 'EXPIRED'];

const TAB_STATUSES: Record<Exclude<RequestTab, 'ALL'>, RequestStatus[]> = {
  // in piata: tot ce inca aduna firme/oferte (ciornele nu mai vin din API — PO r5)
  ACTIVE: [
    'IN_MARKETPLACE',
    'CLAIMED_PARTIAL',
    'CLAIMED_FULL',
    'OFFERS_RECEIVED',
    'NEGOTIATION',
  ],
  // oferta acceptata → executie → livrare (inclusiv disputa deschisa)
  IN_PROGRESS: ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'DISPUTED'],
  // E-admin-platform-3: proiectul anulat de echipa Cozy Home e istoric (fara republicare)
  DONE: ['COMPLETED', 'CANCELLED'],
  EXPIRED: ['EXPIRED'],
};

type RequestSort = 'ATTENTION' | 'NEWEST';

const SORTS: RequestSort[] = ['ATTENTION', 'NEWEST'];

// „Intai cele care te asteapta”: randul clientului, apoi cererile in desfasurare, la final cele incheiate.
function attentionRank(status: RequestStatus): number {
  if (isClientTurn(status)) return 0;
  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED') return 2;
  return 1;
}

const requestStamp = (r: RequestListItemDto) => Date.parse(r.publishedAt ?? r.createdAt);

// cautare fara diacritice si fara majuscule („floresti” gaseste „Florești”)
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Actiunea cardului: unde merge clientul din starea curenta a cererii.
type CardCta = { key: 'compare' | 'confirmDelivery' | 'conversations' | 'view'; href: string };

function cardCta(r: RequestListItemDto): CardCta {
  const offersHref = `/requests/${r.id}/offers`;
  if (r.status === 'OFFERS_RECEIVED' || r.status === 'NEGOTIATION') return { key: 'compare', href: offersHref };
  if (r.status === 'DELIVERED_BY_COMPANY') return { key: 'confirmDelivery', href: offersHref };
  // firme active sau oferte primite → conversatiile; cererea incheiata se deschide pe fisa ei
  if (r.status !== 'COMPLETED' && (r.activeClaims > 0 || r.quotesCount > 0)) {
    return { key: 'conversations', href: offersHref };
  }
  return { key: 'view', href: `/requests/${r.id}` };
}

export default function MyRequestsPage() {
  const t = useTranslations('Requests');
  const tc = useTranslations('Configurator');
  const router = useRouter();
  const me = useMe();
  const list = useMyRequests();
  const relTime = useRelativeTime();
  const next = useRequestNextStep();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  const [tab, setTab] = useState<RequestTab>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RequestSort>('ATTENTION');

  const all = useMemo(() => list.data ?? [], [list.data]);
  const needle = fold(query.trim());
  // cautarea se aplica inaintea taburilor, deci contoarele taburilor arata rezultatele cautarii
  const searched = useMemo(
    () => (needle ? all.filter((r) => fold(r.title).includes(needle) || fold(r.city).includes(needle)) : all),
    [all, needle],
  );
  const countFor = (tb: RequestTab) =>
    tb === 'ALL' ? searched.length : searched.filter((r) => TAB_STATUSES[tb].includes(r.status)).length;
  const rows = useMemo(() => {
    const inTab = tab === 'ALL' ? searched : searched.filter((r) => TAB_STATUSES[tab].includes(r.status));
    return [...inTab].sort((a, b) => {
      if (sort === 'ATTENTION') {
        const byTurn = attentionRank(a.status) - attentionRank(b.status);
        if (byTurn !== 0) return byTurn;
      }
      return requestStamp(b) - requestStamp(a);
    });
  }, [searched, tab, sort]);

  if (me.isPending || me.isError || list.isPending || list.isError) {
    // me.isError → efectul de mai sus face redirect la /login; skeletonul ramane pana atunci
    return (
      <QueryState
        pending={me.isPending || me.isError || list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        skeleton={<SkeletonPage variant="list" />}
      />
    );
  }

  const ctaLabel = (key: CardCta['key']) =>
    key === 'conversations' ? t('cardOpenConversations') : t(`next.cta.${key}`);

  return (
    <div className="flex flex-col gap-6">
      {/* „Cerere noua” sta in antetul aplicatiei; aici apare doar cand lista e goala */}
      <PageHeader title={t('myRequests')} subtitle={all.length > 0 ? t('myRequestsSubtitle') : undefined} />

      {all.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* taburi de filtrare dupa stadiu (idee 2 PO r2) */}
          <FilterChips
            label={t('tabsLabel')}
            value={tab}
            onChange={(v) => v && setTab(v)}
            className="[&>button]:min-h-10"
            options={TABS.map((tb) => ({
              value: tb,
              label: t(`tabs.${tb}`),
              count: countFor(tb),
              dimmed: countFor(tb) === 0,
            }))}
          />
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                className="h-11 pl-9"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Select
                aria-label={t('sortLabel')}
                value={sort}
                onChange={(e) => setSort(e.target.value as RequestSort)}
                className="h-11"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}

      {all.length > 0 && rows.length === 0 && (
        <EmptyState
          variant="dashed"
          size="sm"
          title={needle ? t('searchEmpty') : t('tabEmpty')}
          action={
            needle ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setQuery('')}>
                {t('searchClear')}
              </Button>
            ) : undefined
          }
        />
      )}

      {all.length === 0 && (
        <EmptyState
          variant="dashed"
          icon={Plus}
          title={t('emptyTitle')}
          hint={t('emptyHint')}
          action={
            <Button asChild variant="walnut" size="lg" className="mt-2">
              <Link href="/requests/new">{t('newTitle')}</Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {rows.map((r) => {
          const extraRooms = r.roomTypes.length - MAX_ROOM_CHIPS;
          const cta = cardCta(r);
          const when = r.publishedAt ? relTime(r.publishedAt) : t('statusValue.DRAFT');
          return (
            <Card
              as="article"
              key={r.id}
              padding="none"
              interactive
              className="relative flex flex-col gap-3 px-5 py-5 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h2 className="heading-section min-w-0 break-words">
                  {/* linkul titlului se intinde pe tot cardul; actiunea din subsol ramane deasupra lui */}
                  <Link href={`/requests/${r.id}`} className="rounded-sm after:absolute after:inset-0 after:rounded-xl">
                    {r.title || t('untitled')}
                  </Link>
                </h2>
                <RequestStatusBadge status={r.status} />
              </div>

              {/* camerele cererii, orasul si vechimea */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {r.roomTypes.slice(0, MAX_ROOM_CHIPS).map((rt, i) => (
                  <span key={`${rt}-${i}`} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-ui">
                    {tc(`rooms.type.${rt}`)}
                  </span>
                ))}
                {extraRooms > 0 && (
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-ui text-muted-foreground">
                    +{extraRooms}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {r.roomTypes.length > 0 && '· '}
                  {r.city && `${r.city} · `}
                  <span className="font-mono text-xs">{when}</span>
                </span>
              </div>

              {/* ce urmeaza: chihlimbar cand e randul clientului, carmin la disputa, neutru cand asteapta */}
              <p
                className={cn(
                  'rounded-lg px-3 py-2.5 text-ui',
                  isClientTurn(r.status)
                    ? 'bg-amber-soft text-amber'
                    : r.status === 'DISPUTED'
                      ? 'bg-crimson-soft text-crimson'
                      : 'bg-surface-2 text-ink-2',
                )}
              >
                <span className="font-semibold">{t('next.label')}</span>{' '}
                {next.line({
                  status: r.status,
                  claims: r.activeClaims,
                  offers: r.quotesCount,
                  expiresAt: r.expiresAt,
                })}
              </p>

              {/* pulsul cererii: firme active + oferte primite, si actiunea potrivita starii */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-dashed border-border-2 pt-3">
                <div className="text-ui text-muted-foreground">
                  {t('cardClaims', { n: r.activeClaims })} · {t('cardOffers', { n: r.quotesCount })}
                </div>
                <Link
                  href={cta.href}
                  className="relative z-10 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-walnut hover:text-walnut-deep hover:underline"
                >
                  {ctaLabel(cta.key)}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
