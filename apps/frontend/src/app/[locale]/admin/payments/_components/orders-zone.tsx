'use client';

import type { AdminBillingOrderItemDto, EInvoiceStatus } from '@marketplace/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useMoney } from '@/hooks/use-money';
import { formatAmount } from '@/lib/money';
import { useAdminPayments, useCancelPayment, useConfirmPayment } from '@/hooks/use-billing';
import { apiBlob } from '@/lib/api';
import { saveBlob } from '@/lib/download';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { EInvoiceDialog } from './e-invoice-dialog';
import { usePaymentErrorText } from './use-payment-error-text';

export const ORDER_STATUS_FILTERS = ['PENDING', 'CONFIRMED', 'CANCELLED', 'all'] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
type PendingAction = { kind: 'confirm' | 'cancel'; order: AdminBillingOrderItemDto };

// E-admin-platform-4 — e-Factura (ruta manuala pana la decizia PO)
const E_INVOICE_TONE: Record<EInvoiceStatus, 'amber' | 'info' | 'sage' | 'crimson' | 'muted'> = {
  PENDING: 'amber',
  UPLOADED: 'info',
  VALIDATED: 'sage',
  REJECTED: 'crimson',
  NOT_REQUIRED: 'muted',
};

// E-company-24: firma a apasat "Am platit" — de verificat in extrasul bancar
const isFlagged = (o: AdminBillingOrderItemDto) => o.status === 'PENDING' && !!o.paymentClaimedAt;
// confirmarea manuala e DOAR pentru transfer bancar (comenzi PENDING fara sesiune Stripe)
const isBankPending = (o: AdminBillingOrderItemDto) => o.status === 'PENDING' && !o.hasStripeSession;

