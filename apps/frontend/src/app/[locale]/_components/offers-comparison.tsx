'use client';

import type { ChatThreadDto, QuoteDto, RequestStatus } from '@marketplace/shared';
import { ArrowDown, MessageSquare } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BELOW_SM, useMediaQuery } from '@/components/ui/use-media-query';
import { useNow } from '@/hooks/use-now';
import { formatInCurrency, formatLei, formatRate, toLei } from '@/lib/money';
import {
  canConvertToLei,
  isLiveForBadges,
  pickFastest,
  pickLowest,
  rawTotalLei,
  totalWithVatLei,
} from '@/lib/offer-compare';
import { displayedVersion } from '@/lib/quote-version';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { COMPARE_ROW_KEYS, type CompareRowKey } from './offer-compare-rows';

// Pagina "Oferte si conversatii" (Laws of UX, PO 2026-11-08 + canvas 2026-11):
// - RequestJourney: drumul cererii in 5 pasi, pasul curent evidentiat (Goal-Gradient, Zeigarnik)
// - OffersComparison: ofertele una langa alta pe aceleasi rubrici (Jakob, Miller, Von Restorff);
//   apare de la prima oferta, coloana firmei deschise mai jos e evidentiata
// - UnreadBanner: firmele cu mesaje noi (pe pagina de oferte locul lui l-au luat pastila din
//   capul de coloana si contorul din taburi)
// Doar campuri structurate care exista in oferta; nimic inventat.

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

