'use client';

import { ATTACHMENT_ACCEPT } from '@marketplace/shared';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import {
  useAttachmentsFor,
  useRemoveAttachmentFor,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { AttachmentRow } from './attachment-item';
import { InspirationPicker } from './inspiration-picker';

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
        accept={ATTACHMENT_ACCEPT}
        label={t('uploads.dropLabel')}
        hint={t('uploads.dropHint')}
      />
      {upload.isPending && <p className="text-xs text-muted-foreground">{t('uploads.uploading')}</p>}

      {/* inspiratie din galeria atelierelor (F6, item 3) */}
      <InspirationPicker />

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} onRemove={() => remove.mutate(a.id)} />
          ))}
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
