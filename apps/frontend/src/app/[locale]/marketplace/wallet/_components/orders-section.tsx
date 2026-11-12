'use client';

import type { BillingOrderDto } from '@marketplace/shared';
import { CreditCard } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMoney } from '@/hooks/use-money';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { shortRef } from './order-ref';

// Culoarea spune cine are mutarea: amber = firma mai are de platit, sage = platita, muted = anulata.
const STATUS_TONE: Record<BillingOrderDto['status'], 'amber' | 'sage' | 'muted'> = {
  PENDING: 'amber',
  CONFIRMED: 'sage',
  CANCELLED: 'muted',
};

// Istoric comenzi + facturi (doar OWNER/MANAGER): reluarea platii, datele de transfer, factura PDF.
export function OrdersSection({
  pending,
  loaded,
  orders,
  stripeEnabled,
  billingReady,
  checkoutPending,
  checkoutError,
  downloadingId,
  onContinuePayment,
  onShowBankDetails,
  onDownloadInvoice,
  className,
}: {
  pending: boolean;
  loaded: boolean;
  orders: BillingOrderDto[] | undefined;
  stripeEnabled: boolean;
  billingReady: boolean;
  checkoutPending: boolean;
  checkoutError: string | null;
  downloadingId: string | null;
  onContinuePayment: (order: BillingOrderDto) => void;
  onShowBankDetails: (order: BillingOrderDto) => void;
  onDownloadInvoice: (order: BillingOrderDto) => void;
  className?: string;
}) {
  const tb = useTranslations('Billing');
  const format = useFormatter();
  const money = useMoney();

  const sourceLabel = (o: BillingOrderDto) => {
    if (o.status === 'CONFIRMED') {
      const src = o.paymentSource ?? 'admin';
      return tb.has(`source.${src}`) ? tb(`source.${src}`) : tb('source.admin');
    }
    return o.hasStripeSession || stripeEnabled ? tb('source.stripe') : tb('source.admin');
  };

  return (
    <section
      id="orders"
      aria-labelledby="wallet-orders-title"
      className={cn('flex min-w-0 scroll-mt-24 flex-col gap-4', className)}
    >
      <h2 id="wallet-orders-title" className="font-serif text-2xl leading-tight">
        {tb('orders')}
      </h2>
      {checkoutError && (
        <Alert tone="crimson" role="alert">
          {checkoutError}
        </Alert>
      )}
      <Card padding="none" className="overflow-hidden">
        {pending && (
          <div className="p-5">
            <SkeletonList rows={3} />
          </div>
        )}
        {loaded && orders?.length === 0 && <EmptyState size="sm" variant="plain" title={tb('noOrders')} />}
        {orders && orders.length > 0 && (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {o.orderType === 'SUBSCRIPTION'
                      ? tb('planLabel', { tier: o.planTier ?? '' })
                      : tb('packageLabel', { n: o.credits ?? 0 })}
                    {' · '}
                    <span className="font-mono text-ui">{money(o.totalRon)}</span>
                  </span>
                  <span className="data-mono text-muted-foreground">
                    {format.dateTime(new Date(o.createdAt), { dateStyle: 'medium' })} · {sourceLabel(o)} · #
                    {shortRef(o.id)}
                  </span>
                  {o.testMode && <span className="text-xs text-muted-foreground">{tb('testOrder')}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge tone={STATUS_TONE[o.status]} dot>
                    {tb(`orderStatus.${o.status}`)}
                  </Badge>
                  {o.status === 'PENDING' && o.paymentClaimedAt && (
                    <Badge tone="info">{tb('paymentReported')}</Badge>
                  )}
                  {o.testMode && <Badge tone="amber">{tb('testBadge')}</Badge>}
                  {o.status === 'PENDING' && stripeEnabled && (
                    <Button
                      type="button"
                      size="lg"
                      disabled={checkoutPending || !billingReady}
                      onClick={() => onContinuePayment(o)}
                    >
                      <CreditCard aria-hidden /> {tb('continuePayment')}
                    </Button>
                  )}
                  {o.status === 'PENDING' && !stripeEnabled && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-11 px-0 text-walnut"
                      onClick={() => onShowBankDetails(o)}
                    >
                      {tb('bankTransfer.show')}
                    </Button>
                  )}
                  {o.status === 'CONFIRMED' && o.invoiceLabel && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-11 px-0 text-walnut"
                      disabled={downloadingId === o.id}
                      aria-busy={downloadingId === o.id}
                      onClick={() => onDownloadInvoice(o)}
                    >
                      {tb('invoice')} {o.invoiceLabel}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
