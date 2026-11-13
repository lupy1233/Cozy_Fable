'use client';

import { FileWarning, Loader2, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PendingUpload } from '@/hooks/use-requests';
import type { RejectedUpload } from '@/lib/attachment-upload';

// b5: starea fiecarui fisier trimis — „Se încarcă {name}…” pe rand si lista „Nu am putut adăuga”
// cu numele si motivul (plus „Reîncearcă” la erorile de retea).
export function UploadFeedback({
  pending,
  rejected,
  onDismiss,
  onRetry,
}: {
  pending: PendingUpload[];
  rejected: RejectedUpload[];
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const t = useTranslations('Configurator.uploads');
  return (
    <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
      {pending.length > 0 && (
        <ul className="flex flex-col gap-1" data-upload-pending>
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" />
              <span className="truncate">{t('uploadingFile', { name: p.name })}</span>
            </li>
          ))}
        </ul>
      )}
      {rejected.length > 0 && (
        <section className="flex flex-col gap-1.5" data-upload-rejected>
          <h4 className="text-sm font-medium text-crimson">{t('rejectedTitle')}</h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {rejected.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-crimson/40 bg-crimson/5 px-3 py-2">
                <span className="flex min-w-0 items-start gap-2">
                  <FileWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-xs text-crimson">{t(`rejectReason.${r.reason}`)}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {r.reason === 'NETWORK' && r.file && (
                    <button
                      type="button"
                      onClick={() => onRetry(r.id)}
                      className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                    >
                      <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                      {t('retry')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismiss(r.id)}
                    aria-label={t('dismissRejected', { name: r.name })}
                    className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
