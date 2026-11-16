'use client';

import type { InspirationPhotoDto } from '@marketplace/shared';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SaveButton } from './save-button';
import { InspirationImage } from './inspiration-image';

// Cartonas de galerie (design 2026-11): imaginea deschide lightbox-ul, butonul
// "Salveaza" sta MEREU in coltul din dreapta-sus (nu doar la hover — pe telefon
// nu exista hover) si deschide picker-ul de colectii (cu creare inline); un pin
// salvat arata "Salvat in N colectii", iar popover-ul ramane o lista cu bife
// (E-client-34: aceeasi poza in mai multe colectii). Titlul, camera, firma si
// linkul proiectului stau sub imagine, nu peste ea.

export function InspirationPin({
  photo,
  aspectClass,
  savedBoardIds,
  authed,
  onRequireAuth,
  onOpen,
}: {
  photo: InspirationPhotoDto;
  aspectClass: string;
  // colectiile in care e salvat pin-ul (gol = nesalvat)
  savedBoardIds: string[];
  authed: boolean;
  onRequireAuth: () => void;
  onOpen?: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');

  return (
    // spatierea verticala o da coloana masonry (gap-4), nu pin-ul
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in overflow-hidden">
        <InspirationImage
          src={photo.imageUrl ?? ''}
          alt={photo.title}
          loading="lazy"
          className={cn(
            'w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
            aspectClass,
          )}
        />
      </button>

      {/* mereu vizibil; pe telefon doar iconita (cartonasul are ~150px latime) */}
      <div className="absolute right-2.5 top-2.5 flex max-w-[calc(100%-1.25rem)] justify-end sm:right-3 sm:top-3 sm:max-w-[calc(100%-1.5rem)]">
        <SaveButton
          compact
          photoId={photo.id}
          savedBoardIds={savedBoardIds}
          authed={authed}
          onRequireAuth={onRequireAuth}
        />
      </div>

      <div className="flex flex-col gap-1 border-t border-border px-3.5 pb-3.5 pt-3">
        <h2 className="line-clamp-2 text-sm font-medium">{photo.title}</h2>
        <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="uppercase">{tc(`rooms.type.${photo.roomType}`)}</span> ·{' '}
            {t('byFirm', { name: photo.company.name })}
          </span>
          {/* linkul proiectului-sursa din portofoliul firmei */}
          {photo.sourceUrl && (
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-walnut transition-colors hover:text-walnut-deep hover:underline"
            >
              {t('viewProject')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
