'use client';

import type {
  BillingOrderDto,
  CreditPackageDto,
  PurchaseResultDto,
  SubscriptionPlanDto,
} from '@marketplace/shared';
import { AlertTriangle, Check, Copy, CreditCard, FileDown, Landmark, ShieldCheck } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { useMoney } from '@/hooks/use-money';
import { useSubscription, useWallet } from '@/hooks/use-marketplace';
import { planDisplayName } from '@/lib/plan-label';
import { companyCan } from '@/lib/company-permissions';
import { usePenaltyStatus } from '@/hooks/use-penalties';
import {
  useBillingOrders,
  useCreditPackages,
  useEntitlements,
  useMarkOrderPaid,
  useOrderCheckout,
  usePaymentInstructions,
  usePurchaseCredits,
  usePurchaseSubscription,
  useSubscriptionPlans,
} from '@/hooks/use-billing';
import { ApiError, apiBlob } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { saveBlob } from '@/lib/download';
import { formatAmount } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Badge, TierBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardSection } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage, SkeletonStatGrid, SkeletonText } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { firmRulesChunk } from '../../_components/firm-rules-link';
import { AccessBlocked } from '../_components/access-blocked';

const EXPIRING_DAYS = 7;

// Ce urmeaza sa cumpere firma — dialogul de confirmare arata totalul CU TVA inainte de comanda.
type PendingPurchase =
  | { kind: 'credits'; pkg: CreditPackageDto }
  | { kind: 'plan'; plan: SubscriptionPlanDto };

