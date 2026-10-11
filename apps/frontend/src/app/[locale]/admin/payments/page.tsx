'use client';

import type { AdminBillingOrderItemDto, EInvoiceStatus } from '@marketplace/shared';
import { Info } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMoney } from '@/hooks/use-money';
import { formatAmount } from '@/lib/money';
import { useAdminCompanies } from '@/hooks/use-company';
import { useAdminPlans } from '@/hooks/use-admin';
import { planDisplayName } from '@/lib/plan-label';
import {
  useAdminPayments,
  useAdminSubscriptions,
  useCancelPayment,
  useConfirmPayment,
  useGrantSubscription,
  useUpdateEInvoice,
} from '@/hooks/use-billing';
import { ApiError, apiBlob } from '@/lib/api';
import { saveBlob } from '@/lib/download';
import { Alert } from '@/components/ui/alert';
import { Badge, TierBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonPage, SkeletonTable } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';

type StatusTab = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'all';
type PendingAction = { kind: 'confirm' | 'cancel'; order: AdminBillingOrderItemDto };

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// E-admin-platform-4 — e-Factura (ruta manuala pana la decizia PO)
const E_INVOICE_TONE: Record<EInvoiceStatus, 'amber' | 'info' | 'sage' | 'crimson' | 'muted'> = {
  PENDING: 'amber',
  UPLOADED: 'info',
  VALIDATED: 'sage',
  REJECTED: 'crimson',
  NOT_REQUIRED: 'muted',
};
const EDITABLE_E_INVOICE = ['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED'] as const;
type EditableEInvoice = (typeof EDITABLE_E_INVOICE)[number];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Plati + abonamente (consola admin). Platile Stripe se confirma automat prin webhook;
// confirmarea manuala e DOAR pentru transfer bancar (comenzi PENDING fara sesiune Stripe).
export default function AdminPaymentsPage() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const router = useRouter();
  const me = useMe();
  const [tab, setTab] = useState<StatusTab>('PENDING');
  const list = useAdminPayments(tab === 'all' ? undefined : tab);
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

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) return <SkeletonPage variant="table" />;

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
  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={
          <span className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> {t('stripeNote')}
          </span>
        }
      />

      <MonthlyExport />

      <Tabs
        panelId="admin-payment-results"
        label={t('title')}
        current={tab}
        onChange={(v) => setTab(v as StatusTab)}
        tabs={(['PENDING', 'CONFIRMED', 'CANCELLED', 'all'] as const).map((v) => ({
          value: v,
          label: t(`tabs.${v}`),
        }))}
      />

      <div id="admin-payment-results" role="tabpanel" aria-labelledby={`admin-payment-results-tab-${tab}`} tabIndex={0}>
      {list.isPending && <SkeletonTable rows={6} cols={7} />}
      {list.isError && <Alert tone="crimson">{errorText(list.error)}</Alert>}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('empty')} />
      )}
      {list.data && list.data.length > 0 && (
        <Card padding="none">
          <Table>
            <THead>
              <TR>
                <TH>{t('col.company')}</TH>
                <TH>{t('col.detail')}</TH>
                <TH className="text-right">{t('col.total')}</TH>
                <TH>{t('col.date')}</TH>
                <TH>{t('col.source')}</TH>
                <TH>{t('col.status')}</TH>
                <TH>{t('col.eInvoice')}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.data.map((o) => {
                const bankPending = o.status === 'PENDING' && !o.hasStripeSession;
                return (
                  <TR key={o.id}>
                    <TD>
                      <span className="font-medium">{o.companyName}</span>
                      <span className="block font-mono text-meta text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</span>
                    </TD>
                    <TD>
                      <span className="block">{t(`orderType.${o.orderType}`)}</span>
                      <span className="text-xs text-muted-foreground">{detailOf(o)}</span>
                    </TD>
                    <TD className="text-right font-mono">
                      <span className="block">{money(o.totalRon)}</span>
                      <span className="text-meta text-muted-foreground">
                        {t('vatIncluded', { base: formatAmount(o.baseAmountRon, locale), rate: o.vatRate })}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {format.dateTime(new Date(o.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                    </TD>
                    <TD>
                      <Badge tone={o.hasStripeSession || o.paymentSource === 'stripe' ? 'info' : 'muted'}>
                        {sourceOf(o)}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge
                        tone={o.status === 'CONFIRMED' ? 'sage' : o.status === 'CANCELLED' ? 'muted' : 'amber'}
                        dot
                      >
                        {t(`status.${o.status}`)}
                      </Badge>
                      {o.testMode && (
                        <Badge tone="amber" className="ml-1">
                          {t('testOrder')}
                        </Badge>
                      )}
                      {/* E-company-24: firma a apasat "Am platit" — de verificat in extrasul bancar */}
                      {o.status === 'PENDING' && o.paymentClaimedAt && (
                        <Badge tone="info" className="mt-1 block w-fit">
                          {t('paymentReported', {
                            date: format.dateTime(new Date(o.paymentClaimedAt), { dateStyle: 'medium', timeStyle: 'short' }),
                          })}
                        </Badge>
                      )}
                      {o.invoiceLabel && (
                        <span className="block font-mono text-meta text-muted-foreground">
                          {o.invoiceLabel}
                          {o.status === 'CONFIRMED' && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                className="text-walnut hover:underline disabled:opacity-50"
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
                    </TD>
                    <TD>
                      {o.status === 'CONFIRMED' && o.eInvoiceStatus && (
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={E_INVOICE_TONE[o.eInvoiceStatus]}>{t(`eInvoice.status.${o.eInvoiceStatus}`)}</Badge>
                          {o.anafUploadId && (
                            <span className="font-mono text-meta text-muted-foreground">{o.anafUploadId}</span>
                          )}
                          {!o.testMode && o.invoiceLabel && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEInvoiceOrder(o)}>
                              {t('eInvoice.update')}
                            </Button>
                          )}
                        </div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      {bankPending && (
                        <Button
                          size="sm"
                          className="bg-sage text-white hover:brightness-110"
                          disabled={isBusy}
                          onClick={() => setAction({ kind: 'confirm', order: o })}
                        >
                          {t('confirm')}
                        </Button>
                      )}
                      {o.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 text-crimson"
                          disabled={isBusy}
                          onClick={() => setAction({ kind: 'cancel', order: o })}
                        >
                          {t('cancel')}
                        </Button>
                      )}
                      {o.status === 'PENDING' && o.hasStripeSession && (
                        <span className="block text-meta text-muted-foreground">{t('awaitingStripe')}</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      </div>

      <SubscriptionsSection />

      {eInvoiceOrder && (
        <EInvoiceDialog key={eInvoiceOrder.id} order={eInvoiceOrder} onClose={() => setEInvoiceOrder(null)} errorText={errorText} />
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
              {t('no')}
            </Button>
            <Button
              variant={action?.kind === 'confirm' ? 'walnut' : 'destructive'}
              disabled={isBusy}
              onClick={runAction}
            >
              {t('yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Registrul lunar (CSV) pentru contabil — facturile confirmate din luna aleasa (Europe/Bucharest).
function MonthlyExport() {
  const t = useTranslations('AdminPayments');
  const [month, setMonth] = useState(currentMonth);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  return (
    <Card as="section" className="flex flex-wrap items-end gap-4">
      <div className="min-w-[220px] flex-1">
        <h2 className="heading-card">{t('eInvoice.exportTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('eInvoice.exportHint')}</p>
      </div>
      <Input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="w-44"
        aria-label={t('eInvoice.exportTitle')}
      />
      <a
        href={valid ? `${API}/admin/billing/e-invoice-export?month=${month}` : undefined}
        aria-disabled={!valid}
        className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-ink-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        {t('eInvoice.exportButton')}
      </a>
    </Card>
  );
}

// Actualizare stare e-Factura: ce a facut contabilul in SPV (index incarcare / descarcare).
function EInvoiceDialog({
  order,
  onClose,
  errorText,
}: {
  order: AdminBillingOrderItemDto;
  onClose: () => void;
  errorText: (err: unknown) => string;
}) {
  const t = useTranslations('AdminPayments');
  const update = useUpdateEInvoice();
  const initial = (EDITABLE_E_INVOICE as readonly string[]).includes(order.eInvoiceStatus ?? '')
    ? (order.eInvoiceStatus as EditableEInvoice)
    : 'PENDING';
  const [status, setStatus] = useState<EditableEInvoice>(initial);
  const [uploadId, setUploadId] = useState(order.anafUploadId ?? '');
  const [downloadId, setDownloadId] = useState(order.anafDownloadId ?? '');
  const needsUpload = status === 'UPLOADED' || status === 'VALIDATED';
  const digits = (v: string) => v === '' || /^\d{1,20}$/.test(v);
  const canSave = !update.isPending && digits(uploadId) && digits(downloadId) && (!needsUpload || uploadId !== '');

  const save = () => {
    if (!canSave) return;
    update.mutate(
      {
        orderId: order.id,
        status,
        anafUploadId: uploadId || undefined,
        anafDownloadId: downloadId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('eInvoice.updated'));
          onClose();
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('eInvoice.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {order.companyName} · {order.invoiceLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t('col.eInvoice')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as EditableEInvoice)}>
              {EDITABLE_E_INVOICE.map((s) => (
                <option key={s} value={s}>
                  {t(`eInvoice.status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('eInvoice.uploadId')}>
            <Input
              inputMode="numeric"
              maxLength={20}
              className="font-mono"
              value={uploadId}
              onChange={(e) => setUploadId(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label={t('eInvoice.downloadId')}>
            <Input
              inputMode="numeric"
              maxLength={20}
              className="font-mono"
              value={downloadId}
              onChange={(e) => setDownloadId(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={update.isPending} onClick={onClose}>
            {t('no')}
          </Button>
          <Button variant="walnut" disabled={!canSave} onClick={save}>
            {t('eInvoice.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Abonamente: acordare/prelungire manuala (vanzare asistata) + lista.
function SubscriptionsSection() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const companies = useAdminCompanies('APPROVED');
  const plans = useAdminPlans();
  const subs = useAdminSubscriptions();
  const grant = useGrantSubscription();

  const [companyId, setCompanyId] = useState('');
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState(30);
  const [includeCredits, setIncludeCredits] = useState(false);
  const [note, setNote] = useState('');

  // E-admin-platform-58: planurile gratuite (0 lei) se acorda tot de aici
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.isActive), [plans.data]);
  const planName = (planId: string, code: string) => {
    const p = plans.data?.find((x) => x.id === planId);
    return p ? planDisplayName(p, locale) : code;
  };
  const canSubmit = !!companyId && !!planId && days >= 1 && days <= 366 && !grant.isPending;

  const submit = () => {
    if (!canSubmit) return;
    grant.mutate(
      { companyId, planId, days, includeCredits, note: note.trim() || undefined },
      {
        onSuccess: (res) => {
          toast.success(
            t('grant.success', {
              company: res.companyName,
              date: format.dateTime(new Date(res.expiresAt), { dateStyle: 'medium' }),
            }),
          );
          setNote('');
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
          toast.error(t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR'));
        },
      },
    );
  };

  return (
    <Card as="section" className="flex flex-col gap-4">
      <div>
        <h2 className="heading-section">{t('grant.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('grant.hint')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('grant.company')}>
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{t('grant.pickCompany')}</option>
            {companies.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.cui}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('grant.plan')}>
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">{t('grant.pickPlan')}</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {planDisplayName(p, locale)} · {p.isFree ? t('grant.freePlan') : money(p.priceRon)} · {p.includedCredits} cr.
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('grant.days')}>
          <Input
            type="number"
            min={1}
            max={366}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label={t('grant.includeCredits')} hint={t('grant.includeCreditsHint')}>
          <div className="flex h-10 items-center">
            <Switch checked={includeCredits} onCheckedChange={setIncludeCredits} aria-label={t('grant.includeCredits')} />
          </div>
        </Field>
        <Field label={t('grant.note')} className="sm:col-span-2">
          <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button variant="walnut" disabled={!canSubmit} onClick={submit}>
          {t('grant.submit')}
        </Button>
      </div>

      <h3 className="label mt-2">{t('subscriptions.title')}</h3>
      {subs.isSuccess && subs.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('subscriptions.empty')}</p>
      )}
      {subs.data && subs.data.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>{t('col.company')}</TH>
              <TH>{t('subscriptions.plan')}</TH>
              <TH>{t('subscriptions.period')}</TH>
              <TH>{t('col.status')}</TH>
            </TR>
          </THead>
          <TBody>
            {subs.data.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.companyName}</TD>
                <TD>
                  <span className="flex items-center gap-2">
                    <TierBadge tier={s.tier} label={planName(s.planId, s.tier)} />
                    {s.isTrial && <Badge tone="amber">{t('subscriptions.trial')}</Badge>}
                  </span>
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {format.dateTime(new Date(s.startedAt), { dateStyle: 'medium' })} →{' '}
                  {format.dateTime(new Date(s.expiresAt), { dateStyle: 'medium' })}
                </TD>
                <TD>
                  {s.isCurrent ? (
                    <Badge tone={s.daysLeft <= 7 ? 'amber' : 'sage'} dot>
                      {t('subscriptions.daysLeft', { n: s.daysLeft })}
                    </Badge>
                  ) : (
                    <Badge tone="muted">{t('subscriptions.expired')}</Badge>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