// data calendaristica (YYYY-MM-DD) la pranz UTC, ca sa ramana aceeasi zi in ora Romaniei;
// ISO complet ramane ca atare
const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);

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
  const format = useFormatter();
  const now = useNow(60_000);
  // j1 (etapa 8): sub 640 px tabelul devine carduri pe rubrica — un singur fel randat odata,
  // ca textele si butoanele sa nu apara de doua ori
  const asCards = useMediaQuery(BELOW_SM);

  const cols = threads.map((th) => {
    const quote = quoteByClaim.get(th.claimSlotId);
    const v = quote ? displayedVersion(quote) : undefined;
    // a4: moneda e a variantei (variantele vechi o primesc din oferta, prin backfill)
    const currency = v?.currency ?? quote?.currency ?? 'RON';
    const rate = quote?.eurRonRate ?? 0;
    // m7: fara curs pozitiv, sumele in euro nu se aduc in lei ("—", fara "≈ lei")
    const convertible = canConvertToLei(currency, rate);
    const withVatLei = v ? totalWithVatLei(v, rate) : null;
    return { th, quote, v, currency, rate, convertible, withVatLei };
  });
  // tabelul apare de la prima oferta primita; fara nicio oferta nu are ce arata
  if (!cols.some((c) => c.quote && c.v)) return null;

  // a3: insignele se calculeaza doar intre ofertele care mai pot fi alese (trimise si in
  // valabilitate / acceptate, m6); cele retrase, expirate, inlocuite sau refuzate raman in
  // tabel cu starea lor, fara insigna
  const live = cols.filter((c) => c.v && c.quote && isLiveForBadges(c.quote, c.v));
  const lowestClaim = pickLowest(
    live.map((c) => ({ id: c.th.claimSlotId, withVatLei: c.withVatLei, rawLei: rawTotalLei(c.v!, c.rate) })),
  );
  const fastestClaim = pickFastest(
    live.map((c) => ({ id: c.th.claimSlotId, workingDays: c.v!.deliveryWorkingDays })),
  );

  // cursul folosit (setarea fixa eur_ron_rate, fara data; acelasi pentru toate ofertele) — afisat cand avem euro
  // m7: nota cu cursul doar cand cursul e pozitiv
  const eurCol = cols.find((c) => c.v && c.currency === 'EUR' && c.convertible);
  const showDesign = cols.some((c) => c.v && (c.v.designFee != null || c.v.designIncludes));

  const shortDate = (iso: string, withYear = false) =>
    format.dateTime(toDate(iso), {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
      timeZone: APP_TIME_ZONE,
    });

  const cell = 'border-b border-border px-4 py-3.5 align-top text-sm sm:px-5';
  const rowHead = cn(cell, 'whitespace-nowrap text-left font-normal text-muted-foreground');
  const colBg = (claimSlotId: string) => (claimSlotId === selectedClaimSlotId ? 'bg-surface-2' : undefined);
  const dash = <span className="text-muted-foreground">—</span>;
  const sub = 'block text-meta text-muted-foreground';
  const badge = (label: string) => <span className={cn(PILL, 'bg-sage-soft text-sage')}>{label}</span>;
  const yesNo = (b: boolean | null | undefined) =>
    b == null ? dash : <span className={b ? undefined : 'text-muted-foreground'}>{b ? t('included') : t('notIncluded')}</span>;

  type Col = (typeof cols)[number];
  // continutul fiecarei rubrici; null = rubrica nu se arata (proiectarea, fara proiectare cu plata)
  const rows: Record<CompareRowKey, ((c: Col) => ReactNode) | null> = {
    price: ({ v, quote, currency, rate, convertible }) =>
      v && quote ? (
        <span className="flex flex-col items-start gap-0.5">
          <span className="font-mono text-ui tabular-nums">{formatInCurrency(v.price, currency, locale)}</span>
          {currency === 'EUR' && convertible && (
            <span className={cn(sub, 'font-mono tabular-nums')}>
              {t('approx', { amount: formatLei(toLei(v.price, 'EUR', rate), locale) })}
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('pending')}</span>
      ),
    vat: ({ v }) => {
      if (!v?.vatMode) return dash;
      if (v.vatMode === 'VAT_INCLUDED') return t('vatIncluded');
      if (v.vatMode === 'NOT_VAT_PAYER') return t('vatNotPayer');
      return (
        <span className="flex flex-col items-start gap-0.5">
          {t('vatExcluded')}
          {v.vatRatePercent != null && (
            <span className={sub}>{t('vatAdded', { rate: format.number(v.vatRatePercent) })}</span>
          )}
        </span>
      );
    },
    totalLeiVat: ({ th, v, withVatLei }) => {
      if (!v) return dash;
      if (withVatLei == null) {
        // m7: oferta in euro fara curs pozitiv — doar "—", nu "0 lei"
        if (v.totalWithVat != null) return dash;
        // oferta trimisa inainte de rubrica de TVA: nu calculam nimic
        return (
          <span className="flex flex-col items-start gap-0.5">
            {dash}
            <span className={sub}>{t('vatUnknown')}</span>
          </span>
        );
      }
      const lowest = lowestClaim === th.claimSlotId;
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('font-mono text-lead tabular-nums', lowest && 'font-medium')}>
            {formatLei(withVatLei, locale)}
          </span>
          {lowest && badge(t('lowest'))}
        </span>
      );
    },
    design: showDesign
      ? ({ v, currency, rate, convertible }) =>
          v?.designFee != null ? (
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-mono text-ui tabular-nums">{formatInCurrency(v.designFee, currency, locale)}</span>
              {currency === 'EUR' && convertible && (
                <span className={cn(sub, 'font-mono tabular-nums')}>
                  {t('approx', { amount: formatLei(toLei(v.designFee, 'EUR', rate), locale) })}
                </span>
              )}
              {v.designIncludes && <span className="text-ui">{v.designIncludes}</span>}
            </span>
          ) : (
            dash
          )
      : null,
    term: ({ th, v }) => {
      if (!v) return dash;
      const date = v.deliveryDate ? tq('deliveryBy', { date: shortDate(v.deliveryDate, true) }) : null;
      let main: ReactNode = null;
      let detail: string | null = null;
      if (v.deliveryTermValue != null && v.deliveryTermUnit) {
        main =
          v.deliveryTermUnit === 'WEEKS'
            ? t('weeks', { n: v.deliveryTermValue })
            : t('workingDays', { n: v.deliveryTermValue });
        if (v.deliveryTermUnit === 'WEEKS' && v.deliveryWorkingDays != null) {
          detail = t('termEquals', { days: t('workingDays', { n: v.deliveryWorkingDays }) });
        }
      } else if (v.deliveryTerm) {
        main = v.deliveryTerm; // oferta veche: textul firmei, fara calcul
      }
      if (!main && !date) return dash;
      return (
        <span className="flex flex-col items-start gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-ui">{main ?? date}</span>
            {fastestClaim === th.claimSlotId && badge(t('fastest'))}
          </span>
          {detail && <span className={sub}>{detail}</span>}
          {main && date && <span className={sub}>{date}</span>}
        </span>
      );
    },
    warranty: ({ v }) => {
      if (v?.warrantyMonths != null) return <span className="font-mono text-ui">{t('months', { n: v.warrantyMonths })}</span>;
      return v?.warranty ? <span className="font-mono text-ui">{v.warranty}</span> : dash;
    },
    transport: ({ v }) => (v ? yesNo(v.includesTransport) : dash),
    assembly: ({ v }) => (v ? yesNo(v.includesAssembly) : dash),
    status: ({ quote, v }) => {
      if (!quote || !v) return dash;
      if (quote.status === 'SENT' && !v.isExpired) {
        const daysLeft = Math.max(0, Math.floor((Date.parse(v.validUntil) - now) / DAY_MS));
        const soon = daysLeft <= EXPIRING_SOON_DAYS;
        return (
          <span className={soon ? 'font-medium text-amber' : undefined}>
            {t('validUntil', { date: shortDate(v.validUntil) })}
            {soon && ` · ${t('daysLeft', { n: daysLeft })}`}
          </span>
        );
      }
      // retrasa / expirata / inlocuita / refuzata (DECLINED, a4): doar starea, fara insigne
      return tq(`status.${quote.status}`);
    },
  };

  // capul firmei: numele + mesajele noi (acelasi in tabel si pe carduri)
  const firmHead = (th: ChatThreadDto) => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {th.companyName}
      {th.unreadCount > 0 && (
        <span className={cn(PILL, 'bg-crimson-soft text-crimson')}>
          {tq('unreadMessages', { n: th.unreadCount })}
        </span>
      )}
    </span>
  );

  // actiunea per firma (ultimul rand al tabelului / ultimul card)
  const actionFor = ({ th, quote }: Col) => {
    const claim = th.claimSlotId;
    const label = quote?.status === 'SENT' ? t('openAndChoose') : t('openChat');
    const openedClass =
      'inline-flex min-h-10 items-center gap-1.5 rounded-md font-semibold text-walnut-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut';
    if (claim === selectedClaimSlotId) {
      return onSelect ? (
        <button type="button" onClick={() => onSelect(claim)} className={openedClass}>
          {t('openedBelow')}
          <ArrowDown className="size-4" aria-hidden />
        </button>
      ) : (
        <a href={`#firm-${claim}`} className={openedClass}>
          {t('openedBelow')}
          <ArrowDown className="size-4" aria-hidden />
        </a>
      );
    }
    return onSelect ? (
      <Button type="button" variant="outline" size="lg" onClick={() => onSelect(claim)}>
        {label}
      </Button>
    ) : (
      <Button asChild variant="outline" size="lg">
        <a href={`#firm-${claim}`}>{label}</a>
      </Button>
    );
  };

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-b border-border px-4 py-4 sm:px-5">
      <h2 id="compare-title" className="heading-section">
        {t('title')}
      </h2>
      <span className="text-ui text-muted-foreground">{t('hint')}</span>
    </div>
  );
  const rateNote = eurCol && (
    <p className="border-t border-border bg-surface-2 px-4 py-3 text-ui text-muted-foreground sm:px-5">
      {t('rateNote', { rate: formatRate(eurCol.rate, locale) })}
    </p>
  );

  // telefon: cate un card pe rubrica, cu randul "{firma}: {valoare}" pentru fiecare firma;
  // aceleasi functii din `rows` ca tabelul (aceleasi valori, aceleasi insigne)
  if (asCards) {
    return (
      <Card as="section" padding="none" aria-labelledby="compare-title" className="overflow-hidden shadow" data-compare-cards="">
        {header}
        <ul className="flex flex-col divide-y divide-border">
          {COMPARE_ROW_KEYS.map((key) => {
            const render = rows[key];
            if (!render) return null;
            return (
              <li key={key} data-compare-rubric={key} className="px-4 py-3.5">
                <h3 className="label mb-2">{t(key)}</h3>
                <dl className="flex flex-col gap-1">
                  {cols.map((c) => (
                    <div
                      key={c.th.id}
                      className={cn(
                        '-mx-2 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 rounded-md px-2 py-1.5',
                        colBg(c.th.claimSlotId),
                      )}
                    >
                      <dt className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {c.th.companyName}
                      </dt>
                      <dd className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">{render(c)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
          <li data-compare-rubric="actions" className="px-4 py-3.5">
            <h3 className="label mb-2">{t('actionsTitle')}</h3>
            <ul className="flex flex-col gap-2.5">
              {cols.map((c) => (
                <li
                  key={c.th.id}
                  className={cn(
                    '-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md px-2 py-1.5',
                    colBg(c.th.claimSlotId),
                  )}
                >
                  <span className="min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere]">{firmHead(c.th)}</span>
                  {actionFor(c)}
                </li>
              ))}
            </ul>
          </li>
        </ul>
        {rateNote}
      </Card>
    );
  }

  return (
    <Card as="section" padding="none" aria-labelledby="compare-title" className="overflow-hidden shadow">
      {header}
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
                  {firmHead(th)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROW_KEYS.map((key) => {
              const render = rows[key];
              if (!render) return null;
              return (
                <tr key={key}>
                  {/* eticheta lunga "Total in lei, cu TVA" se poate rupe pe doua randuri (telefon) */}
                  <th scope="row" className={cn(rowHead, key === 'totalLeiVat' && 'whitespace-normal')}>
                    {t(key)}
                  </th>
                  {cols.map((c) => (
                    <td key={c.th.id} className={cn(cell, colBg(c.th.claimSlotId))}>
                      {render(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th scope="row" className={cn(rowHead, 'border-b-0')}>
                <span className="sr-only">{t('details')}</span>
              </th>
              {cols.map((c) => (
                <td key={c.th.id} className={cn(cell, 'border-b-0', colBg(c.th.claimSlotId))}>
                  {actionFor(c)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {rateNote}
    </Card>
  );
}
