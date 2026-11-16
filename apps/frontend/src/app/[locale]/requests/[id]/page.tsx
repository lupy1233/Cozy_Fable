'use client';

import type { RequestStatus } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDeleteRequest, useRepostRequest, useRequest, useRequestVisibility } from '@/hooks/use-requests';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { RequestInspirationByRoom } from '@/components/configurator/request-inspiration-by-room';
import { StudioScenesButton } from '@/components/studio/scene-button';
import {
  NEXT_STEP_TONE,
  RequestJourney,
  RequestStatusBadge,
  isClientTurn,
  useRequestNextStep,
  type NextStepTone,
  type RequestProgressFacts,
} from '../../_components/request-progress';
import { RequestVisibilitySection } from '../../_components/request-visibility-card';

// Limitele de editare (docs/03 §4.3): 3 inainte de prima preluare, 1 dupa.
const MAX_PRE_CLAIM_EDITS = 3;
const MAX_POST_CLAIM_EDITS = 1;

// Starile in care cererea are (sau a avut) firme, oferte si conversatii de deschis.
const STATUSES_WITH_OFFERS: RequestStatus[] = [
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
  'COMPLETED',
  'DISPUTED',
  // E-admin-platform-3: proiect anulat — ofertele si conversatiile raman ca istoric
  'CANCELLED',
];

// Starile din care clientul mai poate sterge cererea (Î17).
const DELETABLE_STATUSES: RequestStatus[] = [
  'DRAFT',
  'IN_MARKETPLACE',
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'EXPIRED',
];

const BAND_TEXT: Record<NextStepTone, string> = {
  amber: 'text-amber',
  info: 'text-info',
  sage: 'text-sage',
  crimson: 'text-crimson',
  muted: 'text-ink-2',
};

