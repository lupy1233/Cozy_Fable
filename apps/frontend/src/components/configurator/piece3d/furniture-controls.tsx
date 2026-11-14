'use client';

import {
  BED_MATTRESS_SIZES, BED_STORAGES, BENCH_STYLES, TABLE_TYPES, TABLE_SEATS,
  TABLE_LENGTH_LIMITS, TABLE_ROUND_DIAMETER, PIECE3D_FINISHES, applyPieceEditRules, editPieceConfig, initialPieceConfig,
  pieceConfig3dSchema, tableDepthAfterRound, tableSeatsShortfall, type Piece3dKind, type PieceConfig3d,
} from '@marketplace/shared';
import { formatDecimal } from '@/lib/decimal';
import { isInEditSession } from '@/stores/configurator-store';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { PieceCanvas, type SnapshotFn } from './piece-canvas';
import { config3dChipItems } from './config-chips';
import { CatalogControls } from './catalog-controls';
import { PieceDimensionControl } from './dimension-control';

// etapa 9 (l1-3): formele afisate (EXTENDABLE ramane valoare salvata, aratata ca dreptunghi + bifa)
const TABLE_FORMS = ['RECTANGULAR', 'ROUND'] as const;

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
  const rectDepth = useRef<number | undefined>(undefined);
  const wantExtendable = useRef(false);
  const [diameterNote, setDiameterNote] = useState<{ type: keyof typeof TABLE_ROUND_DIAMETER; value: number } | null>(null);
  useEffect(() => {
    if (!onSnapshot || !config || mode !== '3d') return;
    const timer = setTimeout(() => onSnapshot(snapshot.current?.() ?? null), 800);
    return () => clearTimeout(timer);
  }, [config, mode, onSnapshot]);
  // revizuire m5: ca la biblioteca si comoda TV, o ciorna cu masa in afara intervalului nou de
  // diametru se ajusteaza O DATA la redeschidere, cu motiv; la editarea unei cereri publicate
  // configuratia ramane cum a fost publicata pana cand omul schimba ceva.
  const [fixSavedConfig] = useState(() => !isInEditSession());
  const editRulesChecked = useRef(false);
  useEffect(() => {
    if (!config || editRulesChecked.current) return;
    editRulesChecked.current = true;
    if (!fixSavedConfig || piece !== 'TABLE') return;
    const ruled = applyPieceEditRules(piece, config);
    if (ruled === config) return;
    if (ruled.table?.shape === 'ROUND') setDiameterNote({ type: ruled.table.type, value: ruled.widthM });
    onChange(ruled);
  }, [config, fixSavedConfig, onChange, piece]);
  // etapa 9 (l1-3): adancimea dreptunghiulara de dinainte de trecerea la rotund
  if (config?.table && config.table.shape !== 'ROUND') rectDepth.current = config.depthM;
  // revizuire m6: bifa "Extensibilă" se tine minte la ocolul prin alt tip / rotund
  if (config?.table?.shape === 'EXTENDABLE') wantExtendable.current = true;
  if (!config) return value == null ? null : <p role="alert">{t('config3d.furniture.invalidSavedConfig')}</p>;
  // etapa 9 (l1): curatarea + regulile noi de editare (diametrul mesei rotunde pe tip); trecerea
  // de la rotund la dreptunghi nu mai pune tacit adancimea pe maxim; diametrul corectat are motiv
  const apply = (patch: Partial<PieceConfig3d>, opts?: { extendable?: boolean }) => {
    if (opts?.extendable !== undefined) wantExtendable.current = opts.extendable;
    let merged: PieceConfig3d = { ...config, ...patch };
    if (merged.table && config.table?.shape === 'ROUND' && merged.table.shape !== 'ROUND') {
      merged = { ...merged, depthM: tableDepthAfterRound(merged.table.type, rectDepth.current) };
    }
    let next = editPieceConfig(piece, merged);
    if (
      opts?.extendable === undefined &&
      wantExtendable.current &&
      next.table?.type === 'DINING' &&
      next.table.shape === 'RECTANGULAR'
    ) {
      next = editPieceConfig(piece, { ...next, table: { ...next.table, shape: 'EXTENDABLE' } });
    }
    const clamped = next.table?.shape === 'ROUND' && Math.abs(next.widthM - merged.widthM) > 1e-6;
    setDiameterNote(clamped && next.table ? { type: next.table.type, value: next.widthM } : null);
    onChange(next);
  };
  const seatsShort = tableSeatsShortfall(config);
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
          {/* etapa 9 (l1-3): doua forme + "Extensibilă" da/nu doar la masa dreptunghiulara de dining.
              Se SALVEAZA tot ca shape 'EXTENDABLE' (fluxurile inghetate puncteaza si descriu dupa el) */}
          {choice(t('flows.PIECE_TABLE.shape.title'), table.shape === 'ROUND' ? 'ROUND' : 'RECTANGULAR', TABLE_FORMS, (v) => t(`flows.PIECE_TABLE.shape.options.${v}.label`), (v) => {
            if ((v === 'ROUND') !== (table.shape === 'ROUND')) apply({ table: { ...table, shape: v as typeof table.shape } });
          })}
          {table.type === 'DINING' && table.shape !== 'ROUND' && toggle(t('flows.PIECE_TABLE.shape.options.EXTENDABLE.label'), table.shape === 'EXTENDABLE',
            (v) => apply({ table: { ...table, shape: v ? 'EXTENDABLE' : 'RECTANGULAR' } }, { extendable: v }))}
          {table.type === 'DINING' && choice(t('flows.PIECE_TABLE.seats.title'), table.seats ?? 'SIX', TABLE_SEATS, (v) => t(`flows.PIECE_TABLE.seats.options.${v}.label`), (v) => apply({ table: { ...table, seats: v as NonNullable<typeof table.seats> } }))}
          <PieceDimensionControl label={table.shape === 'ROUND' ? t('flows.PIECE_TABLE.dimensions.slots.diameter') : t('config3d.width')} valueM={config.widthM}
            minM={table.shape === 'ROUND' ? TABLE_ROUND_DIAMETER[table.type].min : TABLE_LENGTH_LIMITS[table.type].min} maxM={table.shape === 'ROUND' ? TABLE_ROUND_DIAMETER[table.type].max : TABLE_LENGTH_LIMITS[table.type].max} onValueM={(widthM) => apply({ widthM })} />
          {/* motivul corectarii diametrului (b7) si avertismentul de persoane */}
          <div role="status" aria-live="polite" data-testid="table-reasons" className="flex flex-col gap-1 text-meta text-muted-foreground">
            {diameterNote && <p>{t('config3d.furniture.diameterClamped', {
              min: formatDecimal(TABLE_ROUND_DIAMETER[diameterNote.type].min * 100, locale, 0),
              max: formatDecimal(TABLE_ROUND_DIAMETER[diameterNote.type].max * 100, locale, 0),
              value: formatDecimal(Math.round(diameterNote.value * 1000) / 10, locale, 1),
            })}</p>}
            {seatsShort && <p className="text-amber-800 dark:text-amber-300" data-testid="table-seats-warning">{t('config3d.furniture.seatsTooSmall', {
              seats: t(`flows.PIECE_TABLE.seats.options.${seatsShort.seats}.label`),
              cm: formatDecimal(seatsShort.minM * 100, locale, 0),
            })}</p>}
          </div>
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
