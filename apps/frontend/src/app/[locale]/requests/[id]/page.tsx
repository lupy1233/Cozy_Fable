'use client';

import type { RequestStatus } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { discardPendingEditSession } from '@/stores/configurator-store';
import { takePublishNotice } from '@/components/configurator/publish-notice';
import { toast } from '@/components/ui/toaster';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError, isUnauthorizedError } from '@/lib/api';
import { useLoginRedirect } from '@/lib/use-login-redirect';
import { RoleOnlyScreen } from '@/lib/require-auth';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useDeleteRequest, useRepostRequest, useRequest, useRequestVisibility } from '@/hooks/use-requests';
import { useClientFulfillment } from '@/hooks/use-fulfillment';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { useLongDate } from '../../_components/use-long-date';
import { useBudgetFormat } from '@/hooks/use-budget-format';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { roomSnapshotAttachment } from '@/components/configurator/room-snapshot';
import { useDisplayAddress } from '@/components/configurator/use-display-address';
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

// Limitele de editare (docs/03 §4.3) + regula comuna cu garda paginii de editare
import { MAX_POST_CLAIM_EDITS, MAX_PRE_CLAIM_EDITS, requestEditability } from './request-editability';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { requestStartMode } from '@/components/configurator/review-facts-card';

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

