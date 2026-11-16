'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { useAdminPayments } from '@/hooks/use-billing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentErrorText } from './use-payment-error-text';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Starile urmarite in rezumat (NOT_REQUIRED = comenzi fara factura fiscala, nu se raporteaza).
const SUMMARY_STATUSES = ['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED'] as const;
type SummaryStatus = (typeof SUMMARY_STATUSES)[number];
const DOT: Record<SummaryStatus, string> = {
  PENDING: 'bg-amber',
  UPLOADED: 'bg-info',
  VALIDATED: 'bg-sage',
  REJECTED: 'bg-crimson',
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Cele doua carduri pentru contabil: starea e-Factura si exportul lunar.
export function AccountingCards({ onShowToReport }: { onShowToReport: () => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-5">
      <EInvoiceSummary onShowToReport={onShowToReport} />
      <MonthlyExport />
    </div>
  );
}

// Rezumat e-Factura: numarat pe client din comenzile platite deja incarcate (aceeasi cerere
// ca filtrul „Platite”). „De raportat” duce la lista filtrata.
function EInvoiceSummary({ onShowToReport }: { onShowToReport: () => void }) {
  const t = useTranslations('AdminPayments');
  const errorText = usePaymentErrorText();
  const titleId = useId();
  const paid = useAdminPayments('CONFIRMED');
  const counts = useMemo(() => {
    const c: Record<SummaryStatus, number> = { PENDING: 0, UPLOADED: 0, VALIDATED: 0, REJECTED: 0 };
    for (const o of paid.data ?? []) {
      if (o.eInvoiceStatus && o.eInvoiceStatus !== 'NOT_REQUIRED') c[o.eInvoiceStatus] += 1;
    }
    return c;
  }, [paid.data]);

  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="heading-section">
        {t('eInvoice.summaryTitle')}
      </h2>
      {paid.isPending && (
        <div className="flex flex-col gap-2.5">
          {SUMMARY_STATUSES.map((s) => (
            <Skeleton key={s} className="h-4 w-full" />
          ))}
        </div>
      )}
      {paid.isError && <p className="text-sm text-crimson">{errorText(paid.error)}</p>}
      {paid.isSuccess && (
        <>
          <ul className="flex flex-col gap-2 text-sm">
            {SUMMARY_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2.5">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOT[s]}`} />
                  {t(`eInvoice.status.${s}`)}
                </span>
                {s === 'PENDING' && counts.PENDING > 0 ? (
                  <button
                    type="button"
                    onClick={onShowToReport}
                    className="-my-1 inline-flex min-h-8 items-center rounded-md px-1.5 font-mono font-semibold text-walnut underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                  >
                    {counts.PENDING}
                    <span className="sr-only"> · {t('eInvoice.showPending')}</span>
                  </button>
                ) : (
                  <span className="px-1.5 font-mono">{counts[s]}</span>
                )}
              </li>
            ))}
          </ul>
          {paid.data.length > 0 && (
            <p className="text-xs text-muted-foreground">{t('eInvoice.summaryScope', { n: paid.data.length })}</p>
          )}
        </>
      )}
    </Card>
  );
}

// Registrul lunar (CSV) pentru contabil — facturile confirmate din luna aleasa (Europe/Bucharest).
function MonthlyExport() {
  const t = useTranslations('AdminPayments');
  const titleId = useId();
  const [month, setMonth] = useState(currentMonth);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="heading-section">
        {t('eInvoice.exportTitle')}
      </h2>
      <p className="text-ui text-muted-foreground">{t('eInvoice.exportHint')}</p>
      <div className="flex flex-wrap items-end gap-2.5">
        <Field label={t('eInvoice.month')}>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 w-48" />
        </Field>
        <Button
          asChild
          variant="outline"
          className="h-11 border-foreground px-5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <a href={valid ? `${API}/admin/billing/e-invoice-export?month=${month}` : undefined} aria-disabled={!valid}>
            {t('eInvoice.exportButton')}
          </a>
        </Button>
      </div>
    </Card>
  );
}
