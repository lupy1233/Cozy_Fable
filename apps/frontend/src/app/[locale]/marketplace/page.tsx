'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  MARKETPLACE_DISTANCE_BANDS,
  PROJECT_SIZES,
  type MarketplaceDistanceBand,
  type MarketplaceItemDto,
  type ProjectSize,
} from '@marketplace/shared';
import { ArrowRight, Inbox } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMarketplace, useWallet } from '@/hooks/use-marketplace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { useRelativeTime } from '@/lib/relative-time';
import { distanceLabel } from '@/lib/marketplace-distance';
import { cn } from '@/lib/utils';
import { AccessBlocked } from './_components/access-blocked';
import { RequestTag } from './_components/request-tag';
import { SlotBars } from './_components/slot-bars';
import { WorksheetButton } from './_components/worksheet-button';

// Design 2026-11 (canvas): fiecare stare a cardului are pasul ei, langa cost (Fitts,
// Von Restorff); cererile pline sunt estompate ca sa nu para preluabile (Signifiers);
// soldul sta in antet (pastila de credite), nu se mai repeta in pagina. Filtrele si
// sortarea sunt doar pe UI (state local), peste lista deja incarcata.
type Filter = 'all' | 'open' | 'mine';
type Sort = 'newest' | 'cheapest';
type SizeFilter = 'ANY' | ProjectSize;
type DistanceFilter = 'ANY' | MarketplaceDistanceBand;
const FILTERS: Filter[] = ['all', 'open', 'mine'];
const SORTS: Sort[] = ['newest', 'cheapest'];

// Starile pe care datele le pot distinge. Asteptarea impusa de plan (gating) nu apare
// aici: API-ul nu intoarce cererile pe care planul firmei inca nu le poate prelua.
type CardState = 'mine' | 'full' | 'short' | 'open';

const isFull = (r: MarketplaceItemDto) => r.activeClaims >= r.maxClaims;
const isOpen = (r: MarketplaceItemDto) => !isFull(r) && !r.alreadyClaimedByMyCompany;

function cardState(r: MarketplaceItemDto, available: number | null): CardState {
  if (r.alreadyClaimedByMyCompany) return 'mine';
  if (isFull(r)) return 'full';
  if (available != null && r.creditCost != null && r.creditCost > available) return 'short';
  return 'open';
}

