'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMarketplace, useWallet } from '@/hooks/use-marketplace';
import { Badge } from '@/components/ui/badge';
import { SlotTrack } from '@/components/ui/slot-track';

export default function MarketplacePage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const list = useMarketplace();
  const wallet = useWallet();

  // Acces doar COMPANY_USER; restul → dashboard / login
  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/marketplace/wallet"
          className="inline-flex items-center gap-1.5 text-sm text-walnut hover:underline"
        >
          {wallet.data ? t('availableCredits', { n: wallet.data.available }) : t('walletLink')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {list.isPending && <p className="py-10 text-center text-muted-foreground">{t('loading')}</p>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted-foreground">
          {t('empty')}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.data?.map((r) => (
          <Link
            key={r.id}
            href={`/marketplace/${r.id}`}
            className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 ease-ease hover:-translate-y-0.5 hover:border-border-2 hover:shadow"
          >
            <div className="min-w-0">
              <h2 className="font-serif text-xl tracking-[-0.01em]">{r.title}</h2>
              <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="muted">
                  {r.city}, {r.county}
                </Badge>
                {r.size && (
                  <Badge tone="walnut">
                    {tr(`sizeValue.${r.size}`)} · {r.creditCost} {t('credits')}
                  </Badge>
                )}
                <Badge tone="muted">{tr(`budget.${r.budgetRange}`)}</Badge>
                {r.includesPaidDesign && <Badge tone="sage">{t('includesPaidDesign')}</Badge>}
                {r.hasOwnProject && <Badge tone="info">{t('hasOwnProject')}</Badge>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-3 text-right">
              <Badge tone="outline">{t('distance', { km: r.distanceKm.toFixed(1) })}</Badge>
              <div className="flex flex-col items-end gap-1.5">
                <SlotTrack
                  filled={r.activeClaims}
                  total={r.maxClaims}
                  warn={r.activeClaims >= r.maxClaims}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {t('slots', { active: r.activeClaims, max: r.maxClaims })}
                </span>
                <span className="font-mono text-[11px] text-muted-2">
                  {t('publishedAgo', { min: r.publishedAgoMinutes })}
                </span>
                {r.alreadyClaimedByMyCompany && (
                  <Badge tone="sage" dot>
                    {t('alreadyClaimed')}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