export default function WalletPage() {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');
  const tp = useTranslations('Penalties');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const me = useMe();
  const company = useMyCompany();
  // doar OWNER/MANAGER cumpara si vad comenzile (CompanyManagerGuard); cat timp rolul se incarca = doar citire
  const canBuy = companyCan(company.data, 'BILLING_MANAGE');
  const wallet = useWallet();
  const subscription = useSubscription();
  const penalties = usePenaltyStatus();
  const packages = useCreditPackages();
  const plans = useSubscriptionPlans();
  // E-admin-platform-58: ce include planul activ (acces marketplace)
  const entitlements = useEntitlements();
  const instructions = usePaymentInstructions(canBuy);
  const orders = useBillingOrders(canBuy);
  const purchaseCredits = usePurchaseCredits();
  const purchasePlan = usePurchaseSubscription();
  const checkout = useOrderCheckout();
  const markPaid = useMarkOrderPaid();

  const [pending, setPending] = useState<PendingPurchase | null>(null);
  // comanda plasata fara Stripe → panou cu datele de transfer bancar
  const [bankOrder, setBankOrder] = useState<BillingOrderDto | null>(null);
  // E-company-19: factura se descarca prin sesiune (refresh la 401), nu prin <a href> direct
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  async function downloadInvoice(o: BillingOrderDto) {
    setDownloadingId(o.id);
    try {
      const blob = await apiBlob(`/billing/orders/${o.id}/invoice`);
      saveBlob(blob, `factura-${o.invoiceLabel}.pdf`);
    } catch {
      toast.error(tb('invoiceDownloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  }
  // E-company-24: proforma comenzii prin transfer (tot prin sesiune, ca factura)
  const [downloadingProforma, setDownloadingProforma] = useState(false);
  async function downloadProforma(o: BillingOrderDto) {
    setDownloadingProforma(true);
    try {
      const blob = await apiBlob(`/billing/orders/${o.id}/proforma`);
      saveBlob(blob, `proforma-${shortRef(o.id)}.pdf`);
    } catch {
      toast.error(tb('bankTransfer.proformaFailed'));
    } finally {
      setDownloadingProforma(false);
    }
  }
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
    return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="detail" />} />;
  }

  // E-admin-platform-58: TVA-ul si totalurile vin calculate din backend (Decimal half-up, ca pe comanda)
  const planLabelOf = (planId: string, code: string) => {
    const known = plans.data?.find((p) => p.id === planId) ?? (entitlements.data?.planId === planId ? entitlements.data : null);
    return known ? planDisplayName({ code, nameRo: known.nameRo, nameEn: known.nameEn }, locale) : code;
  };
  const stripeEnabled = instructions.data?.stripeEnabled ?? true;
  const sub = subscription.data ?? null;
  const subDays = sub?.daysLeft ?? 0;
  const subExpiring = !!sub && subDays <= EXPIRING_DAYS;
  // E-admin-platform-4: fara date fiscale reale ale platformei, cumpararile sunt oprite (503).
  const billingReady = instructions.data?.billingReady ?? true;
  const stripeTestMode = instructions.data?.stripeMode === 'test';
  const isBusy = purchaseCredits.isPending || purchasePlan.isPending;
  const payDisabled = isBusy || !billingReady;
  const dialogError = purchaseCredits.error ?? purchasePlan.error;
  // firma suspendata / neaprobata: wallet/abonament raspund 403 -> ecran de blocaj (penalizarile raman vizibile)
  const blockedErr = [wallet.error, subscription.error].find(
    (e) => e instanceof ApiError && (e.code === 'COMPANY_SUSPENDED' || e.code === 'COMPANY_NOT_APPROVED'),
  );

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

  // E-company-24: "Am platit" — chitantele vechi nu au campul (undefined = null)
  const confirmTransferSent = (order: BillingOrderDto) => {
    markPaid.mutate(order.id, {
      onSuccess: (res) => {
        setBankOrder(res);
        toast.success(tb('bankTransfer.markPaidToast'));
      },
    });
  };
  const bankClaimedAt = bankOrder?.paymentClaimedAt ?? null;
  const bankExpiresAt = bankOrder?.transferExpiresAt ?? null;

  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return tb.has(`apiErrors.${code}`) ? tb(`apiErrors.${code}`) : tb('apiErrors.INTERNAL_ERROR');
  };

  // sume fara unitate pentru sabloanele care contin deja unitatea (vatLine, payButton)
  const num = (n: number) => formatAmount(n, locale);
  const openPurchase = (next: PendingPurchase) => {
    purchaseCredits.reset();
    purchasePlan.reset();
    setPending(next);
  };

  const penaltiesSection = penalties.data && (
    <Card as="section" tone={penalties.data.suspended ? 'crimson' : 'default'}>
      <h2 className="heading-section">{tp('title')}</h2>
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
      <p className="mt-1 text-sm">{tp.rich('rulesLink', { rules: firmRulesChunk('penalties') })}</p>
      {penalties.data.events.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          {penalties.data.events.map((e) => (
            <li key={e.id}>
              {tp.has(`rule.${e.ruleKey}`) ? tp(`rule.${e.ruleKey}`) : e.ruleKey} · {e.points} {tp('pts')} · {tp('expires')}{' '}
              {format.dateTime(new Date(e.expiresAt), { dateStyle: 'medium' })}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const pageHeader = (
    <PageHeader
      back={{ href: '/marketplace', label: t('back') }}
      title={t('wallet.pageTitle')}
      subtitle={t('wallet.pageSubtitle')}
    />
  );

  if (blockedErr) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {pageHeader}
        <AccessBlocked error={blockedErr} />
        {penaltiesSection}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {pageHeader}

      {stripeTestMode && (
        <Alert tone="amber" icon={<AlertTriangle />} title={tb('testMode.title')}>
          {tb('testMode.body')}
        </Alert>
      )}
      {instructions.data && !billingReady && (
        <Alert tone="amber" icon={<AlertTriangle />}>
          {tb('notReady')}
        </Alert>
      )}

      {/* Portofel credite */}
      <CardSection title={t('wallet.title')} titleSize="section">
        {wallet.isPending ? (
          <SkeletonStatGrid count={3} variant="inline" className="sm:grid-cols-3 lg:grid-cols-3" />
        ) : wallet.data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard variant="inline" align="center" label={t('wallet.available')} value={wallet.data.available} />
              <StatCard
                variant="inline"
                align="center"
                tone="muted"
                label={t('wallet.reserved')}
                value={wallet.data.reserved}
              />
              <StatCard
                variant="inline"
                align="center"
                tone="muted"
                label={t('wallet.totalHeld')}
                value={wallet.data.balance + wallet.data.reserved}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('wallet.reservedHint')}</p>
          </>
        ) : (
          <EmptyState size="sm" variant="plain" title={t('wallet.none')} />
        )}
        {!canBuy && !company.isPending && (
          <Alert tone="neutral" className="mt-1">
            {t('wallet.readOnlyNote')}
          </Alert>
        )}
      </CardSection>

      {/* Abonament — planul curent + planurile disponibile (PO 2026-08-19) */}
      <CardSection
        id="subscription"
        className="scroll-mt-24"
        title={t('subscription.title')}
        titleSize="section"
      >
        {subscription.isPending ? (
          <SkeletonText lines={3} />
        ) : sub ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <TierBadge tier={sub.tier} label={planLabelOf(sub.planId, sub.tier)} />
              <Badge tone="muted">{t(`subscription.statusValue.${sub.status}`)}</Badge>
              {sub.isTrial && <Badge tone="amber">{t('subscription.trial')}</Badge>}
              {/* fara acces la marketplace, intarzierea de acces la cereri nu are sens */}
              {entitlements.data?.features.MARKETPLACE_ACCESS.enabled !== false && (
                <span className="text-muted-foreground">
                  {sub.gatingDelayMinutes > 0
                    ? t('subscription.gatingInfo', { min: sub.gatingDelayMinutes })
                    : t('subscription.gatingNow')}
                </span>
              )}
              <span className="text-muted-2">
                {t('subscription.expires', {
                  date: format.dateTime(new Date(sub.expiresAt), { dateStyle: 'medium' }),
                })}
                {' · '}
                {t('subscription.daysLeft', { n: subDays })}
              </span>
            </div>
            {entitlements.data?.planCode && (
              <p className="text-sm text-muted-foreground">
                {entitlements.data.features.MARKETPLACE_ACCESS.enabled
                  ? t('subscription.marketplaceAccess.included')
                  : t('subscription.marketplaceAccess.notIncluded')}
              </p>
            )}
            {subExpiring && (
              <Alert tone="amber" icon={<AlertTriangle />}>
                {t('subscription.expiringSoon', { n: subDays })}
              </Alert>
            )}
          </div>
        ) : subscription.isSuccess ? (
          <Alert tone="crimson" icon={<AlertTriangle />} className="mt-3">
            {t('subscription.expired')}
          </Alert>
        ) : (
          <Alert tone="amber" icon={<AlertTriangle />} className="mt-3">
            {t('accessBlocked.title.generic')}
          </Alert>
        )}

        <h3 className="label mt-5">{t('subscription.plans')}</h3>
        {plans.isPending && <SkeletonStatGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
        {plans.isSuccess && plans.data.length === 0 && (
          <EmptyState size="sm" variant="plain" title={tb('noPlans')} />
        )}
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {plans.data?.map((p) => {
            const isCurrent = sub?.planId === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-4',
                  isCurrent ? 'border-walnut/50 bg-walnut-soft/40' : 'border-border-2 bg-surface',
                )}
              >
                <div className="flex items-center justify-between">
                  <TierBadge tier={p.tier} label={planDisplayName(p, locale)} />
                  <span className="flex items-center gap-1">
                    {p.isFree && <Badge tone="sage">{tb('freePlan')}</Badge>}
                    {isCurrent && <Badge tone="walnut">{t('subscription.current')}</Badge>}
                  </span>
                </div>
                <div>
                  <span className="font-serif text-2xl">{money(canBuy ? p.totalRon : p.priceRon)}</span>
                  {!canBuy && <span className="text-xs text-muted-foreground"> {tb('excludingVat')}</span>}
                  <span className="text-xs text-muted-foreground"> {t('subscription.perMonth')}</span>
                </div>
                {canBuy && !p.isFree && (
                  <p className="text-xs text-muted-foreground">
                    {tb('vatLine', { base: num(p.priceRon), rate: p.vatRate, total: num(p.totalRon) })}
                  </p>
                )}
                <ul className="text-sm text-muted-foreground">
                  <li>{t('subscription.includedCredits', { n: p.includedCredits })}</li>
                  {p.features.MARKETPLACE_ACCESS.enabled && (
                    <li>
                      {p.gatingDelayMinutes > 0
                        ? t('subscription.gatingInfo', { min: p.gatingDelayMinutes })
                        : t('subscription.gatingNow')}
                    </li>
                  )}
                  <li>
                    {p.features.MARKETPLACE_ACCESS.enabled
                      ? t('subscription.planMarketplaceAccess.included')
                      : t('subscription.planMarketplaceAccess.notIncluded')}
                  </li>
                </ul>
                {/* planul de 0 lei nu se cumpara online (409 PLAN_NOT_PURCHASABLE) — il activeaza adminul */}
                {p.isFree ? (
                  <p className="mt-auto text-xs text-muted-foreground">{tb('freePlanNote')}</p>
                ) : canBuy && (
                  <Button
                    variant={isCurrent || !sub ? 'walnut' : 'outline'}
                    size="sm"
                    className="mt-auto"
                    disabled={payDisabled}
                    onClick={() => openPurchase({ kind: 'plan', plan: p })}
                  >
                    {sub ? t('subscription.extend') : t('subscription.activate')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {sub && canBuy && <p className="mt-3 text-xs text-muted-foreground">{t('subscription.extendHint')}</p>}
      </CardSection>

      {/* Cumpara credite */}
      {canBuy && (
      <CardSection title={tb('buyCredits')} titleSize="section">
        <p className="text-sm text-muted-foreground">
          {stripeEnabled ? tb('buyCreditsHint') : tb('buyCreditsHintBank')}
        </p>
        <p className="text-sm text-muted-foreground">{tb.rich('rulesNotice', { rules: firmRulesChunk('settlement') })}</p>
        {/* E-company-21: creditele se folosesc doar cu abonament activ (SubscriptionActiveGuard);
            cumpararea ramane permisa — nota e doar informativa */}
        {subscription.isSuccess && !sub && (
          <Alert tone="amber" icon={<AlertTriangle />} className="mt-3">
            {tb('noSubscriptionCreditsNote')}
          </Alert>
        )}
        {packages.isPending && <SkeletonStatGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
        {packages.isSuccess && packages.data.length === 0 && (
          <EmptyState size="sm" variant="plain" title={tb('noPackages')} />
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {packages.data?.map((p) => {
            const total = p.totalRon;
            return (
              <Card key={p.id} tone="muted" padding="sm" className="flex flex-col gap-2">
                <span className="font-serif text-2xl">
                  {p.credits} <span className="text-base text-muted-foreground">{t('credits')}</span>
                </span>
                <p className="text-xs text-muted-foreground">
                  {tb('vatLine', { base: num(p.priceRon), rate: p.vatRate, total: num(total) })}
                </p>
                <Button
                  variant="walnut"
                  size="sm"
                  className="mt-auto"
                  disabled={payDisabled}
                  onClick={() => openPurchase({ kind: 'credits', pkg: p })}
                >
                  {tb('payButton', { total: num(total) })}
                </Button>
              </Card>
            );
          })}
        </div>
        {checkout.error && (
          <Alert tone="crimson" className="mt-3">
            {errorText(checkout.error)}
          </Alert>
        )}
      </CardSection>
      )}

      {/* Transfer bancar — doar cand Stripe e dezactivat si s-a plasat o comanda */}
      {canBuy && bankOrder && (
        <CardSection
          id="bank-transfer"
          className="scroll-mt-24"
          tone="amber"
          icon={Landmark}
          title={tb('bankTransfer.title')}
          titleSize="section"
        >
          <p className="text-sm">{tb('bankTransfer.intro', { ref: shortRef(bankOrder.id) })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tb('bankTransfer.emailed')}</p>
          {instructions.data?.bankTransfer?.iban ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{tb('bankTransfer.beneficiary')}</dt>
              <dd className="font-medium">{instructions.data.bankTransfer.sellerName}</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.cui')}</dt>
              <dd className="font-mono">{instructions.data.bankTransfer.cui}</dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.iban')}</dt>
              <dd className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all font-mono">{instructions.data.bankTransfer.iban}</span>
                <CopyButton
                  tb={tb}
                  label={tb('bankTransfer.iban')}
                  value={instructions.data.bankTransfer.iban.replace(/\s+/g, '')}
                />
              </dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.amount')}</dt>
              <dd className="flex items-center justify-between gap-2">
                <span className="font-medium">{money(bankOrder.totalRon)}</span>
                <CopyButton tb={tb} label={tb('bankTransfer.amount')} value={num(bankOrder.totalRon)} />
              </dd>
              <dt className="text-muted-foreground">{tb('bankTransfer.reference')}</dt>
              <dd className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all font-mono">
                  {tb('bankTransfer.referenceValue', { ref: shortRef(bankOrder.id) })}
                </span>
                <CopyButton
                  tb={tb}
                  label={tb('bankTransfer.reference')}
                  value={tb('bankTransfer.referenceValue', { ref: shortRef(bankOrder.id) })}
                />
              </dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm">{tb('bankTransfer.missing')}</p>
          )}
          {bankExpiresAt && (
            <p className="mt-3 text-sm">
              {tb('bankTransfer.autoCancelNote', {
                date: format.dateTime(new Date(bankExpiresAt), { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </p>
          )}
          {bankOrder.status === 'PENDING' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!bankClaimedAt && (
                <Button
                  size="sm"
                  variant="walnut"
                  disabled={markPaid.isPending}
                  aria-busy={markPaid.isPending}
                  onClick={() => confirmTransferSent(bankOrder)}
                >
                  <Check /> {tb('bankTransfer.markPaid')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={downloadingProforma || !billingReady}
                aria-busy={downloadingProforma}
                onClick={() => void downloadProforma(bankOrder)}
              >
                <FileDown /> {tb('bankTransfer.downloadProforma')}
              </Button>
            </div>
          )}
          {bankOrder.status === 'PENDING' &&
            (bankClaimedAt ? (
              <p className="mt-2 text-sm font-medium">
                {tb('bankTransfer.markedPaid', {
                  date: format.dateTime(new Date(bankClaimedAt), { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{tb('bankTransfer.markPaidHint')}</p>
            ))}
          {markPaid.error && (
            <Alert tone="crimson" className="mt-3">
              {errorText(markPaid.error)}
            </Alert>
          )}
        </CardSection>
      )}

      {/* Istoric comenzi + facturi */}
      {canBuy && (
      <CardSection title={tb('orders')} titleSize="section">
        {orders.isPending && <SkeletonList rows={3} />}
        {orders.isSuccess && orders.data.length === 0 && (
          <EmptyState size="sm" variant="plain" title={tb('noOrders')} />
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
                    <span className="font-mono">{money(o.totalRon)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <OrderStatusBadge status={o.status} label={tb(`orderStatus.${o.status}`)} />
                    <span>{format.dateTime(new Date(o.createdAt), { dateStyle: 'medium' })}</span>
                    <span>· {sourceLabel(tb, o, stripeEnabled)}</span>
                    <span className="font-mono">· #{shortRef(o.id)}</span>
                    {o.status === 'PENDING' && o.paymentClaimedAt && (
                      <Badge tone="info">{tb('paymentReported')}</Badge>
                    )}
                    {o.testMode && (
                      <>
                        <Badge tone="amber">{tb('testBadge')}</Badge>
                        <span>{tb('testOrder')}</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {o.status === 'PENDING' && stripeEnabled && (
                    <Button
                      size="sm"
                      variant="walnut"
                      disabled={checkout.isPending || !billingReady}
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
                    <Button
                      size="sm"
                      variant="link"
                      className="h-auto px-0 text-walnut"
                      disabled={downloadingId === o.id}
                      aria-busy={downloadingId === o.id}
                      onClick={() => void downloadInvoice(o)}
                    >
                      {tb('invoice')} {o.invoiceLabel}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardSection>
      )}

      {/* Penalizari */}
      {penaltiesSection}

      {/* Claim-urile s-au mutat pe pagina dedicata */}
      <Card asChild interactive padding="sm">
        <Link href="/marketplace/claims" className="text-sm text-walnut">
          {t('myClaims.goToPage')} →
        </Link>
      </Card>

      {/* Dialog confirmare comanda — totalul CU TVA inainte de plata */}
      {canBuy && (
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !isBusy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tb('confirmTitle')}</DialogTitle>
            <DialogDescription>
              {pending?.kind === 'credits'
                ? tb('confirmCreditsDesc', { n: pending.pkg.credits })
                : pending?.kind === 'plan'
                  ? tb('confirmPlanDesc', { tier: planDisplayName(pending.plan, locale), n: pending.plan.includedCredits })
                  : ''}
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <PriceBreakdown
              amounts={pending.kind === 'credits' ? pending.pkg : pending.plan}
              money={money}
              tb={tb}
            />
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            {stripeEnabled ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <Landmark className="mt-0.5 h-4 w-4 shrink-0" />}
            {stripeEnabled ? tb('confirmStripeHint') : tb('confirmBankHint')}
          </p>
          <p className="text-xs text-muted-foreground">
            {tb.rich('rulesNotice', { rules: firmRulesChunk('settlement', true) })}
          </p>
          {dialogError && (
            <Alert tone="crimson" role="alert">
              {errorText(dialogError)}
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={isBusy} onClick={() => setPending(null)}>
              {tb('cancel')}
            </Button>
            <Button variant="walnut" disabled={payDisabled} onClick={confirmPurchase}>
              {stripeEnabled ? tb('confirmButton') : tb('confirmButtonBank')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
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

// E-admin-platform-58: baza/TVA/total vin din backend (aceeasi formula ca la comanda)
function PriceBreakdown({
  amounts,
  money,
  tb,
}: {
  amounts: { priceRon: number; vatRate: number; vatRon: number; totalRon: number };
  money: (n: number) => string;
  tb: ReturnType<typeof useTranslations<'Billing'>>;
}) {
  const { priceRon: base, vatRate, vatRon: vat, totalRon: total } = amounts;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{tb('breakdown.base')}</dt>
      <dd className="font-mono">{money(base)}</dd>
      <dt className="text-muted-foreground">{tb('breakdown.vat', { rate: vatRate })}</dt>
      <dd className="font-mono">{money(vat)}</dd>
      <dt className="mt-1 border-t border-border pt-1 font-medium">{tb('breakdown.total')}</dt>
      <dd className="mt-1 border-t border-border pt-1 font-mono font-semibold">{money(total)}</dd>
    </dl>
  );
}

function CopyButton({
  value,
  label,
  tb,
}: {
  value: string;
  label: string;
  tb: ReturnType<typeof useTranslations<'Billing'>>;
}) {
  const onCopy = () => {
    void copyText(value).then((ok) => {
      if (ok) toast.success(tb('bankTransfer.copied'));
      else toast.error(tb('bankTransfer.copyFailed'));
    });
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 min-w-11 shrink-0"
      aria-label={tb('bankTransfer.copyAria', { label })}
      onClick={onCopy}
    >
      <Copy /> {tb('bankTransfer.copy')}
    </Button>
  );
}
