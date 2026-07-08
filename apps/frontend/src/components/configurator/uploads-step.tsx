'use client';

import { ArrowLeft, ArrowRight, FileCheck, FileClock, FileX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useRemoveAttachmentFor,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { InspirationPicker } from './inspiration-picker';

const STATUS_ICON = {
  SAFE: FileCheck,
  BLOCKED: FileX,
  PENDING_SCAN: FileClock,
  PENDING_UPLOAD: FileClock,
} as const;

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

  const onFiles = (files: FileList) => {
    Array.from(files).forEach((file) => upload.mutate(file));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('uploads.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('uploads.subtitle')}</p>
      </div>

      <Dropzone
        onFiles={onFiles}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        label={t('uploads.dropLabel')}
        hint={t('uploads.dropHint')}
      />
      {upload.isPending && <p className="text-xs text-muted-foreground">{t('uploads.uploading')}</p>}

      {/* inspiratie din galeria atelierelor (F6, item 3) */}
      <InspirationPicker />

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {attachments.map((a) => {
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
                  {a.filename} · {(a.sizeBytes / 1024).toFixed(0)} KB · {t(`uploads.status.${a.status}`)}
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(a.id)}
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

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('nav.back')}
        </Button>
        <Button type="button" variant="walnut" onClick={onContinue}>
          {t('nav.continue')}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
