'use client';

import { Suspense, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  FURNITURE_TYPES,
  INSPIRATION_PINS,
  pinterestUrl,
  type FurnitureType,
} from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';

// Galeria de inspiratie (stil Pinterest): cautare text + filtrare dupa
// tipul de mobilier; fiecare pin se deschide pe Pinterest. Filtrul
// initial poate veni din query (?type=kitchen — folosit de landing).

const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

// cautare tolerata la diacritice ("bucatarie" gaseste "Bucătărie")
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// useSearchParams cere un boundary de Suspense la randarea statica
export default function InspirationPage() {
  return (
    <Suspense fallback={null}>
      <InspirationGallery />
    </Suspense>
  );
}

function InspirationGallery() {
  const t = useTranslations('Inspiration');
  const params = useSearchParams();

  const initialType = params.get('type');
  const [type, setType] = useState<FurnitureType | null>(
    FURNITURE_TYPES.includes(initialType as FurnitureType)
      ? (initialType as FurnitureType)
      : null,
  );
  const [query, setQuery] = useState('');

  const pins = useMemo(() => {
    const q = norm(query.trim());
    return INSPIRATION_PINS.filter((pin) => {
      if (type && pin.type !== type) return false;
      if (!q) return true;
      const haystack = norm(`${t(`pins.${pin.id}`)} ${t(`types.${pin.type}`)}`);
      return haystack.includes(q);
    });
  }, [query, type, t]);

  return (
    <PublicShell>
      <div className="flex flex-col gap-7">
        <div className="text-center">
          <h1 className="page-title">{t('title')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* cautare + filtre pe tip */}
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-11 rounded-full bg-card pl-9"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setType(null)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                type === null
                  ? 'border-walnut bg-walnut text-primary-foreground'
                  : 'border-border-2 bg-card text-muted-foreground hover:border-muted-2 hover:text-foreground',
              )}
            >
              {t('all')}
            </button>
            {FURNITURE_TYPES.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setType(type === ft ? null : ft)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  type === ft
                    ? 'border-walnut bg-walnut text-primary-foreground'
                    : 'border-border-2 bg-card text-muted-foreground hover:border-muted-2 hover:text-foreground',
                )}
              >
                {t(`types.${ft}`)}
              </button>
            ))}
          </div>
        </div>

        {pins.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">{t('empty')}</p>
        )}

        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {pins.map((pin, i) => (
            <a
              key={pin.id}
              href={pinterestUrl(pin.type)}
              target="_blank"
              rel="noreferrer noopener"
              title={t('openPinterest')}
              className="group relative mb-4 block break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface-2 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.img}
                alt={t(`pins.${pin.id}`)}
                loading="lazy"
                className={cn(
                  'w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
                  PIN_ASPECTS[i % PIN_ASPECTS.length],
                )}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 text-[13px] leading-snug text-white">
                {t(`pins.${pin.id}`)}
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/70">
                  {t(`types.${pin.type}`)}
                </span>
              </span>
              {/* indicator extern la hover */}
              <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
