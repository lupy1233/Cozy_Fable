'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { QuoteDto } from '@marketplace/shared';
import { Badge } from '@/components/ui/badge';
import { displayedVersion } from '@/lib/quote-version';

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
        <span className="font-semibold tabular-nums">
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
          <span className="tabular-nums">
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
          <span className="font-serif text-base font-semibold tabular-nums">
            {fmt(current.total)} {quote.currency}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ≈ {fmt(quote.currency === 'RON' ? current.totalEur : current.totalRon)} {other}
          </span>
        </>
      ),
    });
  }
  if (deliveryLabel) rows.push({ label: t('deliveryDate'), value: deliveryLabel });
  if (current.deliveryTerm) rows.push({ label: t('deliveryTerm'), value: current.deliveryTerm });
  if (current.warranty) rows.push({ label: t('warranty'), value: current.warranty });
  if (quote.acceptedAt) {
    rows.push({ label: t('acceptedAt'), value: new Date(quote.acceptedAt).toLocaleDateString() });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg">{t('title')}</h2>
        {overdue && (
          <Badge tone="crimson" dot>
            {t('overdue')}
          </Badge>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
      {overdue && <p className="mt-3 text-sm text-crimson">{t('overdueHint')}</p>}
    </section>
  );
}
