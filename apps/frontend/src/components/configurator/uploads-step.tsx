'use client';

import { ATTACHMENT_ACCEPT, type AttachmentDto } from '@marketplace/shared';
import { ArrowLeft, ArrowRight, Ruler } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useRemoveAttachmentFor,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { AttachmentRow } from './attachment-item';
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
  const upload = useUploadAttachmentFor(target);
  const remove = useRemoveAttachmentFor(target);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const ownProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const forgetAttachment = useConfiguratorStore((s) => s.forgetAttachment);

  const onFiles = (files: FileList) => {
    Array.from(files).forEach((file) => upload.mutate(file));
  };

  // Fisierele referite de o camera (schite, snapshot 3D) se gestioneaza din
  // camera respectiva; aici sunt doar afisate. Restul = fisierele proiectului
  // (aceeasi regula ca in sumar si ca serverul la "Am deja un proiect").
  const referencedIds = new Set(rooms.flatMap((room) => Object.values(room.answers).flatMap((value) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
  )));
  const projectFiles = attachments.filter((a) => !referencedIds.has(a.id));
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
    const state = useConfiguratorStore.getState();
    state.setDetails({ hasOwnProject: false });
    if (state.startMode === 'OWN_PROJECT') state.setStartMode('STANDARD');
    if (state.startMode === 'DESIGN_HELP') return;
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
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('uploads.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ownProject ? t('uploads.subtitleOwnProject') : t('uploads.subtitle')}
        </p>
        {/* E-client-9: fisierele sunt vizibile firmelor inainte de preluare */}
        <p className="mt-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted-foreground" data-uploads-visibility>
          {t('uploads.visibilityNotice')}
        </p>
      </div>

      <Dropzone
        onFiles={onFiles}
        accept={ATTACHMENT_ACCEPT}
        label={t('uploads.dropLabel')}
        hint={t('uploads.dropHint')}
      />
      {upload.isPending && <p className="text-xs text-muted-foreground">{t('uploads.uploading')}</p>}

      {/* inspiratie din galeria firmelor (F6, item 3) */}
      <InspirationPicker />

      {projectFiles.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-serif text-lg">{t('uploads.projectFilesTitle')}</h3>
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
            <h3 className="font-serif text-lg">{t('uploads.roomSketchesTitle')}</h3>
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('nav.back')}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {ownProject && (
            <Button type="button" variant="outline" onClick={switchToGuided}>
              <Ruler className="mr-1 h-4 w-4" />
              {t('uploads.switchToGuided')}
            </Button>
          )}
          <Button type="button" variant="walnut" onClick={onContinue} disabled={blocked}>
            {t('nav.continue')}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
