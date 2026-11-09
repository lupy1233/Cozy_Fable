'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { MarketplaceItemDto } from '@marketplace/shared';
import { ArrowRight, Coins, Inbox } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMarketplace, useWallet } from '@/hooks/use-marketplace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { SlotTrack } from '@/components/ui/slot-track';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { useRelativeTime } from '@/lib/relative-time';
import { distanceLabel } from '@/lib/marketplace-distance';
import { cn } from '@/lib/utils';
import { AccessBlocked } from './_components/access-blocked';

// Laws of UX (PO 2026-11-08): costul in credite e informatia de decizie a
// firmei, deci sta mare, langa actiune (Fitts, Von Restorff); soldul e sus,
// cu "Cumpara credite" la un click; cererile pline sunt estompate ca sa nu
// para preluabile (Signifiers); filtre + sortare doar pe UI (state local).
type Filter = 'all' | 'open' | 'mine';
type Sort = 'newest' | 'cheapest';
const FILTERS: Filter[] = ['all', 'open', 'mine'];
const SORTS: Sort[] = ['newest', 'cheapest'];

const isFull = (r: MarketplaceItemDto) => r.activeClaims >= r.maxClaims;

export default function MarketplacePage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const list = useMarketplace();
  const wallet = useWallet();
  const relTime = useRelativeTime();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const items = useMemo(() => {
    const rows = (list.data ?? []).filter((r) =>
      filter === 'open' ? !isFull(r) && !r.alreadyClaimedByMyCompany : filter === 'mine' ? r.alreadyClaimedByMyCompany : true,
    );
    return [...rows].sort((a, b) =>
      sort === 'cheapest'
        ? (a.creditCost ?? Number.MAX_SAFE_INTEGER) - (b.creditCost ?? Number.MAX_SAFE_INTEGER)
        : b.publishedAt.localeCompare(a.publishedAt),
    );
  }, [list.data, filter, sort]);
  const available = wallet.data?.available ?? null;

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

      {/* soldul, la vedere: firma stie din prima ce isi permite */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-walnut-soft text-walnut">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{t('balanceLabel')}</p>
            <p className="font-mono text-2xl leading-tight">
              {available != null ? t('availableCredits', { n: available }) : '—'}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/marketplace/wallet">
            {t('buyCredits')}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {list.isSuccess && list.data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-[40px] rounded-full border px-4 text-sm transition-colors',
                  filter === f
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border-2 bg-surface hover:bg-secondary',
                )}
              >
                {t(`filter.${f}`)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('sortLabel')}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="min-h-[40px] rounded-md border border-border-2 bg-surface px-3 text-sm text-foreground"
            >
              {SORTS.map((so) => (
                <option key={so} value={so}>
                  {t(`sort.${so}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {list.isPending && <SkeletonList variant="cards" rows={4} className="lg:grid-cols-2" />}
      {/* 403/404 (firma neaprobata / suspendata / fara abonament) → ecran de blocaj cu CTA */}
      {list.isError && <AccessBlocked error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" icon={Inbox} title={t('empty')} />
      )}
      {list.isSuccess && list.data.length > 0 && items.length === 0 && (
        <EmptyState variant="card" icon={Inbox} title={t('emptyFiltered')} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((r) => {
          const full = isFull(r) && !r.alreadyClaimedByMyCompany;
          const short = available != null && r.creditCost != null && r.creditCost > available;
          return (
          <Card
            key={r.id}
            asChild
            interactive
            className={cn('grid grid-cols-[1fr_auto] gap-4', full && 'opacity-60 saturate-50')}
          >
          <Link href={`/marketplace/${r.id}`}>
            <div className="min-w-0">
              <h2 className="heading-section">
                <ContactSafeText text={r.title} />
              </h2>
              <p className="mt-1.5 line-clamp-2 text-ui text-muted-foreground">
                <ContactSafeText text={r.description} />
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="muted">
                  {r.city}, {r.county}
                </Badge>
                {r.size && <Badge tone="walnut">{tr(`sizeValue.${r.size}`)}</Badge>}
                <Badge tone="muted">{tr(`budget.${r.budgetRange}`)}</Badge>
                {r.includesPaidDesign && <Badge tone="sage">{t('includesPaidDesign')}</Badge>}
                {r.hasOwnProject && <Badge tone="info">{t('hasOwnProject')}</Badge>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-3 text-right">
              <span title={t('distanceHint')}>
                <Badge tone="outline">{distanceLabel(r, t)}</Badge>
              </span>
              <div className="flex flex-col items-end gap-1.5">
                <SlotTrack
                  filled={r.activeClaims}
                  total={r.maxClaims}
                  warn={r.activeClaims >= r.maxClaims}
                />
                <span className="font-mono text-meta text-muted-foreground">
                  {t('slots', { active: r.activeClaims, max: r.maxClaims })}
                </span>
                <span className="font-mono text-meta text-muted-2">
                  {relTime(r.publishedAt)}
                </span>
              </div>
              {/* costul + actiunea, impreuna, in coltul in care ajunge privirea */}
              {r.alreadyClaimedByMyCompany ? (
                <Badge tone="sage" dot>
                  {t('alreadyClaimed')}
                </Badge>
              ) : full ? (
                <span className="text-sm font-medium text-muted-foreground">{t('full')}</span>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  {r.creditCost != null && (
                    <span className={cn('font-mono text-xl leading-none', short ? 'text-crimson' : 'text-foreground')}>
                      {t('availableCredits', { n: r.creditCost })}
                    </span>
                  )}
                  {short ? (
                    <span className="text-meta text-crimson">{t('notEnoughCredits')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-walnut">
                      {t('viewAndClaim')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
