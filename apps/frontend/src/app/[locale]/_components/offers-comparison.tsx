'use client';

import type { ChatThreadDto, QuoteDto, QuoteVersionDto, RequestStatus } from '@marketplace/shared';
import { ArrowDown, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { displayedVersion } from '@/lib/quote-version';
import { cn } from '@/lib/utils';

// Pagina "Oferte si conversatii" (Laws of UX, PO 2026-11-08 + canvas 2026-11):
// - RequestJourney: drumul cererii in 5 pasi, pasul curent evidentiat (Goal-Gradient, Zeigarnik)
// - OffersComparison: ofertele una langa alta pe aceleasi rubrici (Jakob, Miller, Von Restorff);
//   apare de la prima oferta, coloana firmei deschise mai jos e evidentiata
// - UnreadBanner: firmele cu mesaje noi (pe pagina de oferte locul lui l-au luat pastila din
//   capul de coloana si contorul din taburi)
// Doar campuri structurate care exista in oferta; nimic inventat.

const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(n);

const DAY_MS = 86_400_000;
// sub acest prag valabilitatea e semnalata cu chihlimbar + zilele ramase
const EXPIRING_SOON_DAYS = 3;

// pasul din drum pentru fiecare status; null = cerere iesita din drum (expirata, anulata, disputa)
const JOURNEY_STEP: Partial<Record<RequestStatus, number>> = {
  IN_MARKETPLACE: 0,
  CLAIMED_PARTIAL: 1,
  CLAIMED_FULL: 1,
  OFFERS_RECEIVED: 2,
  NEGOTIATION: 2,
  ACCEPTED: 3,
  IN_EXECUTION: 3,
  DELIVERED_BY_COMPANY: 4,
  COMPLETED: 4,
};
const JOURNEY_KEYS = ['published', 'claimed', 'offers', 'chosen', 'done'] as const;

export function RequestJourney({ status }: { status: RequestStatus }) {
  const t = useTranslations('Quotes.journey');
  const current = JOURNEY_STEP[status];
  if (current === undefined) return null;
  // comanda finalizata: si ultimul pas e incheiat
  const finished = status === 'COMPLETED';
  return (
    <ol aria-label={t('label')} className="grid grid-cols-5 gap-1.5">
      {JOURNEY_KEYS.map((k, i) => {
        const done = i < current || finished;
        const here = i === current;
        return (
          <li key={k} aria-current={here ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden
              className={cn('h-1 rounded-full', done ? 'bg-sage' : here ? 'bg-walnut' : 'bg-border-2')}
            />
            <span
              className={cn(
                'text-meta leading-tight sm:text-ui',
                done
                  ? 'font-medium text-sage'
                  : here
                    ? 'font-semibold text-walnut'
                    : 'text-muted-foreground',
              )}
            >
              {t(k)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function UnreadBanner({ threads }: { threads: ChatThreadDto[] }) {
  const t = useTranslations('Quotes');
  const unread = threads.filter((th) => th.unreadCount > 0);
  if (unread.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-crimson/25 bg-crimson-soft px-4 py-3">
      {unread.map((th) => (
        <a
          key={th.id}
          href={`#firm-${th.claimSlotId}`}
          className="flex items-center gap-2 text-sm font-medium text-crimson hover:underline"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          {t('unreadFrom', { company: th.companyName, n: th.unreadCount })}
        </a>
      ))}
    </div>
  );
}

// data calendaristica (YYYY-MM-DD) fara deplasare de fus orar; ISO complet ramane ca atare
const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);

const PILL = 'inline-flex items-center rounded-full px-2 py-px text-xs font-medium';

export function OffersComparison({
  threads,
  quoteByClaim,
  selectedClaimSlotId,
  onSelect,
}: {
  threads: ChatThreadDto[];
  quoteByClaim: Map<string, QuoteDto>;
  // firma deschisa mai jos pe pagina — coloana ei e evidentiata
  selectedClaimSlotId?: string | null;
  // cu onSelect actiunile din ultimul rand sunt butoane (pagina arata o firma pe rand);
  // fara el raman ancore spre #firm-<claimSlotId>
  onSelect?: (claimSlotId: string) => void;
}) {
  const t = useTranslations('Quotes.compare');
  const tq = useTranslations('Quotes');
  const locale = useLocale();
  const now = useNow(60_000);

  const cols = threads.map((th) => {
    const quote = quoteByClaim.get(th.claimSlotId);
    const v = quote ? displayedVersion(quote) : undefined;
    return { th, quote, v };
  });
  // tabelul apare de la prima oferta primita; fara nicio oferta nu are ce arata
  if (!cols.some((c) => c.quote && c.v)) return null;

  const priced = cols.filter((c) => c.v && c.quote && ['SENT', 'ACCEPTED'].includes(c.quote.status));

  // comparam in RON ca sa nu amestecam monede; eticheta "cel mai mic" doar daca e unic
  const totals = priced.map((c) => c.v!.totalRon);
  const min = Math.min(...totals);
  const lowestClaim =
    priced.length > 1 && totals.filter((x) => x === min).length === 1
      ? priced[totals.indexOf(min)].th.claimSlotId
      : null;

  // "cel mai rapid" doar cand TOATE ofertele comparate au data de livrare (camp structurat)
  // si cea mai apropiata e unica; termenul scris liber ("6 saptamani") nu se poate compara
  const dates = priced.map((c) => c.v!.deliveryDate);
  const earliest = priced.length > 1 && dates.every(Boolean) ? [...dates].sort()[0] : null;
  const fastestClaim =
    earliest && dates.filter((d) => d === earliest).length === 1
      ? priced[dates.indexOf(earliest)].th.claimSlotId
      : null;

  const shortDate = (iso: string, withYear = false) =>
    toDate(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
    });
  const termOf = (v: QuoteVersionDto) =>
    [v.deliveryTerm, v.deliveryDate ? shortDate(v.deliveryDate, true) : null].filter(Boolean).join(' · ');

  const cell = 'border-b border-border px-4 py-3.5 align-top text-sm sm:px-5';
  const rowHead = cn(cell, 'whitespace-nowrap text-left font-normal text-muted-foreground');
  const colBg = (claimSlotId: string) => (claimSlotId === selectedClaimSlotId ? 'bg-surface-2' : undefined);
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <Card as="section" padding="none" aria-labelledby="compare-title" className="overflow-hidden shadow">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-b border-border px-4 py-4 sm:px-5">
        <h2 id="compare-title" className="heading-section">
          {t('title')}
        </h2>
        <span className="text-ui text-muted-foreground">{t('hint')}</span>
      </div>
      <div className="overflow-x-auto">
        <table
          className={cn(
            'w-full border-collapse text-left',
            cols.length >= 3 ? 'min-w-[720px]' : cols.length === 2 ? 'min-w-[520px]' : undefined,
          )}
        >
          <thead>
            <tr>
              <th scope="col" className={cn(cell, 'w-[16%]')}>
                <span className="label">{t('field')}</span>
              </th>
              {cols.map(({ th }) => (
                <th key={th.id} scope="col" className={cn(cell, 'font-semibold', colBg(th.claimSlotId))}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {th.companyName}
                    {th.unreadCount > 0 && (
                      <span className={cn(PILL, 'bg-crimson-soft text-crimson')}>
                        {tq('unreadMessages', { n: th.unreadCount })}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={rowHead}>
                {t('total')}
              </th>
              {cols.map(({ th, quote, v }) => (
                <td key={th.id} className={cn(cell, colBg(th.claimSlotId))}>
                  {v && quote ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'font-mono text-lead tabular-nums',
                          lowestClaim === th.claimSlotId && 'font-medium',
                        )}
                      >
                        {fmt(v.total)} {quote.currency}
                      </span>
                      {lowestClaim === th.claimSlotId && (
                        <span className={cn(PILL, 'bg-sage-soft text-sage')}>{t('lowest')}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('pending')}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rowHead}>
                {t('term')}
              </th>
              {cols.map(({ th, v }) => {
                const term = v ? termOf(v) : '';
                return (
                  <td key={th.id} className={cn(cell, colBg(th.claimSlotId))}>
                    {term ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-ui">{term}</span>
                        {fastestClaim === th.claimSlotId && (
                          <span className={cn(PILL, 'bg-sage-soft text-sage')}>{t('fastest')}</span>
                        )}
                      </span>
                    ) : (
                      dash
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className={rowHead}>
                {t('warranty')}
              </th>
              {cols.map(({ th, v }) => (
                <td key={th.id} className={cn(cell, colBg(th.claimSlotId))}>
                  {v?.warranty ? <span className="font-mono text-ui">{v.warranty}</span> : dash}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rowHead}>
                {t('status')}
              </th>
              {cols.map(({ th, quote, v }) => {
                let content: ReactNode = dash;
                if (quote && v) {
                  if (quote.status === 'SENT' && !v.isExpired) {
                    const daysLeft = Math.max(0, Math.floor((Date.parse(v.validUntil) - now) / DAY_MS));
                    const soon = daysLeft <= EXPIRING_SOON_DAYS;
                    content = (
                      <span className={soon ? 'font-medium text-amber' : undefined}>
                        {t('validUntil', { date: shortDate(v.validUntil) })}
                        {soon && ` · ${t('daysLeft', { n: daysLeft })}`}
                      </span>
                    );
                  } else {
                    content = tq(`status.${quote.status}`);
                  }
                }
                return (
                  <td key={th.id} className={cn(cell, colBg(th.claimSlotId))}>
                    {content}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className={cn(rowHead, 'border-b-0')}>
                <span className="sr-only">{t('details')}</span>
              </th>
              {cols.map(({ th, quote }) => {
                const claim = th.claimSlotId;
                const label = quote?.status === 'SENT' ? t('openAndChoose') : t('openChat');
                const openedClass =
                  'inline-flex min-h-10 items-center gap-1.5 rounded-md font-semibold text-walnut-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut';
                return (
                  <td key={th.id} className={cn(cell, 'border-b-0', colBg(claim))}>
                    {claim === selectedClaimSlotId ? (
                      onSelect ? (
                        <button type="button" onClick={() => onSelect(claim)} className={openedClass}>
                          {t('openedBelow')}
                          <ArrowDown className="size-4" aria-hidden />
                        </button>
                      ) : (
                        <a href={`#firm-${claim}`} className={openedClass}>
                          {t('openedBelow')}
                          <ArrowDown className="size-4" aria-hidden />
                        </a>
                      )
                    ) : onSelect ? (
                      <Button type="button" variant="outline" size="lg" onClick={() => onSelect(claim)}>
                        {label}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="lg">
                        <a href={`#firm-${claim}`}>{label}</a>
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
