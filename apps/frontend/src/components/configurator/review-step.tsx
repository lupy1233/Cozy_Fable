'use client';

import type { ConfiguratorContentInput, ContactPreferenceInput } from '@marketplace/shared';
import { ArrowLeft, Loader2, LogIn, Pencil, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import {
  useAttachmentsFor,
  useEditRequestById,
  usePublishDraft,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { useRouter } from '@/i18n/routing';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { InspirationPicker } from './inspiration-picker';
import { RailSection } from './review-rail';
import { RoomAnswerSummary } from './room-answer-summary';

export function ReviewStep({
  token,
  editId,
  uploadTarget,
  onBack,
  onEditRoom,
  onEditDetails,
  onPublished,
}: {
  // mod creare: tokenul draftului; mod editare: id-ul cererii publicate
  token: string | null;
  editId?: string;
  // sursa atasamentelor pentru preview-urile din sumar (item 10)
  uploadTarget: AttachmentTarget;
  onBack: () => void;
  onEditRoom: (index: number) => void;
  onEditDetails: () => void;
  onPublished: (requestId: string) => void;
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const authed = !!me.data;
  const isEdit = Boolean(editId);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const details = useConfiguratorStore((s) => s.details);
  const designHelp = useConfiguratorStore((s) => s.startMode === 'DESIGN_HELP');
  const inspirationPhotoIds = useConfiguratorStore((s) => s.inspirationPhotoIds);
  const snapshots3d = useConfiguratorStore((s) => s.snapshots3d);
  const setAnswer = useConfiguratorStore((s) => s.setAnswer);
  const attachments = useAttachmentsFor(uploadTarget);
  const uploadAttachment = useUploadAttachmentFor(uploadTarget);
  const publishDraft = usePublishDraft(token ?? '');
  const editRequest = useEditRequestById(editId ?? '');
  const publish = isEdit ? editRequest : publishDraft;
  // urcarea snapshot-urilor 3D dinaintea publish-ului (R4)
  const [preparing, setPreparing] = useState(false);

  // titlul nu mai e cerut: e generat automat pe server din camere + oras
  const detailsComplete = Boolean(
    details.addressText &&
      details.county &&
      details.city &&
      (details.contactPreferences?.length ?? 0) > 0,
  );
  // "am nevoie de ajutor": camerele nu au chestionar — e suficient sa existe
  const allRoomsComplete =
    rooms.length > 0 && (designHelp || rooms.every((r) => r.completed));

  const doPublish = async () => {
    if (!detailsComplete || !allRoomsComplete || preparing) return;

    // D-3D-4 (aprobat): snapshotul PNG al pieselor configurate 3D urca AUTOMAT
    // prin fluxul presigned existent (3.4) si intra in answers.snapshot3d.
    // Best-effort: un esec de upload nu blocheaza publicarea (step optional).
    const snapshotByRoom: Record<string, string[]> = {};
    setPreparing(true);
    try {
      for (const room of rooms) {
        const dataUrl = snapshots3d[room.localId];
        if (room.answers.config3d === undefined || !dataUrl) continue;
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `configurare-3d-${room.roomType.toLowerCase()}.png`, {
            type: 'image/png',
          });
          const att = await uploadAttachment.mutateAsync(file);
          snapshotByRoom[room.localId] = [att.id];
          // pastreaza id-ul si in store — o re-publicare nu mai urca inca o data
          setAnswer(room.localId, 'snapshot3d', [att.id]);
        } catch {
          // fara snapshot; cererea ramane valida
        }
      }
    } finally {
      setPreparing(false);
    }

    const payload: ConfiguratorContentInput = {
      description: details.description ?? '',
      budgetRange: (details.budgetRange as ConfiguratorContentInput['budgetRange']) ?? 'UNDER_5K',
      budgetEstimateRon: details.budgetEstimateRon ?? undefined,
      deadlineBucket:
        (details.deadlineBucket as ConfiguratorContentInput['deadlineBucket']) || undefined,
      includesPaidDesign: details.includesPaidDesign ?? false,
      hasOwnProject: details.hasOwnProject ?? false,
      addressText: details.addressText!,
      county: details.county!,
      city: details.city!,
      country: details.country ?? 'RO',
      rooms: rooms.map((r) => ({
        roomType: r.roomType,
        flowVersion: r.flowVersion,
        answers: snapshotByRoom[r.localId]
          ? { ...r.answers, snapshot3d: snapshotByRoom[r.localId] }
          : r.answers,
      })),
      contactPreferences: (details.contactPreferences ?? []) as ContactPreferenceInput[],
      inspirationPhotoIds,
    };
    publish.mutate(payload, { onSuccess: (req) => onPublished(req.id) });
  };

  const apiErr = publish.error instanceof ApiError ? publish.error.code : null;

  // Overlay-ul ramane vizibil si dupa succes (isSuccess), pana la redirect:
  // publish-ul face geocoding pe server si poate dura cateva secunde.
  const publishing = preparing || publish.isPending || publish.isSuccess;

  const readyToPublish = detailsComplete && allRoomsComplete;

  // buton Editeaza: discret la hover pe desktop (hover:hover), mereu vizibil
  // pe touch; focus-visible il arata si la navigarea din tastatura
  const editButton = (onClick: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="shrink-0 text-muted-foreground transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
    >
      <Pencil className="mr-1 h-3.5 w-3.5" />
      {t('review.edit')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {publishing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-10 py-8 text-center shadow-lg"
          >
            <Loader2 className="h-7 w-7 animate-spin text-walnut" />
            <p className="font-serif text-lg">
              {isEdit ? t('review.publishingEdit') : t('review.publishing')}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">{t('review.publishingHint')}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('review.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('review.subtitle')}</p>
      </div>

      {/* firul de verificare: linia verticala + sectiunile ancorate cu noduri */}
      <div className="relative">
        <span
          aria-hidden
          className="absolute bottom-0 left-[11px] top-5 hidden w-px bg-ink/15 sm:block"
        />
        <div className="flex flex-col gap-6 sm:pl-10">
          {/* Detalii generale */}
          <RailSection
            state={detailsComplete ? 'complete' : 'incomplete'}
            index="01"
            title={tr('sectionGeneral')}
            action={editButton(onEditDetails)}
          >
            {detailsComplete ? (
              <div className="text-sm text-muted-foreground">
                {details.description && <p>{details.description}</p>}
                <p className="mt-1">
                  {details.addressText}, {details.city}, {details.county}
                </p>
              </div>
            ) : (
              <Alert tone="amber">{t('review.detailsIncomplete')}</Alert>
            )}
          </RailSection>

          {/* brief de proiectare: banner cu ce urmeaza dupa publicare */}
          {designHelp && <Alert tone="info">{t('review.designHelpBanner')}</Alert>}

          {/* Camere */}
          {rooms.map((room, i) => {
            const complete = room.completed || designHelp;
            return (
              <RailSection
                key={room.localId}
                state={complete ? 'complete' : 'incomplete'}
                index={String(i + 2).padStart(2, '0')}
                eyebrow={tr('room')}
                title={t(`rooms.type.${room.roomType}`)}
                titleExtra={
                  !complete ? (
                    <span className="font-sans text-xs font-normal text-amber">
                      {t('review.roomIncomplete')}
                    </span>
                  ) : undefined
                }
                // fara chestionar per camera pe fluxul de proiectare — nimic de editat
                action={!designHelp ? editButton(() => onEditRoom(i)) : undefined}
              >
                {designHelp ? (
                  <p className="text-sm text-muted-foreground">{t('review.designHelpRoomNote')}</p>
                ) : (
                  <RoomAnswerSummary
                    roomType={room.roomType}
                    answers={room.answers}
                    flowVersion={room.flowVersion}
                    attachments={attachments}
                  />
                )}
              </RailSection>
            );
          })}

          {/* Pozele de inspiratie alese — sectiune optionala: nod neutru pe fir */}
          <RailSection state="neutral" nodeClassName="top-4">
            <InspirationPicker />
          </RailSection>

          {apiErr && (
            <Alert tone="crimson">
              {t.has(`apiErrors.${apiErr}`)
                ? t(`apiErrors.${apiErr}`)
                : tr.has(`apiErrors.${apiErr}`)
                  ? tr(`apiErrors.${apiErr}`)
                  : t('apiErrors.GENERIC')}
            </Alert>
          )}

          {/* Poti completa cererea ca vizitator, dar publicarea necesita cont */}
          {!authed && !me.isPending && readyToPublish && (
            <Alert tone="info">{t('review.loginToPublishHint')}</Alert>
          )}
        </div>
      </div>

      {/* zona de semnatura: firul se termina aici, cu ultima linie de cartus */}
      <div className="relative sm:pl-10">
        {/* segmentul final al firului + nodul terminal (romb de registru) */}
        <span
          aria-hidden
          className="absolute -top-6 left-[11px] hidden h-[38px] w-px bg-ink/15 sm:block"
        />
        <span
          aria-hidden
          className={cn(
            'absolute left-[7px] top-[9px] hidden h-[9px] w-[9px] rotate-45 border transition-colors sm:block',
            readyToPublish ? 'border-sage bg-sage' : 'border-amber bg-surface',
          )}
        />
        <div className="border-t border-ink/15 pt-4">
          {/* randul-sumar al comenzii — doar din datele deja existente */}
          {readyToPublish ? (
            <p className="font-mono text-[11px] leading-relaxed text-muted-2">
              {t('cart.totalRooms', { count: rooms.length })}
              {' — '}
              {rooms.map((r) => t(`rooms.type.${r.roomType}`)).join(', ')}
              {details.city ? ` · ${details.city}` : ''}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 text-[13px] text-amber">
              {!detailsComplete && <p>{t('review.detailsIncomplete')}</p>}
              {rooms.length === 0 && <p>{t('cart.totalRooms', { count: 0 })}</p>}
              {!designHelp &&
                rooms
                  .filter((r) => !r.completed)
                  .map((r) => (
                    <p key={r.localId}>
                      {t(`rooms.type.${r.roomType}`)} — {t('review.roomIncomplete')}
                    </p>
                  ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('nav.back')}
            </Button>
            {authed ? (
              <Button
                type="button"
                variant="walnut"
                size="lg"
                disabled={!detailsComplete || !allRoomsComplete || publish.isPending || preparing}
                onClick={() => void doPublish()}
              >
                <Send className="mr-1 h-4 w-4" />
                {isEdit ? t('review.saveEdit') : tr('publish')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="walnut"
                size="lg"
                disabled={!detailsComplete || !allRoomsComplete || me.isPending}
                onClick={() => router.push('/login?redirect=/requests/new')}
              >
                <LogIn className="mr-1 h-4 w-4" />
                {t('review.loginToPublish')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
