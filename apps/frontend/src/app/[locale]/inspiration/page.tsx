'use client';

import { Suspense, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  INSPIRATION_COLORS,
  type InspirationColor,
  type ItemSystem,
  type Material,
  type RoomType,
} from '@marketplace/shared';
import { Input } from '@/components/ui/input';
import { useInspiration } from '@/hooks/use-inspiration';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';

// Galeria de inspiratie (F6, item 3): mobilier REAL facut de atelierele
// partenere, din DB (admin o alimenteaza). Filtre: tip camera, culoare,
// material, sistem de deschidere; fiecare poza isi arata atelierul.

const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

// tipurile afisate ca filtre (subsetul cu continut probabil in galerie)
const TYPE_FILTERS: RoomType[] = [
  'KITCHEN',
  'LIVING',
  'BEDROOM',
  'DRESSING',
  'OFFICE',
  'BATHROOM',
  'HALLWAY',
];

// linkurile vechi de pe landing folosesc ?type=kitchen (minuscule) — le mapam
const LEGACY_TYPE: Record<string, RoomType> = {
  kitchen: 'KITCHEN',
  living: 'LIVING',
  bedroom: 'BEDROOM',
  dressing: 'DRESSING',
  office: 'OFFICE',
};

const MATERIAL_FILTERS: Material[] = ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV'];
const SYSTEM_FILTERS: ItemSystem[] = ['MANER', 'PUSH', 'GOLA', 'AVENTOS', 'GLISANTE'];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function InspirationPage() {
  return (
    <Suspense fallback={null}>
      <InspirationGallery />
    </Suspense>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        active
          ? 'border-walnut bg-walnut text-primary-foreground'
          : 'border-border-2 bg-card text-muted-foreground hover:border-muted-2 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function InspirationGallery() {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const params = useSearchParams();

  const raw = params.get('type') ?? '';
  const initialType = (LEGACY_TYPE[raw] ?? (TYPE_FILTERS.includes(raw as RoomType) ? raw : null)) as
    | RoomType
    | null;
  const [type, setType] = useState<RoomType | null>(initialType);
  const [colors, setColors] = useState<InspirationColor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [systems, setSystems] = useState<ItemSystem[]>([]);
  const [query, setQuery] = useState('');

  const photos = useInspiration({
    roomType: type ?? undefined,
    colors,
    materials,
    systems,
  });

  const visible = useMemo(() => {
    const q = norm(query.trim());
    const list = photos.data ?? [];
    if (!q) return list;
    return list.filter((p) => norm(`${p.title} ${p.company.name}`).includes(q));
  }, [photos.data, query]);

  return (
    <PublicShell>
      <div className="flex flex-col gap-7">
        <div className="text-center">
          <h1 className="page-title">{t('title')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-11 rounded-full bg-card pl-9"
            />
          </div>

          {/* tip camera */}
          <div className="flex flex-wrap justify-center gap-2">
            <FilterPill active={type === null} onClick={() => setType(null)}>
              {t('all')}
            </FilterPill>
            {TYPE_FILTERS.map((rt) => (
              <FilterPill key={rt} active={type === rt} onClick={() => setType(type === rt ? null : rt)}>
                {tc(`rooms.type.${rt}`)}
              </FilterPill>
            ))}
          </div>

          {/* culoare / material / deschidere (F6: filtre noi, multi-select) */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="label">{t('filters.color')}</span>
            {INSPIRATION_COLORS.map((c) => (
              <FilterPill key={c} active={colors.includes(c)} onClick={() => setColors(toggle(colors, c))}>
                {t(`colors.${c}`)}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="label">{t('filters.material')}</span>
            {MATERIAL_FILTERS.map((m) => (
              <FilterPill
                key={m}
                active={materials.includes(m)}
                onClick={() => setMaterials(toggle(materials, m))}
              >
                {tc(`common.materials.${m}.label`)}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="label">{t('filters.opening')}</span>
            {SYSTEM_FILTERS.map((s) => (
              <FilterPill
                key={s}
                active={systems.includes(s)}
                onClick={() => setSystems(toggle(systems, s))}
              >
                {tc(`common.systems.${s}.label`)}
              </FilterPill>
            ))}
          </div>
        </div>

        {photos.isPending && <p className="py-16 text-center text-muted-foreground">…</p>}
        {!photos.isPending && visible.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">{t('empty')}</p>
        )}

        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {visible.map((photo, i) => (
            <figure
              key={photo.id}
              className="group relative mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface-2 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.imageUrl ?? ''}
                alt={photo.title}
                loading="lazy"
                className={cn(
                  'w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
                  PIN_ASPECTS[i % PIN_ASPECTS.length],
                )}
              />
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-[13px] leading-snug text-white">
                {photo.title}
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/75">
                  {tc(`rooms.type.${photo.roomType}`)} · {t('byFirm', { name: photo.company.name })}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
