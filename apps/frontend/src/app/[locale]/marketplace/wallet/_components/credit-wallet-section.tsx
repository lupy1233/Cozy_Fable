'use client';

import type { CreditWalletDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonStatGrid } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

// Portofelul de credite: soldul disponibil sus, mare; rezervate + total alaturi.
export function CreditWalletSection({
  pending,
  wallet,
  canBuy,
  readOnlyNote,
}: {
  pending: boolean;
  wallet: CreditWalletDto | undefined;
  /** OWNER/MANAGER: apare actiunea "Cumpara credite" (ancora la pachete) */
  canBuy: boolean;
  /** angajat: nota ca doar proprietarul/managerul cumpara si vede comenzile */
  readOnlyNote: boolean;
}) {
  const t = useTranslations('Marketplace');
  const tb = useTranslations('Billing');

  return (
    <section id="credits" aria-labelledby="wallet-credits-title" className="flex scroll-mt-24 flex-col gap-4">
      <h2 id="wallet-credits-title" className="font-serif text-2xl leading-tight">
        {t('wallet.title')}
      </h2>
      <Card padding="lg" className="shadow">
        {pending ? (
          <SkeletonStatGrid count={3} variant="inline" className="sm:grid-cols-3 lg:grid-cols-3" />
        ) : wallet ? (
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
            <div className="flex flex-[1_1_240px] flex-col gap-4">
              <div>
                <div className="label">{t('wallet.available')}</div>
                <div className="font-serif text-6xl leading-none">{wallet.available}</div>
              </div>
              {canBuy && (
                <Button asChild variant="walnut" size="xl" className="self-start">
                  <a href="#packages">{tb('buyCredits')}</a>
                </Button>
              )}
            </div>
            <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard variant="inline" label={t('wallet.reserved')} value={wallet.reserved} />
                <StatCard
                  variant="inline"
                  label={t('wallet.totalHeld')}
                  value={wallet.balance + wallet.reserved}
                />
              </div>
              <p className="text-ui text-muted-foreground">{t('wallet.reservedHint')}</p>
              {/* preluarile au pagina lor; de aici doar trimiterea */}
              <Link
                href="/marketplace/claims"
                className="inline-flex min-h-11 items-center self-start text-sm font-medium text-walnut underline-offset-4 hover:underline"
              >
                {t('myClaims.goToPage')} →
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState size="sm" variant="plain" title={t('wallet.none')} />
        )}
        {readOnlyNote && (
          <Alert tone="neutral" className="mt-4">
            {t('wallet.readOnlyNote')}
          </Alert>
        )}
      </Card>
    </section>
  );
}
