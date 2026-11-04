'use client';

import type { MarketplaceDetailDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useClaim, useMarketplaceDetail, useWallet } from '@/hooks/use-marketplace';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { firmRulesChunk } from '../../_components/firm-rules-link';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { RequestInspirationByRoom } from '@/components/configurator/request-inspiration-by-room';
import { StudioScenesButton } from '@/components/studio/scene-button';
import { useRelativeTime } from '@/lib/relative-time';
import { distanceLabel } from '@/lib/marketplace-distance';

export default function MarketplaceDetailPage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useMarketplaceDetail(id);
  const relTime = useRelativeTime();

  if (detail.isPending) {
    return <SkeletonPage variant="detail" />;
  }
  if (detail.isError || !detail.data) {
    return (
      <EmptyState
        tone="error"
        variant="card"
        title={t('empty')}
        action={
          <Link href="/marketplace" className="text-sm text-walnut hover:underline">
            ← {t('back')}
          </Link>
        }
      />
    );
  }

  const r = detail.data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader back={{ href: '/marketplace', label: t('back') }} title={<ContactSafeText text={r.title} />} />

      <Card>
        <p className="text-sm text-muted-foreground">
          <ContactSafeText text={r.description} />
        </p>
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
          <span title={t('distanceHint')}>{distanceLabel(r, t)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('distanceHint')}</p>
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
      </Card>

      {/* Camere (fara date de contact pre-claim, invarianta 4.2) — prezentare
          structurata per camera, cu navigare cand sunt multe (item 6).
          Atasamentele (PO r6) aduc schitele + snapshotul PNG al pieselor 3D. */}
      <div className="flex flex-col gap-3">
        <h2 className="heading-section">{t('sectionRooms')}</h2>
        {/* camera 3D din Studio (feedback PO r3): amplasarea exacta, read-only */}
        <StudioScenesButton scenes={r.studioScenes} />
        <RoomSpecNav rooms={r.rooms} />
        {r.rooms.map((room, i) => (
          <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={r.attachments} />
        ))}
      </div>

      {/* inspiratia aleasa de client din galerie (F6), grupata pe camere; notitele sunt mascate pre-claim */}
      <RequestInspirationByRoom photos={r.inspirationPhotos} rooms={r.rooms} />

      <ClaimPanel request={r} />
    </div>
  );
}

function ClaimPanel({ request }: { request: MarketplaceDetailDto }) {
  const t = useTranslations('Marketplace');
  const router = useRouter();
  const claim = useClaim();
  const wallet = useWallet();
  const tu = useTranslations('Legal.firmRules.units');
  // E-company-6: preluarea rezerva credite → dialog cu costul, soldul ramas si regulile de retragere
  const [confirmOpen, setConfirmOpen] = useState(false);
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;

  const full = request.activeClaims >= request.maxClaims;
  const insufficient =
    wallet.data != null &&
    request.creditCost != null &&
    wallet.data.available < request.creditCost;
  const apiErr = claim.error instanceof ApiError ? claim.error.code : null;
  const apiErrText = apiErr
    ? t.has(`apiErrors.${apiErr}`)
      ? t(`apiErrors.${apiErr}`)
      : t('apiErrors.INTERNAL_ERROR')
    : null;

  if (request.alreadyClaimedByMyCompany) {
    return (
      <Card tone="sage" padding="sm" className="py-3 text-sm text-sage">
        {t('alreadyClaimed')}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
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
          onClick={() => {
            claim.reset();
            setConfirmOpen(true);
          }}
          disabled={claim.isPending || full || insufficient}
        >
          {claim.isPending ? t('claiming') : full ? t('full') : t('claim')}
        </Button>
      </div>

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('claimConfirmTitle', { title: request.title })}
        confirmLabel={t('claimConfirmCta')}
        cancelLabel={t('claimConfirmCancel')}
        pendingLabel={t('claiming')}
        pending={claim.isPending}
        error={apiErrText}
        confirmDisabled={full || insufficient}
        onConfirm={() =>
          claim.mutate(
            { requestId: request.id },
            // dupa revendicare aterizezi direct in fisa de lucru (PO r6):
            // acolo atribui cererea unui angajat si vezi contactul clientului
            {
              onSuccess: (slot) => {
                setConfirmOpen(false);
                router.push(`/marketplace/claims/${slot.id}`);
              },
            },
          )
        }
      >
        {request.creditCost != null && (
          <p className="font-medium">
            {wallet.data
              ? t('claimConfirmCost', {
                  credits: tu('credit', { n: request.creditCost }),
                  after: tu('credit', { n: wallet.data.available - request.creditCost }),
                })
              : t('claimConfirmCostNoWallet', { credits: tu('credit', { n: request.creditCost }) })}
          </p>
        )}
        {rules && (
          <p>
            {t('claimConfirmGrace', {
              minutes: tu('minute', { n: rules.withdrawals.voluntaryGraceMinutes }),
              points: tu('point', { n: rules.penalties.points.VOLUNTARY_WITHDRAWAL }),
            })}
          </p>
        )}
        <p>{t('claimConfirmPayToPlay')}</p>
        <p className="text-xs text-muted-foreground">{t.rich('claimRulesNote', { rules: firmRulesChunk('sla') })}</p>
      </ActionConfirmDialog>

      {/* E-company-9: ce se intampla cu creditele + linkul la reguli (fara numere; E-company-6 reutilizeaza cheia in dialogul de confirmare) */}
      <p className="text-xs text-muted-foreground">{t.rich('claimRulesNote', { rules: firmRulesChunk('sla') })}</p>

      {insufficient && !apiErr && (
        <p className="text-sm text-amber">{t('apiErrors.INSUFFICIENT_CREDITS')}</p>
      )}
      {apiErrText && !confirmOpen && <p className="text-sm text-crimson">{apiErrText}</p>}
      {claim.isSuccess && <p className="text-sm text-sage">{t('claimSuccess')}</p>}
    </Card>
  );
}
