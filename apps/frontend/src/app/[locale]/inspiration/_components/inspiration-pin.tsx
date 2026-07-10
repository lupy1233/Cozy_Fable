'use client';

import type { InspirationBoardDto, InspirationPhotoDto } from '@marketplace/shared';
import { Check, FolderPlus, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  useBoards,
  useCreateBoard,
  useSavePhoto,
  useUnsavePhoto,
} from '@/hooks/use-inspiration-boards';
import { cn } from '@/lib/utils';

// Pin de galerie in stil Pinterest (item 8): butonul "Salveaza" apare pe hover
// in coltul din dreapta-sus si deschide picker-ul de colectii (cu creare
// inline); un pin salvat arata "Salvat" si se poate scoate cu un click.

export function InspirationPin({
  photo,
  aspectClass,
  savedBoardId,
  authed,
  onRequireAuth,
  onOpen,
}: {
  photo: InspirationPhotoDto;
  aspectClass: string;
  // colectia in care e salvat pin-ul (null = nesalvat)
  savedBoardId: string | null;
  authed: boolean;
  onRequireAuth: () => void;
  onOpen?: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const save = useSavePhoto();
  const unsave = useUnsavePhoto();

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const saved = Boolean(savedBoardId);
  const busy = save.isPending || unsave.isPending;

  const onSaveClick = () => {
    if (!authed) return onRequireAuth();
    if (saved && savedBoardId) {
      unsave.mutate({ boardId: savedBoardId, photoId: photo.id });
      return;
    }
    setPickerOpen((o) => !o);
  };

  return (
    <figure
      ref={rootRef}
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm"
    >
      <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl ?? ''}
          alt={photo.title}
          loading="lazy"
          className={cn(
            'w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
            aspectClass,
          )}
        />
      </button>

      {/* valul de hover + butonul Salveaza (stil Pinterest) */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-black/0 transition-colors',
          'group-hover:bg-black/20',
          (pickerOpen || saved) && 'bg-black/10',
        )}
      />
      <div
        className={cn(
          'absolute right-2.5 top-2.5 transition-opacity',
          pickerOpen || saved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <button
          type="button"
          onClick={onSaveClick}
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

        {/* picker-ul de colectii */}
        {pickerOpen && !saved && (
          <BoardPicker
            onPick={(boardId) => {
              save.mutate(
                { boardId, photoId: photo.id },
                { onSuccess: () => setPickerOpen(false) },
              );
            }}
          />
        )}
      </div>

      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-[13px] leading-snug text-white">
        {photo.title}
        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/75">
          {tc(`rooms.type.${photo.roomType}`)} · {t('byFirm', { name: photo.company.name })}
        </span>
      </figcaption>
    </figure>
  );
}

// Lista colectiilor + creare inline ("Colectie noua"), ca board picker-ul Pinterest.
function BoardPicker({ onPick }: { onPick: (boardId: string) => void }) {
  const t = useTranslations('Inspiration');
  const boards = useBoards();
  const create = useCreateBoard();
  const [name, setName] = useState('');
  const err = create.error instanceof ApiError ? create.error.code : null;

  const submitNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (board) => {
        setName('');
        onPick(board.id);
      },
    });
  };

  return (
    <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        {t('pickBoard')}
      </p>
      <div className="max-h-48 overflow-y-auto">
        {boards.data?.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-2">{t('noBoardsYet')}</p>
        )}
        {boards.data?.map((b: InspirationBoardDto) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b.id)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
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
            <span className="font-mono text-[10px] text-muted-2">{b.itemsCount}</span>
          </button>
        ))}
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
          <p className="mt-1 text-[11px] text-crimson">
            {err === 'BOARD_NAME_TAKEN' ? t('boardNameTaken') : t('boardError')}
          </p>
        )}
      </div>
    </div>
  );
}
