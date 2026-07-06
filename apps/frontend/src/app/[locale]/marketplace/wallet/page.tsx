'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useSubscription, useWallet } from '@/hooks/use-marketplace';
import { usePenaltyStatus } from '@/hooks/use-penalties';
import { useBillingOrders, useCreditPackages, usePurchaseCredits } from '@/hooks/use-billing';
import { cn } from '@/lib/utils';
import { Badge, TierBadge } from '@/components/ui/badge';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function WalletPage() {
  const t = useTranslations('Marketplace');
  const tp = useTranslations('Penalties');
  const router = useRouter();
  const me = useMe();
  const wallet = useWallet();
  const subscription = useSubscription();
  const penalties = usePenaltyStatus();
  const packages = useCreditPackages();
  const orders = useBillingOrders();
  const purchase = usePurchaseCredits();
  const tb = useTranslations('Billing');

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/marketplace" className="text-sm text-walnut hover:underline">
        ← {t('back')}
      </Link>

      {/* Portofel credite */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{t('wallet.title')}</h2>
        {wallet.data ? (
          <div className="mt-3 grid grid-cols-3 gap-4 text-center">
            <Metric label={t('wallet.available')} value={wallet.data.available} highlight />
            <Metric label={t('wallet.reserved')} value={wallet.data.reserved} />
            <Metric label={t('wallet.balance')} value={wallet.data.balance} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t('wallet.none')}</p>
        )}
      </section>

      {/* Abonament */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{t('subscription.title')}</h2>
        {subscription.data ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <TierBadge tier={subscription.data.tier} />
            <Badge tone="muted">{t(`subscription.statusValue.${subscription.data.status}`)}</Badge>
            {subscription.data.isTrial && <Badge tone="amber">{t('subscription.trial')}</Badge>}
            <span className="text-muted-foreground">
              {t('subscription.gating', { min: subscription.data.gatingDelayMinutes })}
            </span>
            <span className="text-muted-2">
              {t('subscription.expires', {
                date: new Date(subscription.data.expiresAt).toLocaleDateString(),
              })}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t('subscription.none')}</p>
        )}
      </section>

      {/* Cumpara credite + facturi */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-xl">{tb('buyCredits')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {packages.data?.map((p) => (
            <button
              key={p.id}
              onClick={() => purchase.mutate(p.id)}
              disabled={purchase.isPending}
              className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <span className="font-serif text-base">{p.credits}</span> {t('credits')} ·{' '}
              <span className="font-mono">{p.priceRon} RON</span>
            </button>
          ))}
        </div>
        {orders.data && orders.data.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="label">{tb('orders')}</h3>
            {orders.data.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <span>
                  {tb(`orderType.${o.orderType}`)} · {o.totalRon} RON ·{' '}
                  <span className="text-muted-foreground">{tb(`orderStatus.${o.status}`)}</span>
                </span>
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
                  ? new Date(penalties.data.suspendedUntil).toLocaleDateString()
                  : '',
              })}
            </p>
          )}
          {penalties.data.events.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-muted-foreground">
              {penalties.data.events.map((e) => (
                <li key={e.id}>
                  {e.ruleKey} · {e.points} {tp('pts')} · {tp('expires')}{' '}
                  {new Date(e.expiresAt).toLocaleDateString()}
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
    </div>
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
