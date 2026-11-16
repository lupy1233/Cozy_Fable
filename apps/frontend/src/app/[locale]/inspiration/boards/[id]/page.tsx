'use client';

import {
  MAX_BOARD_NAME_LENGTH,
  type InspirationBoardItemMetaDto,
  type InspirationPhotoDto,
} from '@marketplace/shared';
import { Bookmark, Check, Loader2, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMe, useSessionRole } from '@/hooks/use-auth';
import {
  useBoardDetail,
  useDeleteBoard,
  useMovePhoto,
  useRenameBoard,
  useSavePhoto,
  useUnsavePhoto,
  useUpdateBoardItem,
} from '@/hooks/use-inspiration-boards';
import { PublicShell } from '../../../_components/public-shell';
import { BoardItemNoteEditor } from '../../_components/board-item-note-editor';
import { BoardPicker } from '../../_components/board-picker';
import { InspirationImage } from '../../_components/inspiration-image';

// auto-fill (nu auto-fit): cu una-doua salvari cartonasele isi pastreaza latimea
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] items-start gap-5';

const backLink =
  'inline-flex min-h-11 items-center gap-1.5 self-start font-medium text-walnut transition-colors hover:text-walnut-deep hover:underline';

// ultima salvare scoasa din colectie — cat sa poata fi pusa inapoi din bara "Anuleaza"
type RemovedItem = {
  photoId: string;
  title: string;
  note: InspirationBoardItemMetaDto['note'];
  roomType: InspirationBoardItemMetaDto['roomType'];
  status: 'idle' | 'pending' | 'error';
};

