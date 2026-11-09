'use client';

import type { ChatThreadDto, QuoteDto, RequestStatus } from '@marketplace/shared';
import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { displayedVersion } from '@/lib/quote-version';
import { cn } from '@/lib/utils';

// Pagina "Oferte si conversatii" dupa Laws of UX (PO 2026-11-08):
// - RequestJourney: drumul cererii in 5 pasi, pasul curent evidentiat (Goal-Gradient, Zeigarnik)
// - UnreadBanner: firmele cu mesaje noi, primele (Serial Position, Selective Attention)
// - OffersComparison: ofertele una langa alta pe aceleasi rubrici (Jakob, Miller, Von Restorff)
// Doar campuri structurate care exista in oferta; nimic calculat in plus.

const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(n);

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
  return (
    <nav aria-label={t('label')} className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <ol className="grid grid-cols-5 gap-1.5">
        {JOURNEY_KEYS.map((k, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={k} aria-current={here ? 'step' : undefined} className="flex flex-col gap-1.5">
              <span
                aria-hidden
                className={cn('h-1.5 rounded-full', done ? 'bg-sage' : here ? 'bg-walnut' : 'bg-surface-3')}
              />
              <span
                className={cn(
                  'text-meta leading-tight sm:text-xs',
                  here ? 'font-semibold text-foreground' : done ? 'text-muted-foreground' : 'text-muted-2',
                )}
              >
                {t(k)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
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

export function OffersComparison({
  threads,
  quoteByClaim,
}: {
  threads: ChatThreadDto[];
  quoteByClaim: Map<string, QuoteDto>;
}) {
  const t = useTranslations('Quotes.compare');
  const tq = useTranslations('Quotes');

  const cols = threads.map((th) => {
    const quote = quoteByClaim.get(th.claimSlotId);
    const v = quote ? displayedVersion(quote) : undefined;
    return { th, quote, v };
  });
  const priced = cols.filter((c) => c.v && c.quote && ['SENT', 'ACCEPTED'].includes(c.quote.status));
  // tabelul are sens abia cand exista ce compara
  if (priced.length < 2) return null;

  // comparam in RON ca sa nu amestecam monede; eticheta "cel mai mic" doar daca e unic
  const totals = priced.map((c) => c.v!.totalRon);
  const min = Math.min(...totals);
  const lowestClaim = totals.filter((x) => x === min).length === 1 ? priced[totals.indexOf(min)].th.claimSlotId : null;

  const cell = 'border-b border-border-2 px-3 py-2.5 align-top text-sm';
  const head = cn(cell, 'whitespace-nowrap font-normal text-muted-foreground');
  const dash = <span className="text-muted-2">—</span>;

  return (
    <section aria-labelledby="compare-title" className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-2 px-4 py-3">
        <h2 id="compare-title" className="font-serif text-lg">
          {t('title')}
        </h2>
        <span className="text-xs text-muted-foreground">{t('hint')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className={cell}>
                <span className="sr-only">{t('field')}</span>
              </th>
              {cols.map(({ th }) => (
                <th key={th.id} scope="col" className={cn(cell, 'font-semibold')}>
                  {th.companyName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={head}>{t('total')}</th>
              {cols.map(({ th, quote, v }) => (
                <td key={th.id} className={cn(cell, 'font-mono tabular-nums')}>
                  {v && quote ? (
                    <>
                      {fmt(v.total)} {quote.currency}
                      {lowestClaim === th.claimSlotId && (
                        <span className="ml-1.5 inline-block rounded-full bg-sage-soft px-2 py-0.5 font-sans text-micro font-semibold text-sage">
                          {t('lowest')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-sans text-muted-2">{t('pending')}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={head}>{t('term')}</th>
              {cols.map(({ th, v }) => (
                <td key={th.id} className={cell}>
                  {v?.deliveryTerm || (v?.deliveryDate ? new Date(v.deliveryDate).toLocaleDateString('ro-RO') : dash)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={head}>{t('warranty')}</th>
              {cols.map(({ th, v }) => (
                <td key={th.id} className={cell}>
                  {v?.warranty || dash}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={head}>{t('status')}</th>
              {cols.map(({ th, quote, v }) => (
                <td key={th.id} className={cell}>
                  {quote && v
                    ? quote.status === 'SENT' && !v.isExpired
                      ? t('validUntil', { date: new Date(v.validUntil).toLocaleDateString('ro-RO') })
                      : tq(`status.${quote.status}`)
                    : dash}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={cn(head, 'border-b-0')}>
                <span className="sr-only">{t('details')}</span>
              </th>
              {cols.map(({ th, quote }) => (
                <td key={th.id} className={cn(cell, 'border-b-0')}>
                  <a
                    href={`#firm-${th.claimSlotId}`}
                    className={cn(
                      'inline-flex min-h-[40px] items-center rounded-md px-3 text-sm font-medium transition-colors',
                      quote?.status === 'SENT'
                        ? 'bg-walnut text-on-walnut hover:bg-walnut-deep'
                        : 'border border-border-2 text-foreground hover:bg-secondary',
                    )}
                  >
                    {quote?.status === 'SENT' ? t('openAndChoose') : t('openChat')}
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
