'use client';

import {
  defaultPieceConfig,
  PIECE3D_KINDS,
  type Piece3dKind,
  type PieceConfig3d,
  type RoomType,
} from '@marketplace/shared';
import {
  AppWindow,
  Archive,
  ArrowLeftRight,
  BookOpen,
  Copy,
  DoorClosed,
  DoorOpen,
  Footprints,
  Lamp,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  RectangleHorizontal,
  RotateCw,
  Send,
  Shirt,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { Configurator3dStep } from '@/components/configurator/piece3d/dynamic';
import { finishSpecFor } from '@/components/configurator/piece3d/finishes';
import { useConfiguratorStore } from '@/stores/configurator-store';
import {
  STUDIO_MAX_SCENES,
  STUDIO_OPENING_KINDS,
  STUDIO_ROOM_LIMITS,
  useActiveScene,
  useStudioStore,
  type StudioOpeningKind,
  type StudioPiece,
} from '@/stores/studio-store';
import { cn } from '@/lib/utils';
import { FLOOR_COLORS, WALL_COLORS } from './palette';

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

const KIND_ICONS: Record<Piece3dKind, ComponentType<{ className?: string }>> = {
  BOOKCASE: BookOpen,
  WARDROBE: Shirt,
  TV_UNIT: Tv,
  SHOE_CABINET: Footprints,
  DRESSER: Archive,
  NIGHTSTAND: Lamp,
  DESK: Monitor,
};

const OPENING_ICONS: Record<StudioOpeningKind, ComponentType<{ className?: string }>> = {
  DOOR: DoorOpen,
  DOOR_DOUBLE: DoorClosed,
  WINDOW: AppWindow,
  WINDOW_WIDE: RectangleHorizontal,
};

const cm = (v: number) => Math.round(v * 100);

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PIECE3D_KINDS.map((kind) => {
                  const Icon = KIND_ICONS[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() =>
                        onChange({ kind, config: defaultPieceConfig(kind), name: t(`kinds.${kind}`) })
                      }
                      className="flex flex-col items-center gap-2 rounded-xl border border-border-2 bg-surface-2/60 px-3 py-4 transition-colors hover:border-walnut/50 hover:bg-walnut-soft/50"
                    >
                      <Icon className="h-6 w-6 text-walnut" />
                      <span className="text-sm font-medium">{t(`kinds.${kind}`)}</span>
                    </button>
                  );
                })}
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
}: {
  piece: StudioPiece;
  onPlace: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('Studio');
  const Icon = KIND_ICONS[piece.kind];
  const spec = finishSpecFor(piece.config.finish, piece.config.customColor);
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-border-2 bg-surface px-3 py-2.5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: `${spec.body}33` }}
      >
        <Icon className="h-5 w-5 text-walnut" />
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

