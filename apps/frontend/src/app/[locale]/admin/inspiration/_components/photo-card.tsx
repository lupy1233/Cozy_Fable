'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InspirationPhotoDto } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const CHECK = 'inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm';
const TEXT_ACTION =
  'inline-flex h-9 cursor-pointer items-center rounded-sm text-ui font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut';

// Input de fisier ascuns vizual, dar accesibil din tastatura (eticheta parinte arata focusul).
function FileInput({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  return (
    <input
      type="file"
      accept={IMAGE_ACCEPT}
      disabled={disabled}
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = '';
      }}
    />
  );
}

export function PhotoCard({
  photo,
  onToggle,
  onDelete,
  onUpload,
  onEdit,
  uploading,
}: {
  photo: InspirationPhotoDto;
  onToggle: (patch: { published?: boolean; featured?: boolean }) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onEdit: () => void;
  uploading: boolean;
}) {
  const t = useTranslations('AdminInspiration');
  const tc = useTranslations('Configurator');
  // poza folosita de cereri active / colectii: retragerea sau stergerea cer
  // confirmare (clientii nu o mai pot pastra la urmatoarea editare) — E-client-2
  const requests = photo.usage?.activeRequests ?? 0;
  const boards = photo.usage?.boards ?? 0;
  const inUse = requests + boards > 0;
  // `kind` ramane neschimbat cat se inchide fereastra, ca textul sa nu sara in timpul animatiei
  const [dialog, setDialog] = useState<{ open: boolean; kind: 'unpublish' | 'delete' }>({ open: false, kind: 'delete' });
  const ask = (kind: 'unpublish' | 'delete') => setDialog({ open: true, kind });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));
  const confirmPending = () => {
    if (dialog.kind === 'unpublish') onToggle({ published: false });
    else onDelete();
    closeDialog();
  };

  const usageParts = [
    requests > 0 ? t('usageRequests', { count: requests }) : null,
    boards > 0 ? t('usageBoards', { count: boards }) : null,
  ].filter((part): part is string => part !== null);

  return (
    <Card as="article" padding="none" className="flex flex-col overflow-hidden">
      {photo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.imageUrl} alt={photo.title} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <label
          className={cn(
            'grid aspect-[4/3] w-full cursor-pointer place-items-center border-b border-dashed border-muted-2 bg-surface-2 px-4 text-center text-sm font-medium text-walnut transition-colors hover:bg-walnut-soft/50',
            'focus-within:ring-2 focus-within:ring-inset focus-within:ring-walnut',
          )}
        >
          {uploading ? t('uploading') : t('noImageUpload')}
          <FileInput onFile={onUpload} disabled={uploading} />
        </label>
      )}
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={photo.title}>
            {photo.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {photo.company.name} · {tc(`rooms.type.${photo.roomType}`)}
          </p>
          {photo.sourceUrl && (
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-walnut underline-offset-2 hover:underline"
            >
              {photo.sourceUrl}
            </a>
          )}
        </div>
        <div className="flex flex-col font-mono text-meta">
          {!photo.imageUrl && (
            <span className="text-amber">{photo.published ? t('statePublishedNoImage') : t('stateUnpublishedNoImage')}</span>
          )}
          {photo.usage && (photo.imageUrl || inUse) && (
            <span className="text-muted-foreground">{inUse ? usageParts.join(' · ') : t('unused')}</span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-background pt-2">
          <label className={CHECK}>
            <input
              type="checkbox"
              className="size-[18px] accent-walnut"
              checked={photo.published}
              onChange={(e) => {
                if (!e.target.checked && inUse) ask('unpublish');
                else onToggle({ published: e.target.checked });
              }}
            />
            {t('published')}
          </label>
          <label className={CHECK}>
            <input
              type="checkbox"
              className="size-[18px] accent-walnut"
              checked={photo.featured}
              onChange={(e) => onToggle({ featured: e.target.checked })}
            />
            {t('featured')}
          </label>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3">
          <div className="flex flex-wrap gap-x-3">
            <button type="button" onClick={onEdit} className={cn(TEXT_ACTION, 'text-walnut')}>
              {t('editTags')}
            </button>
            {photo.imageUrl && (
              <label className={cn(TEXT_ACTION, 'text-walnut focus-within:ring-2 focus-within:ring-walnut')}>
                {uploading ? t('uploading') : t('replaceImage')}
                <FileInput onFile={onUpload} disabled={uploading} />
              </label>
            )}
          </div>
          {/* stergerea cere mereu confirmare; textul difera daca poza e folosita */}
          <button type="button" onClick={() => ask('delete')} className={cn(TEXT_ACTION, 'text-crimson')}>
            {t('deleteAction')}
          </button>
        </div>
      </div>
      <Dialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inUse ? t('confirmTitle') : t('confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {dialog.kind === 'unpublish'
                ? t('confirmUnpublishBody')
                : inUse
                  ? t('confirmDeleteBody')
                  : t('confirmDeleteUnusedBody', { title: photo.title })}
            </DialogDescription>
          </DialogHeader>
          {photo.usage && inUse && (
            <p className="text-sm text-muted-foreground">
              {t('usage', { requests: photo.usage.activeRequests, boards: photo.usage.boards })}
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('cancel')}
            </Button>
            <Button type="button" variant={dialog.kind === 'unpublish' ? 'default' : 'destructive'} onClick={confirmPending}>
              {dialog.kind === 'unpublish' ? t('confirmUnpublish') : t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
