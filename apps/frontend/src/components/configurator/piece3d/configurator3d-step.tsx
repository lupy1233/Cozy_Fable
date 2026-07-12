'use client';

import {
  canAddColumn,
  canRemoveColumn,
  defaultPieceConfig,
  DRAWERS_MAX_TOP,
  GEOM_EPS,
  HANGING_MIN_DEPTH,
  HANGING_MIN_ZONE_H,
  hangingCountFor,
  isPieceConfig3d,
  normalizePieceConfig,
  PIECE3D_FINISHES,
  PIECE3D_RULES,
  resolvePieceLayout,
  zoneCountMax,
  type Piece3dColumn,
  type Piece3dKind,
  type Piece3dZone,
  type Piece3dZoneFill,
  type Piece3dZoneType,
  type PieceConfig3d,
} from '@marketplace/shared';
import { Box, Lock, LockOpen, Minus, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FINISH_SPECS } from './finishes';
import { PieceCanvas, zoneKey, type SnapshotFn, type ZoneRef } from './piece-canvas';

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
  return (
    <Field label={label}>
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
      <p className="mt-1 text-[11px] text-muted-foreground">
        {cm(min)}–{cm(max)} cm
      </p>
    </Field>
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
    // zona care nu mai are fronturi nu poate ramane "deschisa"
    if (type === 'OPEN') {
      setOpenZones((prev) => {
        const next = new Set(prev);
        next.delete(zoneKey(ref.col, ref.zone));
        return next;
      });
    }
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
  // regulile geometrice (R5.3): sertare doar sub 160cm; bara cere 55cm
  // adancime si o zona de 80cm inaltime
  const drawersAllowed = activeResolved ? activeResolved.top <= DRAWERS_MAX_TOP + GEOM_EPS : true;
  const hangingAllowed = activeResolved
    ? config.depthM >= HANGING_MIN_DEPTH - GEOM_EPS &&
      activeResolved.height >= HANGING_MIN_ZONE_H - GEOM_EPS
    : false;
  // barele suprapuse sunt limitate de inaltimea zonei (80cm/bara)
  const activeCountMax =
    activeZoneData && activeMax !== undefined
      ? activeZoneData.fill === 'HANGING' && activeResolved
        ? Math.max(1, Math.min(activeMax, hangingCountFor(activeResolved.height)))
        : activeMax
      : undefined;

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
      <div className="flex flex-wrap gap-1.5">
        {rules.zoneTypes.map((type) => {
          const blocked = type === 'DRAWERS' && !drawersAllowed && activeZoneData.type !== type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={activeZoneData.type === type}
              disabled={blocked}
              title={blocked ? t('config3d.drawersTooHigh') : undefined}
              onClick={() => setZoneType(validActiveZone, type)}
              className={
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ' +
                (activeZoneData.type === type
                  ? 'border-walnut bg-walnut text-white'
                  : 'border-border-2 bg-surface hover:border-walnut/50')
              }
            >
              {t(`config3d.zoneTypes.${type}`)}
            </button>
          );
        })}
      </div>
      {/* interiorul zonelor usa/deschis: gol, polite sau bara de haine */}
      {activeZoneData.type !== 'DRAWERS' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{t('config3d.fillLabel')}</span>
          {FILL_OPTIONS.map((fill) => {
            const blocked =
              fill === 'HANGING' && !hangingAllowed && activeZoneData.fill !== 'HANGING';
            return (
              <button
                key={fillKey(fill)}
                type="button"
                aria-pressed={activeZoneData.fill === fill}
                disabled={blocked}
                title={blocked ? t('config3d.hangingNeeds') : undefined}
                onClick={() => setZoneFill(validActiveZone, fill)}
                className={
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ' +
                  (activeZoneData.fill === fill
                    ? 'border-walnut bg-walnut text-white'
                    : 'border-border-2 bg-surface hover:border-walnut/50')
                }
              >
                {t(`config3d.fills.${fillKey(fill)}`)}
              </button>
            );
          })}
        </div>
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

  const dimensionControls = (
    <div className="grid gap-3 sm:grid-cols-3">
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
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t('config3d.finish')}</span>
        <div className="flex gap-1.5">
          {PIECE3D_FINISHES.map((finish) => (
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
        }}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        {t('config3d.reset')}
      </Button>
    </div>
  );

  // modul clasic: aceleasi date, editate prin campuri (fallback + preferinta)
  const fieldsMode = (
    <div className="flex flex-col gap-4">
      {dimensionControls}
      {columnsControl}
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
            {column.zones.map((zone, zi) => {
              const resolved = layout?.[ci]?.zones[zi];
              const rawMax = zoneCountMax(zone);
              // barele suprapuse sunt limitate de inaltimea zonei (80cm/bara)
              const max =
                rawMax !== undefined && zone.fill === 'HANGING' && resolved
                  ? Math.max(1, Math.min(rawMax, hangingCountFor(resolved.height)))
                  : rawMax;
              const zoneDrawersOk = resolved
                ? resolved.top <= DRAWERS_MAX_TOP + GEOM_EPS
                : true;
              const zoneHangingOk = resolved
                ? config.depthM >= HANGING_MIN_DEPTH - GEOM_EPS &&
                  resolved.height >= HANGING_MIN_ZONE_H - GEOM_EPS
                : false;
              return (
                <div key={zi} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-28 flex-1">
                    <Select
                      value={zone.type}
                      onChange={(e) =>
                        setZoneType({ col: ci, zone: zi }, e.target.value as Piece3dZoneType)
                      }
                    >
                      {rules.zoneTypes.map((type) => (
                        <option
                          key={type}
                          value={type}
                          disabled={type === 'DRAWERS' && !zoneDrawersOk && zone.type !== type}
                        >
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
                        {FILL_OPTIONS.map((fill) => (
                          <option
                            key={fillKey(fill)}
                            value={fillKey(fill)}
                            disabled={
                              fill === 'HANGING' && !zoneHangingOk && zone.fill !== 'HANGING'
                            }
                          >
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
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-border-2">
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
              className="h-[320px] w-full sm:h-[420px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('config3d.hint')}</p>
          {zoneToolbar}
          {dimensionControls}
          {columnsControl}
        </div>
      ) : (
        fieldsMode
      )}
    </div>
  );
}
