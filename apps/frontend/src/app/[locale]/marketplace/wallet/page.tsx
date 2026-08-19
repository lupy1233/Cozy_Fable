'use client';

import type {
  BillingOrderDto,
  CreditPackageDto,
  PurchaseResultDto,
  SubscriptionPlanDto,
} from '@marketplace/shared';
import { AlertTriangle, CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useSubscription, useWallet } from '@/hooks/use-marketplace';
import { usePenaltyStatus } from '@/hooks/use-penalties';
import {
  useBillingOrders,
  useCreditPackages,
  useOrderCheckout,
  usePaymentInstructions,
  usePurchaseCredits,
  usePurchaseSubscription,
  useSubscriptionPlans,
} from '@/hooks/use-billing';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
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
import { toast } from '@/components/ui/toaster';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const EXPIRING_DAYS = 7;

// Ce urmeaza sa cumpere firma — dialogul de confirmare arata totalul CU TVA inainte de comanda.
type PendingPurchase =
  | { kind: 'credits'; pkg: CreditPackageDto }
  | { kind: 'plan'; plan: SubscriptionPlanDto };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function WalletPage() {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');
  const tp = useTranslations('Penalties');
  const format = useFormatter();
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const me = useMe();
  const wallet = useWallet();
  const subscription = useSubscription();
  const penalties = usePenaltyStatus();
  const packages = useCreditPackages();
  const plans = useSubscriptionPlans();
  const instructions = usePaymentInstructions();
  const orders = useBillingOrders();
  const purchaseCredits = usePurchaseCredits();
  const purchasePlan = usePurchaseSubscription();
  const checkout = useOrderCheckout();

  const [pending, setPending] = useState<PendingPurchase | null>(null);
  // comanda plasata fara Stripe → panou cu datele de transfer bancar
  const [bankOrder, setBankOrder] = useState<BillingOrderDto | null>(null);
  const handledReturn = useRef(false);
  const pollTimers = useRef<number[]>([]);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  // Intoarcerea din Stripe Checkout (?payment=success|cancelled&order=...): toast + poll scurt
  // (webhook-ul ajunge la cateva secunde dupa redirect) + curatam query-ul din URL.
  // Timerele stau intr-un ref: router.replace schimba searchParams si ar rula cleanup-ul
  // efectului inainte ca poll-ul sa apuce sa revalideze.
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment || handledReturn.current) return;
    handledReturn.current = true;
    if (payment === 'success') {
      toast.success(tb('paymentSuccessToast'));
      pollTimers.current = [2000, 5000, 9000].map((ms) =>
        window.setTimeout(() => {
          void qc.invalidateQueries({ queryKey: ['billing'] });
        }, ms),
      );
    } else if (payment === 'cancelled') {
      toast(tb('paymentCancelledToast'));
    }
    router.replace('/marketplace/wallet');
  }, [searchParams, router, qc, tb]);

  useEffect(() => {
    const timers = pollTimers;
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const vatRate = instructions.data?.vatRate ?? 21;
  const stripeEnabled = instructions.data?.stripeEnabled ?? true;
  const sub = subscription.data ?? null;
  const subDays = sub?.daysLeft ?? 0;
  const subExpiring = !!sub && subDays <= EXPIRING_DAYS;
  const isBusy = purchaseCredits.isPending || purchasePlan.isPending;
  const purchaseError = purchaseCredits.error ?? purchasePlan.error ?? checkout.error;

  const onPurchaseResult = (res: PurchaseResultDto) => {
    setPending(null);
    if (res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
      return;
    }
    setBankOrder(res.order);
    window.setTimeout(() => document.getElementById('bank-transfer')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const confirmPurchase = () => {
    if (!pending) return;
    if (pending.kind === 'credits') {
      purchaseCredits.mutate(pending.pkg.id, { onSuccess: onPurchaseResult });
    } else {
      purchasePlan.mutate(pending.plan.id, { onSuccess: onPurchaseResult });
    }
  };

  const continuePayment = (order: BillingOrderDto) => {
    checkout.mutate(order.id, { onSuccess: onPurchaseResult });
  };

  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return tb.has(`apiErrors.${code}`) ? tb(`apiErrors.${code}`) : tb('apiErrors.INTERNAL_ERROR');
  };

  const money = (n: number) => format.number(n, { maximumFractionDigits: 2 });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/marketplace" className="text-sm text-walnut hover:underline">
        ← {t('back')}
      </Link>

      {/* Portofel credite */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{t('wallet.title')}</h2>
        {wallet.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('loading')}</p>
        ) : wallet.data ? (
          <div className="mt-3 grid grid-cols-3 gap-4 text-center">
            <Metric label={t('wallet.available')} value={wallet.data.available} highlight />
            <Metric label={t('wallet.reserved')} value={wallet.data.reserved} />
            <Metric label={t('wallet.balance')} value={wallet.data.balance} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t('wallet.none')}</p>
        )}
      </section>

      {/* Abonament — planul curent + planurile disponibile (PO 2026-08-19) */}
      <section id="subscription" className="scroll-mt-24 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{t('subscription.title')}</h2>

        {subscription.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('loading')}</p>
        ) : sub ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <TierBadge tier={sub.tier} />
              <Badge tone="muted">{t(`subscription.statusValue.${sub.status}`)}</Badge>
              {sub.isTrial && <Badge tone="amber">{t('subscription.trial')}</Badge>}
              <span className="text-muted-foreground">
                {sub.gatingDelayMinutes > 0
                  ? t('subscription.gatingInfo', { min: sub.gatingDelayMinutes })
                  : t('subscription.gatingNow')}
              </span>
              <span className="text-muted-2">
                {t('subscription.expires', {
                  date: format.dateTime(new Date(sub.expiresAt), { dateStyle: 'medium' }),
                })}
                {' · '}
                {t('subscription.daysLeft', { n: subDays })}
              </span>
            </div>
            {subExpiring && (
              <Alert tone="amber" icon={<AlertTriangle />}>
                {t('subscription.expiringSoon', { n: subDays })}
              </Alert>
            )}
          </div>
        ) : (
          <Alert tone="crimson" icon={<AlertTriangle />} className="mt-3">
            {t('subscription.expired')}
          </Alert>
        )}

        <h3 className="label mt-5">{t('subscription.plans')}</h3>
        {plans.isSuccess && plans.data.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">{tb('noPlans')}</p>
        )}
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {plans.data?.map((p) => {
            const isCurrent = sub?.planId === p.id;
            const total = round2(p.priceRon * (1 + vatRate / 100));
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-4',
                  isCurrent ? 'border-walnut/50 bg-walnut-soft/40' : 'border-border-2 bg-surface',
                )}
              >
                <div className="flex items-center justify-between">
                  <TierBadge tier={p.tier} />
                  {isCurrent && <Badge tone="walnut">{t('subscription.current')}</Badge>}
                </div>
                <div>
                  <span className="font-serif text-2xl">{money(total)} lei</span>
                  <span className="text-xs text-muted-foreground"> {t('subscription.perMonth')}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tb('vatLine', { base: money(p.priceRon), rate: vatRate, total: money(total) })}
                </p>
                <ul className="text-sm text-muted-foreground">
                  <li>{t('subscription.includedCredits', { n: p.includedCredits })}</li>
                  <li>
                    {p.gatingDelayMinutes > 0
                      ? t('subscription.gatingInfo', { min: p.gatingDelayMinutes })
                      : t('subscription.gatingNow')}
                  </li>
                </ul>
                <Button
                  variant={isCurrent || !sub ? 'walnut' : 'outline'}
                  size="sm"
                  className="mt-auto"
                  disabled={isBusy}
                  onClick={() => setPending({ kind: 'plan', plan: p })}
                >
                  {sub ? t('subscription.extend') : t('subscription.activate')}
                </Button>
              </div>
            );
          })}
        </div>
        {sub && <p className="mt-3 text-xs text-muted-foreground">{t('subscription.extendHint')}</p>}
      </section>

      {/* Cumpara credite */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{tb('buyCredits')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tb('buyCreditsHint')}</p>
        {packages.isSuccess && packages.data.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">{tb('noPackages')}</p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {packages.data?.map((p) => {
            const total = round2(p.priceRon * (1 + vatRate / 100));
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-border-2 bg-surface p-4">
                <span className="font-serif text-2xl">
                  {p.credits} <span className="text-base text-muted-foreground">{t('credits')}</span>
                </span>
                <p className="text-xs text-muted-foreground">
                  {tb('vatLine', { base: money(p.priceRon), rate: vatRate, total: money(total) })}
                </p>
                <Button
                  variant="walnut"
                  size="sm"
                  className="mt-auto"
                  disabled={isBusy}
                  onClick={() => setPending({ kind: 'credits', pkg: p })}
                >
                  {tb('payButton', { total: money(total) })}
                </Button>
              </div>
            );
          })}
        </div>
        {purchaseError && (
          <Alert tone="crimson" className="mt-3">
            {errorText(purchaseError)}
          </Alert>
        )}
      </section>

      {/* Transfer bancar — doar cand Stripe e dezactivat si s-a plasat o comanda */}
      {bankOrder && (
        <section id="bank-transfer" className="scroll-mt-24 rounded-xl border border-amber/30 bg-amber-soft p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <Landmark className="h-5 w-5" /> {tb('bankTransfer.title')}
          </h2>
          <p className="mt-1 text-sm">{tb('bankTransfer.intro', { ref: shortRef(bankOrder.id) })}</p>
          {instructions.data?.bankTransfer?.iban ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{tb('bankTransfer.beneficiary')}</dt>
              <dd className="font-medium">{instructions.data.bankTransfer.sellerName}</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.cui')}</dt>
              <dd className="font-mono">{instructions.data.bankTransfer.cui}</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.iban')}</dt>
              <dd className="font-mono">{instructions.data.bankTransfer.iban}</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.amount')}</dt>
              <dd className="font-medium">{money(bankOrder.totalRon)} lei</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.reference')}</dt>
              <dd className="font-mono">{tb('bankTransfer.referenceValue', { ref: shortRef(bankOrder.id) })}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm">{tb('bankTransfer.missing')}</p>
          )}
        </section>
      )}

      {/* Istoric comenzi + facturi */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{tb('orders')}</h2>
        {orders.isSuccess && orders.data.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">{tb('noOrders')}</p>
        )}
        {orders.data && orders.data.length > 0 && (
          <div className="mt-3 flex flex-col">
            {orders.data.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm last:border-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    {o.orderType === 'SUBSCRIPTION'
                      ? tb('planLabel', { tier: o.planTier ?? '' })
                      : tb('packageLabel', { n: o.credits ?? 0 })}
                    {' · '}
                    <span className="font-mono">{money(o.totalRon)} lei</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <OrderStatusBadge status={o.status} label={tb(`orderStatus.${o.status}`)} />
                    <span>{format.dateTime(new Date(o.createdAt), { dateStyle: 'medium' })}</span>
                    <span>· {sourceLabel(tb, o, stripeEnabled)}</span>
                    <span className="font-mono">· #{shortRef(o.id)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {o.status === 'PENDING' && stripeEnabled && (
                    <Button
                      size="sm"
                      variant="walnut"
                      disabled={checkout.isPending}
                      onClick={() => continuePayment(o)}
                    >
                      <CreditCard /> {tb('continuePayment')}
                    </Button>
                  )}
                  {o.status === 'PENDING' && !stripeEnabled && (
                    <Button size="sm" variant="outline" onClick={() => setBankOrder(o)}>
                      <Landmark /> {tb('bankTransfer.show')}
                    </Button>
                  )}
                  {o.status === 'CONFIRMED' && o.invoiceLabel && (
                    <a
                      href={`${API}/billing/orders/${o.id}/invoice`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-walnut hover:underline"
                    >
                      {tb('invoice')} {o.invoiceLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Penalizari */}
      {penalties.data && (
        <section
          className={cn(
            'rounded-xl border p-5 shadow-sm',
            penalties.data.suspended ? 'border-crimson/30 bg-crimson-soft' : 'border-border bg-surface',
          )}
        >
          <h2 className="font-serif text-xl">{tp('title')}</h2>
          <p className="mt-1 text-sm">
            {tp('points', { active: penalties.data.activePoints, threshold: penalties.data.threshold })}
          </p>
          {penalties.data.suspended && (
            <p className="mt-2 text-sm font-medium text-crimson">
              {tp('suspended', {
                until: penalties.data.suspendedUntil
                  ? format.dateTime(new Date(penalties.data.suspendedUntil), { dateStyle: 'medium' })
                  : '',
              })}
            </p>
          )}
          {penalties.data.events.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-muted-foreground">
              {penalties.data.events.map((e) => (
                <li key={e.id}>
                  {e.ruleKey} · {e.points} {tp('pts')} · {tp('expires')}{' '}
                  {format.dateTime(new Date(e.expiresAt), { dateStyle: 'medium' })}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Claim-urile s-au mutat pe pagina dedicata */}
      <Link
        href="/marketplace/claims"
        className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-walnut shadow-sm transition-colors hover:bg-secondary"
      >
        {t('myClaims.goToPage')} →
      </Link>

      {/* Dialog confirmare comanda — totalul CU TVA inainte de plata */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !isBusy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tb('confirmTitle')}</DialogTitle>
            <DialogDescription>
              {pending?.kind === 'credits'
                ? tb('confirmCreditsDesc', { n: pending.pkg.credits })
                : pending?.kind === 'plan'
                  ? tb('confirmPlanDesc', { tier: pending.plan.tier, n: pending.plan.includedCredits })
                  : ''}
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <PriceBreakdown
              base={pending.kind === 'credits' ? pending.pkg.priceRon : pending.plan.priceRon}
              vatRate={vatRate}
              money={money}
              tb={tb}
            />
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            {stripeEnabled ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <Landmark className="mt-0.5 h-4 w-4 shrink-0" />}
            {stripeEnabled ? tb('confirmStripeHint') : tb('confirmBankHint')}
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={isBusy} onClick={() => setPending(null)}>
              {tb('cancel')}
            </Button>
            <Button variant="walnut" disabled={isBusy} onClick={confirmPurchase}>
              {stripeEnabled ? tb('confirmButton') : tb('confirmButtonBank')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function shortRef(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function sourceLabel(
  tb: ReturnType<typeof useTranslations<'Billing'>>,
  o: BillingOrderDto,
  stripeEnabled: boolean,
) {
  if (o.status === 'CONFIRMED') {
    const src = o.paymentSource ?? 'admin';
    return tb.has(`source.${src}`) ? tb(`source.${src}`) : tb('source.admin');
  }
  return o.hasStripeSession || stripeEnabled ? tb('source.stripe') : tb('source.admin');
}

function OrderStatusBadge({ status, label }: { status: BillingOrderDto['status']; label: string }) {
  const tone = status === 'CONFIRMED' ? 'sage' : status === 'CANCELLED' ? 'muted' : 'amber';
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

function PriceBreakdown({
  base,
  vatRate,
  money,
  tb,
}: {
  base: number;
  vatRate: number;
  money: (n: number) => string;
  tb: ReturnType<typeof useTranslations<'Billing'>>;
}) {
  const vat = round2((base * vatRate) / 100);
  const total = round2(base + vat);
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{tb('breakdown.base')}</dt>
      <dd className="font-mono">{money(base)} lei</dd>
      <dt className="text-muted-foreground">{tb('breakdown.vat', { rate: vatRate })}</dt>
      <dd className="font-mono">{money(vat)} lei</dd>
      <dt className="mt-1 border-t border-border pt-1 font-medium">{tb('breakdown.total')}</dt>
      <dd className="mt-1 border-t border-border pt-1 font-mono font-semibold">{money(total)} lei</dd>
    </dl>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn('font-serif text-3xl tracking-[-0.02em]', !highlight && 'text-muted-foreground')}>
        {value}
      </span>
      <span className="label mt-1">{label}</span>
    </div>
  );
}
