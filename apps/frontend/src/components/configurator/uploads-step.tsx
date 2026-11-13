'use client';

import { ATTACHMENT_ACCEPT, remainingAttachmentSlots, type AttachmentDto } from '@marketplace/shared';
import { ArrowLeft, ArrowRight, Ruler } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useAttachmentUploadQueue,
  useRemoveAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { localRejectReason } from '@/lib/attachment-upload';
import { excludedFileIds, useConfiguratorStore } from '@/stores/configurator-store';
import { AttachmentRow } from './attachment-item';
import { UploadFeedback } from './upload-feedback';
import { InspirationPicker } from './inspiration-picker';
import { roomIssue, screenIndexForStep } from './room-screens';

export function UploadsStep({
  target,
  onBack,
  onContinue,
}: {
  target: AttachmentTarget;
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('Configurator');
  const attachments = useAttachmentsFor(target);
  const queue = useAttachmentUploadQueue(target);
  const remove = useRemoveAttachmentFor(target);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const ownProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const forgetAttachment = useConfiguratorStore((s) => s.forgetAttachment);
  const discardedFiles = useConfiguratorStore((s) => s.discardedFiles);

  // b5: locurile ramase pe cerere (oglinda capului de pe server: 10 + 8 pe camera)
  // (fisierele aflate inca pe drum ocupa deja un loc)
  // b6 + M1 + m8: fisierele camerelor scoase si poza 3D a camerelor bifate nu sunt ale
  // proiectului si nu ocupa locuri (pe ciorna se sterg, la editare dupa salvare)
  const discarded = excludedFileIds(rooms, discardedFiles);
  const liveCount = attachments.filter((a) => !discarded.has(a.id)).length;
  const slotsLeft = remainingAttachmentSlots(rooms.length, liveCount + queue.pending.length);
  // fisierele se trimit pe rand, fiecare cu starea lui (vezi useAttachmentUploadQueue)
  const onAccept = (files: File[]) => {
    void queue.uploadFiles(files, slotsLeft);
  };

  // Fisierele referite de o camera (schite, snapshot 3D) se gestioneaza din
  // camera respectiva; aici sunt doar afisate. Restul = fisierele proiectului
  // (aceeasi regula ca in sumar si ca serverul la "Am deja un proiect").
  const referencedIds = new Set(rooms.flatMap((room) => Object.values(room.answers).flatMap((value) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
  )));
  // b6: fisierele camerelor scoase din cos (la editare inca pe cerere, pana la salvare) nu
  // sunt fisiere ale proiectului
  const projectFiles = attachments.filter((a) => !referencedIds.has(a.id) && !discarded.has(a.id));
  const byId = new Map(attachments.map((a) => [a.id, a]));
  const typeCount = new Map<string, number>();
  const roomFiles = rooms.flatMap((room) => {
    const n = (typeCount.get(room.roomType) ?? 0) + 1;
    typeCount.set(room.roomType, n);
    const ids = Object.values(room.answers).flatMap((value) =>
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
    );
    const files = [...new Set(ids)].map((id) => byId.get(id)).filter((a): a is AttachmentDto => !!a);
    if (files.length === 0) return [];
    const sameType = rooms.filter((r) => r.roomType === room.roomType).length > 1;
    const label = t(`rooms.type.${room.roomType}`) + (sameType ? ` ${n}` : '');
    return [{ key: room.localId, label, files }];
  });
  // "Am deja un proiect" (docs/03 4.1): fara cel putin un fisier de proiect
  // verificat (SAFE) serverul refuza publicarea cu REQUEST_PROJECT_FILE_REQUIRED
  const hasSafeProjectFile = projectFiles.some((a) => a.status === 'SAFE');
  const blocked = ownProject && !hasSafeProjectFile;

  // "Nu am proiectul la indemana": revine la formularul complet si deschide
  // prima camera careia ii lipsesc raspunsuri (de regula dimensiunile)
  const switchToGuided = () => {
    // b8: modul e singura sursa — setStartMode scoate si "am proiect"
    const state = useConfiguratorStore.getState();
    if (state.startMode !== 'OWN_PROJECT') return;
    state.setStartMode('STANDARD');
    state.syncCompletion(false);
    const current = useConfiguratorStore.getState().roomInstances;
    const index = current.findIndex((room) => roomIssue(room, { ownProject: false }) !== null);
    if (index < 0) return;
    const issue = roomIssue(current[index], { ownProject: false });
    state.focusRoomStep(index, screenIndexForStep(current[index], issue?.stepId, false));
    state.setPhase('rooms');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">{t('uploads.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ownProject ? t('uploads.subtitleOwnProject') : t('uploads.subtitle')}
        </p>
        {/* E-client-9: fisierele sunt vizibile firmelor inainte de preluare */}
        <p className="mt-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted-foreground" data-uploads-visibility>
          {t('uploads.visibilityNotice')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Dropzone
          validate={localRejectReason}
          onAccept={onAccept}
          onReject={queue.reject}
          accept={ATTACHMENT_ACCEPT}
          label={t('uploads.dropLabel')}
          hint={t('uploads.dropHint')}
        />
        <p className="text-xs text-muted-foreground" data-upload-slots>
          {t('uploads.slotsLeft', { count: slotsLeft })}
        </p>
        <UploadFeedback
          pending={queue.pending}
          rejected={queue.rejected}
          onDismiss={queue.dismiss}
          onRetry={(id) => queue.retry(id, slotsLeft)}
        />
      </div>

      {/* inspiratie din galeria firmelor (F6, item 3) */}
      <InspirationPicker />

      {projectFiles.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="heading-section">{t('uploads.projectFilesTitle')}</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {projectFiles.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                onRemove={() => remove.mutate(a.id, { onSuccess: () => forgetAttachment(a.id) })}
              />
            ))}
          </ul>
        </section>
      )}

      {roomFiles.length > 0 && (
        <section className="flex flex-col gap-2" data-room-files>
          <div>
            <h3 className="heading-section">{t('uploads.roomSketchesTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('uploads.roomSketchesHint')}</p>
          </div>
          {roomFiles.map((group) => (
            <div key={group.key} className="flex flex-col gap-1.5">
              <p className="font-mono text-meta uppercase tracking-[0.1em] text-muted-2">{group.label}</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {group.files.map((a) => <AttachmentRow key={a.id} attachment={a} />)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {blocked && <p className="text-sm text-amber" role="status">{t('uploads.projectRequired')}</p>}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="xl" className="px-4 text-sm" onClick={onBack}>
          <ArrowLeft aria-hidden />
          {t('nav.back')}
        </Button>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {ownProject && (
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="h-auto min-h-12 whitespace-normal px-4 py-2 text-sm"
              onClick={switchToGuided}
            >
              <Ruler aria-hidden />
              {t('uploads.switchToGuided')}
            </Button>
          )}
          <Button type="button" variant="walnut" size="xl" onClick={onContinue} disabled={blocked}>
            {t('nav.continue')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