// Cartonasul unei salvari (design 2026-11): imaginea, titlul, notita si camera
// clientului (E-client-34), apoi actiunile mereu la vedere — notita (editor in
// Popover), "Muta" in alta colectie (idee 4 PO r2) si "Scoate".
function BoardPin({
  photo,
  boardId,
  meta,
  removing,
  onRemove,
}: {
  photo: InspirationPhotoDto;
  boardId: string;
  meta?: InspirationBoardItemMetaDto;
  removing: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const move = useMovePhoto();
  const [moveOpen, setMoveOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const hasMeta = Boolean(meta?.note || meta?.roomType);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <InspirationImage
        src={photo.imageUrl}
        alt={photo.title}
        loading="lazy"
        className="aspect-square w-full object-cover"
      />
      <div className="flex flex-col gap-2.5 border-t border-border px-3.5 pb-3.5 pt-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">{photo.title}</h2>
          <p className="text-xs text-muted-foreground">
            <span className="uppercase">{tc(`rooms.type.${photo.roomType}`)}</span> ·{' '}
            {t('byFirm', { name: photo.company.name })}
          </p>
        </div>
        {/* E-client-34: camera aleasa de client pentru aceasta idee + notita lui */}
        {meta?.roomType && (
          <Badge tone="walnut" className="self-start">
            {tc(`rooms.type.${meta.roomType}`)}
          </Badge>
        )}
        {meta?.note && <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-ui text-ink-2">{meta.note}</p>}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <Popover open={noteOpen} onOpenChange={setNoteOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center px-0.5 text-ui font-medium text-walnut transition-colors hover:text-walnut-deep hover:underline"
              >
                {hasMeta ? t('noteEdit') : t('noteAdd')}
              </button>
            </PopoverTrigger>
            <PopoverContent width="lg" align="start" className="p-0">
              <BoardItemNoteEditor
                boardId={boardId}
                photoId={photo.id}
                meta={meta}
                onClose={() => setNoteOpen(false)}
              />
            </PopoverContent>
          </Popover>
          <div className="flex gap-1.5">
            <Popover open={moveOpen} onOpenChange={setMoveOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" title={t('moveTo')} className="px-3 text-ui font-normal">
                  {t('movePin')}
                </Button>
              </PopoverTrigger>
              <PopoverContent width="md" align="end" className="p-0">
                <BoardPicker
                  title={t('moveTo')}
                  excludeBoardId={boardId}
                  onPick={(targetBoardId) => {
                    move.mutate({ boardId, photoId: photo.id, targetBoardId });
                    setMoveOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              onClick={onRemove}
              disabled={removing}
              className="px-3 text-ui font-normal"
            >
              {t('removePin')}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

// Detaliul unei colectii (item 8): cartonasele salvarilor cu notita, mutare si
// scoatere (cu "Anuleaza"), redenumire si stergere colectie, link spre cerere.
export default function BoardDetailPage() {
  const t = useTranslations('Inspiration');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const me = useMe();
  const { role } = useSessionRole();
  const board = useBoardDetail(id);
  const rename = useRenameBoard(id);
  const del = useDeleteBoard();
  const unsave = useUnsavePhoto();
  const save = useSavePhoto();
  const updateItem = useUpdateBoardItem(id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  // salvarile cu un DELETE in curs (butonul "Scoate" asteapta)
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [removed, setRemoved] = useState<RemovedItem | null>(null);

  useEffect(() => {
    if (me.isError) router.replace('/login?redirect=/inspiration/boards');
  }, [me.isError, router]);

  if (board.isPending) {
    return (
      <PublicShell>
        <LoadingRegion className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className={GRID}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
            ))}
          </div>
        </LoadingRegion>
      </PublicShell>
    );
  }
  if (board.isError || !board.data) {
    return (
      <PublicShell>
        <EmptyState
          variant="dashed"
          icon={Bookmark}
          title={t('boardNotFound')}
          className="px-5"
          action={
            <Button asChild variant="outline">
              <Link href="/inspiration/boards">{t('myBoards')}</Link>
            </Button>
          }
        />
      </PublicShell>
    );
  }

  const b = board.data;
  const metaByPhoto = new Map(b.items.map((i) => [i.photoId, i]));
  // cererea de oferte o face clientul — firmele/adminul nu primesc butonul
  const canRequest = role === 'CLIENT';
  const renameErr = rename.error instanceof ApiError ? rename.error.code : rename.isError ? 'UNKNOWN' : null;

  const startRename = () => {
    rename.reset();
    setName(b.name);
    setEditing(true);
  };
  const closeRename = () => {
    rename.reset();
    setEditing(false);
  };
  const saveRename = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === b.name) return closeRename();
    rename.mutate(trimmed, { onSuccess: () => setEditing(false) });
  };

  const removeItem = async (photo: InspirationPhotoDto) => {
    if (removingIds.includes(photo.id)) return;
    const meta = metaByPhoto.get(photo.id);
    setRemovingIds((ids) => [...ids, photo.id]);
    try {
      await unsave.mutateAsync({ boardId: id, photoId: photo.id });
      setRemoved({
        photoId: photo.id,
        title: photo.title,
        note: meta?.note ?? null,
        roomType: meta?.roomType ?? null,
        status: 'idle',
      });
    } catch {
      // starea "Salvat" o readuce hook-ul (onError); cartonasul ramane in colectie
    } finally {
      setRemovingIds((ids) => ids.filter((x) => x !== photo.id));
    }
  };

  // "Anuleaza": aceeasi poza se salveaza din nou in colectie (POST idempotent), apoi
  // notita si camera se pun la loc (PATCH) — doar cu mutatiile existente. Salvarea
  // revine prima in colectie (cea mai noua). La esec, a doua incercare reia ambii pasi.
  const undoRemove = async () => {
    const target = removed;
    if (!target || target.status === 'pending') return;
    // intre timp poate fi scoasa alta salvare: atingem bara doar daca e tot a acesteia
    const patchBar = (next: RemovedItem | null) =>
      setRemoved((cur) => (cur && cur.photoId === target.photoId ? next : cur));
    patchBar({ ...target, status: 'pending' });
    try {
      await save.mutateAsync({ boardId: id, photoId: target.photoId });
      if (target.note !== null || target.roomType !== null) {
        await updateItem.mutateAsync({ photoId: target.photoId, note: target.note, roomType: target.roomType });
      }
      patchBar(null);
    } catch {
      patchBar({ ...target, status: 'error' });
    }
  };

  return (
    <PublicShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href="/inspiration/boards" className={backLink}>
            <span aria-hidden>←</span>
            {t('myBoards')}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              {editing ? (
                <form onSubmit={saveRename} className="flex flex-wrap items-center gap-2">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && closeRename()}
                    maxLength={MAX_BOARD_NAME_LENGTH}
                    aria-label={t('renameBoard')}
                    className="h-12 min-w-0 max-w-md flex-1 font-serif text-2xl"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t('renameSave')}
                    disabled={rename.isPending}
                    className="h-11 w-11"
                  >
                    {rename.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={closeRename}
                    aria-label={t('close')}
                    className="h-11 w-11"
                  >
                    <X aria-hidden />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="page-title min-w-0 break-words">{b.name}</h1>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={startRename}
                    aria-label={t('renameBoard')}
                    className="h-11 w-11 shrink-0 text-muted-foreground"
                  >
                    <Pencil aria-hidden />
                  </Button>
                </div>
              )}
              {editing && renameErr && (
                <p role="alert" className="text-sm text-crimson">
                  {renameErr === 'BOARD_NAME_TAKEN' ? t('boardNameTaken') : t('boardError')}
                </p>
              )}
              <p className="text-muted-foreground">
                {t('pinCount', { n: b.itemsCount })} · {t('notesPrivate')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (confirm(t('deleteBoardConfirm', { name: b.name }))) {
                    del.mutate(id, { onSuccess: () => router.replace('/inspiration/boards') });
                  }
                }}
                disabled={del.isPending}
                className="h-11 px-3.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
              >
                {t('deleteBoard')}
              </Button>
              {canRequest && b.photos.length > 0 && (
                <Button asChild variant="walnut" className="h-11 px-5">
                  <Link href="/requests/new">{t('useInRequest')}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {b.photos.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={Bookmark}
            title={t('boardEmpty')}
            className="px-5"
            action={
              <Button asChild variant="walnut">
                <Link href="/inspiration">{t('exploreGallery')}</Link>
              </Button>
            }
          />
        ) : (
          <div className={GRID}>
            {b.photos.map((photo) => (
              <BoardPin
                key={photo.id}
                photo={photo}
                boardId={id}
                meta={metaByPhoto.get(photo.id)}
                removing={removingIds.includes(photo.id)}
                onRemove={() => void removeItem(photo)}
              />
            ))}
          </div>
        )}

        {/* bara de dupa "Scoate": ramane lipita de marginea de jos a ecranului cat
            colectia e mai lunga decat el, pana la "Anuleaza" sau inchidere */}
        {removed && (
          <div
            role="status"
            className="sticky bottom-4 z-20 flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 self-center rounded-lg bg-foreground py-2.5 pl-[18px] pr-2.5 text-primary-foreground shadow-lg"
          >
            <span className="min-w-0 break-words">
              {removed.status === 'error' ? t('undoError') : t('removedFromBoard', { title: removed.title })}
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void undoRemove()}
                disabled={removed.status === 'pending'}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-muted-foreground px-3.5 font-medium transition-colors hover:bg-primary-foreground/10 disabled:opacity-60"
              >
                {removed.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {t('undo')}
              </button>
              <button
                type="button"
                onClick={() => setRemoved(null)}
                aria-label={t('close')}
                className="grid h-9 w-9 place-items-center rounded-md text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
