'use client';

import { MAX_ATTACHMENTS_PER_REQUEST } from '@marketplace/shared';
import { FileCheck, FileClock, FileX, Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useRemoveAttachmentFor,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { SketchGuide } from './sketch-guide';

const STATUS_ICON = {
  SAFE: FileCheck,
  BLOCKED: FileX,
  PENDING_SCAN: FileClock,
  PENDING_UPLOAD: FileClock,
} as const;

// Uploader-ul pasului "schita/proiect" al unei camere. Fisierele merg prin acelasi
// flux presign/confirm ca pasul global de fisiere; raspunsul step-ului = lista de
// attachment id-uri (verificata pe server la publish). Cap global: 10 fisiere/cerere.
export function RoomSketchUpload({
  target,
  value,
  maxFiles,
  hasOwnProject,
  onChange,
}: {
  target: AttachmentTarget;
  value: string[];
  maxFiles: number;
  // clientul a bifat "am proiect pentru toata locuinta" → pasul se poate sari
  hasOwnProject: boolean;
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations('Configurator');
  const allAttachments = useAttachmentsFor(target);
  const upload = useUploadAttachmentFor(target);
  const remove = useRemoveAttachmentFor(target);

  const mine = allAttachments.filter((a) => value.includes(a.id));
  const globalRemaining = MAX_ATTACHMENTS_PER_REQUEST - allAttachments.length;
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
          accept="image/jpeg,image/png,image/webp,application/pdf"
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
          {mine.map((a) => {
            const Icon = STATUS_ICON[a.status] ?? FileClock;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon
                    className={
                      'h-4 w-4 ' +
                      (a.status === 'SAFE'
                        ? 'text-sage'
                        : a.status === 'BLOCKED'
                          ? 'text-crimson'
                          : 'text-amber')
                    }
                  />
                  {a.filename} · {(a.sizeBytes / 1024).toFixed(0)} KB ·{' '}
                  {t(`uploads.status.${a.status}`)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    remove.mutate(a.id);
                    onChange(value.filter((id) => id !== a.id));
                  }}
                  className="text-crimson"
                  aria-label="remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* fara proiect: aratam cum se face o schita */}
      <SketchGuide />
    </div>
  );
}
