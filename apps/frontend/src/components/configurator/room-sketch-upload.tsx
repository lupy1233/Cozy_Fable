'use client';

import {
  ATTACHMENT_ACCEPT,
  maxAttachmentsForRequest,
  remainingAttachmentSlots,
  type AttachmentDto,
} from '@marketplace/shared';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useAttachmentUploadQueue,
  useRemoveAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { localRejectReason } from '@/lib/attachment-upload';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { AttachmentRow } from './attachment-item';
import { SketchGuide } from './sketch-guide';
import { UploadFeedback } from './upload-feedback';

// Uploader-ul pasului "schita/proiect" al unei camere. Fisierele merg prin acelasi
// flux presign/confirm ca pasul global de fisiere; raspunsul step-ului = lista de
// attachment id-uri (verificata pe server la publish). Limita e PER CAMERA
// (maxFiles=7, feedback PO 2026-07-13); capul global creste cu camerele.
export function RoomSketchUpload({
  target,
  value,
  maxFiles,
  roomCount,
  hasOwnProject,
  onChange,
}: {
  target: AttachmentTarget;
  value: string[];
  maxFiles: number;
  // numarul de camere din cerere — dimensioneaza capul global (oglinda BE)
  roomCount: number;
  // clientul a bifat "am proiect pentru toata locuinta" → pasul se poate sari
  hasOwnProject: boolean;
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations('Configurator');
  const allAttachments = useAttachmentsFor(target);
  const queue = useAttachmentUploadQueue(target);
  const remove = useRemoveAttachmentFor(target);
  const forgetAttachment = useConfiguratorStore((s) => s.forgetAttachment);
  // acumulator pentru incarcarile pe rand: fiecare fisier reusit se adauga la lista cea mai
  // noua, nu la valoarea veche prinsa in closure (altfel s-ar suprascrie reciproc)
  const idsRef = useRef(value);
  idsRef.current = value;

  const mine = allAttachments.filter((a) => value.includes(a.id));
  // b5: fisierele aflate inca pe drum ocupa deja un loc
  const inFlight = queue.pending.length;
  const globalRemaining = remainingAttachmentSlots(roomCount, allAttachments.length + inFlight);
  const localRemaining = Math.max(0, maxFiles - mine.length - inFlight);
  const canUpload = globalRemaining > 0 && localRemaining > 0;
  const slotsLeft = Math.min(localRemaining, globalRemaining);

  if (hasOwnProject) {
    return (
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {t('sketchUpload.skipNotice')}
        </span>
      </Alert>
    );
  }

  const onUploaded = (att: AttachmentDto) => {
    const next = [...idsRef.current, att.id];
    idsRef.current = next;
    onChange(next);
  };
  const startBatch = () => {
    // id-urile unor fisiere sterse intre timp nu se mai poarta mai departe
    // (lista incarcata = sursa de adevar; goala = inca necunoscuta)
    if (allAttachments.length > 0) {
      idsRef.current = idsRef.current.filter((id) => allAttachments.some((a) => a.id === id));
    }
  };
  // refuzurile (tip, marime, gol, limita, scanare, retea) apar in „Nu am putut adăuga” (b5)
  const onAccept = (files: File[]) => {
    startBatch();
    void queue.uploadFiles(files, slotsLeft, onUploaded);
  };
  const onRetry = (id: string) => {
    startBatch();
    queue.retry(id, slotsLeft, onUploaded);
  };

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <Dropzone
          validate={localRejectReason}
          onAccept={onAccept}
          onReject={queue.reject}
          accept={ATTACHMENT_ACCEPT}
          label={t('uploads.dropLabel')}
          hint={t('sketchUpload.hint', { local: localRemaining, global: globalRemaining })}
        />
      ) : inFlight > 0 ? null : (
        <Alert tone="amber">
          {/* b5 pas 6: spune care limita s-a atins si cat e ea (camera sau toata cererea) */}
          {localRemaining <= 0
            ? t('sketchUpload.limitReachedRoom', { max: maxFiles })
            : t('sketchUpload.limitReached', { max: maxAttachmentsForRequest(roomCount) })}
        </Alert>
      )}
      <UploadFeedback
        pending={queue.pending}
        rejected={queue.rejected}
        onDismiss={queue.dismiss}
        onRetry={onRetry}
      />

      {mine.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {mine.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onRemove={() => {
                remove.mutate(a.id, { onSuccess: () => forgetAttachment(a.id) });
                onChange(value.filter((id) => id !== a.id));
              }}
            />
          ))}
        </ul>
      )}

      {/* fara proiect: aratam cum se face o schita */}
      <SketchGuide />
    </div>
  );
}
