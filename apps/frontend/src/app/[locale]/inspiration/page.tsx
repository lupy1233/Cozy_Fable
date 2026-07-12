'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FolderHeart, Loader2, Search } from 'lucide-react';
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
import { useMe } from '@/hooks/use-auth';
import { useInfiniteInspiration } from '@/hooks/use-inspiration';
import { useSavedRefs } from '@/hooks/use-inspiration-boards';
import { Link, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';
import { InspirationLightbox } from './_components/inspiration-lightbox';
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
  // lightbox: indexul pin-ului deschis in lista vizibila (navigare ←/→)
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // infinite scroll (idee 6 PO r2): pagini de 40, incarcate la sentinel/buton
  const photos = useInfiniteInspiration({
    roomType: type ?? undefined,
    colors,
    materials,
    systems,
  });

  const visible = useMemo(() => {
    const q = norm(query.trim());
    const list = (photos.data?.pages ?? []).flat();
    if (!q) return list;
    return list.filter((p) => norm(`${p.title} ${p.company.name}`).includes(q));
  }, [photos.data, query]);

  // sentinel: cand intra in viewport, incarca pagina urmatoare
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = photos;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
              onOpen={() => setOpenIndex(i)}
            />
          ))}
        </div>

        {/* sentinel de infinite scroll + buton fallback (idee 6 PO r2) */}
        {hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 rounded-full border border-border-2 bg-card px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-walnut hover:text-walnut disabled:opacity-60"
            >
              {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('loadMore')}
            </button>
          </div>
        )}

        {/* lightbox Pinterest (idee 3 PO r2): salvare + navigare + similare */}
        {openIndex !== null && (
          <InspirationLightbox
            photos={visible}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
            onNavigate={setOpenIndex}
            savedByPhoto={savedByPhoto}
            authed={authed}
            onRequireAuth={requireAuth}
          />
        )}
      </div>
    </PublicShell>
  );
}
