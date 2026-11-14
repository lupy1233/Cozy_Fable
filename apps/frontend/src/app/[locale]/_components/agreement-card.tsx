'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import type { QuoteDto } from '@marketplace/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { displayedVersion } from '@/lib/quote-version';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { useQuoteDate, useQuoteMoney } from './use-quote-terms';

// E-admin-platform-3 — "Acordul vostru": ce s-a convenit la acceptare (firma, pret, termen,
// garantie, data acordului), vizibil clientului si firmei castigatoare. Data de livrare
// depasita pe un proiect inca in lucru primeste semnalul "Termen depasit".
const ACTIVE_STATUSES = ['ACCEPTED', 'IN_EXECUTION'];

// ziua de azi (YYYY-MM-DD) in ora Romaniei, nu a browserului
function bucharestToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function AgreementCard({
  quote,
  requestStatus,
  mode,
}: {
  quote: QuoteDto;
  requestStatus: string;
  mode: 'client' | 'company';
}) {
  const t = useTranslations('Fulfillment.agreement');
  const titleId = useId();
  // e7: sume si date ca pe cardul ofertei — limba aplicatiei, "lei", ora Romaniei
  const money = useQuoteMoney();
  const date = useQuoteDate();
  // E-client-1: versiunea confirmata la accept (fallback: ultima, pe accepturile vechi)
  const current = displayedVersion(quote);
  if (!current) return null;
  // a4: moneda e a variantei confirmate (o varianta noua poate fi in alta moneda)
  const currency = current.currency;
  const other = currency === 'RON' ? 'EUR' : 'RON';
  const overdue =
    !!current.deliveryDate && ACTIVE_STATUSES.includes(requestStatus) && current.deliveryDate < bucharestToday();
  // data calendaristica (YYYY-MM-DD) — useQuoteDate o ia la pranz UTC, fara zi sarita
  const deliveryLabel = current.deliveryDate ? date(current.deliveryDate) : null;

  const rows: { label: string; value: ReactNode }[] = [];
  if (mode === 'client') rows.push({ label: t('company'), value: quote.companyName });
  rows.push({
    label: t('price'),
    value: (
      <>
        <span className="font-mono font-medium">{money(current.price, currency)}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          ≈ {money(currency === 'RON' ? current.priceEur : current.priceRon, other)}
        </span>
      </>
    ),
  });
  if (current.designFee != null) {
    rows.push({
      label: t('designFee'),
      value: (
        <>
          <span className="font-mono">{money(current.designFee, currency)}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ≈ {money((currency === 'RON' ? current.designFeeEur : current.designFeeRon) ?? 0, other)}
          </span>
        </>
      ),
    });
    // E-client-1: totalul convenit = lucrare + proiectare (docs/03)
    rows.push({
      label: t('total'),
      value: (
        <>
          <span className="font-mono text-base font-medium">{money(current.total, currency)}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ≈ {money(currency === 'RON' ? current.totalEur : current.totalRon, other)}
          </span>
        </>
      ),
    });
  }
  if (deliveryLabel) {
    rows.push({ label: t('deliveryDate'), value: <span className="font-mono">{deliveryLabel}</span> });
  }
  if (current.deliveryTerm) rows.push({ label: t('deliveryTerm'), value: current.deliveryTerm });
  if (current.warranty) rows.push({ label: t('warranty'), value: current.warranty });
  if (quote.acceptedAt) {
    rows.push({
      label: t('acceptedAt'),
      value: <span className="font-mono">{date(quote.acceptedAt)}</span>,
    });
  }

  // salvie = acord incheiat; carmin doar cand data de livrare a trecut pe un proiect inca in lucru
  return (
    <Card as="section" aria-labelledby={titleId} className={cn(overdue && 'border-crimson/40')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="heading-card">
          {t('title')}
        </h2>
        {overdue ? (
          <Badge tone="crimson" dot>
            {t('overdue')}
          </Badge>
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sage" aria-hidden />
        )}
      </div>
      <dl className="mt-3 flex flex-col text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-border py-2 first:border-t-0 first:pt-0 last:pb-0"
          >
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
      {overdue && <p className="mt-3 text-sm text-crimson">{t('overdueHint')}</p>}
    </Card>
  );
}
