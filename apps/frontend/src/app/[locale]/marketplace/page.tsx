'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ArrowRight, Inbox } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMarketplace, useWallet } from '@/hooks/use-marketplace';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { SlotTrack } from '@/components/ui/slot-track';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { useRelativeTime } from '@/lib/relative-time';
import { distanceLabel } from '@/lib/marketplace-distance';
import { AccessBlocked } from './_components/access-blocked';

export default function MarketplacePage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const list = useMarketplace();
  const wallet = useWallet();
  const relTime = useRelativeTime();

  // Acces doar COMPANY_USER; restul → dashboard / login
  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="list" />} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Link
            href="/marketplace/wallet"
            className="inline-flex items-center gap-1.5 text-sm text-walnut hover:underline"
          >
            {wallet.data ? t('availableCredits', { n: wallet.data.available }) : t('walletLink')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {list.isPending && <SkeletonList variant="cards" rows={4} className="lg:grid-cols-2" />}
      {/* 403/404 (firma neaprobata / suspendata / fara abonament) → ecran de blocaj cu CTA */}
      {list.isError && <AccessBlocked error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" icon={Inbox} title={t('empty')} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.data?.map((r) => (
          <Card key={r.id} asChild interactive className="grid grid-cols-[1fr_auto] gap-4">
          <Link href={`/marketplace/${r.id}`}>
            <div className="min-w-0">
              <h2 className="heading-section">
                <ContactSafeText text={r.title} />
              </h2>
              <p className="mt-1.5 line-clamp-2 text-ui text-muted-foreground">
                <ContactSafeText text={r.description} />
              </p>
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
              <span title={t('distanceHint')}>
                <Badge tone="outline">{distanceLabel(r, t)}</Badge>
              </span>
              <div className="flex flex-col items-end gap-1.5">
                <SlotTrack
                  filled={r.activeClaims}
                  total={r.maxClaims}
                  warn={r.activeClaims >= r.maxClaims}
                />
                <span className="font-mono text-meta text-muted-foreground">
                  {t('slots', { active: r.activeClaims, max: r.maxClaims })}
                </span>
                <span className="font-mono text-meta text-muted-2">
                  {relTime(r.publishedAt)}
                </span>
                {r.alreadyClaimedByMyCompany && (
                  <Badge tone="sage" dot>
                    {t('alreadyClaimed')}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
