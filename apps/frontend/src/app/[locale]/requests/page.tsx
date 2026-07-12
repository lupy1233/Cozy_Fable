'use client';

import type { RequestStatus } from '@marketplace/shared';
import { ArrowRight, FileText, Handshake, MapPin, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyRequests } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import { ROOM_ICONS } from '@/lib/room-icons';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

// "Cererile mele" pe carduri vii (feedback PO item 12), in limbajul cardurilor
// din marketplace: camere cu iconite, statusul, ateliere active + oferte, CTA
// direct spre conversatii. Tabelul anterior era doar o lista plata.
// Taburi de filtrare cand lista creste (idee 2 PO r2) — filtrare client-side,
// lista vine oricum integral (fara paginare).

const MAX_ROOM_CHIPS = 4;

type RequestTab = 'ALL' | 'ACTIVE' | 'IN_PROGRESS' | 'DONE' | 'EXPIRED';

const TABS: RequestTab[] = ['ALL', 'ACTIVE', 'IN_PROGRESS', 'DONE', 'EXPIRED'];

const TAB_STATUSES: Record<Exclude<RequestTab, 'ALL'>, RequestStatus[]> = {
  // in piata: ciorne + tot ce inca aduna ateliere/oferte
  ACTIVE: [
    'DRAFT',
    'IN_MARKETPLACE',
    'CLAIMED_PARTIAL',
    'CLAIMED_FULL',
    'OFFERS_RECEIVED',
    'NEGOTIATION',
  ],
  // oferta acceptata → executie → livrare (inclusiv disputa deschisa)
  IN_PROGRESS: ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'DISPUTED'],
  DONE: ['COMPLETED'],
  EXPIRED: ['EXPIRED'],
};

export default function MyRequestsPage() {
  const t = useTranslations('Requests');
  const tc = useTranslations('Configurator');
  const router = useRouter();
  const me = useMe();
  const list = useMyRequests();
  const relTime = useRelativeTime();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  const [tab, setTab] = useState<RequestTab>('ALL');

  const all = useMemo(() => list.data ?? [], [list.data]);
  const countFor = (tb: RequestTab) =>
    tb === 'ALL' ? all.length : all.filter((r) => TAB_STATUSES[tb].includes(r.status)).length;
  const rows = useMemo(
    () => (tab === 'ALL' ? all : all.filter((r) => TAB_STATUSES[tab].includes(r.status))),
    [all, tab],
  );

  if (me.isPending || list.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t('myRequests')}</h1>
          {all.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">{t('myRequestsSubtitle')}</p>
          )}
        </div>
        <Button asChild variant="walnut">
          <Link href="/requests/new">{t('newTitle')}</Link>
        </Button>
      </div>

      {/* taburi de filtrare dupa stadiu (idee 2 PO r2) */}
      {all.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TABS.map((tb) => {
            const n = countFor(tb);
            return (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                aria-pressed={tab === tb}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  tab === tb
                    ? 'border-walnut bg-walnut text-primary-foreground'
                    : 'border-border-2 bg-card text-muted-foreground hover:border-muted-2 hover:text-foreground',
                  n === 0 && tab !== tb && 'opacity-50',
                )}
              >
                {t(`tabs.${tb}`)}
                <span className="ml-1.5 font-mono text-xs opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {all.length > 0 && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-2 bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {t('tabEmpty')}
        </p>
      )}

      {all.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-2 bg-surface px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-walnut-soft text-walnut">
            <Plus className="h-6 w-6" />
          </span>
          <p className="font-serif text-xl">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('emptyHint')}</p>
          <Button asChild variant="walnut" className="mt-2">
            <Link href="/requests/new">{t('newTitle')}</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => {
          const extraRooms = r.roomTypes.length - MAX_ROOM_CHIPS;
          const hasActivity = r.activeClaims > 0 || r.quotesCount > 0;
          return (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 ease-ease hover:-translate-y-0.5 hover:border-border-2 hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 font-serif text-xl leading-snug tracking-[-0.01em]">
                  {r.title || t('untitled')}
                </h2>
                <StatusBadge status={r.status} label={t(`statusValue.${r.status}`)} />
              </div>

              {/* camerele cererii, cu iconite */}
              {r.roomTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.roomTypes.slice(0, MAX_ROOM_CHIPS).map((rt, i) => (
                    <span
                      key={`${rt}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <span className="text-walnut [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <ConfiguratorIcon name={ROOM_ICONS[rt]} />
                      </span>
                      {tc(`rooms.type.${rt}`)}
                    </span>
                  ))}
                  {extraRooms > 0 && (
                    <span className="inline-flex items-center rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs text-muted-2">
                      +{extraRooms}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {r.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {r.city}
                  </span>
                )}
                <span className="font-mono text-muted-2">
                  {r.publishedAt ? relTime(r.publishedAt) : t('statusValue.DRAFT')}
                </span>
              </div>

              {/* pulsul cererii: ateliere active + oferte primite */}
              <div className="flex items-center justify-between border-t border-border-2 pt-3">
                <div className="flex items-center gap-4 text-sm">
                  <span
                    className={
                      'inline-flex items-center gap-1.5 ' +
                      (r.activeClaims > 0 ? 'text-walnut' : 'text-muted-2')
                    }
                  >
                    <Handshake className="h-4 w-4" />
                    {t('cardClaims', { n: r.activeClaims })}
                  </span>
                  <span
                    className={
                      'inline-flex items-center gap-1.5 ' +
                      (r.quotesCount > 0 ? 'text-sage' : 'text-muted-2')
                    }
                  >
                    <FileText className="h-4 w-4" />
                    {t('cardOffers', { n: r.quotesCount })}
                  </span>
                </div>
                <span
                  onClick={(e) => {
                    if (!hasActivity) return;
                    e.preventDefault();
                    router.push(`/requests/${r.id}/offers`);
                  }}
                  className={
                    'inline-flex items-center gap-1 text-sm transition-colors ' +
                    (hasActivity
                      ? 'text-walnut group-hover:underline'
                      : 'text-muted-2')
                  }
                >
                  {hasActivity ? t('cardOpenConversations') : t('view')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
