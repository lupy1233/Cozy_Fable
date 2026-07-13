'use client';

import { useState } from 'react';
import { ArrowLeft, Check, FolderHeart, Images, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InspirationPhotoDto, RoomType } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMe } from '@/hooks/use-auth';
import { useInspiration } from '@/hooks/use-inspiration';
import { useBoardDetail, useBoards } from '@/hooks/use-inspiration-boards';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { cn } from '@/lib/utils';

// Alegerea pozelor de inspiratie din galerie, direct in formular (F6, item 3).
// Selectia (max 10) intra in cerere la publish; firmele o vad pe detaliu.
// R7 (feedback PO r3): al doilea tab cu colectiile utilizatorului (caietul de
// idei) — pozele salvate pe boards se pot alege direct, fara re-cautare.

const MAX_SELECTED = 10;

const TYPE_FILTERS: RoomType[] = ['KITCHEN', 'LIVING', 'BEDROOM', 'DRESSING', 'OFFICE', 'BATHROOM', 'HALLWAY'];

type PickerTab = 'gallery' | 'boards';

// Grila comuna de poze cu toggle de selectie — galerie si colectii arata identic.
function PhotoGrid({
  photos,
  selected,
  onToggle,
}: {
  photos: InspirationPhotoDto[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p) => {
        const isSel = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            aria-pressed={isSel}
            className={cn(
              'group relative overflow-hidden rounded-lg border text-left transition-shadow',
              isSel ? 'border-walnut shadow-[0_0_0_3px_hsl(var(--walnut)/0.2)]' : 'border-border-2',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl ?? ''}
              alt={p.title}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            <span className="block truncate px-2 py-1.5 text-xs">
              {p.title}
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.company.name}
              </span>
            </span>
            {isSel && (
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-walnut text-background">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function InspirationPicker() {
  const t = useTranslations('Configurator');
  const tc = useTranslations('Configurator');
  const ti = useTranslations('Inspiration');
  const me = useMe();
  const authed = !!me.data;
  const selected = useConfiguratorStore((s) => s.inspirationPhotoIds);
  const setSelected = useConfiguratorStore((s) => s.setInspirationPhotos);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('gallery');
  const [type, setType] = useState<RoomType | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);

  const gallery = useInspiration({ roomType: type ?? undefined }, open && tab === 'gallery');
  // colectiile utilizatorului (caietul de idei) — doar pentru conturi logate
  const boards = useBoards(open && tab === 'boards');
  const boardDetail = useBoardDetail(open && tab === 'boards' ? boardId ?? '' : '');
  // pozele deja alese, pentru thumbnails (independent de filtrul din dialog)
  const chosen = useInspiration({ ids: selected }, selected.length > 0);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else if (selected.length < MAX_SELECTED) {
      setSelected([...selected, id]);
    }
  };

  const openDialog = () => {
    setTab('gallery');
    setBoardId(null);
    setOpen(true);
  };

  return (
    <div className="rounded-xl border border-border-2 bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">{t('inspirationPicker.title')}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('inspirationPicker.subtitle', { max: MAX_SELECTED })}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openDialog}>
          <Images className="mr-1.5 h-4 w-4" />
          {t('inspirationPicker.browse')}
        </Button>
      </div>

      {/* selectia curenta */}
      {selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {(chosen.data ?? []).map((p) => (
            <li key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl ?? ''} alt={p.title} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`remove ${p.title}`}
                onClick={() => toggle(p.id)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inspirationPicker.dialogTitle')}</DialogTitle>
          </DialogHeader>

          {/* taburi: galeria publica / colectiile mele (doar logat) */}
          {authed && (
            <div className="flex gap-1 rounded-lg border border-border-2 bg-surface p-1 text-sm">
              {(['gallery', 'boards'] as PickerTab[]).map((tb) => (
                <button
                  key={tb}
                  type="button"
                  onClick={() => {
                    setTab(tb);
                    setBoardId(null);
                  }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                    tab === tb ? 'bg-walnut-soft font-medium text-walnut' : 'text-muted-foreground',
                  )}
                >
                  {tb === 'gallery' ? (
                    <Images className="h-4 w-4" />
                  ) : (
                    <FolderHeart className="h-4 w-4" />
                  )}
                  {t(`inspirationPicker.${tb === 'gallery' ? 'tabGallery' : 'tabBoards'}`)}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t('inspirationPicker.selectedCount', { count: selected.length, max: MAX_SELECTED })}
          </p>

          {tab === 'gallery' && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setType(null)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm',
                    type === null ? 'border-walnut bg-walnut-soft text-walnut' : 'border-border-2 text-muted-foreground',
                  )}
                >
                  {ti('all')}
                </button>
                {TYPE_FILTERS.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setType(type === rt ? null : rt)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm',
                      type === rt ? 'border-walnut bg-walnut-soft text-walnut' : 'border-border-2 text-muted-foreground',
                    )}
                  >
                    {tc(`rooms.type.${rt}`)}
                  </button>
                ))}
              </div>

              {gallery.isPending && <p className="py-10 text-center text-muted-foreground">…</p>}
              {!gallery.isPending && (gallery.data ?? []).length === 0 && (
                <p className="py-10 text-center text-muted-foreground">{ti('empty')}</p>
              )}
              <PhotoGrid photos={gallery.data ?? []} selected={selected} onToggle={toggle} />
            </>
          )}

          {tab === 'boards' && !boardId && (
            <>
              {boards.isPending && <p className="py-10 text-center text-muted-foreground">…</p>}
              {!boards.isPending && (boards.data ?? []).length === 0 && (
                <p className="py-10 text-center text-muted-foreground">
                  {t('inspirationPicker.boardsEmpty')}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(boards.data ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBoardId(b.id)}
                    className="group overflow-hidden rounded-lg border border-border-2 text-left transition-colors hover:border-walnut"
                  >
                    <div className="grid aspect-[4/3] w-full grid-cols-3 gap-0.5 bg-surface-2">
                      {b.coverUrls.length === 0 && (
                        <span className="col-span-3 grid place-items-center text-muted-foreground">
                          <FolderHeart className="h-6 w-6" />
                        </span>
                      )}
                      {b.coverUrls.slice(0, 3).map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className={cn('h-full w-full object-cover', i === 0 && b.coverUrls.length === 1 && 'col-span-3')}
                        />
                      ))}
                    </div>
                    <span className="block truncate px-2 py-1.5 text-xs font-medium">
                      {b.name}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {t('inspirationPicker.boardCount', { count: b.itemsCount })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'boards' && boardId && (
            <>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setBoardId(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {t('inspirationPicker.backToBoards')}
                </Button>
                <span className="font-serif">{boardDetail.data?.name ?? ''}</span>
              </div>
              {boardDetail.isPending && <p className="py-10 text-center text-muted-foreground">…</p>}
              {!boardDetail.isPending && (boardDetail.data?.photos ?? []).length === 0 && (
                <p className="py-10 text-center text-muted-foreground">{ti('empty')}</p>
              )}
              <PhotoGrid photos={boardDetail.data?.photos ?? []} selected={selected} onToggle={toggle} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
