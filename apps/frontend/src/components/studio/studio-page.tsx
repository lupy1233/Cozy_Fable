'use client';

import {
  defaultPieceConfig,
  PIECE3D_KINDS,
  type Piece3dKind,
  type PieceConfig3d,
  type RoomType,
} from '@marketplace/shared';
import {
  Archive,
  BookOpen,
  Copy,
  Footprints,
  Lamp,
  Loader2,
  Monitor,
  Pencil,
  Plus,
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
import { useStudioStore, type StudioPiece } from '@/stores/studio-store';
import { cn } from '@/lib/utils';
import { FLOOR_COLORS, WALL_COLORS } from './palette';

// Studio 3D — "modul Sims" al platformei: joc de amenajare SEPARAT de
// formular. Biblioteca de piese (create cu acelasi configurator 3D ca in
// wizard) + camera in care piesele se aseaza liber. Butonul "Adauga in cerere"
// varsa corpurile din camera in configurator (cate o camera-piesa cu config3d
// precompletat) si duce utilizatorul in wizard sa termine cererea.

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

export function StudioPage() {
  const t = useTranslations('Studio');
  const router = useRouter();

  const pieces = useStudioStore((s) => s.pieces);
  const placements = useStudioStore((s) => s.placements);
  const room = useStudioStore((s) => s.room);
  const selectedId = useStudioStore((s) => s.selectedId);
  const savePiece = useStudioStore((s) => s.savePiece);
  const deletePiece = useStudioStore((s) => s.deletePiece);
  const placePiece = useStudioStore((s) => s.placePiece);
  const rotatePlacement = useStudioStore((s) => s.rotatePlacement);
  const duplicatePlacement = useStudioStore((s) => s.duplicatePlacement);
  const removePlacement = useStudioStore((s) => s.removePlacement);
  const clearPlacements = useStudioStore((s) => s.clearPlacements);
  const setRoom = useStudioStore((s) => s.setRoom);
  const setSelected = useStudioStore((s) => s.setSelected);

  const [editor, setEditor] = useState<EditorState | null>(null);

  const pieceList = Object.values(pieces).sort((a, b) => b.updatedAt - a.updatedAt);
  const selected = placements.find((p) => p.id === selectedId) ?? null;
  const selectedPiece = selected ? (pieces[selected.pieceId] ?? null) : null;

  // scurtaturi de joc: R = rotire, Delete = scoate piesa, Escape = deselectare
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
      const id = useStudioStore.getState().selectedId;
      if (!id) return;
      if (e.key === 'r' || e.key === 'R') rotatePlacement(id);
      else if (e.key === 'Delete' || e.key === 'Backspace') removePlacement(id);
      else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, rotatePlacement, removePlacement, setSelected]);

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

  const sendToRequest = () => {
    if (placements.length === 0) {
      toast.error(t('toastEmpty'));
      return;
    }
    const cfg = useConfiguratorStore.getState();
    if (cfg.startMode == null) cfg.setStartMode('STANDARD');
    let count = 0;
    for (const placement of placements) {
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
          {placements.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">
              {placements.length}
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

        {/* camera 3D */}
        <div className="flex flex-col gap-3">
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

            {placements.length === 0 && (
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('width')}</span>
              <input
                type="range"
                min={2}
                max={8}
                step={0.1}
                value={room.widthM}
                onChange={(e) => setRoom({ widthM: Number(e.target.value) })}
                className="w-28 accent-[hsl(var(--walnut))]"
              />
              <span className="w-12 text-xs tabular-nums text-muted-foreground">
                {room.widthM.toFixed(1)} m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('depth')}</span>
              <input
                type="range"
                min={2}
                max={8}
                step={0.1}
                value={room.depthM}
                onChange={(e) => setRoom({ depthM: Number(e.target.value) })}
                className="w-28 accent-[hsl(var(--walnut))]"
              />
              <span className="w-12 text-xs tabular-nums text-muted-foreground">
                {room.depthM.toFixed(1)} m
              </span>
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
                      room.wallColor === s.id
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
                      room.floorColor === s.id
                        ? 'scale-110 border-walnut ring-2 ring-walnut/30'
                        : 'border-border-2 hover:scale-105',
                    )}
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>
            </div>
            {placements.length > 0 && (
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
