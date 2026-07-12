'use client';

import { ATTACHMENT_ACCEPT, maxAttachmentsForRequest } from '@marketplace/shared';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useRemoveAttachmentFor,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { AttachmentRow } from './attachment-item';
import { SketchGuide } from './sketch-guide';

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
  const upload = useUploadAttachmentFor(target);
  const remove = useRemoveAttachmentFor(target);

  const mine = allAttachments.filter((a) => value.includes(a.id));
  const globalRemaining = maxAttachmentsForRequest(roomCount) - allAttachments.length;
  const localRemaining = maxFiles - mine.length;
  const canUpload = globalRemaining > 0 && localRemaining > 0;

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

  // secvential, cu acumulator local: upload-urile paralele ar suprascrie
  // reciproc lista de id-uri (closure pe aceeasi valoare veche)
  const onFiles = async (files: FileList) => {
    const room = Math.min(localRemaining, globalRemaining);
    let ids = value;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      try {
        const att = await upload.mutateAsync(file);
        ids = [...ids, att.id];
        onChange(ids);
      } catch {
        // eroarea individuala e reflectata de upload.isError; continuam cu restul
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <Dropzone
          onFiles={onFiles}
          accept={ATTACHMENT_ACCEPT}
          label={t('uploads.dropLabel')}
          hint={t('sketchUpload.hint', { local: localRemaining, global: globalRemaining })}
        />
      ) : (
        <Alert tone="amber">{t('sketchUpload.limitReached')}</Alert>
      )}
      {upload.isPending && (
        <p className="text-xs text-muted-foreground">{t('uploads.uploading')}</p>
      )}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {mine.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onRemove={() => {
                remove.mutate(a.id);
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
