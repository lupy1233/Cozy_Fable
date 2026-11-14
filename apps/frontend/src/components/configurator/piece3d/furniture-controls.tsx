'use client';

import {
  BED_MATTRESS_SIZES, BED_STORAGES, BENCH_STYLES, TABLE_TYPES, TABLE_SHAPES, TABLE_SEATS,
  TABLE_LENGTH_LIMITS, PIECE3D_FINISHES, initialPieceConfig, normalizePieceConfig,
  pieceConfig3dSchema, type Piece3dKind, type PieceConfig3d,
} from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { PieceCanvas, type SnapshotFn } from './piece-canvas';
import { config3dChipItems } from './config-chips';
import { CatalogControls } from './catalog-controls';
import { PieceDimensionControl } from './dimension-control';

interface Props {
  piece: Piece3dKind;
  value: unknown;
  onChange: (value: PieceConfig3d) => void;
  onSnapshot?: (value: string | null) => void;
}

// 41.4: dimensiunile mesei / bancutei folosesc componenta unica PieceDimensionControl
// (aceeasi eticheta, acelasi "cm", aceleasi mesaje de corectare ca dulapul)
export function FurnitureControls({ piece, value, onChange, onSnapshot }: Props) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  const parsed = useMemo(() => pieceConfig3dSchema(piece).safeParse(value), [piece, value]);
  const config = parsed.success ? parsed.data : null;
  const snapshot = useRef<SnapshotFn | null>(null);
  const [webgl] = useState(() => {
    try { const canvas = document.createElement('canvas'); return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl')); }
    catch { return false; }
  });
  const [mode, setMode] = useState<'3d' | 'fields'>(webgl ? '3d' : 'fields');
  useEffect(() => { if (value == null) onChange(initialPieceConfig(piece)); }, [piece, value, onChange]);
  useEffect(() => {
    if (!onSnapshot || !config || mode !== '3d') return;
    const timer = setTimeout(() => onSnapshot(snapshot.current?.() ?? null), 800);
    return () => clearTimeout(timer);
  }, [config, mode, onSnapshot]);
  if (!config) return value == null ? null : <p role="alert">{t('config3d.furniture.invalidSavedConfig')}</p>;
  const apply = (patch: Partial<PieceConfig3d>) => onChange(normalizePieceConfig(piece, { ...config, ...patch }));
  const choice = (label: string, current: string, options: readonly string[], labelFor: (v: string) => string, set: (v: string) => void) =>
    <label className="grid gap-1 text-sm font-medium">{label}<Select className="min-h-11" value={current} onChange={(e) => set(e.target.value)}>
      {options.map((v) => <option key={v} value={v}>{labelFor(v)}</option>)}
    </Select></label>;
  const toggle = (label: string, checked: boolean, set: (v: boolean) => void) =>
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border-2 px-3 text-sm">
      <input type="checkbox" className="h-5 w-5 accent-walnut" checked={checked} onChange={(e) => set(e.target.checked)} />{label}
    </label>;
  const bed = config.bed;
  const table = config.table;
  const bench = config.bench;
  return <div className="space-y-4">
    {webgl && <div className="flex gap-2">{(['3d', 'fields'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m}
      onClick={() => setMode(m)} className="min-h-11 rounded-full border border-border-2 px-4 text-sm aria-pressed:bg-walnut aria-pressed:text-white">
      {t(m === '3d' ? 'config3d.mode3d' : 'config3d.modeFields')}</button>)}</div>}
    <div className={mode === '3d' ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]' : ''}>
      {mode === '3d' && <PieceCanvas kind={piece} config={config} onSnapshotReady={(fn) => { snapshot.current = fn; }} className="h-[320px] overflow-hidden rounded-2xl border border-border-2 sm:h-[420px]" />}
      <div className="space-y-4">
        <CatalogControls kind={piece} config={config} apply={apply} />
        {bed && <>
          {choice(t('flows.PIECE_BED.bedSize.title'), bed.mattressSize, BED_MATTRESS_SIZES, (v) => t(`flows.PIECE_BED.bedSize.options.${v}.label`), (v) => apply({ bed: { ...bed, mattressSize: v as typeof bed.mattressSize } }))}
          {choice(t('flows.PIECE_BED.storage.title'), bed.storage, BED_STORAGES, (v) => t(`flows.PIECE_BED.storage.options.${v}.label`), (v) => apply({ bed: { ...bed, storage: v as typeof bed.storage } }))}
          {toggle(t('flows.PIECE_BED.upholstered.title'), bed.upholstered, (v) => apply({ bed: { ...bed, upholstered: v } }))}
          <p className="text-xs leading-relaxed text-muted-foreground">{t('config3d.furniture.beddingContext')}</p>
        </>}
        {table && <>
          {choice(t('flows.PIECE_TABLE.tableType.title'), table.type, TABLE_TYPES, (v) => t(`flows.PIECE_TABLE.tableType.options.${v}.label`), (v) => apply({ table: { ...table, type: v as typeof table.type } }))}
          {choice(t('flows.PIECE_TABLE.shape.title'), table.shape, TABLE_SHAPES.filter((v) => v !== 'EXTENDABLE' || table.type === 'DINING'), (v) => t(`flows.PIECE_TABLE.shape.options.${v}.label`), (v) => apply({ table: { ...table, shape: v as typeof table.shape } }))}
          {table.type === 'DINING' && choice(t('flows.PIECE_TABLE.seats.title'), table.seats ?? 'SIX', TABLE_SEATS, (v) => t(`flows.PIECE_TABLE.seats.options.${v}.label`), (v) => apply({ table: { ...table, seats: v as NonNullable<typeof table.seats> } }))}
          <PieceDimensionControl label={table.shape === 'ROUND' ? t('flows.PIECE_TABLE.dimensions.slots.diameter') : t('config3d.width')} valueM={config.widthM}
            minM={table.shape === 'ROUND' ? 0.7 : TABLE_LENGTH_LIMITS[table.type].min} maxM={table.shape === 'ROUND' ? 1.8 : TABLE_LENGTH_LIMITS[table.type].max} onValueM={(widthM) => apply({ widthM })} />
          {table.shape !== 'ROUND' && <PieceDimensionControl label={t('config3d.depth')} valueM={config.depthM} minM={0.4} maxM={1.2} onValueM={(depthM) => apply({ depthM })} />}
        </>}
        {bench && <>
          {choice(t('flows.PIECE_BENCH.style.title'), bench.style, BENCH_STYLES, (v) => t(`flows.PIECE_BENCH.style.options.${v}.label`), (v) => apply({ bench: { ...bench, style: v as typeof bench.style } }))}
          {toggle(t('flows.PIECE_BENCH.upholsteredSeat.title'), bench.upholsteredSeat, (v) => apply({ bench: { ...bench, upholsteredSeat: v } }))}
          <PieceDimensionControl label={t('config3d.width')} valueM={config.widthM} minM={0.6} maxM={2} onValueM={(widthM) => apply({ widthM })} />
        </>}
        {!config.upholstery && choice(t('config3d.furniture.visualFinish'), config.finish, PIECE3D_FINISHES, (v) => t(`config3d.finishes.${v}`), (v) => apply({ finish: v as PieceConfig3d['finish'], ...(v === 'CUSTOM' && !config.customColor ? { customColor: '#c9aa80' } : {}) }))}
        {!config.upholstery && config.finish === 'CUSTOM' && <label className="flex min-h-11 items-center justify-between text-sm">{t('config3d.finishes.CUSTOM')}
          <input type="color" className="h-11 w-16" value={config.customColor ?? '#c9aa80'} onChange={(e) => apply({ customColor: e.target.value })} />
        </label>}
        <div className="flex flex-wrap gap-1.5">{config3dChipItems(t, config, piece, locale).map((chip, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs">
          {chip.swatch && <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border border-border-2" style={{ backgroundColor: chip.swatch }} />}{chip.text}</span>)}</div>
      </div>
    </div>
  </div>;
}
