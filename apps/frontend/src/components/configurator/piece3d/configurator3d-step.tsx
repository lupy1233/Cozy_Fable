'use client';

import {
  canAddColumn,
  canRemoveColumn,
  defaultPieceConfig,
  DRAWERS_MAX_TOP,
  drawersCountFor,
  GEOM_EPS,
  HANGING_MIN_DEPTH,
  HANGING_MIN_ZONE_H,
  hangingCountFor,
  isPieceConfig3d,
  normalizePieceConfig,
  PIECE3D_FINISHES,
  PIECE3D_RULES,
  resolvePieceLayout,
  shelvesCountFor,
  SLIDING_COLUMNS_MAX,
  SLIDING_COLUMNS_MIN,
  zoneCountMax,
  type Piece3dColumn,
  type Piece3dKind,
  type Piece3dSlideDirection,
  type Piece3dZone,
  type Piece3dZoneFill,
  type Piece3dZoneType,
  type PieceConfig3d,
} from '@marketplace/shared';
import {
  Box,
  Lock,
  LockOpen,
  Minus,
  MousePointerClick,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FINISH_SPECS } from './finishes';
import { PieceCanvas, slideKey, zoneKey, type SnapshotFn, type ZoneRef } from './piece-canvas';

// Step-ul configurator-3d (R2/R3): model 3D live + controale directe.
// D-3D-2 (aprobat): 3D si "campurile clasice" COEXISTA ca doua moduri de UI
// ale aceluiasi raspuns — ambele produc acelasi PieceConfig3d, validat identic.
// Fara WebGL (device vechi) cade automat pe modul cu campuri (R5).

interface Configurator3dStepUIProps {
  piece: Piece3dKind;
  value: unknown;
  onChange: (value: PieceConfig3d) => void;
  // primeste PNG-ul scenei (debounced) — folosit la publish pentru snapshot (R4)
  onSnapshot?: (dataUrl: string | null) => void;
}

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// count implicit la schimbarea tipului/interiorului unei zone
const DEFAULT_DRAWERS = 2;
const DEFAULT_SHELVES = 3;

const cm = (v: number) => Math.round(v * 100);

// optiunile de interior pentru zonele usa/deschis (undefined = gol)
const FILL_OPTIONS: (Piece3dZoneFill | undefined)[] = [undefined, 'SHELVES', 'HANGING'];
const fillKey = (fill: Piece3dZoneFill | undefined) => fill ?? 'NONE';

