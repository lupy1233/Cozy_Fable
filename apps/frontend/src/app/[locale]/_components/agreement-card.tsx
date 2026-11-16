'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import type { QuoteDto } from '@marketplace/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { displayedVersion } from '@/lib/quote-version';
import { cn } from '@/lib/utils';

// E-admin-platform-3 — "Acordul vostru": ce s-a convenit la acceptare (firma, pret, termen,
// garantie, data acordului), vizibil clientului si firmei castigatoare. Data de livrare
// depasita pe un proiect inca in lucru primeste semnalul "Termen depasit".
const ACTIVE_STATUSES = ['ACCEPTED', 'IN_EXECUTION'];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  // E-client-1: versiunea confirmata la accept (fallback: ultima, pe accepturile vechi)
  const current = displayedVersion(quote);
  if (!current) return null;
  const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(n);
  const other = quote.currency === 'RON' ? 'EUR' : 'RON';
  const overdue =
    !!current.deliveryDate && ACTIVE_STATUSES.includes(requestStatus) && current.deliveryDate < localToday();
  // data calendaristica (YYYY-MM-DD) afisata fara deplasare de fus orar
  const deliveryLabel = current.deliveryDate
    ? new Date(`${current.deliveryDate}T12:00:00`).toLocaleDateString()
    : null;

  const rows: { label: string; value: ReactNode }[] = [];
  if (mode === 'client') rows.push({ label: t('company'), value: quote.companyName });
  rows.push({
    label: t('price'),
    value: (
      <>
        <span className="font-mono font-medium">
          {fmt(current.price)} {quote.currency}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          ≈ {fmt(quote.currency === 'RON' ? current.priceEur : current.priceRon)} {other}
        </span>
      </>
    ),
  });
  if (current.designFee != null) {
    rows.push({
      label: t('designFee'),
      value: (
        <>
          <span className="font-mono">
            {fmt(current.designFee)} {quote.currency}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ≈ {fmt((quote.currency === 'RON' ? current.designFeeEur : current.designFeeRon) ?? 0)} {other}
          </span>
        </>
      ),
    });
    // E-client-1: totalul convenit = lucrare + proiectare (docs/03)
    rows.push({
      label: t('total'),
      value: (
        <>
          <span className="font-mono text-base font-medium">
            {fmt(current.total)} {quote.currency}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ≈ {fmt(quote.currency === 'RON' ? current.totalEur : current.totalRon)} {other}
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
      value: <span className="font-mono">{new Date(quote.acceptedAt).toLocaleDateString()}</span>,
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
