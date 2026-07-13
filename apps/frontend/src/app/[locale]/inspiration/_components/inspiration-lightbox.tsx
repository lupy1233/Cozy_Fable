'use client';

import type { InspirationPhotoDto } from '@marketplace/shared';
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SaveButton } from './save-button';

const SIMILAR_COUNT = 8;

// Lightbox in stil Pinterest (idee 3 PO r2): imaginea pe mare cu buton
// "Salveaza", navigare ←/→ (butoane + tastatura) intre pin-urile filtrate
// si idei asemanatoare dedesubt (aceeasi camera sau materiale/culori comune).
export function InspirationLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  savedByPhoto,
  authed,
  onRequireAuth,
}: {
  // lista pin-urilor vizibile (dupa filtrele active) — spatiul de navigare
  photos: InspirationPhotoDto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  savedByPhoto: Map<string, string>;
  authed: boolean;
  onRequireAuth: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');

  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  // pagina din spate nu deruleaza cat e lightbox-ul deschis — pozitia din
  // galerie ramane exact unde era la inchidere (U3, PO r4)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // idei asemanatoare: aceeasi camera sau materiale/culori comune, din lista
  // deja filtrata (docs/09: "dupa aceleasi filtre")
  const similar = useMemo(() => {
    if (!photo) return [];
    const score = (p: InspirationPhotoDto) => {
      let s = 0;
      if (p.roomType === photo.roomType) s += 2;
      if (p.materials.some((m) => photo.materials.includes(m))) s += 1;
      if (p.colors.some((c) => photo.colors.includes(c))) s += 1;
      return s;
    };
    return photos
      .map((p, i) => ({ p, i, s: score(p) }))
      .filter((x) => x.p.id !== photo.id && x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, SIMILAR_COUNT);
  }, [photos, photo]);

  if (!photo) return null;

  // portal pe <body>: overlay-ul fixed nu mai depinde de stramosii paginii
  // (un transform pe <main> il ancora la inceputul documentului — U3, PO r4)
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      {/* sagetile stau in afara cardului, ca pe Pinterest */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label={t('prevPin')}
          className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-md transition-colors hover:bg-white sm:grid"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label={t('nextPin')}
          className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-md transition-colors hover:bg-white sm:grid"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="min-h-0 overflow-y-auto">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl ?? ''}
              alt={photo.title}
              className="max-h-[62vh] w-full bg-black/5 object-contain"
            />
            {/* navigare pe mobil: sageti mici peste imagine */}
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-2 sm:hidden">
              <button
                type="button"
                onClick={() => hasPrev && onNavigate(index - 1)}
                aria-label={t('prevPin')}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white',
                  !hasPrev && 'invisible',
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => hasNext && onNavigate(index + 1)}
                aria-label={t('nextPin')}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white',
                  !hasNext && 'invisible',
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-serif text-lg leading-tight">{photo.title}</p>
              <p className="text-xs text-muted-foreground">
                {tc(`rooms.type.${photo.roomType}`)} · {t('byFirm', { name: photo.company.name })}
              </p>
              {/* linkul proiectului-sursa din portofoliul atelierului */}
              {photo.sourceUrl && (
                <a
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-walnut/40 bg-walnut-soft/60 px-2.5 py-1 text-xs font-medium text-walnut transition-colors hover:border-walnut hover:bg-walnut-soft"
                >
                  {t('viewProject')}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <SaveButton
              photoId={photo.id}
              savedBoardId={savedByPhoto.get(photo.id) ?? null}
              authed={authed}
              onRequireAuth={onRequireAuth}
            />
          </div>

          {similar.length > 0 && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('similarPins')}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {similar.map(({ p, i }) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onNavigate(i)}
                    className="group relative overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl ?? ''}
                      alt={p.title}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
