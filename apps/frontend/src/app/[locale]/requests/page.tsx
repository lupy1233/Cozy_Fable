'use client';

import { ArrowRight, FileText, Handshake, MapPin, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyRequests } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import { ROOM_ICONS } from '@/lib/room-icons';
import { useRelativeTime } from '@/lib/relative-time';

// "Cererile mele" pe carduri vii (feedback PO item 12), in limbajul cardurilor
// din marketplace: camere cu iconite, statusul, ateliere active + oferte, CTA
// direct spre conversatii. Tabelul anterior era doar o lista plata.

const MAX_ROOM_CHIPS = 4;

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

  if (me.isPending || list.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const rows = list.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t('myRequests')}</h1>
          {rows.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">{t('myRequestsSubtitle')}</p>
          )}
        </div>
        <Button asChild variant="walnut">
          <Link href="/requests/new">{t('newTitle')}</Link>
        </Button>
      </div>

      {rows.length === 0 && (
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
