'use client';

import type { MarketplaceDetailDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useClaim, useMarketplaceDetail, useWallet } from '@/hooks/use-marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { RequestInspirationStrip } from '@/components/configurator/request-inspiration-strip';
import { useRelativeTime } from '@/lib/relative-time';

export default function MarketplaceDetailPage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useMarketplaceDetail(id);
  const relTime = useRelativeTime();

  if (detail.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (detail.isError || !detail.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('empty')}</p>;
  }

  const r = detail.data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/marketplace" className="text-sm text-walnut hover:underline">
        ← {t('back')}
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h1 className="page-title">{r.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {r.size && (
            <span>
              {t('size')}: <strong>{tr(`sizeValue.${r.size}`)}</strong> · {r.creditCost}{' '}
              {t('credits')}
            </span>
          )}
          <span>
            {tr('field.budgetRange')}: {tr(`budget.${r.budgetRange}`)}
          </span>
          <span>{t('distance', { km: r.distanceKm.toFixed(1) })}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {r.city}, {r.county}
        </p>
        {r.deadlineBucket && (
          <p className="text-sm text-muted-foreground">
            {t('desiredDeadline')}: {tr(`deadline.${r.deadlineBucket}`)}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-muted-2">
          {relTime(r.publishedAt)} ·{' '}
          {t('slots', { active: r.activeClaims, max: r.maxClaims })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.includesPaidDesign && <Badge tone="sage">{t('includesPaidDesign')}</Badge>}
          {r.hasOwnProject && <Badge tone="info">{t('hasOwnProject')}</Badge>}
        </div>
      </div>

      {/* Camere (fara date de contact pre-claim, invarianta 4.2) — prezentare
          structurata per camera, cu navigare cand sunt multe (item 6) */}
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">{t('sectionRooms')}</h2>
        <RoomSpecNav rooms={r.rooms} />
        {r.rooms.map((room, i) => (
          <RoomSpecCard key={room.id} room={room} index={i + 1} />
        ))}
      </div>

      {/* inspiratia aleasa de client din galerie (F6) */}
      <RequestInspirationStrip ids={r.inspirationPhotoIds} />

      <ClaimPanel request={r} />
    </div>
  );
}

function ClaimPanel({ request }: { request: MarketplaceDetailDto }) {
  const t = useTranslations('Marketplace');
  const router = useRouter();
  const claim = useClaim();
  const wallet = useWallet();

  const full = request.activeClaims >= request.maxClaims;
  const insufficient =
    wallet.data != null &&
    request.creditCost != null &&
    wallet.data.available < request.creditCost;
  const apiErr = claim.error instanceof ApiError ? claim.error.code : null;

  if (request.alreadyClaimedByMyCompany) {
    return (
      <div className="rounded-xl border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage">
        {t('alreadyClaimed')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {request.creditCost != null && (
            <>
              {t('claimCost', { n: request.creditCost })}
              {wallet.data && ` · ${t('availableCredits', { n: wallet.data.available })}`}
            </>
          )}
        </div>
        <Button
          variant="walnut"
          size="lg"
          onClick={() =>
            claim.mutate(
              { requestId: request.id },
              { onSuccess: () => router.push('/marketplace/wallet') },
            )
          }
          disabled={claim.isPending || full || insufficient}
        >
          {claim.isPending ? t('claiming') : full ? t('full') : t('claim')}
        </Button>
      </div>

      {insufficient && !apiErr && (
        <p className="text-sm text-amber">{t('apiErrors.INSUFFICIENT_CREDITS')}</p>
      )}
      {apiErr && (
        <p className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}
      {claim.isSuccess && <p className="text-sm text-sage">{t('claimSuccess')}</p>}
    </div>
  );
}
