'use client';

import { Suspense, useMemo, useState } from 'react';
import { FolderHeart, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  INSPIRATION_COLORS,
  type InspirationColor,
  type InspirationPhotoDto,
  type ItemSystem,
  type Material,
  type RoomType,
} from '@marketplace/shared';
import { Input } from '@/components/ui/input';
import { useMe } from '@/hooks/use-auth';
import { useInspiration } from '@/hooks/use-inspiration';
import { useSavedRefs } from '@/hooks/use-inspiration-boards';
import { Link, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';
import { InspirationPin } from './_components/inspiration-pin';

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
  const router = useRouter();
  const me = useMe();
  const savedRefs = useSavedRefs();

  const raw = params.get('type') ?? '';
  const initialType = (LEGACY_TYPE[raw] ?? (TYPE_FILTERS.includes(raw as RoomType) ? raw : null)) as
    | RoomType
    | null;
  const [type, setType] = useState<RoomType | null>(initialType);
  const [colors, setColors] = useState<InspirationColor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [systems, setSystems] = useState<ItemSystem[]>([]);
  const [query, setQuery] = useState('');
  // lightbox: pin-ul deschis pe mare (click pe imagine, ca pe Pinterest)
  const [openPhoto, setOpenPhoto] = useState<InspirationPhotoDto | null>(null);

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

  // photoId → boardId (starea "Salvat" per pin)
  const savedByPhoto = useMemo(
    () => new Map((savedRefs.data ?? []).map((s) => [s.photoId, s.boardId])),
    [savedRefs.data],
  );
  const authed = !!me.data;
  const requireAuth = () => router.push('/login?redirect=/inspiration');

  return (
    <PublicShell>
      <div className="flex flex-col gap-7">
        <div className="relative text-center">
          <h1 className="page-title">{t('title')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t('subtitle')}</p>
          {/* colectiile mele — vizibil oricui; neautentificat → login */}
          <Link
            href={authed ? '/inspiration/boards' : '/login?redirect=/inspiration/boards'}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-2 bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-walnut hover:text-walnut sm:absolute sm:right-0 sm:top-1 sm:mt-0"
          >
            <FolderHeart className="h-4 w-4" />
            {t('myBoards')}
          </Link>
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
            <InspirationPin
              key={photo.id}
              photo={photo}
              aspectClass={PIN_ASPECTS[i % PIN_ASPECTS.length]}
              savedBoardId={savedByPhoto.get(photo.id) ?? null}
              authed={authed}
              onRequireAuth={requireAuth}
              onOpen={() => setOpenPhoto(photo)}
            />
          ))}
        </div>

        {/* lightbox simplu: imaginea pe mare + meta (click oriunde inchide) */}
        {openPhoto && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setOpenPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-xl"
            >
              <button
                type="button"
                onClick={() => setOpenPhoto(null)}
                aria-label={t('close')}
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={openPhoto.imageUrl ?? ''}
                alt={openPhoto.title}
                className="max-h-[70vh] w-full object-contain bg-black/5"
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-serif text-lg leading-tight">{openPhoto.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tc(`rooms.type.${openPhoto.roomType}`)} ·{' '}
                    {t('byFirm', { name: openPhoto.company.name })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