export default function MarketplacePage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const list = useMarketplace();
  const wallet = useWallet();
  const relTime = useRelativeTime();
  const [filter, setFilter] = useState<Filter>('all');
  const [size, setSize] = useState<SizeFilter>('ANY');
  const [distance, setDistance] = useState<DistanceFilter>('ANY');
  const [sort, setSort] = useState<Sort>('newest');

  // marimea si distanta ingusteaza lista; numerele de pe pastile se calculeaza peste ea,
  // ca sa spuna exact cate carduri apar la click
  const scoped = useMemo(
    () =>
      (list.data ?? []).filter(
        (r) => (size === 'ANY' || r.size === size) && (distance === 'ANY' || r.distanceBand === distance),
      ),
    [list.data, size, distance],
  );
  const counts: Record<Filter, number> = useMemo(
    () => ({
      all: scoped.length,
      open: scoped.filter(isOpen).length,
      mine: scoped.filter((r) => r.alreadyClaimedByMyCompany).length,
    }),
    [scoped],
  );
  const items = useMemo(() => {
    const rows = scoped.filter((r) =>
      filter === 'open' ? isOpen(r) : filter === 'mine' ? r.alreadyClaimedByMyCompany : true,
    );
    return [...rows].sort((a, b) =>
      sort === 'cheapest'
        ? (a.creditCost ?? Number.MAX_SAFE_INTEGER) - (b.creditCost ?? Number.MAX_SAFE_INTEGER)
        : b.publishedAt.localeCompare(a.publishedAt),
    );
  }, [scoped, filter, sort]);
  const available = wallet.data?.available ?? null;

  const resetFilters = () => {
    setFilter('all');
    setSize('ANY');
    setDistance('ANY');
  };

  // Acces doar COMPANY_USER; restul → dashboard / login
  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="list" />} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {list.isSuccess && list.data.length > 0 && (
        <Card
          padding="none"
          className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5 px-5 py-4 shadow-none"
        >
          <FilterChips
            label={t('filterLabel')}
            value={filter}
            onChange={(v) => setFilter(v ?? 'all')}
            options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`), count: counts[f] }))}
            className="[&>button]:min-h-10"
          />
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="mk-size" className="text-xs text-muted-foreground">
                {t('size')}
              </label>
              <Select
                id="mk-size"
                value={size}
                onChange={(e) => setSize(e.target.value as SizeFilter)}
                className="min-w-[7.5rem]"
              >
                <option value="ANY">{t('filterAny')}</option>
                {PROJECT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {tr(`sizeValue.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="mk-dist" className="text-xs text-muted-foreground">
                {t('distanceFilter')}
              </label>
              <Select
                id="mk-dist"
                value={distance}
                onChange={(e) => setDistance(e.target.value as DistanceFilter)}
                className="min-w-[8.5rem]"
              >
                <option value="ANY">{t('filterAny')}</option>
                {MARKETPLACE_DISTANCE_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {t(`distanceBand.${b}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="mk-sort" className="text-xs text-muted-foreground">
                {t('sortLabel')}
              </label>
              <Select
                id="mk-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-w-[11rem]"
              >
                {SORTS.map((so) => (
                  <option key={so} value={so}>
                    {t(`sort.${so}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      )}

      {list.isPending && <SkeletonList variant="cards" rows={4} className="lg:grid-cols-2" />}
      {/* 403/404 (firma neaprobata / suspendata / fara abonament) → ecran de blocaj cu CTA */}
      {list.isError && <AccessBlocked error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" icon={Inbox} title={t('empty')} />
      )}
      {list.isSuccess && list.data.length > 0 && items.length === 0 && (
        <EmptyState
          variant="card"
          icon={Inbox}
          title={t('emptyFiltered')}
          action={
            <Button type="button" variant="outline" onClick={resetFilters}>
              {t('resetFilters')}
            </Button>
          }
        />
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-5">
          {items.map((r) => {
            const state = cardState(r, available);
            const slotsLabel =
              state === 'mine'
                ? t('slotsMine', { active: r.activeClaims, max: r.maxClaims })
                : t('slots', { active: r.activeClaims, max: r.maxClaims });
            return (
              <Card
                key={r.id}
                as="article"
                padding="none"
                className={cn('flex flex-col gap-3 px-6 py-5', state === 'full' && 'opacity-60')}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <h2 className="heading-section min-w-0">
                    <Link
                      href={`/marketplace/${r.id}`}
                      className="rounded-sm underline-offset-4 hover:text-walnut hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ContactSafeText text={r.title} />
                    </Link>
                  </h2>
                  <span className="data-mono whitespace-nowrap text-muted-foreground">
                    {relTime(r.publishedAt)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  <ContactSafeText text={r.description} />
                </p>
                <div className="flex flex-wrap gap-x-2 gap-y-1.5">
                  <RequestTag>
                    {r.city}, {r.county}
                  </RequestTag>
                  <RequestTag title={t('distanceHint')}>{distanceLabel(r, t)}</RequestTag>
                  {r.size && <RequestTag tone="walnut">{tr(`sizeValue.${r.size}`)}</RequestTag>}
                  <RequestTag>{tr(`budget.${r.budgetRange}`)}</RequestTag>
                  {r.includesPaidDesign && <RequestTag tone="sage">{t('includesPaidDesign')}</RequestTag>}
                  {r.hasOwnProject && <RequestTag tone="info">{t('hasOwnProject')}</RequestTag>}
                </div>

                {/* locurile in stanga; costul + pasul urmator impreuna, in dreapta */}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-dashed border-border-2 pt-3.5">
                  <div className="flex flex-col gap-1.5">
                    <SlotBars filled={r.activeClaims} total={r.maxClaims} />
                    <span className="text-xs text-muted-foreground">{slotsLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    {r.creditCost != null && (
                      <span
                        className={cn(
                          'font-mono text-lead font-medium',
                          state === 'short' ? 'text-crimson' : 'text-foreground',
                        )}
                      >
                        {state === 'short' && available != null
                          ? t('creditsShort', { cost: r.creditCost, missing: r.creditCost - available })
                          : t('availableCredits', { n: r.creditCost })}
                      </span>
                    )}
                    {state === 'open' && (
                      <Button asChild variant="walnut" size="lg" className="h-11">
                        <Link href={`/marketplace/${r.id}`}>
                          {t('viewAndClaim')}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    )}
                    {state === 'mine' && <WorksheetButton requestId={r.id} className="h-11" />}
                    {state === 'short' && (
                      <Button asChild variant="outline" size="lg" className="h-11">
                        <Link href="/marketplace/wallet">{t('buyCredits')}</Link>
                      </Button>
                    )}
                    {state === 'full' && (
                      <span className="text-sm font-medium text-muted-foreground">{t('full')}</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
