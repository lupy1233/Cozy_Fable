'use client';

import { Bookmark, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSavePhoto, useUnsavePhoto } from '@/hooks/use-inspiration-boards';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { BoardPicker } from './board-picker';

// Butonul "Salveaza"/"Salvat" cu popover — partajat de pin si lightbox.
// E-client-34: popover-ul e o lista de colectii cu bife — o poza se salveaza in mai multe
// colectii deodata (bifa = salveaza, debifare = scoate); ramane deschis intre bife.
// Mutarea intre colectii ramane pe detaliul colectiei.
// Design 2026-11: pastila alba cu semn de carte, mereu vizibila pe cartonas (nu doar la
// hover); salvat = pastila espresso cu semnul plin.
export function SaveButton({
  photoId,
  savedBoardIds,
  authed,
  onRequireAuth,
  compact = false,
}: {
  photoId: string;
  // colectiile in care e salvata poza (gol = nesalvata)
  savedBoardIds: string[];
  authed: boolean;
  onRequireAuth: () => void;
  // pe cartonasele inguste de pe telefon (2 coloane) ramane doar iconita;
  // textul sta in continuare in numele accesibil
  compact?: boolean;
}) {
  const t = useTranslations('Inspiration');
  const [open, setOpen] = useState(false);
  const save = useSavePhoto();
  const unsave = useUnsavePhoto();
  // colectiile cu o bifa in curs de confirmare (spinner pe rand)
  const [pending, setPending] = useState<string[]>([]);

  const saved = savedBoardIds.length > 0;
  const busy = pending.length > 0;

  // eroarea se anuleaza in hook (rollback pe perechea afectata); aici doar urmarim "in curs"
  const toggleBoard = async (boardId: string, checked: boolean) => {
    if (pending.includes(boardId)) return;
    setPending((p) => [...p, boardId]);
    try {
      await (checked ? save : unsave).mutateAsync({ boardId, photoId });
    } catch {
      // revenit de onError
    } finally {
      setPending((p) => p.filter((id) => id !== boardId));
    }
  };

  // neautentificat: nu deschide picker-ul, ci cere login-ul
  const onOpenChange = (o: boolean) => {
    if (o && !authed) return onRequireAuth();
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-10 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border text-ui font-medium shadow-sm transition-colors',
            compact ? 'w-10 sm:w-auto sm:px-3.5' : 'px-3.5',
            saved
              ? 'border-foreground bg-foreground text-primary-foreground hover:bg-ink-2'
              : 'border-border-2 bg-surface text-foreground hover:border-muted-2 hover:bg-surface-2',
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Bookmark className={cn('h-3.5 w-3.5 shrink-0', saved && 'fill-current')} aria-hidden />
          )}
          <span className={compact ? 'sr-only sm:not-sr-only sm:min-w-0 sm:truncate' : 'min-w-0 truncate'}>
            {saved ? t('savedInCount', { count: savedBoardIds.length }) : t('save')}
          </span>
        </button>
      </PopoverTrigger>

      {/* Escape inchide doar pickerul, nu si lightbox-ul (care asculta keydown pe document) */}
      <PopoverContent
        width="md"
        align="end"
        className="p-0"
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <BoardPicker
          title={t('saveToBoards')}
          checkedBoardIds={savedBoardIds}
          pendingBoardIds={pending}
          onToggle={toggleBoard}
          footer={
            <PopoverClose asChild>
              <button
                type="button"
                className="block w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-walnut transition-colors hover:bg-secondary"
              >
                {t('done')}
              </button>
            </PopoverClose>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
