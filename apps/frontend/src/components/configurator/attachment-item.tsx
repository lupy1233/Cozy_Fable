'use client';

import { attachmentKind, type AttachmentDto } from '@marketplace/shared';
import { FileArchive, FileText, FileWarning, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Afisarea atasamentelor (feedback PO item 10): statusul de scanare NU se mai
// arata clientului cand fisierul e in regula — apare doar un indicator discret
// cat dureaza scanarea si o EROARE clara daca fisierul e respins (BLOCKED).
// ZIP-urile primesc iconita lor si raman fara preview (invarianta 3.4).

export function AttachmentKindIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  const kind = attachmentKind(mimeType);
  const Icon = kind === 'image' ? ImageIcon : kind === 'zip' ? FileArchive : FileText;
  return <Icon className={className ?? 'h-4 w-4'} />;
}

// Rand de fisier in listele de upload (pasul Fisiere + schita per camera).
export function AttachmentRow({
  attachment,
  onRemove,
}: {
  attachment: AttachmentDto;
  onRemove?: () => void;
}) {
  const t = useTranslations('Configurator');
  const blocked = attachment.status === 'BLOCKED';
  const scanning = attachment.status === 'PENDING_SCAN' || attachment.status === 'PENDING_UPLOAD';

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
        blocked ? 'border-crimson/40 bg-crimson/5' : 'border-border bg-surface-2',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {blocked ? (
          <FileWarning className="h-4 w-4 shrink-0 text-crimson" />
        ) : (
          <AttachmentKindIcon mimeType={attachment.mimeType} className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{attachment.filename}</span>
        <span className="shrink-0 font-mono text-meta text-muted-2">
          {(attachment.sizeBytes / 1024).toFixed(0)} KB
        </span>
        {scanning && (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-meta text-muted-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('uploads.scanning')}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {blocked && <span className="text-xs font-medium text-crimson">{t('uploads.blockedNotice')}</span>}
        {onRemove && (
          <button type="button" onClick={onRemove} className="grid h-11 w-11 place-items-center rounded-md text-crimson focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut" aria-label={t('uploads.removeFile', { name: attachment.filename })}>
            <X className="h-4 w-4" />
          </button>
        )}
      </span>
    </li>
  );
}

// Preview compact pentru sumar/detaliu: thumbnail pentru imagini (cand exista
// URL servibil), iconita de tip pentru PDF/ZIP, eroare pentru BLOCKED.
export function AttachmentThumb({ attachment }: { attachment: AttachmentDto }) {
  const t = useTranslations('Configurator');
  const kind = attachmentKind(attachment.mimeType);
  const blocked = attachment.status === 'BLOCKED';
  const [failedUrl, setFailedUrl] = useState<string>();
  const safeUrl = attachment.status === 'SAFE' ? attachment.downloadUrl : undefined;

  if (attachment.status === 'PENDING_UPLOAD' || attachment.status === 'PENDING_SCAN') {
    return <span role="status" aria-label={`${attachment.filename}: ${t('uploads.scanning')}`} className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 px-1 text-center text-micro text-muted-foreground">
      <Loader2 aria-hidden className="h-5 w-5 animate-spin" />{t('uploads.scanning')}
    </span>;
  }

  if (blocked) {
    return (
      <span
        title={attachment.filename}
        className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-crimson/40 bg-crimson/5 text-crimson"
      >
        <FileWarning className="h-5 w-5" />
        <span className="px-1 text-center text-micro font-medium leading-tight">
          {t('uploads.blockedShort')}
        </span>
      </span>
    );
  }

  if (kind === 'image' && safeUrl && failedUrl !== safeUrl) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeUrl}
        onError={() => setFailedUrl(safeUrl)}
        alt={attachment.filename}
        loading="lazy"
        className="h-16 w-16 rounded-md border border-border object-cover"
      />
    );
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noreferrer"
        title={attachment.filename}
        className="transition-opacity hover:opacity-85"
      >
        {img}
      </a>
    );
  }

  const body = (
    <span
      title={attachment.filename}
      className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 text-muted-foreground"
    >
      <AttachmentKindIcon mimeType={attachment.mimeType} className="h-5 w-5" />
      <span className="w-full truncate px-1 text-center font-mono text-micro">
        {attachment.filename.replace(/^(.{8}).+(\.[^.]+)$/, '$1…$2')}
      </span>
    </span>
  );
  return safeUrl ? (
    <a
      href={safeUrl}
      target="_blank"
      rel="noreferrer"
      className="transition-opacity hover:opacity-85"
    >
      {body}
    </a>
  ) : (
    body
  );
}
