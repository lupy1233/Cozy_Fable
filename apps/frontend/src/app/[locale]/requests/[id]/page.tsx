'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useDeleteRequest, useRepostRequest, useRequest } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { RequestInspirationStrip } from '@/components/configurator/request-inspiration-strip';
import { StudioScenesButton } from '@/components/studio/scene-button';

export default function RequestDetailPage() {
  const t = useTranslations('Requests');
  const format = useFormatter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useRequest(id);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(`mm_req_token_${id}`));
  }, [id]);

  if (detail.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (detail.isError || !detail.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('empty')}</p>;
  }

  const r = detail.data;

  const hasOffers = [
    'CLAIMED_PARTIAL',
    'CLAIMED_FULL',
    'OFFERS_RECEIVED',
    'NEGOTIATION',
    'ACCEPTED',
    'DELIVERED_BY_COMPANY',
    'COMPLETED',
    'DISPUTED',
  ].includes(r.status);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Link href="/requests" className="self-start text-sm text-walnut hover:underline">
        ← {t('myRequests')}
      </Link>

      {/* Fisa proiectului — cartus de plansa tehnica: colturi de registru +
          grid de celule cu hairline-uri interioare (acelasi motiv ca wizard-ul) */}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r border-ink/30" />

        <div className="border border-ink/15 bg-surface shadow-sm">
          {/* randul principal: titlu serif + statusul in celula proprie */}
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1 px-5 py-4 sm:px-6">
              <h1 className="page-title">{r.title}</h1>
            </div>
            {/* pe mobil statusul coboara sub titlu, ca un rand propriu de cartus */}
            <div className="flex shrink-0 flex-col items-start gap-1.5 border-t border-ink/15 px-5 py-3.5 sm:border-l sm:border-t-0 sm:px-6 sm:py-4">
              <span className="label">{t('status')}</span>
              <StatusBadge status={r.status} label={t(`statusValue.${r.status}`)} />
            </div>
          </div>

          {/* nota clientului pe plansa */}
          <p className="border-t border-ink/15 px-5 py-3.5 font-serif text-sm italic text-muted-foreground sm:px-6">
            {r.description}
          </p>

          {/* celulele de specificatii — 2 coloane pe mobil, 4 pe desktop;
              marimea/costul in credite si coordonatele nu se afiseaza clientului */}
          <div className="flex flex-wrap overflow-hidden">
            <SheetCell label={t('field.budgetRange')}>{t(`budget.${r.budgetRange}`)}</SheetCell>
            {r.deadlineBucket && (
              <SheetCell label={t('field.desiredDeadline')}>
                {t(`deadline.${r.deadlineBucket}`)}
              </SheetCell>
            )}
            <SheetCell label={t('field.addressText')}>
              {r.addressText}, {r.city}, {r.county}
            </SheetCell>
            {r.expiresAt && (
              <SheetCell label={t('expiresAt')}>
                {/* data localizata, fara secunde — adnotare de cartus, nu timestamp */}
                {format.dateTime(new Date(r.expiresAt), { dateStyle: 'medium', timeStyle: 'short' })}
              </SheetCell>
            )}
          </div>

          {/* subsolul cartusului: adnotarea de revizie + actiunile */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-ink/15 px-5 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-muted-2">
                {t('editsUsed')}: {r.preClaimEditsUsed}/3 · {r.postClaimEditsUsed}/1
              </span>
              <EditRequestButton
                id={id}
                status={r.status}
                preUsed={r.preClaimEditsUsed}
                postUsed={r.postClaimEditsUsed}
              />
            </div>
            {hasOffers && (
              <Button asChild variant="walnut" size="sm">
                <Link href={`/requests/${id}/offers`}>{t('viewOffers')}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Camere — prezentare structurata per camera (item 6) */}
      <div className="flex flex-col gap-3">
        <SectionHeading>{t('sectionRooms')}</SectionHeading>
        {/* camera 3D din Studio (feedback PO r3) — cum a aranjat-o clientul */}
        <StudioScenesButton scenes={r.studioScenes} />
        <RoomSpecNav rooms={r.rooms} />
        {r.rooms.map((room, i) => (
          <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={r.attachments} />
        ))}
      </div>

      {/* Atasamente — statusul de scanare nu se afiseaza; doar eroarea (item 10) */}
      {r.attachments.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading>{t('sectionAttachments')}</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {r.attachments.map((a) => (
              <AttachmentThumb key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* inspiratia aleasa din galerie (F6) */}
      <RequestInspirationStrip ids={r.inspirationPhotoIds} />

      {r.status === 'EXPIRED' && token && <RepostButton id={id} token={token} />}

      {['DRAFT', 'IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'EXPIRED'].includes(
        r.status,
      ) && <DeleteRequestButton id={id} />}
    </div>
  );
}

// Celula de cartus: eticheta mica uppercase deasupra valorii. Celulele cresc
// ca sa umple mereu randul (numarul lor variaza); hairline-uri interioare prin
// border-l/border-t, iar -ml-px + overflow-hidden pe container ascunde
// border-l al primei celule de pe fiecare rand.
function SheetCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="-ml-px min-w-0 grow basis-1/2 border-l border-t border-ink/15 px-5 py-3.5 sm:px-6 md:basis-1/4">
      <span className="label block">{label}</span>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

// Titlu de sectiune: serif + hairline rule pana la margine — liniste disciplinata.
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 font-serif text-xl">{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-ink/15" />
    </div>
  );
}

// Editare: 3 edit-uri pre-claim (IN_MARKETPLACE), 1 post-claim (inainte de oferte).
// Post-claim: avertizare — scoringul se recalculeaza, dar claim-urile firmelor
// raman pe snapshot (docs/03 §4.3); firmele pot retrage claim-ul dupa modificare.
function EditRequestButton({
  id,
  status,
  preUsed,
  postUsed,
}: {
  id: string;
  status: string;
  preUsed: number;
  postUsed: number;
}) {
  const t = useTranslations('Requests');
  const router = useRouter();

  const preClaim = status === 'IN_MARKETPLACE';
  const postClaim = status === 'CLAIMED_PARTIAL' || status === 'CLAIMED_FULL';
  if (!preClaim && !postClaim) return null;

  const remaining = preClaim ? 3 - preUsed : 1 - postUsed;
  if (remaining <= 0) return null;

  const go = () => {
    if (postClaim && !confirm(t('editPostClaimWarning'))) return;
    router.push(`/requests/${id}/edit`);
  };

  return (
    <Button variant="outline" size="sm" onClick={go}>
      {t('editRequest', { remaining })}
    </Button>
  );
}

function DeleteRequestButton({ id }: { id: string }) {
  const t = useTranslations('Requests');
  const router = useRouter();
  const del = useDeleteRequest();
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <button
        onClick={() => {
          if (confirm(t('deleteConfirm'))) {
            del.mutate(id, { onSuccess: () => router.replace('/requests') });
          }
        }}
        disabled={del.isPending}
        className="self-start text-sm text-crimson hover:underline disabled:opacity-50"
      >
        {t('deleteRequest')}
      </button>
    </div>
  );
}

function RepostButton({ id, token }: { id: string; token: string }) {
  const t = useTranslations('Requests');
  const repost = useRepostRequest(token);
  const apiErr = repost.error instanceof ApiError ? repost.error.code : null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="walnut"
        className="self-start"
        onClick={() => repost.mutate()}
        disabled={repost.isPending}
      >
        {t('repost')}
      </Button>
      {apiErr && (
        <p className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}
      {repost.isSuccess && <p className="text-sm text-sage">{t('reposted')}</p>}
    </div>
  );
}
