'use client';

import type { InspirationPhotoDto } from '@marketplace/shared';
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SaveButton } from './save-button';

// Pragul de la care un gest orizontal conteaza ca "swipe la poza urmatoare".
const SWIPE_THRESHOLD_PX = 60;

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

  // A4/B4: directia glisarii (pentru animatia de intrare) + starea gestului
  // touch (deplasarea curenta a imaginii sub deget).
  const [dir, setDir] = useState<1 | -1>(1);
  const [dragX, setDragX] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);

  const go = (delta: 1 | -1) => {
    if (delta === 1 && !hasNext) return;
    if (delta === -1 && !hasPrev) return;
    setDir(delta);
    setDragX(null);
    onNavigate(index + delta);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) go(-1);
      if (e.key === 'ArrowRight' && hasNext) go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  // Gestul de swipe: urmarim degetul pe orizontala (vertical ramane scroll-ul
  // cardului); la ridicare, peste prag → poza vecina, altfel revine pe loc.
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    touch.current = { x: t0.clientX, y: t0.clientY, horizontal: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const st = touch.current;
    if (!st) return;
    const t0 = e.touches[0];
    const dx = t0.clientX - st.x;
    const dy = t0.clientY - st.y;
    if (st.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      st.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (st.horizontal) {
      // rezistenta la capete: fara vecin, imaginea se misca doar putin
      const capped = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? dx / 4 : dx;
      setDragX(capped);
    }
  };
  const onTouchEnd = () => {
    const st = touch.current;
    touch.current = null;
    if (!st || !st.horizontal || dragX === null) {
      setDragX(null);
      return;
    }
    if (dragX <= -SWIPE_THRESHOLD_PX && hasNext) go(1);
    else if (dragX >= SWIPE_THRESHOLD_PX && hasPrev) go(-1);
    else setDragX(null);
  };

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
            go(-1);
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
            go(1);
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
          {/* A3/A4: scena are INALTIME FIXA (nu max-h) — cardul nu-si mai
              schimba dimensiunea intre poze si nici la incarcarea imaginii;
              swipe pe touch (B4), cu urmarirea degetului */}
          <div
            className="relative h-[48vh] touch-pan-y overflow-hidden bg-black/5 sm:h-[62vh]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* key pe poza → remount → animatia de intrare ruleaza directional;
                fara fill-mode: daca animatia nu ruleaza, imaginea e vizibila */}
            <div
              key={photo.id}
              className={cn(
                'h-full w-full',
                dragX === null && (dir === 1 ? 'lightbox-slide-left' : 'lightbox-slide-right'),
              )}
              style={
                dragX !== null
                  ? { transform: `translateX(${dragX}px)`, transition: 'none' }
                  : { transition: 'transform 220ms ease-out' }
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.imageUrl ?? ''}
                alt={photo.title}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            {/* preincarca vecinii: glisarea nu mai "sare" pe alb la navigare */}
            {hasPrev && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[index - 1].imageUrl ?? ''} alt="" aria-hidden className="hidden" />
            )}
            {hasNext && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[index + 1].imageUrl ?? ''} alt="" aria-hidden className="hidden" />
            )}
            {/* navigare pe mobil: sageti mici peste imagine */}
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-2 sm:hidden">
              <button
                type="button"
                onClick={() => go(-1)}
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
                onClick={() => go(1)}
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
                    onClick={() => {
                      setDir(i > index ? 1 : -1);
                      setDragX(null);
                      onNavigate(i);
                    }}
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
