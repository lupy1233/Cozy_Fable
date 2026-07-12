'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FolderHeart, Loader2, Search, X } from 'lucide-react';
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

// esantioanele filtrului de culoare — paleta se CITESTE, nu se descifreaza
const COLOR_SWATCH: Record<InspirationColor, string> = {
  WHITE: '#f6f3ec',
  BLACK: '#26221d',
  GRAY: '#9a968e',
  BEIGE: '#dbc9ab',
  BROWN: '#7a5638',
  NATURAL_WOOD: '#c49a66',
  GREEN: '#7d9276',
  BLUE: '#66809c',
  RED: '#a84e3f',
  YELLOW: '#d9a53b',
  MULTICOLOR:
    'conic-gradient(#a84e3f 0 25%, #d9a53b 25% 50%, #7d9276 50% 75%, #66809c 75% 100%)',
};

function Swatch({ color, className }: { color: InspirationColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/10', className)}
      style={{ background: COLOR_SWATCH[color] }}
    />
  );
}

// Chip-declansator + panou multi-select (consola de filtre a caietului de idei):
// eticheta smallcaps, numarul selectiilor si un preview al alegerii pe chip.
function FilterGroup({
  label,
  count,
  preview,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  count: number;
  preview?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
          count > 0 || open
            ? 'border-walnut/50 bg-walnut-soft/60 text-foreground'
            : 'border-border-2 bg-surface text-muted-foreground hover:border-muted-2 hover:text-foreground',
        )}
      >
        <span className="font-semibold uppercase tracking-[0.1em]">{label}</span>
        {preview}
        {count > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-walnut px-1 text-[10px] font-semibold text-primary-foreground">
            {count}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label={label}
            onClick={onClose}
            className="fixed inset-0 z-10 cursor-default"
            tabIndex={-1}
          />
          <div className="absolute left-0 z-20 mt-2 w-max max-w-[min(21rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-surface p-2.5 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

// optiune de panou: bifa + eticheta (+ esantion la culori)
function PanelOption({
  active,
  onClick,
  swatch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  swatch?: InspirationColor;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
        active ? 'bg-walnut-soft/70 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      {swatch && <Swatch color={swatch} />}
      <span className="flex-1">{children}</span>
      <Check className={cn('h-3.5 w-3.5 text-walnut', active ? 'opacity-100' : 'opacity-0')} />
    </button>
  );
}

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
  // panoul de filtre deschis din consola (unul singur odata)
  const [openGroup, setOpenGroup] = useState<'color' | 'material' | 'system' | null>(null);
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

        {/* consola de filtre: cautare + camere + panouri compacte (culoare cu
            esantioane, material, deschidere) — inlocuieste cele 4 randuri de
            pill-uri centrate */}
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 rounded-full bg-surface pl-9"
            />
          </div>

          {/* tip camera — filtrul principal, un singur rand (scroll pe mobil) */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:justify-center sm:overflow-visible">
            <FilterPill active={type === null} onClick={() => setType(null)}>
              {t('all')}
            </FilterPill>
            {TYPE_FILTERS.map((rt) => (
              <FilterPill key={rt} active={type === rt} onClick={() => setType(type === rt ? null : rt)}>
                {tc(`rooms.type.${rt}`)}
              </FilterPill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <FilterGroup
              label={t('filters.color')}
              count={colors.length}
              open={openGroup === 'color'}
              onToggle={() => setOpenGroup(openGroup === 'color' ? null : 'color')}
              onClose={() => setOpenGroup(null)}
              preview={
                colors.length > 0 && (
                  <span className="flex items-center -space-x-1">
                    {colors.slice(0, 3).map((c) => (
                      <Swatch key={c} color={c} className="ring-1 ring-surface" />
                    ))}
                  </span>
                )
              }
            >
              <div className="grid grid-cols-2 gap-0.5">
                {INSPIRATION_COLORS.map((c) => (
                  <PanelOption
                    key={c}
                    active={colors.includes(c)}
                    onClick={() => setColors(toggle(colors, c))}
                    swatch={c}
                  >
                    {t(`colors.${c}`)}
                  </PanelOption>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup
              label={t('filters.material')}
              count={materials.length}
              open={openGroup === 'material'}
              onToggle={() => setOpenGroup(openGroup === 'material' ? null : 'material')}
              onClose={() => setOpenGroup(null)}
            >
              <div className="flex w-56 flex-col gap-0.5">
                {MATERIAL_FILTERS.map((m) => (
                  <PanelOption
                    key={m}
                    active={materials.includes(m)}
                    onClick={() => setMaterials(toggle(materials, m))}
                  >
                    {tc(`common.materials.${m}.label`)}
                  </PanelOption>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup
              label={t('filters.opening')}
              count={systems.length}
              open={openGroup === 'system'}
              onToggle={() => setOpenGroup(openGroup === 'system' ? null : 'system')}
              onClose={() => setOpenGroup(null)}
            >
              <div className="flex w-56 flex-col gap-0.5">
                {SYSTEM_FILTERS.map((s) => (
                  <PanelOption
                    key={s}
                    active={systems.includes(s)}
                    onClick={() => setSystems(toggle(systems, s))}
                  >
                    {tc(`common.systems.${s}.label`)}
                  </PanelOption>
                ))}
              </div>
            </FilterGroup>

            <span className="ml-auto text-xs text-muted-foreground">
              {t('shownCount', { count: visible.length })}
            </span>
            {(type !== null || colors.length > 0 || materials.length > 0 || systems.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setType(null);
                  setColors([]);
                  setMaterials([]);
                  setSystems([]);
                  setOpenGroup(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-crimson underline-offset-2 hover:underline"
              >
                <X className="h-3 w-3" />
                {t('clearFilters')}
              </button>
            )}
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
