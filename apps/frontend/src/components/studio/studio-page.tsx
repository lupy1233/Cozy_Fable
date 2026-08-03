'use client';

import {
  defaultPieceConfig,
  PIECE3D_KINDS,
  type Piece3dKind,
  type PieceConfig3d,
  type RoomType,
} from '@marketplace/shared';
import {
  ArrowLeftRight,
  Copy,
  FolderOpen,
  GripVertical,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import {
  useDeleteStudioDraft,
  useLoadStudioDraft,
  useSaveStudioDraft,
  useStudioDrafts,
} from '@/hooks/use-studio-drafts';
import { Configurator3dStep } from '@/components/configurator/piece3d/dynamic';
import { useConfiguratorStore } from '@/stores/configurator-store';
import {
  OPENING_DIM_LIMITS,
  openingSize,
  placementHalfExtents,
  STUDIO_MAX_SCENES,
  STUDIO_OPENING_KINDS,
  STUDIO_ROOM_LIMITS,
  useActiveScene,
  useStudioStore,
  wallLength,
  type StudioDropPayload,
  type StudioOpening,
  type StudioOpeningKind,
  type StudioPiece,
  type StudioRoom,
} from '@/stores/studio-store';
import { cn } from '@/lib/utils';
import { FLOOR_COLORS, WALL_COLORS } from './palette';
import { OpeningPreview, PiecePreview } from './previews';
import { StudioTutorial, tutorialTargetFor, type TutorialPhase } from './tutorial';

// Studio 3D — "modul Sims" al platformei: joc de amenajare SEPARAT de
// formular. Biblioteca de piese (create cu acelasi configurator 3D ca in
// wizard) + camere multiple (scene) cu usi si ferestre, intre care te plimbi
// din taburi. Butonul "Adauga in cerere" varsa corpurile din camera curenta
// in configurator (cate o camera-piesa cu config3d precompletat).

const RoomCanvas = dynamic(() => import('./room-canvas'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-surface-2">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

// piesa-carcasa → tipul de camera din configurator (flow-urile v3 cu config3d)
const KIND_TO_ROOM: Record<Piece3dKind, RoomType> = {
  BOOKCASE: 'PIECE_BOOKCASE',
  WARDROBE: 'PIECE_WARDROBE',
  TV_UNIT: 'PIECE_TV_UNIT',
  SHOE_CABINET: 'PIECE_SHOE_CABINET',
  DRESSER: 'PIECE_DRESSER',
  NIGHTSTAND: 'PIECE_NIGHTSTAND',
  DESK: 'PIECE_DESK',
};

const cm = (v: number) => Math.round(v * 100);

// Incuietoare numarata pe scrollul paginii: fullscreen-ul si editorul de piesa
// o pot tine SIMULTAN, iar eliberarile in ORICE ordine (ex. browserul iese
// singur din fullscreen nativ cat timp editorul e inca deschis) nu lasa
// body-ul intepenit pe overflow:hidden, cum o faceau perechile save/restore.
let bodyScrollLocks = 0;
function lockBodyScroll(): () => void {
  if (++bodyScrollLocks === 1) document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--bodyScrollLocks === 0) document.body.style.overflow = '';
  };
}

interface EditorState {
  pieceId?: string;
  kind: Piece3dKind | null;
  name: string;
  config: PieceConfig3d | null;
}

function PieceEditorDialog({
  editor,
  onChange,
  onSave,
  onClose,
}: {
  editor: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('Studio');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => lockBodyScroll(), []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editor.pieceId ? t('editorEdit') : t('editorNew')}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="truncate font-serif text-lg leading-tight">
            {editor.pieceId ? t('editorEdit') : t('editorNew')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {editor.kind == null ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t('pickKind')}</p>
              {/* cartonasele variantelor: elevatia reala a configului implicit,
                  desenata din modelul parametric — nu iconite generice */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PIECE3D_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      onChange({ kind, config: defaultPieceConfig(kind), name: t(`kinds.${kind}`) })
                    }
                    className="flex flex-col items-center gap-2 rounded-xl border border-border-2 bg-surface-2/60 px-3 py-4 transition-colors hover:border-walnut/50 hover:bg-walnut-soft/50"
                  >
                    <PiecePreview
                      kind={kind}
                      config={defaultPieceConfig(kind)}
                      className="h-16 w-full"
                    />
                    <span className="text-sm font-medium">{t(`kinds.${kind}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="max-w-sm">
                <label className="mb-1 block text-sm font-medium" htmlFor="studio-piece-name">
                  {t('nameLabel')}
                </label>
                <Input
                  id="studio-piece-name"
                  value={editor.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  placeholder={t('namePlaceholder')}
                  maxLength={60}
                />
              </div>
              <Configurator3dStep
                piece={editor.kind}
                value={editor.config ?? undefined}
                onChange={(config) => onChange({ config })}
              />
            </div>
          )}
        </div>

        {editor.kind != null && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button variant="walnut" onClick={onSave}>
              {t('save')}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function LibraryRow({
  piece,
  onPlace,
  onEdit,
  onDelete,
  onGrab,
}: {
  piece: StudioPiece;
  onPlace: () => void;
  onEdit: () => void;
  onDelete: () => void;
  // ridicarea piesei de pe rand (drag & drop spre camera, feedback PO r4)
  onGrab: (e: React.PointerEvent) => void;
}) {
  const t = useTranslations('Studio');
  return (
    <li
      title={t('dragToPlace')}
      onPointerDown={onGrab}
      className="flex cursor-grab select-none items-center gap-2.5 rounded-xl border border-border-2 bg-surface px-3 py-2.5 transition-colors hover:border-walnut/40"
    >
      {/* plansa piesei: elevatia reala, in finisajul ei */}
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border-2/60 bg-surface-2/70 p-1">
        <PiecePreview kind={piece.kind} config={piece.config} className="h-full w-full" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{piece.name}</p>
        <p className="text-xs text-muted-foreground">
          {t(`kinds.${piece.kind}`)} · {cm(piece.config.widthM)}×{cm(piece.config.heightM)}×
          {cm(piece.config.depthM)} cm
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          title={t('place')}
          aria-label={t('place')}
          onClick={onPlace}
          className="grid h-8 w-8 place-items-center rounded-md text-walnut transition-colors hover:bg-walnut-soft"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('edit')}
          aria-label={t('edit')}
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('delete')}
          aria-label={t('delete')}
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

// Fereastra modala compacta a studioului — inlocuieste prompt()/confirm() de
// browser (feedback PO r2, itemul 5): aceeasi identitate ca restul dialogurilor.
function StudioModal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('Studio');
  return (
    <StudioModal label={title} onClose={onClose}>
      <h3 className="font-serif text-lg leading-tight">{title}</h3>
      {body && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </StudioModal>
  );
}

function NameDialog({
  title,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Studio');
  const [name, setName] = useState(initial);
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    onClose();
  };
  return (
    <StudioModal label={title} onClose={onClose}>
      <h3 className="font-serif text-lg leading-tight">{title}</h3>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        maxLength={60}
        className="mt-3"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button variant="walnut" size="sm" disabled={!name.trim()} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </StudioModal>
  );
}

// Camp numeric compact pentru o distanta in cm (feedback PO r5: cu dragul e
// greu sa nimeresti fix; aici scrii exact cati cm vrei pana la perete).
// Draftul local se comite pe blur/Enter; parintele re-cheieaza campul cand
// valoarea se schimba din alta parte (drag), ca sa ramana sincron.
function GapField({
  label,
  valueM,
  onCommit,
}: {
  label: string;
  valueM: number;
  onCommit: (m: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(v) && v >= 0) onCommit(v / 100);
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="w-12 truncate text-right">{label}</span>
      <input
        type="number"
        min={0}
        value={draft ?? String(cm(valueM))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        }}
        className="h-6 w-14 rounded-md border border-border-2 bg-surface px-1 text-right text-[11px] tabular-nums focus-visible:border-foreground focus-visible:outline-none"
      />
      <span>cm</span>
    </label>
  );
}

// Slider compact pentru o dimensiune a golului selectat (cm) — folosit in
// panoul plutitor; variantele ne-ajustabile (min == max) nu primesc slider.
function OpeningDimSlider({
  label,
  min,
  max,
  valueM,
  onValueM,
  onGestureStart,
}: {
  label: string;
  min: number;
  max: number;
  valueM: number;
  onValueM: (v: number) => void;
  onGestureStart?: () => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="w-14 truncate text-right">{label}</span>
      <input
        type="range"
        min={cm(min)}
        max={cm(max)}
        step={1}
        value={cm(valueM)}
        onPointerDown={onGestureStart}
        onChange={(e) => onValueM(Number(e.target.value) / 100)}
        className="w-24 accent-[hsl(var(--walnut))]"
      />
      <span className="w-12 tabular-nums">{cm(valueM)} cm</span>
    </label>
  );
}

// pozitia panoului ramane in cadru: minim 4px fata de fiecare margine
function clampPanelPos(
  container: HTMLElement,
  panel: HTMLElement | null,
  p: { x: number; y: number },
): { x: number; y: number } {
  if (!panel) return p;
  return {
    x: Math.min(Math.max(p.x, 4), Math.max(4, container.clientWidth - panel.offsetWidth - 4)),
    y: Math.min(Math.max(p.y, 4), Math.max(4, container.clientHeight - panel.offsetHeight - 4)),
  };
}

// Cochilia panourilor plutitoare din fereastra 3D (piesa/gol selectat).
// Feedback PO: panoul de sus poate acoperi exact ce vrei sa vezi — manerul
// din stanga il muta oriunde in canvas (dublu-click = inapoi sus-centrat),
// iar pozitia aleasa se pastreaza intre selectii si peste refresh (store).
function FloatingPanel({
  canvasRef,
  children,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const t = useTranslations('Studio');
  const pos = useStudioStore((s) => s.panelPos);
  const setPos = useStudioStore((s) => s.setPanelPos);
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  // panoul nu ramane in afara cadrului cand canvasul isi schimba marimea
  // (toggle fullscreen, resize fereastra) sau cand apare cu alta latime
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const reclamp = () => {
      const p = posRef.current;
      if (!p) return;
      // un container inca ne-asezat (0x0, ex. in timpul unui remount) ar
      // strivi pozitia in coltul {4,4} — nu re-clampam pe dimensiuni fantoma
      if (container.clientWidth < 50 || container.clientHeight < 50) return;
      const next = clampPanelPos(container, ref.current, p);
      if (next.x !== p.x || next.y !== p.y) setPos(next);
    };
    reclamp();
    const ro = new ResizeObserver(reclamp);
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasRef, setPos]);

  const onGripDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const panel = ref.current;
    const container = canvasRef.current;
    if (!panel || !container) return;
    const panelRect = panel.getBoundingClientRect();
    const grab = { dx: e.clientX - panelRect.left, dy: e.clientY - panelRect.top };
    // urmarim DOAR pointerul care a apucat manerul (pe touch, un al doilea
    // deget care roteste camera nu are voie sa smuceasca panoul)
    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const c = canvasRef.current;
      if (!c || !ref.current) return;
      const rect = c.getBoundingClientRect();
      setPos(
        clampPanelPos(c, ref.current, {
          x: ev.clientX - rect.left - grab.dx,
          y: ev.clientY - rect.top - grab.dy,
        }),
      );
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={ref}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={cn(
        'absolute flex items-stretch rounded-xl border border-border-2 bg-surface/95 py-2 pl-1 pr-3 shadow-md backdrop-blur',
        !pos && 'left-1/2 top-3 -translate-x-1/2',
      )}
    >
      <button
        type="button"
        title={t('movePanel')}
        aria-label={t('movePanel')}
        onPointerDown={onGripDown}
        onDoubleClick={() => setPos(null)}
        className="flex cursor-grab touch-none select-none items-center rounded-lg px-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-col gap-1.5 pl-1">{children}</div>
    </div>
  );
}

// Panoul golului selectat: nume + mutare/stergere + dimensiunile ajustabile
// ale variantei (usa: latime/inaltime; fereastra: + parapet; priza: doar cota).
function OpeningToolbar({
  opening,
  room,
  onCycle,
  onRemove,
  onResize,
  onMove,
  onGestureStart,
}: {
  opening: StudioOpening;
  room: StudioRoom;
  onCycle: () => void;
  onRemove: () => void;
  onResize: (patch: { w?: number; h?: number; sill?: number }) => void;
  onMove: (offset: number) => void;
  onGestureStart: () => void;
}) {
  const t = useTranslations('Studio');
  const lim = OPENING_DIM_LIMITS[opening.kind];
  const size = openingSize(opening);
  const adjustable = (r: { min: number; max: number }) => r.max - r.min > 0.001;
  // pozitia pe perete, privind peretele DIN interior: stanga = capatul cu
  // localul negativ (aceeasi conventie pe toti peretii)
  const L = wallLength(room, opening.wall);
  const sign = opening.wall === 'N' || opening.wall === 'E' ? 1 : -1;
  const cx = sign * opening.offset;
  const gapLeft = cx - size.w / 2 + L / 2;
  const gapRight = L / 2 - (cx + size.w / 2);
  const moveToLocal = (cxNew: number) => {
    onGestureStart();
    onMove(cxNew * sign);
  };
  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <span className="max-w-[160px] truncate px-1 text-xs font-medium">
          {t(`openings.${opening.kind}`)}
        </span>
        <button
          type="button"
          title={`${t('cycleWall')} (R)`}
          aria-label={t('cycleWall')}
          onClick={onCycle}
          className="grid h-7 w-7 place-items-center rounded-full text-walnut transition-colors hover:bg-walnut-soft"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t('removeOpening')}
          aria-label={t('removeOpening')}
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* distantele pana la capetele peretelui — editabile exact, la cm */}
      <div
        key={`${opening.id}:${opening.offset}`}
        className="flex items-center justify-center gap-3"
      >
        <GapField
          label={t('gapLeft')}
          valueM={gapLeft}
          onCommit={(g) => moveToLocal(-L / 2 + g + size.w / 2)}
        />
        <GapField
          label={t('gapRight')}
          valueM={gapRight}
          onCommit={(g) => moveToLocal(L / 2 - g - size.w / 2)}
        />
      </div>
      {(adjustable(lim.w) || adjustable(lim.h) || adjustable(lim.sill)) && (
        <div className="flex flex-col gap-1">
          {adjustable(lim.w) && (
            <OpeningDimSlider
              label={t('openingWidth')}
              min={lim.w.min}
              max={lim.w.max}
              valueM={size.w}
              onValueM={(w) => onResize({ w })}
              onGestureStart={onGestureStart}
            />
          )}
          {adjustable(lim.h) && (
            <OpeningDimSlider
              label={t('openingHeight')}
              min={lim.h.min}
              max={lim.h.max}
              valueM={size.h}
              onValueM={(h) => onResize({ h })}
              onGestureStart={onGestureStart}
            />
          )}
          {adjustable(lim.sill) && (
            <OpeningDimSlider
              label={opening.kind === 'OUTLET' ? t('outletHeight') : t('openingSill')}
              min={lim.sill.min}
              max={lim.sill.max}
              valueM={size.sill}
              onValueM={(sill) => onResize({ sill })}
              onGestureStart={onGestureStart}
            />
          )}
        </div>
      )}
    </>
  );
}

// Dimensiune de camera cu precizie de 1cm: slider + camp numeric in cm
// (draftul local evita clamp-ul agresiv la fiecare tasta, ca in configurator).
function RoomDimControl({
  label,
  valueM,
  min,
  max,
  onValueM,
  onGestureStart,
}: {
  label: string;
  valueM: number;
  min: number;
  max: number;
  onValueM: (v: number) => void;
  onGestureStart?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(v) && v > 0) {
      onGestureStart?.();
      onValueM(v / 100);
    }
    setDraft(null);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="range"
        min={cm(min)}
        max={cm(max)}
        step={1}
        value={cm(valueM)}
        onPointerDown={onGestureStart}
        onChange={(e) => onValueM(Number(e.target.value) / 100)}
        className="w-24 accent-[hsl(var(--walnut))]"
      />
      <input
        type="number"
        min={cm(min)}
        max={cm(max)}
        value={draft ?? String(cm(valueM))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        }}
        className="h-7 w-16 rounded-md border border-border-2 bg-surface px-1.5 text-right text-xs tabular-nums focus-visible:border-foreground focus-visible:outline-none"
      />
      <span className="text-[11px] text-muted-foreground">cm</span>
    </div>
  );
}

// Drafturile din cont: salvare (nou / actualizare) + lista cu incarcare si
// stergere, intr-un singur dialog. Snapshotul pleaca din studio-store si se
// intoarce prin loadSnapshot; serverul valideaza continutul cu schema shared.
function StudioDraftsDialog({
  loadedDraft,
  onLoaded,
  onClose,
}: {
  loadedDraft: { id: string; name: string } | null;
  onLoaded: (draft: { id: string; name: string } | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Studio');
  const me = useMe();
  const drafts = useStudioDrafts();
  const save = useSaveStudioDraft();
  const load = useLoadStudioDraft();
  const removeDraft = useDeleteStudioDraft();
  const [name, setName] = useState(loadedDraft?.name ?? '');
  const [confirmDraft, setConfirmDraft] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveErrorToast = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'STUDIO_DRAFT_NAME_TAKEN') toast.error(t('nameTaken'));
    else if (e instanceof ApiError && e.code === 'STUDIO_DRAFT_LIMIT_REACHED')
      toast.error(t('draftLimit'));
    else toast.error(t('draftError'));
  };

  const onSave = (id?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save.mutate(
      { id, name: trimmed, data: useStudioStore.getState().snapshot() },
      {
        onSuccess: (dto) => {
          onLoaded({ id: dto.id, name: dto.name });
          toast.success(t('draftSaved'));
        },
        onError: saveErrorToast,
      },
    );
  };

  const onLoad = (id: string) => {
    load.mutate(id, {
      onSuccess: (dto) => {
        useStudioStore.getState().loadSnapshot(dto.data);
        onLoaded({ id: dto.id, name: dto.name });
        toast.success(t('draftLoaded'));
        onClose();
      },
      onError: () => toast.error(t('draftError')),
    });
  };

  const onDelete = (draft: { id: string; name: string }) => {
    removeDraft.mutate(draft.id, {
      onSuccess: () => {
        if (loadedDraft?.id === draft.id) onLoaded(null);
        toast.success(t('draftDeleted'));
      },
      onError: () => toast.error(t('draftError')),
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('myDrafts')}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="font-serif text-lg leading-tight">{t('myDrafts')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!me.data ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t('loginToSave')}</p>
            <Button asChild variant="walnut" size="sm">
              <Link href="/login">{t('goToLogin')}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
            {/* salvarea studioului curent */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="studio-draft-name">
                {t('draftNameLabel')}
              </label>
              <Input
                id="studio-draft-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('draftNamePlaceholder')}
                maxLength={80}
              />
              <div className="flex flex-wrap gap-2">
                {loadedDraft && (
                  <Button
                    size="sm"
                    variant="walnut"
                    disabled={save.isPending || !name.trim()}
                    onClick={() => onSave(loadedDraft.id)}
                  >
                    <Save className="h-4 w-4" />
                    {t('updateDraft', { name: loadedDraft.name })}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={loadedDraft ? 'outline' : 'walnut'}
                  disabled={save.isPending || !name.trim()}
                  onClick={() => onSave()}
                >
                  <Save className="h-4 w-4" />
                  {t('saveAsNew')}
                </Button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* drafturile existente */}
            {drafts.isLoading ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !drafts.data || drafts.data.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-2 p-3 text-xs leading-relaxed text-muted-foreground">
                {t('emptyDrafts')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {drafts.data.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex items-center gap-2 rounded-xl border border-border-2 bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{draft.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(draft.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={load.isPending}
                      onClick={() => onLoad(draft.id)}
                    >
                      {t('loadDraft')}
                    </Button>
                    <button
                      type="button"
                      title={t('deleteDraft')}
                      aria-label={t('deleteDraft')}
                      onClick={() => setConfirmDraft({ id: draft.id, name: draft.name })}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{t('loadWarning')}</p>
          </div>
        )}
      </div>

      {confirmDraft && (
        <ConfirmDialog
          title={t('deleteDraft')}
          body={t('confirmDeleteDraft', { name: confirmDraft.name })}
          confirmLabel={t('delete')}
          onConfirm={() => onDelete(confirmDraft)}
          onClose={() => setConfirmDraft(null)}
        />
      )}
    </div>,
    document.body,
  );
}

export function StudioPage() {
  const t = useTranslations('Studio');
  const router = useRouter();

  const pieces = useStudioStore((s) => s.pieces);
  const scenes = useStudioStore((s) => s.scenes);
  const scene = useActiveScene();
  const selectedId = useStudioStore((s) => s.selectedId);
  const selectedOpeningId = useStudioStore((s) => s.selectedOpeningId);
  const savePiece = useStudioStore((s) => s.savePiece);
  const deletePiece = useStudioStore((s) => s.deletePiece);
  const placePiece = useStudioStore((s) => s.placePiece);
  const movePlacement = useStudioStore((s) => s.movePlacement);
  const moveOpening = useStudioStore((s) => s.moveOpening);
  const rotatePlacement = useStudioStore((s) => s.rotatePlacement);
  const duplicatePlacement = useStudioStore((s) => s.duplicatePlacement);
  const removePlacement = useStudioStore((s) => s.removePlacement);
  const clearPlacements = useStudioStore((s) => s.clearPlacements);
  const addOpening = useStudioStore((s) => s.addOpening);
  const cycleOpeningWall = useStudioStore((s) => s.cycleOpeningWall);
  const resizeOpening = useStudioStore((s) => s.resizeOpening);
  const removeOpening = useStudioStore((s) => s.removeOpening);
  const addScene = useStudioStore((s) => s.addScene);
  const renameScene = useStudioStore((s) => s.renameScene);
  const deleteScene = useStudioStore((s) => s.deleteScene);
  const duplicateScene = useStudioStore((s) => s.duplicateScene);
  const setActiveScene = useStudioStore((s) => s.setActiveScene);
  const setRoom = useStudioStore((s) => s.setRoom);
  const setSelected = useStudioStore((s) => s.setSelected);
  const setSelectedOpening = useStudioStore((s) => s.setSelectedOpening);
  const recordHistory = useStudioStore((s) => s.recordHistory);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const canUndo = useStudioStore((s) => s.history.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  // draftul din cont incarcat/salvat ultima data — persistat in store (r2)
  const loadedDraft = useStudioStore((s) => s.accountDraft);
  const setLoadedDraft = useStudioStore((s) => s.setAccountDraft);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body?: string;
    onConfirm: () => void;
  } | null>(null);

  // turul de invatare cu misiuni: la prima vizita se deschide invitatia;
  // dupa aceea (parcurs sau refuzat) se reia doar din butonul "?"
  const [tutorial, setTutorial] = useState<TutorialPhase>(null);
  useEffect(() => {
    if (!useStudioStore.getState().tutorialSeen) setTutorial('welcome');
  }, []);
  const tutTarget = tutorialTargetFor(tutorial);
  const tutorialModalOpen = tutorial === 'welcome' || tutorial === 'finale';

  // Ecran complet (feedback PO: prea multe panouri pentru spatiul din pagina):
  // studioul devine un overlay fixed peste tot viewportul (sub dialoguri, care
  // stau la z-50+), iar unde browserul permite cerem si fullscreen nativ —
  // daca refuza (ex. iframe), ramane overlay-ul, tot un castig de spatiu.
  const [fullscreen, setFullscreen] = useState(false);
  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  const toggleFullscreen = fullscreen ? exitFullscreen : enterFullscreen;

  // oglinzi pentru listenerul de fullscreenchange (montat o singura data):
  // starea overlay-ului + "e ceva deschis" (selectie/dialog) + momentul unui
  // Esc cheltuit pe altceva decat iesirea din fullscreen
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  const fsGuardRef = useRef({ escAt: 0, busy: false });
  fsGuardRef.current.busy = !!(
    editor ||
    draftsOpen ||
    renameOpen ||
    confirmState ||
    tutorialModalOpen ||
    selectedId ||
    selectedOpeningId
  );

  // Browserul iese SINGUR din fullscreen nativ la Esc (necancelabil). Ca sa
  // pastram ordinea "Esc inchide intai selectia/dialogul", la o iesire nativa
  // provocata de un asemenea Esc (sau cu ceva inca deschis — Firefox/Safari
  // inghit keydown-ul) retrogradam la modul overlay in loc sa inchidem tot;
  // abia urmatorul Esc inchide overlay-ul. Sensul invers: daca intrarea
  // nativa aterizeaza dupa ce utilizatorul s-a razgandit (toggle rapid in
  // timpul tranzitiei), reconciliem iesind imediat din nativ.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) {
        if (!fullscreenRef.current) document.exitFullscreen().catch(() => {});
        return;
      }
      const g = fsGuardRef.current;
      if (fullscreenRef.current && (g.busy || Date.now() - g.escAt < 500)) return;
      setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // la parasirea paginii (ex. "Adauga in cerere") nu lasam browserul in
  // fullscreen nativ fara studioul care l-a cerut
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    [],
  );

  // overlay-ul acopera pagina — nu lasam fundalul sa se plimbe sub el
  useEffect(() => {
    if (!fullscreen) return;
    return lockBodyScroll();
  }, [fullscreen]);
  // cadrul ferestrei 3D — reperul fata de care se muta panoul plutitor
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  // sagetile misca selectia cu 1cm; o rafala de apasari = O intrare de undo
  const nudgeAtRef = useRef(0);
  // toastul de "nu incape" e limitat — sliderele trag continuu de resize
  const blockedAtRef = useRef(0);
  const blockedToast = () => {
    if (Date.now() - blockedAtRef.current < 1600) return;
    blockedAtRef.current = Date.now();
    toast.error(t('resizeBlocked'));
  };

  // drag & drop din paleta (feedback PO r4): ridici o piesa sau un gol si il
  // lasi in camera; ghost-ul = un cartonas-plansa prins cu ac de alama, in
  // limbajul planselor de pe landing. Payload-ul sta in store, drop-ul il
  // face canvas-ul (are camera); pagina deseneaza doar ghost-ul.
  const [ghost, setGhost] = useState<{
    x: number;
    y: number;
    label: string;
    payload: StudioDropPayload;
  } | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    label: string;
    payload: StudioDropPayload;
    active: boolean;
  } | null>(null);

  const beginPaletteDrag = (e: React.PointerEvent, payload: StudioDropPayload, label: string) => {
    if (e.button !== 0) return;
    // butoanele de actiune ale randului raman butoane, nu manere de drag
    if ((e.target as HTMLElement).closest('button') && payload.type === 'piece') return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, payload, label, active: false };
  };

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const d = dragStartRef.current;
      if (!d) return;
      if (!d.active) {
        // pragul de 6px desparte click-ul obisnuit de ridicare
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6) return;
        d.active = true;
        useStudioStore.getState().setDropPayload(d.payload);
        document.body.style.cursor = 'grabbing';
      }
      setGhost({ x: ev.clientX, y: ev.clientY, label: d.label, payload: d.payload });
    };
    const onUp = () => {
      const d = dragStartRef.current;
      dragStartRef.current = null;
      if (d?.active) {
        document.body.style.cursor = '';
        setGhost(null);
        // payload-ul e consumat (sau curatat) de canvas la acelasi pointerup
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const pieceList = Object.values(pieces).sort((a, b) => b.updatedAt - a.updatedAt);
  const selected = scene.placements.find((p) => p.id === selectedId) ?? null;
  const selectedPiece = selected ? (pieces[selected.pieceId] ?? null) : null;
  const selectedOpening = scene.openings.find((o) => o.id === selectedOpeningId) ?? null;

  // scurtaturi de joc: R = rotire piesa / mutare gol pe alt perete,
  // Delete = scoate, Escape = deselectare
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      // Esc "cheltuit" pe altceva (editor, dialog, selectie, camp focusat) e
      // memorat: iesirea din fullscreen nativ provocata de acelasi Esc nu
      // trebuie sa inchida si overlay-ul (vezi listenerul de fullscreenchange)
      if (e.key === 'Escape' && (inField || fsGuardRef.current.busy)) {
        fsGuardRef.current.escAt = Date.now();
      }
      // dialogurile turului isi asculta singure Esc-ul; restul scurtaturilor
      // (Delete/R/sageti) n-au voie sa actioneze in scena din spatele lor
      if (tutorialModalOpen) return;
      if (editor) return;
      if (inField) return;
      const s = useStudioStore.getState();
      // undo/redo global (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        s.redo();
        return;
      }
      // F = ecran complet on/off (scurtatura de joc, in familia lui R);
      // nu din dialoguri si nu pe auto-repeat (tinuta apasata, ar stroboscopa)
      if (
        (e.key === 'f' || e.key === 'F') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.repeat &&
        !draftsOpen &&
        !renameOpen &&
        !confirmState
      ) {
        toggleFullscreen();
        return;
      }
      // sagetile = mutare fina la 1cm (Shift = 5cm) — precizia pe care dragul
      // nu o poate garanta (feedback PO r5); rafala = o intrare de undo
      const arrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      const nudge = () => {
        if (Date.now() - nudgeAtRef.current > 800) s.recordHistory();
        nudgeAtRef.current = Date.now();
      };
      const step = e.shiftKey ? 0.05 : 0.01;
      const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
      if (s.selectedId) {
        if (e.key === 'r' || e.key === 'R') rotatePlacement(s.selectedId);
        else if (e.key === 'Delete' || e.key === 'Backspace') removePlacement(s.selectedId);
        else if (e.key === 'Escape') setSelected(null);
        else if (arrow) {
          const p = active?.placements.find((pl) => pl.id === s.selectedId);
          if (!p) return;
          e.preventDefault();
          nudge();
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          movePlacement(p.id, p.x + dx, p.z + dz);
        }
      } else if (s.selectedOpeningId) {
        if (e.key === 'r' || e.key === 'R') cycleOpeningWall(s.selectedOpeningId);
        else if (e.key === 'Delete' || e.key === 'Backspace') removeOpening(s.selectedOpeningId);
        else if (e.key === 'Escape') setSelectedOpening(null);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const o = active?.openings.find((op) => op.id === s.selectedOpeningId);
          if (!o) return;
          e.preventDefault();
          nudge();
          // stanga/dreapta privind peretele din interior (local -x = stanga)
          const sign = o.wall === 'N' || o.wall === 'E' ? 1 : -1;
          const delta = (e.key === 'ArrowLeft' ? -1 : 1) * step * sign;
          moveOpening(o.id, o.offset + delta);
        }
      } else if (
        e.key === 'Escape' &&
        fullscreen &&
        !draftsOpen &&
        !renameOpen &&
        !confirmState
      ) {
        // Esc inchide intai selectia/dialogul; abia fara ele iese din fullscreen
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, fullscreen, draftsOpen, renameOpen, confirmState, tutorialModalOpen, toggleFullscreen, exitFullscreen, rotatePlacement, removePlacement, cycleOpeningWall, removeOpening, setSelected, setSelectedOpening, movePlacement, moveOpening]);

  const openNewPiece = () => setEditor({ kind: null, name: '', config: null });
  const openEditPiece = (piece: StudioPiece) =>
    setEditor({ pieceId: piece.id, kind: piece.kind, name: piece.name, config: piece.config });

  const saveEditor = () => {
    if (!editor || editor.kind == null) return;
    const saved = savePiece({
      id: editor.pieceId,
      name: editor.name,
      kind: editor.kind,
      config: editor.config ?? defaultPieceConfig(editor.kind),
    });
    // piesa noua intra direct in camera — sa se vada imediat rezultatul
    if (!editor.pieceId) placePiece(saved.id);
    setEditor(null);
  };

  const onDeletePiece = (piece: StudioPiece) =>
    setConfirmState({
      title: t('delete'),
      body: t('confirmDeletePiece', { name: piece.name }),
      onConfirm: () => deletePiece(piece.id),
    });

  const onAddScene = () => addScene(t('sceneDefaultName', { n: scenes.length + 1 }));
  const onDuplicateScene = () => duplicateScene(scene.id, t('sceneCopyName', { name: scene.name }));
  const onDeleteScene = () =>
    setConfirmState({
      title: t('deleteScene'),
      body: t('confirmDeleteScene', { name: scene.name }),
      onConfirm: () => deleteScene(scene.id),
    });
  const onAddOpening = (kind: StudioOpeningKind) => {
    if (!addOpening(kind)) toast.error(t('noSpaceForOpening'));
  };

  const sendToRequest = () => {
    if (scene.placements.length === 0) {
      toast.error(t('toastEmpty'));
      return;
    }
    const cfg = useConfiguratorStore.getState();
    if (cfg.startMode == null) cfg.setStartMode('STANDARD');
    let count = 0;
    const scenePieces: Record<string, StudioPiece> = {};
    for (const placement of scene.placements) {
      const piece = pieces[placement.pieceId];
      if (!piece) continue;
      cfg.addRoomWithAnswers(KIND_TO_ROOM[piece.kind], { config3d: piece.config });
      scenePieces[piece.id] = piece;
      count++;
    }
    // camera insasi calatoreste cu cererea (feedback PO r3): firmele o vad
    // read-only in detaliu, cu click pe piesa → viewerul de dimensiuni
    cfg.attachStudioScene({ scene, pieces: scenePieces });
    useConfiguratorStore.getState().setPhase('cart');
    toast.success(t('toastSent', { count }));
    router.push('/requests/new');
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        // overlay-ul fullscreen: peste header/footer (z-30), sub dialoguri
        // (z-50+); sub lg pastreaza curgerea normala si se deruleaza
        fullscreen && 'fixed inset-0 z-40 gap-3 overflow-y-auto bg-background p-3 sm:p-4',
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className={cn('font-serif leading-tight', fullscreen ? 'text-xl' : 'text-3xl')}>
            {t('title')}
          </h1>
          {!fullscreen && <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setDraftsOpen(true)}>
            <FolderOpen className="h-4 w-4" />
            {t('myDrafts')}
            {loadedDraft && (
              <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                · {loadedDraft.name}
              </span>
            )}
          </Button>
          <Button variant="walnut" onClick={sendToRequest}>
            <Send className="h-4 w-4" />
            {t('sendToRequest')}
            {scene.placements.length > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">
                {scene.placements.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]',
          // pe desktop grila umple restul ecranului, iar coloanele se intind
          fullscreen && 'lg:min-h-0 lg:flex-1 lg:items-stretch',
        )}
      >
        {/* biblioteca de piese */}
        <aside
          className={cn(
            'flex flex-col gap-3 rounded-2xl border border-border-2 bg-surface-2/50 p-3',
            fullscreen && 'lg:min-h-0',
          )}
        >
          {/* jurnalul de misiuni al turului — andocat deasupra bibliotecii */}
          <StudioTutorial phase={tutorial} onPhase={setTutorial} canvasRef={canvasWrapRef} />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('library')}
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={openNewPiece}
              className={cn(tutTarget === 'newPiece' && 'tut-pulse')}
            >
              <Plus className="h-4 w-4" />
              {t('newPiece')}
            </Button>
          </div>
          {pieceList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-2 p-3 text-xs leading-relaxed text-muted-foreground">
              {t('libraryEmpty')}
            </p>
          ) : (
            <ul
              className={cn(
                'flex max-h-[430px] flex-col gap-2 overflow-y-auto pr-0.5',
                // in fullscreen lista foloseste toata inaltimea coloanei
                fullscreen && 'lg:min-h-0 lg:max-h-none lg:flex-1',
              )}
            >
              {pieceList.map((piece) => (
                <LibraryRow
                  key={piece.id}
                  piece={piece}
                  onPlace={() => placePiece(piece.id)}
                  onEdit={() => openEditPiece(piece)}
                  onDelete={() => onDeletePiece(piece)}
                  onGrab={(e) =>
                    beginPaletteDrag(e, { type: 'piece', pieceId: piece.id }, piece.name)
                  }
                />
              ))}
            </ul>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{t('sendHint')}</p>
        </aside>

        {/* camerele + scena 3D */}
        <div className={cn('flex flex-col gap-3', fullscreen && 'lg:min-h-0')}>
          {/* taburile camerelor: te plimbi intre scenele apartamentului */}
          <div className="flex flex-wrap items-center gap-1.5">
            {scenes.map((sc) =>
              sc.id === scene.id ? (
                <span
                  key={sc.id}
                  className="inline-flex items-center gap-1 rounded-full bg-walnut px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm"
                >
                  {sc.name}
                  <button
                    type="button"
                    title={t('renameScene')}
                    aria-label={t('renameScene')}
                    onClick={() => setRenameOpen(true)}
                    className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-white/20"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {scenes.length < STUDIO_MAX_SCENES && (
                    <button
                      type="button"
                      title={t('duplicateScene')}
                      aria-label={t('duplicateScene')}
                      onClick={onDuplicateScene}
                      className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-white/20"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                  {scenes.length > 1 && (
                    <button
                      type="button"
                      title={t('deleteScene')}
                      aria-label={t('deleteScene')}
                      onClick={onDeleteScene}
                      className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-white/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ) : (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setActiveScene(sc.id)}
                  className="rounded-full border border-border-2 bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-walnut/50 hover:text-foreground"
                >
                  {sc.name}
                </button>
              ),
            )}
            {scenes.length < STUDIO_MAX_SCENES && (
              <button
                type="button"
                onClick={onAddScene}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-dashed border-border-2 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-walnut/60 hover:text-walnut',
                  tutTarget === 'newScene' && 'tut-pulse',
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('newScene')}
              </button>
            )}
            {/* undo/redo — o intrare per actiune/gest, Ctrl+Z / Ctrl+Shift+Z */}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                title={`${t('undo')} (Ctrl+Z)`}
                aria-label={t('undo')}
                disabled={!canUndo}
                onClick={undo}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40',
                  // nu pulsam un buton stins — cardul misiunii explica intai
                  tutTarget === 'undo' && canUndo && 'tut-pulse',
                )}
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={`${t('redo')} (Ctrl+Shift+Z)`}
                aria-label={t('redo')}
                disabled={!canRedo}
                onClick={redo}
                className="grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <Redo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={`${t(fullscreen ? 'exitFullscreen' : 'fullscreen')} (F)`}
                aria-label={t(fullscreen ? 'exitFullscreen' : 'fullscreen')}
                onClick={toggleFullscreen}
                className="grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                title={t('tutorial.replay')}
                aria-label={t('tutorial.replay')}
                onClick={() => setTutorial('welcome')}
                className="grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={canvasWrapRef}
            className={cn(
              'relative overflow-hidden rounded-2xl border border-border-2',
              // canvasul preia tot spatiul ramas; sub o limita rezonabila
              // lasam pagina sa se deruleze in loc sa strivim scena
              fullscreen && 'lg:min-h-[320px] lg:flex-1',
              tutTarget === 'orbit' && 'tut-pulse',
            )}
          >
            <RoomCanvas
              className={cn('h-[380px] w-full sm:h-[520px]', fullscreen && 'lg:h-full')}
            />

            {/* panoul piesei selectate: actiuni + distantele pana la pereti,
                editabile la cm (feedback PO r5 — dragul nu nimereste fix) */}
            {selected && selectedPiece && (
              <FloatingPanel canvasRef={canvasWrapRef}>
              <div className="flex items-center justify-center gap-1">
                <span className="max-w-[140px] truncate px-1.5 text-xs font-medium">
                  {selectedPiece.name}
                </span>
                <button
                  type="button"
                  title={t('edit')}
                  aria-label={t('edit')}
                  onClick={() => openEditPiece(selectedPiece)}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={`${t('rotate')} (R)`}
                  aria-label={t('rotate')}
                  onClick={() => rotatePlacement(selected.id)}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-walnut transition-colors hover:bg-walnut-soft',
                    tutTarget === 'rotate' && 'tut-pulse',
                  )}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('duplicate')}
                  aria-label={t('duplicate')}
                  onClick={() => duplicatePlacement(selected.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('remove')}
                  aria-label={t('remove')}
                  onClick={() => removePlacement(selected.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {(() => {
                const { hx, hz } = placementHalfExtents(selectedPiece.config, selected.rotation);
                const roomW = scene.room.widthM;
                const roomD = scene.room.depthM;
                const moveTo = (x: number, z: number) => {
                  recordHistory();
                  movePlacement(selected.id, x, z);
                };
                return (
                  <div
                    key={`${selected.id}:${selected.x}:${selected.z}:${selected.rotation}`}
                    className="grid grid-cols-2 gap-x-3 gap-y-1"
                  >
                    <GapField
                      label={t('gapLeft')}
                      valueM={selected.x - hx + roomW / 2}
                      onCommit={(g) => moveTo(-roomW / 2 + g + hx, selected.z)}
                    />
                    <GapField
                      label={t('gapRight')}
                      valueM={roomW / 2 - (selected.x + hx)}
                      onCommit={(g) => moveTo(roomW / 2 - g - hx, selected.z)}
                    />
                    <GapField
                      label={t('gapBack')}
                      valueM={selected.z - hz + roomD / 2}
                      onCommit={(g) => moveTo(selected.x, -roomD / 2 + g + hz)}
                    />
                    <GapField
                      label={t('gapFront')}
                      valueM={roomD / 2 - (selected.z + hz)}
                      onCommit={(g) => moveTo(selected.x, roomD / 2 - g - hz)}
                    />
                  </div>
                );
              })()}
              </FloatingPanel>
            )}

            {/* panoul golului selectat (usa/fereastra/priza) cu dimensiuni */}
            {!selected && selectedOpening && (
              <FloatingPanel canvasRef={canvasWrapRef}>
                <OpeningToolbar
                  opening={selectedOpening}
                  room={scene.room}
                  onCycle={() => cycleOpeningWall(selectedOpening.id)}
                  onRemove={() => removeOpening(selectedOpening.id)}
                  onResize={(patch) => {
                    if (!resizeOpening(selectedOpening.id, patch)) blockedToast();
                  }}
                  onMove={(offset) => moveOpening(selectedOpening.id, offset)}
                  onGestureStart={recordHistory}
                />
              </FloatingPanel>
            )}

            {/* indiciul de camera goala dispare la PRIMUL lucru asezat —
                inclusiv usi/ferestre/prize — si cat timp tragi ceva din paleta */}
            {scene.placements.length === 0 && scene.openings.length === 0 && !ghost && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <span className="rounded-full bg-surface/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                  {t('emptyRoomHint')}
                </span>
              </div>
            )}

          </div>

          {/* controalele camerei */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border-2 bg-surface-2/50 px-4 py-3',
              tutTarget === 'room' && 'tut-pulse',
            )}
          >
            <RoomDimControl
              label={t('width')}
              valueM={scene.room.widthM}
              min={STUDIO_ROOM_LIMITS.width.min}
              max={STUDIO_ROOM_LIMITS.width.max}
              onValueM={(v) => setRoom({ widthM: v })}
              onGestureStart={recordHistory}
            />
            <RoomDimControl
              label={t('depth')}
              valueM={scene.room.depthM}
              min={STUDIO_ROOM_LIMITS.depth.min}
              max={STUDIO_ROOM_LIMITS.depth.max}
              onValueM={(v) => setRoom({ depthM: v })}
              onGestureStart={recordHistory}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('openingsLabel')}</span>
              <div
                className={cn(
                  'flex items-center gap-1',
                  tutTarget === 'openings' && 'tut-pulse rounded-lg',
                )}
              >
                {/* elevatiile variantelor: click = asezare automata,
                    tragere = asezare exact pe peretele tinta */}
                {STUDIO_OPENING_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    title={t(`openings.${kind}`)}
                    aria-label={t(`openings.${kind}`)}
                    onPointerDown={(e) =>
                      beginPaletteDrag(e, { type: 'opening', kind }, t(`openings.${kind}`))
                    }
                    onClick={() => onAddOpening(kind)}
                    className="grid h-10 w-11 cursor-grab place-items-center rounded-md border border-border-2 bg-surface p-1 transition-colors hover:border-walnut/50"
                  >
                    <OpeningPreview kind={kind} className="h-full w-full" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('walls')}</span>
              <div className="flex items-center gap-1">
                {WALL_COLORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.id}
                    aria-label={`${t('walls')}: ${s.id}`}
                    onClick={() => {
                      recordHistory();
                      setRoom({ wallColor: s.id });
                    }}
                    className={cn(
                      'h-6 w-6 rounded-full border transition-transform',
                      scene.room.wallColor === s.id
                        ? 'scale-110 border-walnut ring-2 ring-walnut/30'
                        : 'border-border-2 hover:scale-105',
                    )}
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('floor')}</span>
              <div className="flex items-center gap-1">
                {FLOOR_COLORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.id}
                    aria-label={`${t('floor')}: ${s.id}`}
                    onClick={() => {
                      recordHistory();
                      setRoom({ floorColor: s.id });
                    }}
                    className={cn(
                      'h-6 w-6 rounded-full border transition-transform',
                      scene.room.floorColor === s.id
                        ? 'scale-110 border-walnut ring-2 ring-walnut/30'
                        : 'border-border-2 hover:scale-105',
                    )}
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>
            </div>
            {scene.placements.length > 0 && (
              <button
                type="button"
                onClick={clearPlacements}
                className="ml-auto text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
              >
                {t('clearRoom')}
              </button>
            )}
          </div>
        </div>
      </div>

      {editor && (
        <PieceEditorDialog
          editor={editor}
          onChange={(patch) => setEditor((prev) => (prev ? { ...prev, ...patch } : prev))}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}

      {draftsOpen && (
        <StudioDraftsDialog
          loadedDraft={loadedDraft}
          onLoaded={setLoadedDraft}
          onClose={() => setDraftsOpen(false)}
        />
      )}

      {renameOpen && (
        <NameDialog
          title={t('renameScene')}
          initial={scene.name}
          submitLabel={t('save')}
          onSubmit={(name) => renameScene(scene.id, name)}
          onClose={() => setRenameOpen(false)}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          body={confirmState.body}
          confirmLabel={t('delete')}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}

      {/* ghost-ul de drag: cartonas-plansa "ridicat" de pe masa, prins cu ac
          de alama (rombul de pe landing) — urmareste cursorul */}
      {ghost &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[70]"
            style={{ left: ghost.x + 14, top: ghost.y + 10 }}
          >
            <div className="relative flex -rotate-2 items-center gap-2 rounded-lg border border-border-2 bg-surface/95 py-1.5 pl-2 pr-3 shadow-lg backdrop-blur">
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#b08d57]" />
              {ghost.payload.type === 'piece' && pieces[ghost.payload.pieceId] ? (
                <PiecePreview
                  kind={pieces[ghost.payload.pieceId].kind}
                  config={pieces[ghost.payload.pieceId].config}
                  className="h-9 w-9"
                />
              ) : ghost.payload.type === 'opening' ? (
                <OpeningPreview kind={ghost.payload.kind} className="h-9 w-9" />
              ) : null}
              <span className="max-w-[130px] truncate text-xs font-medium">{ghost.label}</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
