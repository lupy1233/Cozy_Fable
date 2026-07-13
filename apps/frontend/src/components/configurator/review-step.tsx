'use client';

import type { ConfiguratorContentInput, ContactPreferenceInput } from '@marketplace/shared';
import { ArrowLeft, Check, Loader2, LogIn, Pencil, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
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
  const allRoomsComplete = rooms.length > 0 && rooms.every((r) => r.completed);

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

      {/* Detalii generale */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg">{tr('sectionGeneral')}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onEditDetails}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t('review.edit')}
          </Button>
        </div>
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
      </section>

      {/* Camere */}
      {rooms.map((room, i) => (
        <section key={room.localId} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-serif text-lg">
              {t(`rooms.type.${room.roomType}`)}
              {room.completed ? (
                <Check className="h-4 w-4 text-sage" />
              ) : (
                <span className="text-xs font-normal text-amber">{t('review.roomIncomplete')}</span>
              )}
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEditRoom(i)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {t('review.edit')}
            </Button>
          </div>
          <RoomAnswerSummary
            roomType={room.roomType}
            answers={room.answers}
            flowVersion={room.flowVersion}
            attachments={attachments}
          />
        </section>
      ))}

      {/* Pozele de inspiratie alese — vizibile (si editabile) inainte de publish (R7) */}
      <InspirationPicker />

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
      {!authed && !me.isPending && (detailsComplete && allRoomsComplete) && (
        <Alert tone="info">{t('review.loginToPublishHint')}</Alert>
      )}

      <div className="flex items-center justify-between">
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
  );
}
