'use client';

import type { AdminBillingOrderItemDto } from '@marketplace/shared';
import { Info } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminCompanies } from '@/hooks/use-company';
import { useAdminPlans } from '@/hooks/use-admin';
import {
  useAdminPayments,
  useAdminSubscriptions,
  useCancelPayment,
  useConfirmPayment,
  useGrantSubscription,
} from '@/hooks/use-billing';
import { ApiError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Badge, TierBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

// Plati + abonamente (consola admin). Platile Stripe se confirma automat prin webhook;
// confirmarea manuala e DOAR pentru transfer bancar (comenzi PENDING fara sesiune Stripe).
export default function AdminPaymentsPage() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const router = useRouter();
  const me = useMe();
  const [tab, setTab] = useState<StatusTab>('PENDING');
  const list = useAdminPayments(tab === 'all' ? undefined : tab);
  const confirm = useConfirmPayment();
  const cancel = useCancelPayment();
  const [action, setAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;

  const money = (n: number) => `${format.number(n, { maximumFractionDigits: 2 })} lei`;
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
      <div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> {t('stripeNote')}
        </p>
      </div>

      <Tabs
        current={tab}
        onChange={(v) => setTab(v as StatusTab)}
        tabs={(['PENDING', 'CONFIRMED', 'CANCELLED', 'all'] as const).map((v) => ({
          value: v,
          label: t(`tabs.${v}`),
        }))}
      />

      {list.isPending && <p className="py-10 text-center text-muted-foreground">{t('loading')}</p>}
      {list.isError && <Alert tone="crimson">{errorText(list.error)}</Alert>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
      {list.data && list.data.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <Table>
            <THead>
              <TR>
                <TH>{t('col.company')}</TH>
                <TH>{t('col.detail')}</TH>
                <TH className="text-right">{t('col.total')}</TH>
                <TH>{t('col.date')}</TH>
                <TH>{t('col.source')}</TH>
                <TH>{t('col.status')}</TH>
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
                      <span className="block font-mono text-[11px] text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</span>
                    </TD>
                    <TD>
                      <span className="block">{t(`orderType.${o.orderType}`)}</span>
                      <span className="text-xs text-muted-foreground">{detailOf(o)}</span>
                    </TD>
                    <TD className="text-right font-mono">
                      <span className="block">{money(o.totalRon)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {t('vatIncluded', { base: format.number(o.baseAmountRon), rate: o.vatRate })}
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
                      {o.invoiceLabel && (
                        <span className="block font-mono text-[11px] text-muted-foreground">{o.invoiceLabel}</span>
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
                        <span className="block text-[11px] text-muted-foreground">{t('awaitingStripe')}</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      <SubscriptionsSection />

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

// Abonamente: acordare/prelungire manuala (vanzare asistata) + lista.
function SubscriptionsSection() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const companies = useAdminCompanies('APPROVED');
  const plans = useAdminPlans();
  const subs = useAdminSubscriptions();
  const grant = useGrantSubscription();

  const [companyId, setCompanyId] = useState('');
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState(30);
  const [includeCredits, setIncludeCredits] = useState(false);
  const [note, setNote] = useState('');

  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.isActive), [plans.data]);
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
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">{t('grant.title')}</h2>
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
                {p.tier} · {p.priceRon} lei · {p.includedCredits} cr.
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
                    <TierBadge tier={s.tier} />
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
    </section>
  );
}
