'use client';

import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useMovePhoto, useSavePhoto, useUnsavePhoto } from '@/hooks/use-inspiration-boards';
import { cn } from '@/lib/utils';
import { BoardPicker } from './board-picker';

// Butonul "Salveaza"/"Salvat" cu popover — partajat de pin si lightbox.
// Nesalvat: click deschide picker-ul de colectii. Salvat: click deschide
// meniul "Muta in colectia…" + "Scoate din colectie" (idee 4 PO r2).
export function SaveButton({
  photoId,
  savedBoardId,
  authed,
  onRequireAuth,
  onOpenChange,
}: {
  photoId: string;
  // colectia in care e salvat pin-ul (null = nesalvat)
  savedBoardId: string | null;
  authed: boolean;
  onRequireAuth: () => void;
  // pin-ul isi tine valul de hover vizibil cat timp popover-ul e deschis
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('Inspiration');
  const [open, setOpenRaw] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const save = useSavePhoto();
  const unsave = useUnsavePhoto();
  const move = useMovePhoto();

  const setOpen = (o: boolean) => {
    setOpenRaw(o);
    onOpenChange?.(o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saved = Boolean(savedBoardId);
  const busy = save.isPending || unsave.isPending || move.isPending;

  const onClick = () => {
    if (!authed) return onRequireAuth();
    setOpen(!open);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md transition-colors',
          saved
            ? 'bg-foreground text-background hover:bg-ink-2'
            : 'bg-crimson text-white hover:brightness-110',
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saved ? t('saved') : t('save')}
      </button>

      {open && !saved && (
        <BoardPicker
          onPick={(boardId) => {
            save.mutate({ boardId, photoId });
            setOpen(false);
          }}
        />
      )}

      {open && saved && savedBoardId && (
        <BoardPicker
          title={t('moveTo')}
          excludeBoardId={savedBoardId}
          onPick={(targetBoardId) => {
            move.mutate({ boardId: savedBoardId, photoId, targetBoardId });
            setOpen(false);
          }}
          footer={
            <button
              type="button"
              onClick={() => {
                unsave.mutate({ boardId: savedBoardId, photoId });
                setOpen(false);
              }}
              className="block w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-crimson transition-colors hover:bg-secondary"
            >
              {t('removeFromBoard')}
            </button>
          }
        />
      )}
    </div>
  );
}
