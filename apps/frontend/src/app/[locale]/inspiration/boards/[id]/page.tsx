'use client';

import type { InspirationPhotoDto } from '@marketplace/shared';
import { Check, FolderInput, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-auth';
import {
  useBoardDetail,
  useDeleteBoard,
  useMovePhoto,
  useRenameBoard,
  useUnsavePhoto,
} from '@/hooks/use-inspiration-boards';
import { PublicShell } from '../../../_components/public-shell';
import { BoardPicker } from '../../_components/board-picker';

const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

// Pin din colectie: scoatere + mutare in alta colectie (idee 4 PO r2).
function BoardPin({
  photo,
  boardId,
  aspectClass,
  onRemove,
}: {
  photo: InspirationPhotoDto;
  boardId: string;
  aspectClass: string;
  onRemove: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const move = useMovePhoto();
  const [moveOpen, setMoveOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!moveOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMoveOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moveOpen]);

  return (
    <figure
      ref={rootRef}
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl ?? ''}
        alt={photo.title}
        loading="lazy"
        className={`w-full object-cover ${aspectClass}`}
      />
      <div
        className={`absolute right-2.5 top-2.5 flex items-center gap-1.5 transition-opacity ${
          moveOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoveOpen((o) => !o)}
            title={t('moveTo')}
            className="flex items-center gap-1 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md transition-colors hover:bg-surface"
          >
            <FolderInput className="h-3.5 w-3.5" />
            {t('movePin')}
          </button>
          {moveOpen && (
            <BoardPicker
              title={t('moveTo')}
              excludeBoardId={boardId}
              onPick={(targetBoardId) => {
                move.mutate({ boardId, photoId: photo.id, targetBoardId });
                setMoveOpen(false);
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-foreground/90 px-3 py-1.5 text-xs font-semibold text-background shadow-md transition-colors hover:bg-foreground"
        >
          {t('removePin')}
        </button>
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

// Detaliul unei colectii (item 8): masonry cu salvarile, scoatere per pin,
// redenumire si stergere colectie.
export default function BoardDetailPage() {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const me = useMe();
  const board = useBoardDetail(id);
  const rename = useRenameBoard(id);
  const del = useDeleteBoard();
  const unsave = useUnsavePhoto();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (me.isError) router.replace('/login?redirect=/inspiration/boards');
  }, [me.isError, router]);

  if (board.isPending) {
    return (
      <PublicShell>
        <p className="py-20 text-center text-muted-foreground">…</p>
      </PublicShell>
    );
  }
  if (board.isError || !board.data) {
    return (
      <PublicShell>
        <p className="py-20 text-center text-muted-foreground">{t('boardNotFound')}</p>
      </PublicShell>
    );
  }

  const b = board.data;

  const saveRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === b.name) return setEditing(false);
    rename.mutate(trimmed, { onSuccess: () => setEditing(false) });
  };

  return (
    <PublicShell>
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link href="/inspiration/boards" className="text-sm text-walnut hover:underline">
              ← {t('myBoards')}
            </Link>
            {editing ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                  maxLength={60}
                  className="h-11 rounded-lg border border-border-2 bg-card px-3 font-serif text-2xl outline-none focus:border-walnut"
                />
                <button
                  type="button"
                  onClick={saveRename}
                  aria-label={t('renameSave')}
                  className="grid h-9 w-9 place-items-center rounded-full bg-walnut text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label={t('close')}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h1 className="page-title mt-2 flex items-center gap-2.5">
                <span className="truncate">{b.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setName(b.name);
                    setEditing(true);
                  }}
                  aria-label={t('renameBoard')}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-2 transition-colors hover:bg-walnut-soft hover:text-walnut"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </h1>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{t('pinCount', { n: b.itemsCount })}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(t('deleteBoardConfirm', { name: b.name }))) {
                del.mutate(id, { onSuccess: () => router.replace('/inspiration/boards') });
              }
            }}
            disabled={del.isPending}
            className="text-crimson"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {t('deleteBoard')}
          </Button>
        </div>

        {b.photos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-2 bg-card px-6 py-14 text-center">
            <p className="text-muted-foreground">{t('boardEmpty')}</p>
            <Button asChild variant="walnut" className="mt-4">
              <Link href="/inspiration">{t('exploreGallery')}</Link>
            </Button>
          </div>
        )}

        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {b.photos.map((photo, i) => (
            <BoardPin
              key={photo.id}
              photo={photo}
              boardId={id}
              aspectClass={PIN_ASPECTS[i % PIN_ASPECTS.length]}
              onRemove={() => unsave.mutate({ boardId: id, photoId: photo.id })}
            />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
