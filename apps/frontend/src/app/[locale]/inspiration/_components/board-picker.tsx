'use client';

import type { InspirationBoardDto } from '@marketplace/shared';
import { Check, FolderPlus, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useBoards, useCreateBoard } from '@/hooks/use-inspiration-boards';
import { cn } from '@/lib/utils';

// Lista colectiilor + creare inline ("Colectie noua"), ca board picker-ul
// Pinterest. Refolosit la salvare (titlu "Salveaza in colectia…") si la mutare
// ("Muta in colectia…", cu colectia curenta exclusa) — idee 4 PO r2.
// E-client-34: in modul cu bife (checkedBoardIds + onToggle) o poza se salveaza in mai
// multe colectii deodata; randurile devin casute de bifat si nu mai cheama onPick.
export function BoardPicker({
  onPick,
  excludeBoardId,
  title,
  footer,
  checkedBoardIds,
  onToggle,
  pendingBoardIds,
}: {
  onPick?: (boardId: string) => void;
  // modul cu bife: colectiile in care poza e deja salvata
  checkedBoardIds?: string[];
  onToggle?: (boardId: string, checked: boolean) => void;
  // colectii cu o mutatie in curs (spinner pe rand)
  pendingBoardIds?: string[];
  // colectia curenta a pin-ului — ascunsa din lista la mutare
  excludeBoardId?: string;
  title?: string;
  footer?: React.ReactNode;
}) {
  const t = useTranslations('Inspiration');
  const boards = useBoards();
  const create = useCreateBoard();
  const [name, setName] = useState('');
  const err = create.error instanceof ApiError ? create.error.code : null;

  const list = (boards.data ?? []).filter((b) => b.id !== excludeBoardId);
  const checkMode = checkedBoardIds !== undefined && onToggle !== undefined;

  const submitNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (board) => {
        setName('');
        // in modul cu bife colectia noua se creeaza deja bifata
        if (checkMode) onToggle(board.id, true);
        else onPick?.(board.id);
      },
    });
  };

  return (
    // doar continutul: panoul, pozitionarea si inchiderea vin din PopoverContent
    <div className="text-left">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        {title ?? t('pickBoard')}
      </p>
      <div className="max-h-48 overflow-y-auto" role={checkMode ? 'group' : undefined} aria-label={checkMode ? (title ?? t('pickBoard')) : undefined}>
        {!boards.isPending && list.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-2">{t('noBoardsYet')}</p>
        )}
        {list.map((b: InspirationBoardDto) => {
          const checked = checkMode && checkedBoardIds.includes(b.id);
          const pending = pendingBoardIds?.includes(b.id) ?? false;
          return (
          <button
            key={b.id}
            type="button"
            role={checkMode ? 'checkbox' : undefined}
            aria-checked={checkMode ? checked : undefined}
            // o bifa in curs nu se poate inversa (POST si DELETE paralele pe aceeasi pereche)
            disabled={checkMode && pending}
            aria-busy={pending || undefined}
            onClick={() => (checkMode ? onToggle(b.id, !checked) : onPick?.(b.id))}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:cursor-wait',
              checked && 'bg-walnut-soft/50',
            )}
          >
            {b.coverUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.coverUrls[0]} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-2">
                <FolderPlus className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
            <span className="font-mono text-micro text-muted-2">{b.itemsCount}</span>
            {checkMode && (
              <span
                aria-hidden
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded border',
                  checked ? 'border-walnut bg-walnut text-primary-foreground' : 'border-border-2',
                )}
              >
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : checked ? <Check className="h-3 w-3" /> : null}
              </span>
            )}
          </button>
          );
        })}
      </div>
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
            placeholder={t('newBoardPlaceholder')}
            maxLength={60}
            className="h-8 min-w-0 flex-1 rounded-md border border-border-2 bg-surface-2 px-2 text-sm outline-none focus:border-walnut"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={create.isPending || !name.trim()}
            aria-label={t('createBoard')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-walnut text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
        {err && (
          <p className="mt-1 text-meta text-crimson">
            {err === 'BOARD_NAME_TAKEN' ? t('boardNameTaken') : t('boardError')}
          </p>
        )}
      </div>
      {footer}
    </div>
  );
}