// Zona „Comenzi”: filtru pe stare, tabelul comenzilor, confirmare / anulare (cu dialog) si
// actualizarea starii e-Factura. Platile Stripe se confirma automat prin webhook.
export function OrdersZone({
  status,
  onStatusChange,
  eInvoiceOnly,
  onEInvoiceOnlyChange,
}: {
  status: OrderStatusFilter;
  onStatusChange: (status: OrderStatusFilter) => void;
  /** doar facturile de raportat in e-Factura (filtru pe client, peste comenzile platite) */
  eInvoiceOnly: boolean;
  onEInvoiceOnlyChange: (value: boolean) => void;
}) {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const errorText = usePaymentErrorText();
  const list = useAdminPayments(status === 'all' ? undefined : status);
  // contorul de pe „In asteptare” (aceeasi cerere ca lista cand filtrul e PENDING)
  const pendingList = useAdminPayments('PENDING');
  const confirm = useConfirmPayment();
  const cancel = useCancelPayment();
  const [action, setAction] = useState<PendingAction | null>(null);
  const [eInvoiceOrder, setEInvoiceOrder] = useState<AdminBillingOrderItemDto | null>(null);
  // E-company-19: PDF-ul facturii prin sesiune (refresh la 401) + nume factura-{serie}-{numar}.pdf
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  async function downloadInvoice(o: AdminBillingOrderItemDto) {
    setDownloadingId(o.id);
    try {
      const blob = await apiBlob(`/admin/payments/${o.id}/invoice`);
      saveBlob(blob, `factura-${o.invoiceLabel}.pdf`);
    } catch {
      toast.error(t('eInvoice.pdfFailed'));
    } finally {
      setDownloadingId(null);
    }
  }

  const toReportOnly = eInvoiceOnly && status === 'CONFIRMED';
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const visible = toReportOnly ? data.filter((o) => o.eInvoiceStatus === 'PENDING') : data;
    // cele semnalate de firme ca platite stau sus; restul isi pastreaza ordinea de la server
    return [...visible.filter(isFlagged), ...visible.filter((o) => !isFlagged(o))];
  }, [list.data, toReportOnly]);
  // un singur buton de brand pe ecran: prima comanda de confirmat din lista
  const primaryId = rows.find(isBankPending)?.id;
  const hasInvoiceCol = rows.some((o) => o.status === 'CONFIRMED' || !!o.invoiceLabel);

  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const detailOf = (o: AdminBillingOrderItemDto) =>
    o.orderType === 'SUBSCRIPTION'
      ? t('planLabel', { tier: o.planTier ?? '' })
      : t('packageLabel', { n: o.credits ?? 0 });
  const sourceOf = (o: AdminBillingOrderItemDto) => {
    if (o.status === 'CONFIRMED') {
      const src = o.paymentSource ?? 'admin';
      return t.has(`source.${src}`) ? t(`source.${src}`) : src;
    }
    return o.hasStripeSession ? t('source.stripe') : t('source.bank');
  };
  const isBusy = confirm.isPending || cancel.isPending;

  const runAction = () => {
    if (!action) return;
    const m = action.kind === 'confirm' ? confirm : cancel;
    m.mutate(action.order.id, {
      onSuccess: () => {
        toast.success(action.kind === 'confirm' ? t('confirmedToast') : t('cancelledToast'));
        setAction(null);
      },
      onError: (err) => toast.error(errorText(err)),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <FilterChips
          label={t('statusFilterLabel')}
          value={status}
          onChange={(v) => {
            if (!v) return;
            onEInvoiceOnlyChange(false);
            onStatusChange(v);
          }}
          options={ORDER_STATUS_FILTERS.map((v) => ({
            value: v,
            label: t(`tabs.${v}`),
            count: v === 'PENDING' ? pendingList.data?.length : undefined,
          }))}
        />
        {(status === 'PENDING' || status === 'all') && (
          <span className="text-ui text-muted-foreground">{t('flaggedFirst')}</span>
        )}
      </div>

      {toReportOnly && (
        <Alert
          tone="info"
          action={
            <Button variant="outline" size="sm" className="shrink-0 self-center" onClick={() => onEInvoiceOnlyChange(false)}>
              {t('eInvoice.showAllPaid')}
            </Button>
          }
        >
          {t('eInvoice.pendingOnly')}
        </Alert>
      )}

      <div>
        {list.isPending && <SkeletonTable rows={6} cols={6} />}
        {list.isError && <Alert tone="crimson">{errorText(list.error)}</Alert>}
        {list.isSuccess && rows.length === 0 && <EmptyState variant="card" size="sm" title={t('empty')} />}
        {rows.length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <Table className="min-w-[900px] [&_td]:align-middle [&_th]:bg-surface-2">
              <THead>
                <TR>
                  <TH scope="col">{t('col.company')}</TH>
                  <TH scope="col">{t('col.detail')}</TH>
                  <TH scope="col" className="text-right">
                    {t('col.total')}
                  </TH>
                  <TH scope="col">{t('col.payment')}</TH>
                  <TH scope="col">{t('col.status')}</TH>
                  {hasInvoiceCol && <TH scope="col">{t('col.invoice')}</TH>}
                  <TH scope="col" className="text-right">
                    {t('col.actions')}
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <span className="block font-semibold">{o.companyName}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                    </TD>
                    <TD>{detailOf(o)}</TD>
                    <TD className="text-right">
                      <span className="block font-mono text-sm font-medium">{money(o.totalRon)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t('vatIncluded', { base: formatAmount(o.baseAmountRon, locale), rate: o.vatRate })}
                      </span>
                    </TD>
                    <TD>
                      <span className="block">{sourceOf(o)}</span>
                      <span className="block whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {fmtDate(o.createdAt)}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge
                          tone={o.status === 'CONFIRMED' ? 'sage' : o.status === 'CANCELLED' ? 'muted' : 'amber'}
                          dot
                        >
                          {t(`status.${o.status}`)}
                        </Badge>
                        {o.testMode && <Badge tone="amber">{t('testOrder')}</Badge>}
                      </span>
                      {isFlagged(o) && o.paymentClaimedAt && (
                        <span className="mt-1 block text-xs font-semibold text-info">
                          {t('paymentReported', { date: fmtDate(o.paymentClaimedAt) })}
                        </span>
                      )}
                    </TD>
                    {hasInvoiceCol && (
                      <TD>
                        {o.invoiceLabel && (
                          <span className="block whitespace-nowrap font-mono text-xs">
                            {o.invoiceLabel}
                            {o.status === 'CONFIRMED' && (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  className="text-walnut underline-offset-2 hover:underline disabled:opacity-50"
                                  disabled={downloadingId === o.id}
                                  aria-busy={downloadingId === o.id}
                                  onClick={() => void downloadInvoice(o)}
                                >
                                  {t('eInvoice.pdf')}
                                </button>
                              </>
                            )}
                          </span>
                        )}
                        {o.status === 'CONFIRMED' && o.eInvoiceStatus && (
                          <span className="mt-1 flex flex-col items-start gap-1">
                            <Badge tone={E_INVOICE_TONE[o.eInvoiceStatus]}>
                              {t(`eInvoice.status.${o.eInvoiceStatus}`)}
                            </Badge>
                            {o.anafUploadId && (
                              <span className="font-mono text-meta text-muted-foreground">{o.anafUploadId}</span>
                            )}
                            {!o.testMode && o.invoiceLabel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="-ml-2 px-2 text-walnut"
                                onClick={() => setEInvoiceOrder(o)}
                              >
                                {t('eInvoice.update')}
                              </Button>
                            )}
                          </span>
                        )}
                      </TD>
                    )}
                    <TD className="whitespace-nowrap text-right">
                      {isBankPending(o) && (
                        <Button
                          size="lg"
                          variant={o.id === primaryId ? 'walnut' : 'outline'}
                          className="px-3.5"
                          disabled={isBusy}
                          onClick={() => setAction({ kind: 'confirm', order: o })}
                        >
                          {t('confirm')}
                        </Button>
                      )}
                      {o.status === 'PENDING' && o.hasStripeSession && (
                        <span className="text-ui text-muted-foreground">{t('awaitingStripe')}</span>
                      )}
                      {/* anularea e discreta (text) si cere confirmare */}
                      {o.status === 'PENDING' && (
                        <Button
                          size="lg"
                          variant="ghost"
                          className="ml-1 px-2.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
                          disabled={isBusy}
                          onClick={() => setAction({ kind: 'cancel', order: o })}
                        >
                          {t('cancel')}
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {eInvoiceOrder && (
        <EInvoiceDialog key={eInvoiceOrder.id} order={eInvoiceOrder} onClose={() => setEInvoiceOrder(null)} />
      )}

      {/* Confirmare actiune (ireversibila la confirm: emite factura + livreaza) */}
      <Dialog open={action !== null} onOpenChange={(open) => !open && !isBusy && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.kind === 'confirm' ? t('confirmDialogTitle') : t('cancelDialogTitle')}</DialogTitle>
            <DialogDescription>
              {action &&
                (action.kind === 'confirm'
                  ? t('confirmDialogDesc', {
                      company: action.order.companyName,
                      detail: detailOf(action.order),
                      total: money(action.order.totalRon),
                    })
                  : t('cancelDialogDesc', {
                      company: action.order.companyName,
                      detail: detailOf(action.order),
                    }))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isBusy} onClick={() => setAction(null)}>
              {t('back')}
            </Button>
            <Button
              variant={action?.kind === 'confirm' ? 'walnut' : 'destructive'}
              disabled={isBusy}
              onClick={runAction}
            >
              {action?.kind === 'confirm' ? t('confirmDialogCta') : t('cancelDialogCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
