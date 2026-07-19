'use client';

import type { InspirationPhotoDto } from '@marketplace/shared';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SaveButton } from './save-button';

// Pin de galerie in stil Pinterest (item 8): butonul "Salveaza" apare pe hover
// in coltul din dreapta-sus si deschide picker-ul de colectii (cu creare
// inline); un pin salvat arata "Salvat", iar click-ul pe el deschide meniul
// "Muta in colectia…" / "Scoate din colectie" (idee 4 PO r2).

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
  const saved = Boolean(savedBoardId);

  return (
    // spatierea verticala o da coloana masonry (gap-4), nu pin-ul
    <figure className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm">
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
        <SaveButton
          photoId={photo.id}
          savedBoardId={savedBoardId}
          authed={authed}
          onRequireAuth={onRequireAuth}
          onOpenChange={setPickerOpen}
        />
      </div>

      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-[13px] leading-snug text-white">
        <span className="min-w-0">
          {photo.title}
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/75">
            {tc(`rooms.type.${photo.roomType}`)} · {t('byFirm', { name: photo.company.name })}
          </span>
        </span>
        {/* linkul proiectului-sursa — vizibil pe hover, nu deschide lightbox-ul */}
        {photo.sourceUrl && (
          <a
            href={photo.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={t('viewProject')}
            aria-label={t('viewProject')}
            className="pointer-events-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-white hover:text-foreground group-hover:opacity-100"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}
