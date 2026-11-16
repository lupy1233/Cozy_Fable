'use client';

import type { BillingOrderDto, PurchaseResultDto } from '@marketplace/shared';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { useSubscription, useWallet } from '@/hooks/use-marketplace';
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
import { saveBlob } from '@/lib/download';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { SectionNav } from '../../company/_components/section-nav';
import { AccessBlocked } from '../_components/access-blocked';
import { BankTransferPanel } from './_components/bank-transfer-panel';
import { CreditPackagesSection } from './_components/credit-packages-section';
import { CreditWalletSection } from './_components/credit-wallet-section';
import { shortRef } from './_components/order-ref';
import { OrdersSection } from './_components/orders-section';
import { PenaltiesSection } from './_components/penalties-section';
import { PurchaseDialog, type PendingPurchase } from './_components/purchase-dialog';
import { SubscriptionSection } from './_components/subscription-section';

export default function WalletPage() {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');
  const tp = useTranslations('Penalties');
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
    return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="list" />} />;
  }

  // E-admin-platform-58: TVA-ul si totalurile vin calculate din backend (Decimal half-up, ca pe comanda)
  const stripeEnabled = instructions.data?.stripeEnabled ?? true;
  const sub = subscription.data ?? null;
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

  // panoul de transfer apare deasupra comenzilor: il aducem in vedere dupa ce s-a randat
  const showBankOrder = (order: BillingOrderDto) => {
    setBankOrder(order);
    window.setTimeout(() => document.getElementById('bank-transfer')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const onPurchaseResult = (res: PurchaseResultDto) => {
    setPending(null);
    if (res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
      return;
    }
    showBankOrder(res.order);
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

  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return tb.has(`apiErrors.${code}`) ? tb(`apiErrors.${code}`) : tb('apiErrors.INTERNAL_ERROR');
  };

  const openPurchase = (next: PendingPurchase) => {
    purchaseCredits.reset();
    purchasePlan.reset();
    setPending(next);
  };

  const pageHeader = <PageHeader title={t('wallet.pageTitle')} subtitle={t('wallet.pageSubtitle')} />;

  if (blockedErr) {
    return (
      <div className="flex flex-col gap-8">
        {pageHeader}
        <AccessBlocked error={blockedErr} />
        {penalties.data && <PenaltiesSection status={penalties.data} className="mx-auto w-full max-w-lg" />}
      </div>
    );
  }

  // sectiunile randate acum = intrarile din navigarea paginii (aceleasi conditii ca mai jos)
  const navItems = [
    { id: 'credits', label: t('wallet.navCredits') },
    { id: 'subscription', label: t('subscription.title') },
    ...(canBuy
      ? [
          { id: 'packages', label: tb('buyCredits') },
          { id: 'orders', label: tb('orders') },
        ]
      : []),
    ...(penalties.data ? [{ id: 'penalties', label: tp('title') }] : []),
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        {pageHeader}
        <SectionNav variant="tabs" label={t('wallet.sectionsNav')} items={navItems} />
      </div>

      {(stripeTestMode || (instructions.data && !billingReady)) && (
        <div className="flex flex-col gap-3">
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
        </div>
      )}

      <CreditWalletSection
        pending={wallet.isPending}
        wallet={wallet.data}
        canBuy={canBuy}
        readOnlyNote={!canBuy && !company.isPending}
      />

      <SubscriptionSection
        subscriptionPending={subscription.isPending}
        subscriptionLoaded={subscription.isSuccess}
        subscription={sub}
        plansPending={plans.isPending}
        plansLoaded={plans.isSuccess}
        plans={plans.data}
        entitlements={entitlements.data}
        canBuy={canBuy}
        payDisabled={payDisabled}
        onBuy={(plan) => openPurchase({ kind: 'plan', plan })}
      />

      {canBuy && (
        <CreditPackagesSection
          pending={packages.isPending}
          loaded={packages.isSuccess}
          packages={packages.data}
          stripeEnabled={stripeEnabled}
          noSubscription={subscription.isSuccess && !sub}
          payDisabled={payDisabled}
          onBuy={(pkg) => openPurchase({ kind: 'credits', pkg })}
        />
      )}

      {/* Transfer bancar — doar cand Stripe e dezactivat si s-a plasat / s-a deschis o comanda */}
      {canBuy && bankOrder && (
        <BankTransferPanel
          order={bankOrder}
          bankTransfer={instructions.data?.bankTransfer}
          billingReady={billingReady}
          markPaidPending={markPaid.isPending}
          markPaidError={markPaid.error ? errorText(markPaid.error) : null}
          onMarkPaid={confirmTransferSent}
          downloadingProforma={downloadingProforma}
          onDownloadProforma={(o) => void downloadProforma(o)}
        />
      )}

      {(canBuy || penalties.data) && (
        <div className="flex flex-wrap items-start gap-6">
          {canBuy && (
            <OrdersSection
              className="flex-[999_1_520px]"
              pending={orders.isPending}
              loaded={orders.isSuccess}
              orders={orders.data}
              stripeEnabled={stripeEnabled}
              billingReady={billingReady}
              checkoutPending={checkout.isPending}
              checkoutError={checkout.error ? errorText(checkout.error) : null}
              downloadingId={downloadingId}
              onContinuePayment={continuePayment}
              onShowBankDetails={showBankOrder}
              onDownloadInvoice={(o) => void downloadInvoice(o)}
            />
          )}
          {penalties.data && <PenaltiesSection status={penalties.data} className="flex-[1_1_320px]" />}
        </div>
      )}

      {/* Dialog confirmare comanda — totalul CU TVA inainte de plata */}
      {canBuy && (
        <PurchaseDialog
          pending={pending}
          busy={isBusy}
          payDisabled={payDisabled}
          stripeEnabled={stripeEnabled}
          error={dialogError ? errorText(dialogError) : null}
          onClose={() => setPending(null)}
          onConfirm={confirmPurchase}
        />
      )}
    </div>
  );
}
