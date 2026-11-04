'use client';

import { Check, Loader2 } from 'lucide-react';
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
export function SaveButton({
  photoId,
  savedBoardIds,
  authed,
  onRequireAuth,
  onOpenChange,
}: {
  photoId: string;
  // colectiile in care e salvata poza (gol = nesalvata)
  savedBoardIds: string[];
  authed: boolean;
  onRequireAuth: () => void;
  // pin-ul isi tine valul de hover vizibil cat timp popover-ul e deschis
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('Inspiration');
  const [open, setOpenRaw] = useState(false);
  const save = useSavePhoto();
  const unsave = useUnsavePhoto();
  // colectiile cu o bifa in curs de confirmare (spinner pe rand)
  const [pending, setPending] = useState<string[]>([]);

  const setOpen = (o: boolean) => {
    setOpenRaw(o);
    onOpenChange?.(o);
  };

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
  const onOpenChangeRaw = (o: boolean) => {
    if (o && !authed) return onRequireAuth();
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChangeRaw}>
      <PopoverTrigger asChild>
        <button
          type="button"
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
          {saved ? t('savedInCount', { count: savedBoardIds.length }) : t('save')}
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