function DimensionControl({
  label,
  min,
  max,
  valueM,
  onValueM,
}: {
  label: string;
  min: number;
  max: number;
  valueM: number;
  onValueM: (v: number) => void;
}) {
  // intervalul permis sta LANGA eticheta (nu sub slider) — economiseste un rand
  // per dimensiune, ca panoul lateral din modul 3D sa incapa pe ecran (U2)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">
          {cm(min)}–{cm(max)} cm
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={cm(min)}
          max={cm(max)}
          step={1}
          value={cm(valueM)}
          onChange={(e) => onValueM(Number(e.target.value) / 100)}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border-2 accent-walnut"
          aria-label={label}
        />
        <div className="relative w-24 shrink-0">
          <Input
            type="number"
            inputMode="numeric"
            min={cm(min)}
            max={cm(max)}
            value={cm(valueM)}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isFinite(raw)) onValueM(raw / 100);
            }}
            className="pr-9 text-right"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            cm
          </span>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  value,
  onDelta,
  canDec,
  canInc,
  decLabel,
  incLabel,
}: {
  value: number;
  onDelta: (delta: 1 | -1) => void;
  canDec: boolean;
  canInc: boolean;
  decLabel: string;
  incLabel: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border-2 bg-surface px-1.5 py-1">
      <button
        type="button"
        onClick={() => onDelta(-1)}
        disabled={!canDec}
        aria-label={decLabel}
        className="grid h-7 w-7 place-items-center rounded-md text-foreground transition-colors hover:bg-walnut-soft disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center font-mono text-sm tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onDelta(1)}
        disabled={!canInc}
        aria-label={incLabel}
        className="grid h-7 w-7 place-items-center rounded-md text-foreground transition-colors hover:bg-walnut-soft disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Pereche/grup de optiuni exclusive stil "pill" — acelasi limbaj vizual ca
// pilulele de tip de zona (T1: maner/push, soclu/picioare, batante/glisante).
function TogglePills({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onSelect(option.value)}
          className={
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
            (value === option.value
              ? 'border-walnut bg-walnut text-white'
              : 'border-border-2 bg-surface hover:border-walnut/50')
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Dimensiune editabila cu lacat (R5.3): valoarea afisata e cea REZOLVATA;
// editarea o blocheaza implicit, lacatul o elibereaza (impartire egala).
function LockableSize({
  label,
  valueCm,
  locked,
  onValueCm,
  onToggleLock,
  lockLabel,
  unlockLabel,
}: {
  label: string;
  valueCm: number;
  locked: boolean;
  onValueCm: (v: number) => void;
  onToggleLock: () => void;
  lockLabel: string;
  unlockLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative w-20 shrink-0">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={valueCm}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) onValueCm(v);
          }}
          aria-label={label}
          className="h-8 pr-7 text-right text-sm"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          cm
        </span>
      </div>
      <button
        type="button"
        aria-pressed={locked}
        title={locked ? unlockLabel : lockLabel}
        aria-label={locked ? unlockLabel : lockLabel}
        onClick={onToggleLock}
        className={
          'grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors ' +
          (locked
            ? 'border-walnut/50 bg-walnut-soft text-walnut'
            : 'border-border-2 text-muted-foreground hover:text-foreground')
        }
      >
        {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function Configurator3dStepUI({
  piece,
  value,
  onChange,
  onSnapshot,
}: Configurator3dStepUIProps) {
  const t = useTranslations('Configurator');
  const rules = PIECE3D_RULES[piece];
  const [webgl] = useState(() => hasWebGl());
  const [mode, setMode] = useState<'3d' | 'fields'>(webgl ? '3d' : 'fields');
  const [activeZone, setActiveZone] = useState<ZoneRef | null>(null);
  // zonele cu usa/sertar deschise in scena ("col:zone")
  const [openZones, setOpenZones] = useState<Set<string>>(new Set());
  const snapshotFn = useRef<SnapshotFn | null>(null);

  const config = isPieceConfig3d(value) ? value : null;

  // raspunsul exista mereu dupa montare — configul implicit al piesei
  useEffect(() => {
    if (!config) onChange(defaultPieceConfig(piece));
  }, [config, onChange, piece]);

  const apply = useCallback(
    (next: PieceConfig3d) => onChange(normalizePieceConfig(piece, next)),
    [onChange, piece],
  );

  // snapshot PNG debounced dupa fiecare schimbare (R4); doar in modul 3D
  useEffect(() => {
    if (!config || !onSnapshot || mode !== '3d') return;
    const timer = setTimeout(() => {
      onSnapshot(snapshotFn.current ? snapshotFn.current() : null);
    }, 800);
    return () => clearTimeout(timer);
  }, [config, mode, onSnapshot]);

  // zona activa ramane valida dupa orice modificare de structura
  const validActiveZone = useMemo(() => {
    if (!config || !activeZone) return null;
    const column = config.columns[activeZone.col];
    if (!column || activeZone.zone >= column.zones.length) return null;
    return activeZone;
  }, [config, activeZone]);

  // geometria rezolvata (latimi/inaltimi reale, cu blocaje) — pentru afisarea
  // dimensiunilor si regulile bara de haine / sertare (R5.3)
  const layout = useMemo(
    () => (config ? resolvePieceLayout(piece, config) : null),
    [piece, config],
  );

  if (!config) return null;

  const setColumns = (n: number) => {
    const columns = Array.from(
      { length: Math.max(rules.minColumns, n) },
      (_, i) => config.columns[i] ?? rules.defaultColumn(),
    );
    apply({ ...config, columns });
    setActiveZone(null);
    setOpenZones(new Set());
  };

  const updateZone = (ref: ZoneRef, patch: Partial<Piece3dZone>) => {
    const columns = config.columns.map((column, ci) =>
      ci === ref.col
        ? {
            ...column,
            zones: column.zones.map((zone, zi) =>
              zi === ref.zone ? ({ ...zone, ...patch } as Piece3dZone) : zone,
            ),
          }
        : column,
    );
    apply({ ...config, columns });
  };

  const updateColumn = (col: number, patch: Partial<Piece3dColumn>) => {
    const columns = config.columns.map((column, ci) =>
      ci === col ? { ...column, ...patch } : column,
    );
    apply({ ...config, columns });
  };

  const setZoneType = (ref: ZoneRef, type: Piece3dZoneType) => {
    const zone = config.columns[ref.col].zones[ref.zone];
    if (type === 'DRAWERS') {
      // sertarele nu au interior; count = numarul de sertare
      updateZone(ref, { type, fill: undefined, count: DEFAULT_DRAWERS });
    } else {
      // usa/deschis pastreaza interiorul existent (polite/bare) cu tot cu numar
      updateZone(ref, {
        type,
        count: zone.fill
          ? zone.count ?? (zone.fill === 'SHELVES' ? DEFAULT_SHELVES : 1)
          : undefined,
      });
    }
    // starea "deschis" nu supravietuieste schimbarii tipului de fronturi:
    // o usa lasata deschisa devenita sertar ar ramane blocata pe unghiul de usa
    setOpenZones((prev) => {
      if (!prev.has(zoneKey(ref.col, ref.zone))) return prev;
      const next = new Set(prev);
      next.delete(zoneKey(ref.col, ref.zone));
      return next;
    });
  };

  const setZoneFill = (ref: ZoneRef, fill: Piece3dZoneFill | undefined) => {
    updateZone(ref, {
      fill,
      count: fill === 'SHELVES' ? DEFAULT_SHELVES : fill === 'HANGING' ? 1 : undefined,
    });
  };

  const addZone = (col: number) => {
    // zona noua porneste pe tipul implicit al piesei (sertarele cu count)
    const type = rules.zoneTypes[0];
    const fresh: Piece3dZone = type === 'DRAWERS' ? { type, count: DEFAULT_DRAWERS } : { type };
    const columns = config.columns.map((column, ci) =>
      ci === col && column.zones.length < rules.maxZonesPerColumn
        ? { ...column, zones: [...column.zones, fresh] }
        : column,
    );
    apply({ ...config, columns });
    setActiveZone({ col, zone: Math.min(config.columns[col].zones.length, rules.maxZonesPerColumn - 1) });
  };

  const removeZone = (ref: ZoneRef) => {
    const columns = config.columns.map((column, ci) =>
      ci === ref.col
        ? { ...column, zones: column.zones.filter((_, zi) => zi !== ref.zone) }
        : column,
    );
    apply({ ...config, columns });
    // selectia ramane pe coloana (zona vecina) — bara nu dispare la stergere
    const remaining = columns[ref.col].zones.length;
    setActiveZone(remaining > 0 ? { col: ref.col, zone: Math.min(ref.zone, remaining - 1) } : null);
    setOpenZones(new Set());
  };

  const activeZoneData = validActiveZone
    ? config.columns[validActiveZone.col].zones[validActiveZone.zone]
    : null;
  const activeMax = activeZoneData ? zoneCountMax(activeZoneData) : undefined;
  const activeResolved =
    validActiveZone && layout ? layout[validActiveZone.col]?.zones[validActiveZone.zone] : null;
  const activeColWidth = validActiveZone && layout ? layout[validActiveZone.col]?.width : null;
  // usile glisante (T1): activ doar pe dulap, la 2-3 coloane
  const sliding = config.doorMode === 'SLIDING';
  // regulile geometrice (R5.3 + T1): sertare doar sub 160cm SI cu minim
  // 15cm/front; bara cere 55cm adancime si o zona de 80cm inaltime; politele
  // cer minim 10cm de spatiu intre ele
  const drawersAllowed = activeResolved
    ? activeResolved.top <= DRAWERS_MAX_TOP + GEOM_EPS &&
      drawersCountFor(activeResolved.height) >= 1
    : true;
  const hangingAllowed = activeResolved
    ? config.depthM >= HANGING_MIN_DEPTH - GEOM_EPS &&
      activeResolved.height >= HANGING_MIN_ZONE_H - GEOM_EPS
    : false;
  const shelvesAllowed = activeResolved ? shelvesCountFor(activeResolved.height) >= 1 : false;
  // plafoanele de count urmeaza geometria rezolvata: bare (80cm/bara),
  // sertare (15cm/front), polite (pas de 10cm)
  const activeCountMax =
    activeZoneData && activeMax !== undefined && activeResolved
      ? activeZoneData.fill === 'HANGING'
        ? Math.max(1, Math.min(activeMax, hangingCountFor(activeResolved.height)))
        : activeZoneData.type === 'DRAWERS'
          ? Math.max(1, Math.min(activeMax, drawersCountFor(activeResolved.height)))
          : activeZoneData.fill === 'SHELVES'
            ? Math.max(1, Math.min(activeMax, shelvesCountFor(activeResolved.height)))
            : activeMax
      : activeMax;

  const zoneToolbar = validActiveZone && activeZoneData && activeResolved && (
    <div className="flex flex-col gap-2 rounded-xl border border-walnut/40 bg-walnut-soft/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-walnut">
          {t('config3d.zoneToolbarTitle', {
            column: validActiveZone.col + 1,
            zone: validActiveZone.zone + 1,
          })}
        </span>
        <button
          type="button"
          onClick={() => removeZone(validActiveZone)}
          disabled={config.columns[validActiveZone.col].zones.length <= 1}
          className="text-xs text-crimson underline-offset-2 hover:underline disabled:opacity-30"
        >
          {t('config3d.removeZone')}
        </button>
      </div>
      {/* optiunile indisponibile geometric se ASCUND, nu se dezactiveaza
          (feedback PO 2026-07-13); cea selectata ramane mereu vizibila;
          T1: usa per zona nu exista in spatele usilor glisante */}
      <div className="flex flex-wrap gap-1.5">
        {rules.zoneTypes
          .filter(
            (type) => !(type === 'DRAWERS' && !drawersAllowed && activeZoneData.type !== type),
          )
          .filter((type) => !(type === 'DOOR' && sliding))
          .map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={activeZoneData.type === type}
              onClick={() => setZoneType(validActiveZone, type)}
              className={
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                (activeZoneData.type === type
                  ? 'border-walnut bg-walnut text-white'
                  : 'border-border-2 bg-surface hover:border-walnut/50')
              }
            >
              {t(`config3d.zoneTypes.${type}`)}
            </button>
          ))}
      </div>
      {/* interiorul zonelor usa/deschis: gol, polite sau bara de haine */}
      {activeZoneData.type !== 'DRAWERS' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{t('config3d.fillLabel')}</span>
          {FILL_OPTIONS.filter(
            (fill) => !(fill === 'HANGING' && !hangingAllowed && activeZoneData.fill !== 'HANGING'),
          )
            .filter(
              (fill) =>
                !(fill === 'SHELVES' && !shelvesAllowed && activeZoneData.fill !== 'SHELVES'),
            )
            .map((fill) => (
            <button
              key={fillKey(fill)}
              type="button"
              aria-pressed={activeZoneData.fill === fill}
              onClick={() => setZoneFill(validActiveZone, fill)}
              className={
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                (activeZoneData.fill === fill
                  ? 'border-walnut bg-walnut text-white'
                  : 'border-border-2 bg-surface hover:border-walnut/50')
              }
            >
              {t(`config3d.fills.${fillKey(fill)}`)}
            </button>
          ))}
        </div>
      )}
      {/* T1: directia usii glisante a coloanei — doar unde exista vecine pe
          ambele parti (capetele gliseaza mereu spre interior) */}
      {sliding && validActiveZone.col > 0 && validActiveZone.col < config.columns.length - 1 && (
        <TogglePills
          label={t('config3d.slideDirection')}
          options={(['L', 'R'] as const).map((dir) => ({
            value: dir,
            label: t(`config3d.slideDirections.${dir}`),
          }))}
          value={config.columns[validActiveZone.col].slideTo ?? 'L'}
          onSelect={(dir) =>
            updateColumn(validActiveZone.col, { slideTo: dir as Piece3dSlideDirection })
          }
        />
      )}
      {activeCountMax !== undefined && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t('config3d.countLabel')}</span>
          <Stepper
            value={activeZoneData.count ?? 1}
            onDelta={(d) =>
              updateZone(validActiveZone, {
                count: Math.max(1, Math.min(activeCountMax, (activeZoneData.count ?? 1) + d)),
              })
            }
            canDec={(activeZoneData.count ?? 1) > 1}
            canInc={(activeZoneData.count ?? 1) < activeCountMax}
            decLabel={t('config3d.fewer')}
            incLabel={t('config3d.more')}
          />
        </div>
      )}
      {/* randurile (zonele) coloanei selectate: + adauga jos, − scoate de jos */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t('config3d.rowsInColumn')}</span>
        <Stepper
          value={config.columns[validActiveZone.col].zones.length}
          onDelta={(d) => {
            const len = config.columns[validActiveZone.col].zones.length;
            if (d === 1) addZone(validActiveZone.col);
            else removeZone({ col: validActiveZone.col, zone: len - 1 });
          }}
          canDec={config.columns[validActiveZone.col].zones.length > 1}
          canInc={config.columns[validActiveZone.col].zones.length < rules.maxZonesPerColumn}
          decLabel={t('config3d.fewer')}
          incLabel={t('config3d.more')}
        />
      </div>
      {/* dimensiunile randului/coloanei selectate, cu blocare (R5.3) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <LockableSize
          label={t('config3d.rowHeight')}
          valueCm={cm(activeResolved.height)}
          locked={activeZoneData.heightM !== undefined}
          onValueCm={(v) => updateZone(validActiveZone, { heightM: v / 100 })}
          onToggleLock={() =>
            updateZone(validActiveZone, {
              heightM: activeZoneData.heightM === undefined ? activeResolved.height : undefined,
            })
          }
          lockLabel={t('config3d.lockSize')}
          unlockLabel={t('config3d.unlockSize')}
        />
        {piece !== 'DESK' && activeColWidth != null && (
          <LockableSize
            label={t('config3d.columnWidth')}
            valueCm={cm(activeColWidth)}
            locked={config.columns[validActiveZone.col].widthM !== undefined}
            onValueCm={(v) => updateColumn(validActiveZone.col, { widthM: v / 100 })}
            onToggleLock={() =>
              updateColumn(validActiveZone.col, {
                widthM:
                  config.columns[validActiveZone.col].widthM === undefined
                    ? activeColWidth
                    : undefined,
              })
            }
            lockLabel={t('config3d.lockSize')}
            unlockLabel={t('config3d.unlockSize')}
          />
        )}
      </div>
    </div>
  );

  // in modul 3D sliderele stau unul sub altul in panoul lateral (lg);
  // in modul cu campuri raman 3 pe rand ca inainte
  const dimensionControls = (
    <div className={mode === '3d' ? 'grid gap-3 sm:grid-cols-3 lg:grid-cols-1' : 'grid gap-3 sm:grid-cols-3'}>
      <DimensionControl
        label={t('config3d.width')}
        min={rules.width.min}
        max={rules.width.max}
        valueM={config.widthM}
        onValueM={(v) => apply({ ...config, widthM: v })}
      />
      <DimensionControl
        label={t('config3d.height')}
        min={rules.height.min}
        max={rules.height.max}
        valueM={config.heightM}
        onValueM={(v) => apply({ ...config, heightM: v })}
      />
      <DimensionControl
        label={t('config3d.depth')}
        min={rules.depth.min}
        max={rules.depth.max}
        valueM={config.depthM}
        onValueM={(v) => apply({ ...config, depthM: v })}
      />
    </div>
  );

  const columnsControl = (
    <div className="flex flex-wrap items-center gap-4">
      {/* piesele cu o singura coloana posibila (noptiera) nu afiseaza deloc
          controlul — nu doar dezactivat (feedback PO 2026-07-13) */}
      {rules.maxColumns > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {piece === 'DESK' ? t('config3d.pedestals') : t('config3d.columns')}
          </span>
          <Stepper
            value={config.columns.length}
            onDelta={(d) => setColumns(config.columns.length + d)}
            canDec={canRemoveColumn(piece, config)}
            canInc={canAddColumn(piece, config)}
            decLabel={t('config3d.fewer')}
            incLabel={t('config3d.more')}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t('config3d.finish')}</span>
        <div className="flex flex-wrap gap-1.5">
          {PIECE3D_FINISHES.filter((finish) => finish !== 'CUSTOM').map((finish) => (
            <button
              key={finish}
              type="button"
              aria-pressed={config.finish === finish}
              title={t(`config3d.finishes.${finish}`)}
              onClick={() => apply({ ...config, finish })}
              className={
                'h-7 w-7 rounded-full border-2 transition-transform ' +
                (config.finish === finish
                  ? 'scale-110 border-walnut shadow-[0_0_0_2px_hsl(var(--walnut)/0.2)]'
                  : 'border-border-2 hover:scale-105')
              }
              style={{ backgroundColor: FINISH_SPECS[finish].body }}
            />
          ))}
          {/* T1: orice culoare — swatch cu color picker nativ; alegerea seteaza
              finisajul CUSTOM si pastreaza culoarea in config */}
          <label
            title={t('config3d.finishes.CUSTOM')}
            className={
              'relative h-7 w-7 cursor-pointer rounded-full border-2 transition-transform ' +
              (config.finish === 'CUSTOM'
                ? 'scale-110 border-walnut shadow-[0_0_0_2px_hsl(var(--walnut)/0.2)]'
                : 'border-border-2 hover:scale-105')
            }
            style={{
              background:
                config.customColor ??
                'conic-gradient(#e2662e, #d9b23c, #8a9c88, #42586c, #a26bb0, #e2662e)',
            }}
          >
            <input
              type="color"
              value={config.customColor ?? '#b08d57'}
              onChange={(e) =>
                apply({ ...config, finish: 'CUSTOM', customColor: e.target.value })
              }
              aria-label={t('config3d.finishes.CUSTOM')}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        onClick={() => {
          apply(defaultPieceConfig(piece));
          setActiveZone(null);
          setOpenZones(new Set());
        }}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        {t('config3d.reset')}
      </Button>
    </div>
  );

  // T1: optiunile de stil ale piesei — deschiderea fronturilor (toate
  // piesele), soclu/picioare (comoda), usi batante/glisante (dulap)
  const canSlide =
    config.columns.length >= SLIDING_COLUMNS_MIN && config.columns.length <= SLIDING_COLUMNS_MAX;
  const optionsControl = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <TogglePills
        label={t('config3d.frontStyleLabel')}
        options={(['PUSH', 'HANDLE'] as const).map((style) => ({
          value: style,
          label: t(`config3d.frontStyles.${style}`),
        }))}
        value={config.frontStyle ?? 'PUSH'}
        onSelect={(style) =>
          apply({ ...config, frontStyle: style as PieceConfig3d['frontStyle'] })
        }
      />
      {rules.legsOption && (
        <TogglePills
          label={t('config3d.baseLabel')}
          options={[
            { value: 'PLINTH', label: t('config3d.basePlinth') },
            { value: 'LEGS', label: t('config3d.baseLegs') },
          ]}
          value={config.legs ? 'LEGS' : 'PLINTH'}
          onSelect={(base) => apply({ ...config, legs: base === 'LEGS' ? true : undefined })}
        />
      )}
      {rules.slidingDoors && (sliding || canSlide) && (
        <TogglePills
          label={t('config3d.doorModeLabel')}
          options={(['HINGED', 'SLIDING'] as const).map((mode) => ({
            value: mode,
            label: t(`config3d.doorModes.${mode}`),
          }))}
          value={sliding ? 'SLIDING' : 'HINGED'}
          onSelect={(mode) => {
            apply({ ...config, doorMode: mode === 'SLIDING' ? 'SLIDING' : undefined });
            setOpenZones(new Set());
          }}
        />
      )}
      {/* la 1 sau 4+ coloane optiunea de glisare nu exista — explicam de ce */}
      {rules.slidingDoors && !sliding && !canSlide && (
        <p className="text-[11px] text-muted-foreground">{t('config3d.slidingNeeds')}</p>
      )}
    </div>
  );

  // modul clasic: aceleasi date, editate prin campuri (fallback + preferinta)
  const fieldsMode = (
    <div className="flex flex-col gap-4">
      {dimensionControls}
      {columnsControl}
      {optionsControl}
      <div className="grid gap-3 md:grid-cols-2">
        {config.columns.map((column, ci) => (
          <div key={ci} className="flex flex-col gap-2 rounded-lg border border-border-2 bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('config3d.columnLabel', { n: ci + 1 })}
              </span>
              <div className="flex items-center gap-3">
                {piece !== 'DESK' && layout?.[ci] && (
                  <LockableSize
                    label={t('config3d.columnWidth')}
                    valueCm={cm(layout[ci].width)}
                    locked={column.widthM !== undefined}
                    onValueCm={(v) => updateColumn(ci, { widthM: v / 100 })}
                    onToggleLock={() =>
                      updateColumn(ci, {
                        widthM: column.widthM === undefined ? layout[ci].width : undefined,
                      })
                    }
                    lockLabel={t('config3d.lockSize')}
                    unlockLabel={t('config3d.unlockSize')}
                  />
                )}
                <button
                  type="button"
                  onClick={() => addZone(ci)}
                  disabled={column.zones.length >= rules.maxZonesPerColumn}
                  className="flex items-center gap-1 text-xs text-walnut underline-offset-2 hover:underline disabled:opacity-30"
                >
                  <Plus className="h-3 w-3" />
                  {t('config3d.addZone')}
                </button>
              </div>
            </div>
            {/* T1: directia usii glisante — doar coloanele cu vecine pe ambele parti */}
            {sliding && ci > 0 && ci < config.columns.length - 1 && (
              <TogglePills
                label={t('config3d.slideDirection')}
                options={(['L', 'R'] as const).map((dir) => ({
                  value: dir,
                  label: t(`config3d.slideDirections.${dir}`),
                }))}
                value={column.slideTo ?? 'L'}
                onSelect={(dir) =>
                  updateColumn(ci, { slideTo: dir as Piece3dSlideDirection })
                }
              />
            )}
            {column.zones.map((zone, zi) => {
              const resolved = layout?.[ci]?.zones[zi];
              const rawMax = zoneCountMax(zone);
              // plafoane pe geometria rezolvata: bare (80cm/bara), sertare
              // (15cm/front, T1), polite (pas de 10cm, T1)
              const max =
                rawMax !== undefined && resolved
                  ? zone.fill === 'HANGING'
                    ? Math.max(1, Math.min(rawMax, hangingCountFor(resolved.height)))
                    : zone.type === 'DRAWERS'
                      ? Math.max(1, Math.min(rawMax, drawersCountFor(resolved.height)))
                      : zone.fill === 'SHELVES'
                        ? Math.max(1, Math.min(rawMax, shelvesCountFor(resolved.height)))
                        : rawMax
                  : rawMax;
              const zoneDrawersOk = resolved
                ? resolved.top <= DRAWERS_MAX_TOP + GEOM_EPS &&
                  drawersCountFor(resolved.height) >= 1
                : true;
              const zoneHangingOk = resolved
                ? config.depthM >= HANGING_MIN_DEPTH - GEOM_EPS &&
                  resolved.height >= HANGING_MIN_ZONE_H - GEOM_EPS
                : false;
              const zoneShelvesOk = resolved ? shelvesCountFor(resolved.height) >= 1 : false;
              return (
                <div key={zi} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-28 flex-1">
                    <Select
                      value={zone.type}
                      onChange={(e) =>
                        setZoneType({ col: ci, zone: zi }, e.target.value as Piece3dZoneType)
                      }
                    >
                      {/* optiunile indisponibile geometric se ascund (PO 2026-07-13) */}
                      {rules.zoneTypes
                        .filter(
                          (type) =>
                            !(type === 'DRAWERS' && !zoneDrawersOk && zone.type !== type),
                        )
                        .filter((type) => !(type === 'DOOR' && sliding))
                        .map((type) => (
                          <option key={type} value={type}>
                            {t(`config3d.zoneTypes.${type}`)}
                          </option>
                        ))}
                    </Select>
                  </div>
                  {zone.type !== 'DRAWERS' && (
                    <div className="min-w-28 flex-1">
                      <Select
                        value={fillKey(zone.fill)}
                        aria-label={t('config3d.fillLabel')}
                        onChange={(e) =>
                          setZoneFill(
                            { col: ci, zone: zi },
                            e.target.value === 'NONE'
                              ? undefined
                              : (e.target.value as Piece3dZoneFill),
                          )
                        }
                      >
                        {FILL_OPTIONS.filter(
                          (fill) =>
                            !(fill === 'HANGING' && !zoneHangingOk && zone.fill !== 'HANGING'),
                        )
                          .filter(
                            (fill) =>
                              !(fill === 'SHELVES' && !zoneShelvesOk && zone.fill !== 'SHELVES'),
                          )
                          .map((fill) => (
                            <option key={fillKey(fill)} value={fillKey(fill)}>
                              {t(`config3d.fills.${fillKey(fill)}`)}
                            </option>
                          ))}
                      </Select>
                    </div>
                  )}
                  {max !== undefined && (
                    <Input
                      type="number"
                      min={1}
                      max={max}
                      title={t('config3d.countLabel')}
                      aria-label={t('config3d.countLabel')}
                      value={zone.count ?? 1}
                      onChange={(e) =>
                        updateZone(
                          { col: ci, zone: zi },
                          { count: Math.max(1, Math.min(max, Number(e.target.value) || 1)) },
                        )
                      }
                      className="w-16 text-right"
                    />
                  )}
                  {resolved && (
                    <LockableSize
                      label={t('config3d.rowHeight')}
                      valueCm={cm(resolved.height)}
                      locked={zone.heightM !== undefined}
                      onValueCm={(v) => updateZone({ col: ci, zone: zi }, { heightM: v / 100 })}
                      onToggleLock={() =>
                        updateZone(
                          { col: ci, zone: zi },
                          { heightM: zone.heightM === undefined ? resolved.height : undefined },
                        )
                      }
                      lockLabel={t('config3d.lockSize')}
                      unlockLabel={t('config3d.unlockSize')}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeZone({ col: ci, zone: zi })}
                    disabled={column.zones.length <= 1}
                    aria-label={t('config3d.removeZone')}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-crimson hover:bg-crimson/10 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {webgl && (
        <div className="flex items-center gap-1 self-start rounded-full border border-border-2 bg-surface p-0.5 text-sm">
          <button
            type="button"
            aria-pressed={mode === '3d'}
            onClick={() => setMode('3d')}
            className={
              'flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ' +
              (mode === '3d' ? 'bg-walnut text-white' : 'text-muted-foreground hover:text-foreground')
            }
          >
            <Box className="h-3.5 w-3.5" />
            {t('config3d.mode3d')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'fields'}
            onClick={() => setMode('fields')}
            className={
              'flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ' +
              (mode === 'fields'
                ? 'bg-walnut text-white'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('config3d.modeFields')}
          </button>
        </div>
      )}
      {!webgl && <p className="text-sm text-muted-foreground">{t('config3d.webglMissing')}</p>}

      {mode === '3d' ? (
        // U2 (feedback PO r4): pe desktop scena sta sticky in stanga si toate
        // comenzile intr-o coloana in dreapta — panoul zonei selectate apare
        // LANGA model, nu sub el, ca totul sa incapa pe un singur ecran.
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
          <div className="overflow-hidden rounded-xl border border-border-2 lg:sticky lg:top-20">
            <PieceCanvas
              kind={piece}
              config={config}
              activeZone={validActiveZone}
              openZones={openZones}
              onZoneClick={(ref) => {
                // click pe zona: o selecteaza; daca are usa/sertare, le deschide
                // sau le inchide (NU mai cicleaza tipul — tipul se alege din bara)
                setActiveZone(ref);
                const zone = config.columns[ref.col]?.zones[ref.zone];
                if (sliding) {
                  // T1: primul click gliseaza usa coloanei; cu usa deschisa,
                  // click pe sertare le trage, click in alta parte o inchide
                  setOpenZones((prev) => {
                    const door = slideKey(ref.col);
                    const next = new Set(prev);
                    if (!next.has(door)) {
                      next.add(door);
                    } else if (zone?.type === 'DRAWERS') {
                      const key = zoneKey(ref.col, ref.zone);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                    } else {
                      // inchide usa si sertarele ramase deschise in coloana
                      next.delete(door);
                      for (const key of [...next]) {
                        if (key.startsWith(`${ref.col}:`)) next.delete(key);
                      }
                    }
                    return next;
                  });
                  return;
                }
                if (zone && (zone.type === 'DOOR' || zone.type === 'DRAWERS' || zone.type === 'TILT_OUT')) {
                  setOpenZones((prev) => {
                    const key = zoneKey(ref.col, ref.zone);
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }
              }}
              onSnapshotReady={(fn) => {
                snapshotFn.current = fn;
              }}
              className="h-[320px] w-full sm:h-[420px] lg:h-[500px]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {/* zona selectata sau indrumarea de interactiune (acelasi slot) */}
            {zoneToolbar || (
              <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border-2 bg-surface-2/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-walnut" />
                <span>{t('config3d.hint')}</span>
              </div>
            )}
            <div className="rounded-xl border border-border-2 bg-surface p-3">
              {dimensionControls}
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border-2 bg-surface p-3">
              {columnsControl}
              {optionsControl}
            </div>
          </div>
        </div>
      ) : (
        fieldsMode
      )}
    </div>
  );
}
