'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bookmark, Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
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
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import { INSPIRATION_ROOM_TYPES } from '@/components/configurator/inspiration-room-types';
import { MasonryColumns } from '@/components/ui/masonry-columns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSessionRole } from '@/hooks/use-auth';
import { useInfiniteInspiration } from '@/hooks/use-inspiration';
import { useBoards, useSavedRefs } from '@/hooks/use-inspiration-boards';
import { Link, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';
import { InspirationLightbox } from './_components/inspiration-lightbox';
import { InspirationPin } from './_components/inspiration-pin';

// Galeria de inspiratie (F6, item 3): mobilier REAL facut de firmele
// partenere, din DB (admin o alimenteaza). Filtre: tip camera, culoare,
// material, sistem de deschidere; fiecare poza isi arata firma.

const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;
// raporturile h/w ale acelorasi aspecte — echilibrarea coloanelor masonry
const PIN_RATIOS = [4 / 3, 1, 5 / 4] as const;
// textul de sub imagine (titlu + camera/firma), ca fractiune din latimea cartonasului
const PIN_CAPTION_RATIO = 0.3;
// cartonasul "Pasul urmator" (fara imagine) — inaltime relativa estimata
const CTA_RATIO = 1;
// locul cartonasului "Pasul urmator" in galerie: dupa a 11-a idee (cu mai putine
// idei, la sfarsit). Pozitie fixa → paginile noi din infinite scroll nu-l muta.
const CTA_AFTER = 11;

type GalleryTile = { kind: 'photo'; photo: InspirationPhotoDto; index: number } | { kind: 'cta' };

// tipurile afisate ca filtre (subsetul cu continut probabil in galerie)
const TYPE_FILTERS = INSPIRATION_ROOM_TYPES;

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

// Declansator + panou multi-select (consola de filtre a caietului de idei):
// eticheta cu majuscule spatiate, numarul selectiilor si un preview al alegerii.
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
    <Popover open={open} onOpenChange={(o) => (o ? onToggle() : onClose())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-meta uppercase tracking-[0.08em] transition-colors',
            count > 0 || open
              ? 'border-walnut bg-walnut-soft font-semibold text-walnut-deep'
              : 'border-border-2 bg-surface font-medium text-foreground hover:border-muted-2',
          )}
        >
          {label}
          {preview}
          {count > 0 && (
            <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-walnut px-1 font-mono text-meta tracking-normal text-primary-foreground">
              {count}
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" width="auto" className="max-w-[min(21rem,calc(100vw-2.5rem))] p-2.5">
        {children}
      </PopoverContent>
    </Popover>
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
        'flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ui transition-colors',
        active ? 'bg-walnut-soft/70 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      {swatch && <Swatch color={swatch} />}
      <span className="flex-1">{children}</span>
      <Check className={cn('h-3.5 w-3.5 text-walnut', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
    </button>
  );
}

// Cartonasul din galerie care duce spre cererea de oferte (design 2026-11):
// ideile salvate se ataseaza la cerere din configurator.
function RequestCtaCard() {
  const t = useTranslations('Inspiration');
  const tn = useTranslations('Nav');
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-brass bg-walnut-soft p-4 sm:p-6">
      <p className="kicker text-walnut-deep">{t('nextStep.kicker')}</p>
      <h2 className="font-serif text-xl leading-tight sm:text-2xl">{t('nextStep.title')}</h2>
      <p className="text-walnut-deep">{t('nextStep.body')}</p>
      <Button asChild variant="walnut" className="h-11 self-start px-5">
        <Link href="/requests/new">{tn('createRequest')}</Link>
      </Button>
    </article>
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

function InspirationGallery() {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const params = useSearchParams();
  const router = useRouter();
  const { role, user } = useSessionRole();
  const savedRefs = useSavedRefs();
  // numarul colectiilor de langa "Colectiile mele" (doar cu sesiune)
  const boards = useBoards();

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

  // photoId → colectiile in care e salvata (starea "Salvat" per pin; o poza poate fi in mai multe)
  const savedByPhoto = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of savedRefs.data ?? []) map.set(s.photoId, [...(map.get(s.photoId) ?? []), s.boardId]);
    return map;
  }, [savedRefs.data]);
  const authed = !!user;
  const requireAuth = () => router.push('/login?redirect=/inspiration');
  const boardCount = boards.data?.length ?? 0;

  // cererea de oferte e a clientului (sau a vizitatorului): firmele si adminul nu vad
  // cartonasul — aceeasi regula ca butonul "Cere oferte" din antet
  const showRequestCta = !role || role === 'CLIENT';
  const tiles = useMemo<GalleryTile[]>(() => {
    const list = visible.map<GalleryTile>((photo, index) => ({ kind: 'photo', photo, index }));
    if (showRequestCta && list.length > 0) list.splice(Math.min(CTA_AFTER, list.length), 0, { kind: 'cta' });
    return list;
  }, [visible, showRequestCta]);

  // filtrele din panouri, ca pastile care se pot scoate una cate una
  const activeFilters: { key: string; label: string; swatch?: InspirationColor; remove: () => void }[] = [
    ...colors.map((c) => ({
      key: `color-${c}`,
      label: t(`colors.${c}`),
      swatch: c,
      remove: () => setColors(colors.filter((x) => x !== c)),
    })),
    ...materials.map((m) => ({
      key: `material-${m}`,
      label: tc(`common.materials.${m}.label`),
      remove: () => setMaterials(materials.filter((x) => x !== m)),
    })),
    ...systems.map((s) => ({
      key: `system-${s}`,
      label: tc(`common.systems.${s}.label`),
      remove: () => setSystems(systems.filter((x) => x !== s)),
    })),
  ];
  const hasFilters = type !== null || activeFilters.length > 0;

  return (
    <PublicShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex flex-col gap-3">
            <h1 className="page-title">{t('title')}</h1>
            <p className="max-w-[620px] text-pretty text-lead text-muted-foreground">{t('subtitle')}</p>
          </div>
          {/* colectiile mele — vizibil oricui; neautentificat → login */}
          <Button asChild variant="outline" className="h-11 rounded-full px-[18px]">
            <Link href={authed ? '/inspiration/boards' : '/login?redirect=/inspiration/boards'}>
              <Bookmark className="text-walnut" aria-hidden />
              {t('myBoards')}
              {boardCount > 0 && <span className="data-mono text-muted-foreground">{boardCount}</span>}
            </Link>
          </Button>
        </div>

        {/* consola de filtre: cautare + camere + panouri compacte (culoare cu
            esantioane, material, deschidere) + pastilele filtrelor active */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('searchLabel')}
              placeholder={t('searchPlaceholder')}
              className="h-11 pl-11"
            />
          </div>

          {/* tip camera — filtrul principal, un singur rand (scroll pe mobil) */}
          <FilterChips<'ALL' | RoomType>
            label={t('roomFilterLabel')}
            allowDeselect
            className="-mx-1 flex-nowrap overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>button]:h-10 [&>button]:px-4"
            value={type ?? 'ALL'}
            onChange={(v) => setType(v === null || v === 'ALL' ? null : v)}
            options={[
              { value: 'ALL', label: t('all') },
              ...TYPE_FILTERS.map((rt) => ({ value: rt, label: tc(`rooms.type.${rt}`) })),
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
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

              {activeFilters.map((f) => (
                <span
                  key={f.key}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-3 pl-3.5 pr-1.5 text-ui text-foreground"
                >
                  {f.swatch && <Swatch color={f.swatch} />}
                  {f.label}
                  <button
                    type="button"
                    onClick={f.remove}
                    aria-label={t('removeFilter', { name: f.label })}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="data-mono text-muted-foreground">{t('shownCount', { count: visible.length })}</span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setType(null);
                    setColors([]);
                    setMaterials([]);
                    setSystems([]);
                    setOpenGroup(null);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 font-medium text-crimson underline-offset-2 hover:underline"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  {t('clearFilters')}
                </button>
              )}
            </div>
          </div>
        </div>

        {photos.isPending && (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {/* eroare de API ≠ "nicio idee" (audit 2026-08-19 P1): mesaj + reincercare */}
        {photos.isError && (
          <Alert
            tone="amber"
            icon={<AlertTriangle />}
            title={t('loadError')}
            className="mx-auto w-full max-w-xl items-center"
            action={
              <Button variant="outline" size="sm" onClick={() => photos.refetch()}>
                {t('retry')}
              </Button>
            }
          />
        )}
        {photos.isSuccess && visible.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">{t('empty')}</p>
        )}

        {/* masonry stabil: itemii raman pe coloana lor cand se incarca pagini
            noi din infinite scroll — fara layout shift (CSS columns re-aseza tot) */}
        <MasonryColumns
          items={tiles}
          columns={{ base: 2, sm: 3, lg: 4 }}
          estimateHeight={(tile) =>
            tile.kind === 'cta' ? CTA_RATIO : PIN_RATIOS[tile.index % PIN_RATIOS.length] + PIN_CAPTION_RATIO
          }
          renderItem={(tile) =>
            tile.kind === 'cta' ? (
              <RequestCtaCard key="request-cta" />
            ) : (
              <InspirationPin
                key={tile.photo.id}
                photo={tile.photo}
                aspectClass={PIN_ASPECTS[tile.index % PIN_ASPECTS.length]}
                savedBoardIds={savedByPhoto.get(tile.photo.id) ?? []}
                authed={authed}
                onRequireAuth={requireAuth}
                onOpen={() => setOpenIndex(tile.index)}
              />
            )
          }
        />

        {/* sentinel de infinite scroll + buton fallback (idee 6 PO r2) */}
        {hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-[22px]"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && <Loader2 className="animate-spin" />}
              {t('loadMore')}
            </Button>
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
