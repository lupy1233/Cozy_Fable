'use client';

import type { EntitlementsDto, SubscriptionDetailDto, SubscriptionPlanDto } from '@marketplace/shared';
import { AlertTriangle, Check, Minus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonStatGrid, SkeletonText } from '@/components/ui/skeleton';
import { useMoney } from '@/hooks/use-money';
import { formatAmount } from '@/lib/money';
import { planDisplayName } from '@/lib/plan-label';
import { cn } from '@/lib/utils';

const EXPIRING_DAYS = 7;

// Abonament — starea planului curent + planurile disponibile (PO 2026-08-19).
// `id="subscription"` e tinta linkurilor din alte pagini (/marketplace/wallet#subscription).
export function SubscriptionSection({
  subscriptionPending,
  subscriptionLoaded,
  subscription,
  plansPending,
  plansLoaded,
  plans,
  entitlements,
  canBuy,
  payDisabled,
  onBuy,
}: {
  subscriptionPending: boolean;
  /** raspuns primit (cu sau fara abonament); false dupa incarcare = eroare */
  subscriptionLoaded: boolean;
  subscription: SubscriptionDetailDto | null;
  plansPending: boolean;
  plansLoaded: boolean;
  plans: SubscriptionPlanDto[] | undefined;
  /** E-admin-platform-58: ce include planul activ (acces marketplace) */
  entitlements: EntitlementsDto | null | undefined;
  canBuy: boolean;
  payDisabled: boolean;
  onBuy: (plan: SubscriptionPlanDto) => void;
}) {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const sub = subscription;

  const currentPlanName = (s: SubscriptionDetailDto) => {
    const known =
      plans?.find((p) => p.id === s.planId) ?? (entitlements?.planId === s.planId ? entitlements : null);
    return known
      ? planDisplayName({ code: s.tier, nameRo: known.nameRo, nameEn: known.nameEn }, locale)
      : s.tier;
  };

  const gatingText = (minutes: number) =>
    minutes > 0 ? t('subscription.gatingInfo', { min: minutes }) : t('subscription.gatingNow');

  const renderStatus = () => {
    if (subscriptionPending) return <SkeletonText lines={2} />;
    if (sub) {
      const expiring = sub.daysLeft <= EXPIRING_DAYS;
      return (
        <Card
          role="status"
          tone="amber"
          padding="none"
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-5 py-4 text-amber"
        >
          <div className="min-w-0 flex-[999_1_320px]">
            <p className="text-sm">
              {expiring && <AlertTriangle className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />}
              <span className="font-semibold">
                {sub.status === 'ACTIVE'
                  ? t('subscription.activeLine', { plan: currentPlanName(sub) })
                  : `${currentPlanName(sub)} · ${t(`subscription.statusValue.${sub.status}`)}`}
              </span>{' '}
              {t('subscription.expires', {
                date: format.dateTime(new Date(sub.expiresAt), { dateStyle: 'medium' }),
              })}
              {' · '}
              {t('subscription.daysLeft', { n: sub.daysLeft })}
              {/* fara acces la marketplace, intarzierea de acces la cereri nu are sens */}
              {entitlements?.features.MARKETPLACE_ACCESS.enabled !== false && (
                <>
                  {' · '}
                  {gatingText(sub.gatingDelayMinutes)}
                </>
              )}
              {sub.isTrial && (
                <Badge tone="amber" className="ml-2 border border-amber/40 align-middle">
                  {t('subscription.trial')}
                </Badge>
              )}
            </p>
            {entitlements?.planCode && (
              <p className="mt-1 text-ui">
                {entitlements.features.MARKETPLACE_ACCESS.enabled
                  ? t('subscription.marketplaceAccess.included')
                  : t('subscription.marketplaceAccess.notIncluded')}
              </p>
            )}
            {expiring && (
              <p className="mt-1 text-sm font-medium">{t('subscription.expiringSoon', { n: sub.daysLeft })}</p>
            )}
          </div>
          {canBuy && <p className="flex-[1_1_260px] text-ui">{t('subscription.extendHint')}</p>}
        </Card>
      );
    }
    if (subscriptionLoaded) {
      return (
        <Alert tone="crimson" icon={<AlertTriangle />}>
          {t('subscription.expired')}
        </Alert>
      );
    }
    return (
      <Alert tone="amber" icon={<AlertTriangle />}>
        {t('accessBlocked.title.generic')}
      </Alert>
    );
  };

  return (
    <section
      id="subscription"
      aria-labelledby="wallet-subscription-title"
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <h2 id="wallet-subscription-title" className="font-serif text-2xl leading-tight">
        {t('subscription.title')}
      </h2>

      {renderStatus()}

      {plansPending && <SkeletonStatGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
      {plansLoaded && plans?.length === 0 && <EmptyState size="sm" variant="card" title={tb('noPlans')} />}
      {plans && plans.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
          {plans.map((p) => {
            const isCurrent = sub?.planId === p.id;
            const marketplace = p.features.MARKETPLACE_ACCESS.enabled;
            return (
              <Card
                key={p.id}
                as="article"
                padding="none"
                className={cn('flex flex-col gap-3.5', isCurrent ? 'border-2 border-walnut p-[23px]' : 'p-6')}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <h3 className="heading-section">{planDisplayName(p, locale)}</h3>
                  <span className="flex shrink-0 items-center gap-1">
                    {p.isFree && <Badge tone="sage">{tb('freePlan')}</Badge>}
                    {isCurrent && <Badge tone="walnut">{t('subscription.current')}</Badge>}
                  </span>
                </div>
                <div>
                  <p>
                    <span className="font-mono text-3xl font-medium">{formatAmount(p.priceRon, locale)}</span>{' '}
                    <span className="text-sm text-muted-foreground">
                      {p.isFree ? t('subscription.priceSuffixFree') : t('subscription.priceSuffix')}
                    </span>
                  </p>
                  {/* totalul cu TVA ramane la vedere pentru cine plateste (acelasi calcul ca pe comanda) */}
                  {canBuy && !p.isFree && (
                    <p className="data-mono mt-1 text-muted-foreground">
                      {tb('totalWithVat', { total: money(p.totalRon), rate: p.vatRate })}
                    </p>
                  )}
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  <PlanFeature>{t('subscription.includedCredits', { n: p.includedCredits })}</PlanFeature>
                  {marketplace && <PlanFeature>{gatingText(p.gatingDelayMinutes)}</PlanFeature>}
                  <PlanFeature included={marketplace}>
                    {marketplace
                      ? t('subscription.planMarketplaceAccess.included')
                      : t('subscription.planMarketplaceAccess.notIncluded')}
                  </PlanFeature>
                </ul>
                {/* planul de 0 lei nu se cumpara online (409 PLAN_NOT_PURCHASABLE) — il activeaza adminul */}
                {p.isFree ? (
                  <p className="mt-auto text-xs text-muted-foreground">{tb('freePlanNote')}</p>
                ) : (
                  canBuy && (
                    <Button
                      type="button"
                      variant={isCurrent || !sub ? 'default' : 'outline'}
                      className="mt-auto h-11"
                      disabled={payDisabled}
                      onClick={() => onBuy(p)}
                    >
                      {isCurrent ? t('subscription.extend') : t('subscription.activate')}
                    </Button>
                  )
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PlanFeature({ included = true, children }: { included?: boolean; children: ReactNode }) {
  const Icon = included ? Check : Minus;
  return (
    <li className={cn('flex gap-2.5', !included && 'text-muted-foreground')}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', included ? 'text-sage' : 'text-muted-2')} aria-hidden />
      <span>{children}</span>
    </li>
  );
}