// e1: starile de dupa acceptarea unei oferte (pentru „Acceptată pe …”)
const STATUSES_AFTER_ACCEPT: RequestStatus[] = [
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
  'COMPLETED',
  'DISPUTED',
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
  const budgetFormat = useBudgetFormat();
  // b12: adresa fara dubluri (oras = judet), tara doar cand nu e Romania
  const displayAddress = useDisplayAddress();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useRequest(id);
  // aceeasi interogare ca in cardul „Cine vede cererea”: de aici vin firmele cu preluare
  // si cate dintre ele au trimis oferta (pentru banda „pasul urmator”)
  const visibility = useRequestVisibility(id, !!detail.data && detail.data.status !== 'DRAFT');
  const next = useRequestNextStep();
  const fmtLongDate = useLongDate();
  // e1: data acceptarii vine din panoul de dupa acceptare (doar dupa ce exista o oferta acceptata)
  const fulfillment = useClientFulfillment(id, !!detail.data && STATUSES_AFTER_ACCEPT.includes(detail.data.status));
  // m1: intoarcerea la cerere inchide editarea lasata in asteptare (fereastra de reluare
  // e doar pentru schimbarea limbii pe pagina de editare); "Editeaza" porneste de la server
  useEffect(() => {
    discardPendingEditSession();
  }, []);
  // b3: mesajul de reusita lasat de formular inainte de navigare — o singura data, doar
  // pentru aceasta cerere (semnul se sterge la citire)
  const tConfigurator = useTranslations('Configurator');
  useEffect(() => {
    const notice = takePublishNotice(id);
    if (notice) {
      toast.success(
        tConfigurator(
          notice === 'reposted' ? 'review.repostedToast' : notice === 'editSaved' ? 'review.editSavedToast' : 'review.publishedToast',
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // f3 (review M1): plasa de siguranta — 401 pe cerere SI „cine sunt eu” a esuat → login cu
  // intoarcere, chiar daca semnalul global n-a dus acolo (pagina nu ramane pe schelet)
  const me = useMe();
  const toLogin = useLoginRedirect();
  const unauthorized = isUnauthorizedError(detail.error);
  useEffect(() => {
    if (unauthorized && me.isError) toLogin();
  }, [unauthorized, me.isError, toLogin]);
  // f4: mesajele „nu exista sau nu e a ta” si ecranul de acces pentru alt rol
  const tAccess = useTranslations('Access');
  if (me.data && me.data.role !== 'CLIENT') return <RoleOnlyScreen role="CLIENT" />;

  // e1 / f3: sesiunea a expirat (401) → ramanem pe incarcare; ascultatorul global duce omul la login
  if (detail.isPending || (detail.error instanceof ApiError && detail.error.status === 401)) {
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
        tone="warning"
        title={tAccess('requestNotYours')}
        hint={tAccess('requestNotYoursHint')}
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
  // d5: un singur rand "Cum ai pornit cererea", cu aceeasi regula ca editarea (b8)
  const startMode = requestStartMode(r);
  const helpRooms = r.rooms
    .filter((room) => room.needsDesignHelp)
    .map((room) => tConfigurator(`rooms.type.${room.roomType}`));
  // imaginile 3D aratate deja in cardul piesei (aceeasi regula ca RoomSpecCard)
  const shownSnapshots = new Set(
    r.rooms.map((room) => roomSnapshotAttachment(room, r.attachments)?.id).filter((id): id is string => !!id),
  );
  const listedAttachments = r.attachments.filter((a) => !shownSnapshots.has(a.id));

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
              {/* b11: suma aleasa in lei (acelasi format ca in Sumar si la firma) sau 'Buget nedeclarat' */}
              <SheetCell label={t('field.budgetRange')}>{budgetFormat.amount(r)}</SheetCell>
              {r.deadlineBucket && (
                <SheetCell label={t('field.desiredDeadline')}>{t(`deadline.${r.deadlineBucket}`)}</SheetCell>
              )}
              <SheetCell label={t('field.addressText')}>
                {displayAddress(r)}
              </SheetCell>
              {/* d5: aceleasi randuri ca in Sumar — contactele transmise firmelor si modul de pornire */}
              <SheetCell label={tConfigurator('review.facts.contact')}>
                {r.contactPreferences.length > 0
                  ? r.contactPreferences.map((c) => (
                      <span key={c.id} className="block break-all">
                        {t(`contactChannel.${c.channel}`)}: {c.value}
                      </span>
                    ))
                  : tConfigurator('review.facts.notProvided')}
              </SheetCell>
              <SheetCell label={tConfigurator('review.facts.mode')}>
                {tConfigurator(`start.${startMode}.title`)}
                {startMode === 'STANDARD' && helpRooms.length > 0 && (
                  <span className="mt-0.5 block text-ui font-normal text-muted-foreground">
                    {tConfigurator('review.facts.helpRooms', { rooms: helpRooms.join(', ') })}
                  </span>
                )}
              </SheetCell>
              {/* e1: termenul de expirare conteaza doar cat cererea asteapta in piata */}
              {r.expiresAt && r.status === 'IN_MARKETPLACE' && (
                <SheetCell label={t('expiresAt')} mono>
                  {/* data localizata, fara secunde, in ora Romaniei */}
                  {format.dateTime(new Date(r.expiresAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: APP_TIME_ZONE,
                  })}
                </SheetCell>
              )}
              {STATUSES_AFTER_ACCEPT.includes(r.status) && fulfillment.data?.acceptedAt && (
                <SheetCell label={t('acceptedOn')}>{fmtLongDate(fulfillment.data.acceptedAt)}</SheetCell>
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
              <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={r.attachments} audience="client" />
            ))}
          </section>

          {/* Atasamente — statusul de scanare nu se afiseaza; doar eroarea (item 10).
              Imaginea 3D a piesei e deja in cardul piesei: nu se repeta aici. */}
          {listedAttachments.length > 0 && (
            <section aria-labelledby="request-attachments-title" className="flex flex-col gap-3">
              <h2 id="request-attachments-title" className="font-serif text-2xl">
                {t('sectionAttachments')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {listedAttachments.map((a) => (
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

          {DELETABLE_STATUSES.includes(r.status) && <DeleteRequestCard id={id} status={r.status} />}
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

  // aceeasi regula ca garda paginii de editare (request-editability.ts)
  const { postClaim, remaining, canEdit, noteKey } = requestEditability({
    status,
    preClaimEditsUsed: preUsed,
    postClaimEditsUsed: postUsed,
  });
  const note = t(`edits.${noteKey}`, { remaining });

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
// e4: confirmarea e un dialog al aplicatiei care spune consecintele (definitiv, ofertele se
// anuleaza, conversatiile raman doar de citit, firmele isi primesc creditele inapoi); dupa
// stergere, mesajul de reusita apare pe lista de cereri (toast global, supravietuieste navigarii).
function DeleteRequestCard({ id, status }: { id: string; status: RequestStatus }) {
  const t = useTranslations('Requests');
  const router = useRouter();
  const del = useDeleteRequest();
  const [open, setOpen] = useState(false);
  const apiErr = del.error instanceof ApiError ? del.error.code : del.error ? 'INTERNAL_ERROR' : null;
  // ciorna n-a ajuns la firme: fara oferte / conversatii / credite de explicat
  const draft = status === 'DRAFT';
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
      {/* f6 / e4: ciorna si cererea expirata nu au preluari active de anulat */}
      <p className="text-ui text-muted-foreground">
        {draft || status === 'EXPIRED' ? t('deleteSection.hintNoClaims') : t('deleteSection.hint')}
      </p>
      <button
        type="button"
        onClick={() => {
          del.reset();
          setOpen(true);
        }}
        disabled={del.isPending}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-crimson hover:underline disabled:opacity-50"
      >
        {t('deleteRequest')}…
      </button>
      <ActionConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('deleteDialog.title')}
        tone="danger"
        confirmLabel={t('deleteDialog.confirm')}
        cancelLabel={t('deleteDialog.cancel')}
        pendingLabel={t('deleteDialog.pending')}
        pending={del.isPending}
        error={apiErr ? (t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')) : null}
        onConfirm={() =>
          del.mutate(id, {
            onSuccess: () => {
              setOpen(false);
              toast.success(t('deleteDialog.done'));
              router.replace('/requests');
            },
          })
        }
      >
        <p>{t('deleteDialog.permanent')}</p>
        {!draft && (
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('deleteDialog.offers')}</li>
            <li>{t('deleteDialog.chats')}</li>
            <li>{t('deleteDialog.credits')}</li>
          </ul>
        )}
      </ActionConfirmDialog>
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
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {/* f6-2: formularul precompletat; salvarea aplica modificarile si republica (tot o singura data) */}
        <Button asChild variant="outline" size="xl" className="w-full px-6 text-sm sm:w-auto">
          <Link href={`/requests/${id}/edit`}>{t('repostWithChanges')}</Link>
        </Button>
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
      </div>
    </Card>
  );
}
