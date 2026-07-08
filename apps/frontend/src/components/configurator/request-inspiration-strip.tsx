'use client';

import { useTranslations } from 'next-intl';
import { useInspirationByIds } from '@/hooks/use-inspiration';

// Pozele de inspiratie alese pe o cerere (F6) — banda de thumbnails cu
// atribuirea atelierului; folosita pe detaliul clientului si al firmei.
export function RequestInspirationStrip({ ids }: { ids: string[] }) {
  const t = useTranslations('Inspiration');
  const photos = useInspirationByIds(ids);

  if (ids.length === 0 || !photos.data?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-serif text-xl">{t('requestSection')}</h2>
      <ul className="flex flex-wrap gap-2">
        {photos.data.map((p) => (
          <li key={p.id} className="w-32 overflow-hidden rounded-lg border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl ?? ''} alt={p.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <span className="block truncate px-2 py-1 text-[11px]">
              {p.title}
              <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.company.name}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
