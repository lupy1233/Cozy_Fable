'use client';

import type { CreditPackageDto } from '@marketplace/shared';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMoney } from '@/hooks/use-money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonStatGrid } from '@/components/ui/skeleton';
import { firmRulesChunk } from '../../../_components/firm-rules-link';

// Cumpara credite — pachetele active, cu pretul fara TVA, pretul pe credit si totalul cu TVA.
export function CreditPackagesSection({
  pending,
  loaded,
  packages,
  stripeEnabled,
  noSubscription,
  payDisabled,
  onBuy,
}: {
  pending: boolean;
  loaded: boolean;
  packages: CreditPackageDto[] | undefined;
  stripeEnabled: boolean;
  /** E-company-21: creditele se folosesc doar cu abonament activ — nota informativa */
  noSubscription: boolean;
  payDisabled: boolean;
  onBuy: (pkg: CreditPackageDto) => void;
}) {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');
  const money = useMoney();

  return (
    <section id="packages" aria-labelledby="wallet-packages-title" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 id="wallet-packages-title" className="font-serif text-2xl leading-tight">
          {tb('buyCredits')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {stripeEnabled ? tb('buyCreditsIntro') : tb('buyCreditsIntroBank')}
        </p>
        <p className="text-ui text-muted-foreground">
          {tb.rich('rulesNotice', { rules: firmRulesChunk('settlement') })}
        </p>
      </div>

      {/* cumpararea ramane permisa fara abonament (SubscriptionActiveGuard e doar pe preluare) */}
      {noSubscription && (
        <Alert tone="amber" icon={<AlertTriangle />}>
          {tb('noSubscriptionCreditsNote')}
        </Alert>
      )}

      {pending && <SkeletonStatGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
      {loaded && packages?.length === 0 && <EmptyState size="sm" variant="card" title={tb('noPackages')} />}
      {packages && packages.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
          {packages.map((p) => {
            // pretul pe credit, din pretul fara TVA al pachetului
            const perCredit = p.credits > 0 ? p.priceRon / p.credits : null;
            return (
              <Card
                key={p.id}
                as="article"
                padding="lg"
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
              >
                <div className="min-w-0">
                  <h3 className="font-serif text-2xl leading-tight">
                    {p.credits} {t('credits')}
                  </h3>
                  <p className="data-mono mt-1 text-muted-foreground">
                    {tb('priceExVat', { price: money(p.priceRon) })}
                    {perCredit !== null && (
                      <>
                        {' · '}
                        {tb('perCredit', { price: money(perCredit) })}
                      </>
                    )}
                  </p>
                  <p className="data-mono text-muted-foreground">
                    {tb('totalWithVat', { total: money(p.totalRon), rate: p.vatRate })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-foreground px-[18px]"
                  disabled={payDisabled}
                  aria-label={tb('buyPackageAria', { n: p.credits })}
                  onClick={() => onBuy(p)}
                >
                  {tb('buy')}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