export default function RequestDetailPage() {
  const t = useTranslations('Requests');
  const format = useFormatter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useRequest(id);
  // aceeasi interogare ca in cardul „Cine vede cererea”: de aici vin firmele cu preluare
  // si cate dintre ele au trimis oferta (pentru banda „pasul urmator”)
  const visibility = useRequestVisibility(id, !!detail.data && detail.data.status !== 'DRAFT');
  const next = useRequestNextStep();

  if (detail.isPending) {
    return (
      <QueryState pending onRetry={() => void detail.refetch()} skeleton={<SkeletonPage variant="detail" />} />
    );
  }
  if (detail.isError || !detail.data) {
    // cerere inexistenta / a altcuiva → mesajul de gol; orice alta eroare se poate reincerca
    const missing =
      !detail.isError || (detail.error instanceof ApiError && [403, 404].includes(detail.error.status));
    if (!missing) return <LoadError onRetry={() => void detail.refetch()} />;
    return (
      <EmptyState
        variant="card"
        title={t('empty')}
        action={
          <Button asChild variant="outline">
            <Link href="/requests">← {t('myRequests')}</Link>
          </Button>
        }
      />
    );
  }

  const r = detail.data;
  const hasOffers = STATUSES_WITH_OFFERS.includes(r.status);
  const yourTurn = isClientTurn(r.status);
  const tone = NEXT_STEP_TONE[r.status] ?? 'muted';

  const holders = visibility.data?.contactHolders ?? null;
  const facts: RequestProgressFacts = {
    status: r.status,
    claims: holders ? holders.filter((h) => h.claimStatus !== 'COMPLETED').length : null,
    offers: holders ? holders.filter((h) => h.claimStatus === 'OFFER_SENT').length : null,
    expiresAt: r.expiresAt,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/requests"
          className="inline-flex min-h-11 items-center self-start text-sm text-walnut hover:underline"
        >
          ← {t('myRequests')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="page-title min-w-0 break-words">{r.title || t('untitled')}</h1>
          <RequestStatusBadge status={r.status} />
        </div>
      </header>

      {/* drumul cererii: jaloanele prin care trece, cu pasul curent marcat */}
      <RequestJourney status={r.status} />

      {/* pasul urmator + butonul lui; cererea expirata are propria banda (republicare) */}
      {r.status !== 'EXPIRED' && (
        <Card
          role="status"
          tone={tone}
          padding="none"
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
        >
          <div className={cn('flex min-w-0 flex-[1_1_320px] flex-col gap-0.5', BAND_TEXT[tone])}>
            <p className="font-semibold">{next.title(facts)}</p>
            <p className="text-ui">{next.body(facts)}</p>
          </div>
          {hasOffers && (
            <Button
              asChild
              variant={yourTurn ? 'walnut' : 'outline'}
              size={yourTurn ? 'xl' : 'lg'}
              className={cn('w-full sm:w-auto', yourTurn && 'px-6 text-sm')}
            >
              <Link href={`/requests/${id}/offers`}>
                {r.status === 'DELIVERED_BY_COMPANY' ? t('next.cta.confirmDelivery') : t('viewOffers')}
              </Link>
            </Button>
          )}
        </Card>
      )}
      <RepostSection id={id} status={r.status} repostUsed={r.repostUsed} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Fisa proiectului: nota clientului + specificatiile; marimea/costul in credite
              si coordonatele nu se afiseaza clientului */}
          <Card as="section" padding="none" aria-label={t('sheet.label')}>
            {r.description && (
              <p className="break-words px-5 py-5 font-serif text-lg italic leading-relaxed text-ink-2 sm:px-6">
                <q>{r.description}</q>
              </p>
            )}
            <dl
              className={cn(
                'grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))]',
                r.description && 'border-t border-border',
              )}
            >
              <SheetCell label={t('field.budgetRange')}>{t(`budget.${r.budgetRange}`)}</SheetCell>
              {r.deadlineBucket && (
                <SheetCell label={t('field.desiredDeadline')}>{t(`deadline.${r.deadlineBucket}`)}</SheetCell>
              )}
              <SheetCell label={t('field.addressText')}>
                {r.addressText}, {r.city}, {r.county}
              </SheetCell>
              {r.expiresAt && (
                <SheetCell label={t('expiresAt')} mono>
                  {/* data localizata, fara secunde */}
                  {format.dateTime(new Date(r.expiresAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </SheetCell>
              )}
            </dl>
          </Card>

          {/* Camere — prezentare structurata per camera (item 6) */}
          <section aria-labelledby="request-rooms-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="request-rooms-title" className="font-serif text-2xl">
                {t('sectionRooms')}
              </h2>
              {/* camera 3D din Studio (feedback PO r3) — cum a aranjat-o clientul */}
              <StudioScenesButton scenes={r.studioScenes} />
            </div>
            <RoomSpecNav rooms={r.rooms} />
            {r.rooms.map((room, i) => (
              <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={r.attachments} />
            ))}
          </section>

          {/* Atasamente — statusul de scanare nu se afiseaza; doar eroarea (item 10) */}
          {r.attachments.length > 0 && (
            <section aria-labelledby="request-attachments-title" className="flex flex-col gap-3">
              <h2 id="request-attachments-title" className="font-serif text-2xl">
                {t('sectionAttachments')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {r.attachments.map((a) => (
                  <AttachmentThumb key={a.id} attachment={a} />
                ))}
              </div>
            </section>
          )}

          {/* inspiratia aleasa din galerie (F6) */}
          <RequestInspirationByRoom photos={r.inspirationPhotos} rooms={r.rooms} />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          {/* E-client-9: cine vede proiectul si cine detine datele de contact */}
          {r.status !== 'DRAFT' && <RequestVisibilitySection requestId={id} />}

          {r.status !== 'DRAFT' && (
            <EditsCard
              id={id}
              status={r.status}
              preUsed={r.preClaimEditsUsed}
              postUsed={r.postClaimEditsUsed}
            />
          )}

          {DELETABLE_STATUSES.includes(r.status) && <DeleteRequestCard id={id} />}
        </aside>
      </div>
    </div>
  );
}

// Celula din fisa proiectului: eticheta mica deasupra valorii.
function SheetCell({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4 sm:px-6">
      <dt className="label">{label}</dt>
      <dd className={cn('break-words', mono ? 'font-mono text-ui' : 'font-medium')}>{children}</dd>
    </div>
  );
}

// Editare: 3 edit-uri pre-claim (IN_MARKETPLACE), 1 post-claim (inainte de oferte).
// Post-claim: avertizare — scoringul se recalculeaza, dar claim-urile firmelor
// raman pe snapshot (docs/03 §4.3); firmele pot retrage claim-ul dupa modificare.
function EditsCard({
  id,
  status,
  preUsed,
  postUsed,
}: {
  id: string;
  status: RequestStatus;
  preUsed: number;
  postUsed: number;
}) {
  const t = useTranslations('Requests');
  const router = useRouter();

  const preClaim = status === 'IN_MARKETPLACE';
  const postClaim = status === 'CLAIMED_PARTIAL' || status === 'CLAIMED_FULL';
  const remaining = preClaim ? MAX_PRE_CLAIM_EDITS - preUsed : postClaim ? MAX_POST_CLAIM_EDITS - postUsed : 0;
  const canEdit = (preClaim || postClaim) && remaining > 0;

  const note = canEdit
    ? preClaim
      ? t('edits.preClaim', { remaining })
      : t('edits.postClaim')
    : preClaim || postClaim
      ? t('edits.noneLeft')
      : t('edits.locked');

  const go = () => {
    if (postClaim && !confirm(t('editPostClaimWarning'))) return;
    router.push(`/requests/${id}/edit`);
  };

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="request-edits-title"
      className="flex flex-col gap-3 px-5 py-5 sm:px-6"
    >
      <h2 id="request-edits-title" className="heading-section">
        {t('edits.title')}
      </h2>
      <p className="text-ui text-muted-foreground">{note}</p>
      <p className="font-mono text-xs text-muted-foreground">
        {t('edits.used', {
          pre: preUsed,
          preMax: MAX_PRE_CLAIM_EDITS,
          post: postUsed,
          postMax: MAX_POST_CLAIM_EDITS,
        })}
      </p>
      {canEdit && (
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={go}>
          {t('editRequest', { remaining })}
        </Button>
      )}
    </Card>
  );
}

// Î17 — stergerea cererii, cu confirmare; preluarile active ale firmelor se anuleaza.
function DeleteRequestCard({ id }: { id: string }) {
  const t = useTranslations('Requests');
  const router = useRouter();
  const del = useDeleteRequest();
  return (
    <Card
      as="section"
      tone="dashed"
      padding="none"
      aria-labelledby="request-delete-title"
      className="flex flex-col gap-2 border-crimson/30 bg-transparent px-5 py-5 sm:px-6"
    >
      <h2 id="request-delete-title" className="text-sm font-semibold">
        {t('deleteSection.title')}
      </h2>
      <p className="text-ui text-muted-foreground">{t('deleteSection.hint')}</p>
      <button
        type="button"
        onClick={() => {
          if (confirm(t('deleteConfirm'))) {
            del.mutate(id, { onSuccess: () => router.replace('/requests') });
          }
        }}
        disabled={del.isPending}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-crimson hover:underline disabled:opacity-50"
      >
        {t('deleteRequest')}…
      </button>
    </Card>
  );
}

// Repost (docs/03 4.4: o singura data, manual) din contul proprietarului, fara token
// local. Montat mereu: mesajul de succes ramane vizibil dupa ce statusul devine
// IN_MARKETPLACE; dupa un repost folosit, explicatie + cerere noua (C4-4/WF1-12).
// Pentru o cerere expirata, aceasta e banda „pasul urmator” a fisei.
function RepostSection({ id, status, repostUsed }: { id: string; status: RequestStatus; repostUsed: boolean }) {
  const t = useTranslations('Requests');
  const repost = useRepostRequest(id);
  if (repost.isSuccess) {
    return (
      <Alert tone="sage" role="status">
        {t('reposted')}
      </Alert>
    );
  }
  if (status !== 'EXPIRED') return null;
  if (repostUsed) {
    return (
      <Card
        tone="muted"
        padding="none"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
      >
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <p className="font-semibold">{t('next.title.EXPIRED')}</p>
          <p className="text-ui text-muted-foreground">{t('repostUsedNote')}</p>
        </div>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/requests/new">{t('repostStartNew')}</Link>
        </Button>
      </Card>
    );
  }
  const apiErr = repost.error instanceof ApiError ? repost.error.code : null;
  return (
    <Card
      tone="amber"
      padding="none"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
    >
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5 text-amber">
        <p className="font-semibold">{t('next.title.EXPIRED')}</p>
        <p className="text-ui">{t('repostHint')}</p>
        {apiErr && (
          <p role="alert" className="text-ui text-crimson">
            {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="walnut"
        size="xl"
        className="w-full px-6 text-sm sm:w-auto"
        onClick={() => repost.mutate()}
        disabled={repost.isPending}
      >
        {t('repost')}
      </Button>
    </Card>
  );
}