// Dimensiune de camera cu precizie de 1cm: slider + camp numeric in cm
// (draftul local evita clamp-ul agresiv la fiecare tasta, ca in configurator).
function RoomDimControl({
  label,
  valueM,
  min,
  max,
  onValueM,
}: {
  label: string;
  valueM: number;
  min: number;
  max: number;
  onValueM: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(v) && v > 0) onValueM(v / 100);
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
  const rotatePlacement = useStudioStore((s) => s.rotatePlacement);
  const duplicatePlacement = useStudioStore((s) => s.duplicatePlacement);
  const removePlacement = useStudioStore((s) => s.removePlacement);
  const clearPlacements = useStudioStore((s) => s.clearPlacements);
  const addOpening = useStudioStore((s) => s.addOpening);
  const cycleOpeningWall = useStudioStore((s) => s.cycleOpeningWall);
  const removeOpening = useStudioStore((s) => s.removeOpening);
  const addScene = useStudioStore((s) => s.addScene);
  const renameScene = useStudioStore((s) => s.renameScene);
  const deleteScene = useStudioStore((s) => s.deleteScene);
  const setActiveScene = useStudioStore((s) => s.setActiveScene);
  const setRoom = useStudioStore((s) => s.setRoom);
  const setSelected = useStudioStore((s) => s.setSelected);
  const setSelectedOpening = useStudioStore((s) => s.setSelectedOpening);

  const [editor, setEditor] = useState<EditorState | null>(null);

  const pieceList = Object.values(pieces).sort((a, b) => b.updatedAt - a.updatedAt);
  const selected = scene.placements.find((p) => p.id === selectedId) ?? null;
  const selectedPiece = selected ? (pieces[selected.pieceId] ?? null) : null;
  const selectedOpening = scene.openings.find((o) => o.id === selectedOpeningId) ?? null;

  // scurtaturi de joc: R = rotire piesa / mutare gol pe alt perete,
  // Delete = scoate, Escape = deselectare
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const s = useStudioStore.getState();
      if (s.selectedId) {
        if (e.key === 'r' || e.key === 'R') rotatePlacement(s.selectedId);
        else if (e.key === 'Delete' || e.key === 'Backspace') removePlacement(s.selectedId);
        else if (e.key === 'Escape') setSelected(null);
      } else if (s.selectedOpeningId) {
        if (e.key === 'r' || e.key === 'R') cycleOpeningWall(s.selectedOpeningId);
        else if (e.key === 'Delete' || e.key === 'Backspace') removeOpening(s.selectedOpeningId);
        else if (e.key === 'Escape') setSelectedOpening(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, rotatePlacement, removePlacement, cycleOpeningWall, removeOpening, setSelected, setSelectedOpening]);

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

  const onDeletePiece = (piece: StudioPiece) => {
    if (window.confirm(t('confirmDeletePiece', { name: piece.name }))) deletePiece(piece.id);
  };

  const onAddScene = () => addScene(t('sceneDefaultName', { n: scenes.length + 1 }));
  const onRenameScene = () => {
    const name = window.prompt(t('renameScenePrompt'), scene.name);
    if (name && name.trim()) renameScene(scene.id, name);
  };
  const onDeleteScene = () => {
    if (window.confirm(t('confirmDeleteScene', { name: scene.name }))) deleteScene(scene.id);
  };
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
    for (const placement of scene.placements) {
      const piece = pieces[placement.pieceId];
      if (!piece) continue;
      cfg.addRoomWithAnswers(KIND_TO_ROOM[piece.kind], { config3d: piece.config });
      count++;
    }
    useConfiguratorStore.getState().setPhase('cart');
    toast.success(t('toastSent', { count }));
    router.push('/requests/new');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-serif text-3xl leading-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
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

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* biblioteca de piese */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-border-2 bg-surface-2/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('library')}
            </h2>
            <Button size="sm" variant="outline" onClick={openNewPiece}>
              <Plus className="h-4 w-4" />
              {t('newPiece')}
            </Button>
          </div>
          {pieceList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-2 p-3 text-xs leading-relaxed text-muted-foreground">
              {t('libraryEmpty')}
            </p>
          ) : (
            <ul className="flex max-h-[430px] flex-col gap-2 overflow-y-auto pr-0.5">
              {pieceList.map((piece) => (
                <LibraryRow
                  key={piece.id}
                  piece={piece}
                  onPlace={() => placePiece(piece.id)}
                  onEdit={() => openEditPiece(piece)}
                  onDelete={() => onDeletePiece(piece)}
                />
              ))}
            </ul>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{t('sendHint')}</p>
        </aside>

        {/* camerele + scena 3D */}
        <div className="flex flex-col gap-3">
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
                    onClick={onRenameScene}
                    className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-white/20"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
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
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-2 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-walnut/60 hover:text-walnut"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('newScene')}
              </button>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border-2">
            <RoomCanvas className="h-[380px] w-full sm:h-[520px]" />

            {/* bara piesei selectate */}
            {selected && selectedPiece && (
              <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-2 bg-surface/95 px-2 py-1 shadow-md backdrop-blur">
                <span className="max-w-[140px] truncate px-1.5 text-xs font-medium">
                  {selectedPiece.name}
                </span>
                <button
                  type="button"
                  title={`${t('rotate')} (R)`}
                  aria-label={t('rotate')}
                  onClick={() => rotatePlacement(selected.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-walnut transition-colors hover:bg-walnut-soft"
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
            )}

            {/* bara golului selectat (usa/fereastra) */}
            {!selected && selectedOpening && (
              <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-2 bg-surface/95 px-2 py-1 shadow-md backdrop-blur">
                <span className="max-w-[160px] truncate px-1.5 text-xs font-medium">
                  {t(`openings.${selectedOpening.kind}`)}
                </span>
                <button
                  type="button"
                  title={`${t('cycleWall')} (R)`}
                  aria-label={t('cycleWall')}
                  onClick={() => cycleOpeningWall(selectedOpening.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-walnut transition-colors hover:bg-walnut-soft"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('removeOpening')}
                  aria-label={t('removeOpening')}
                  onClick={() => removeOpening(selectedOpening.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {scene.placements.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <span className="rounded-full bg-surface/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                  {t('emptyRoomHint')}
                </span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
              <span className="rounded-full bg-surface/85 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                {t('canvasHint')}
              </span>
            </div>
          </div>

          {/* controalele camerei */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border-2 bg-surface-2/50 px-4 py-3">
            <RoomDimControl
              label={t('width')}
              valueM={scene.room.widthM}
              min={STUDIO_ROOM_LIMITS.width.min}
              max={STUDIO_ROOM_LIMITS.width.max}
              onValueM={(v) => setRoom({ widthM: v })}
            />
            <RoomDimControl
              label={t('depth')}
              valueM={scene.room.depthM}
              min={STUDIO_ROOM_LIMITS.depth.min}
              max={STUDIO_ROOM_LIMITS.depth.max}
              onValueM={(v) => setRoom({ depthM: v })}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('openingsLabel')}</span>
              <div className="flex items-center gap-1">
                {STUDIO_OPENING_KINDS.map((kind) => {
                  const Icon = OPENING_ICONS[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      title={t(`openings.${kind}`)}
                      aria-label={t(`openings.${kind}`)}
                      onClick={() => onAddOpening(kind)}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-surface text-muted-foreground transition-colors hover:border-walnut/50 hover:text-walnut"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
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
                    onClick={() => setRoom({ wallColor: s.id })}
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
                    onClick={() => setRoom({ floorColor: s.id })}
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
    </div>
  );
}
