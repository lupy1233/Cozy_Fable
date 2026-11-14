'use client';

import {
  canAddColumn,
  canRemoveColumn,
  columnStepperLimits,
  COLUMN_W_MAX,
  COLUMN_W_MIN,
  defaultPieceConfig,
  DESK_TWO_PEDESTALS_FROM_W,
  DRAWER_H_MIN,
  DRAWERS_MAX_TOP,
  explainPieceCleanup,
  drawersCountFor,
  GEOM_EPS,
  HANGING_MIN_DEPTH,
  HANGING_MIN_ZONE_H,
  hangingCountFor,
  isPieceConfig3d,
  isFurnitureKind,
  normalizePieceConfig,
  PIECE3D_FINISHES,
  PIECE3D_RULES,
  resolvePieceLayout,
  SHELF_GAP_MIN,
  shelvesCountFor,
  SLIDING_COLUMNS_MAX,
  SLIDING_COLUMNS_MIN,
  zoneCountMax,
  ZONE_H_MIN,
  type Piece3dCleanupNote,
  type Piece3dColumn,
  type Piece3dColumnLimit,
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
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDecimal } from '@/lib/decimal';
import { cmRangeText, useDecimalField } from '../use-decimal-field';
import { useDimensionField } from './use-dimension-field';
import { FINISH_SPECS } from './finishes';
import { PieceCanvas, zoneKey, type SnapshotFn, type ZoneRef } from './piece-canvas';
import { FurnitureControls } from './furniture-controls';
import { CatalogControls } from './catalog-controls';
import { useCabinetFronts } from './use-cabinet-fronts';
import { Snapshot3dAutoUpload } from '../snapshot3d-sync';
import { stableKey } from '@/stores/snapshot3d';

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
// cm cu o zecimala (precizie mm) pentru campurile editabile: 40,5 ramane 40,5 (b1)
const cmExact = (v: number) => Math.round(v * 1000) / 10;

// b7: stableKey (din stores/snapshot3d) = cheie de comparatie independenta de ordinea
// cheilor (raspunsul salvat poate trece prin validare / store, care pot reordona campurile)

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
  // draft local pentru campul numeric: valoarea afisata NU se leaga direct de
  // valueM cat timp userul editeaza — altfel clamp-ul din normalizePieceConfig
  // se aplica la fiecare tasta si "sare" inapoi la minim inainte sa apuce sa
  // scrie a doua cifra (ex: sterge 50, vrea 25, dar 2 < min => revine la min)
  // b1: camp text cu virgula; b7: valoarea in afara intervalului se corecteaza
  // la limita CU mesaj ("Minimul e 60 cm — am pus 60"), campul golit pastreaza
  // valoarea veche cu mesaj, "1,2" se citeste ca metri (120 cm)
  const locale = useLocale();
  const range = cmRangeText(min, max, locale);
  const field = useDimensionField({
    valueCm: cmExact(valueM),
    minCm: cmExact(min),
    maxCm: cmExact(max),
    onValueCm: (v) => onValueM(v / 100),
  });
  // intervalul permis sta LANGA eticheta (nu sub slider) — economiseste un rand
  // per dimensiune, ca panoul lateral din modul 3D sa incapa pe ecran (U2)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-meta text-muted-foreground">{range}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={cm(min)}
          max={cm(max)}
          step={1}
          value={cm(valueM)}
          onChange={(e) => {
            field.reset();
            onValueM(Number(e.target.value) / 100);
          }}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border-2 accent-walnut"
          aria-label={label}
        />
        <div className="relative w-24 shrink-0">
          <Input
            {...field.inputProps}
            aria-label={label}
            className={field.error ? 'border-crimson pr-9 text-right' : 'pr-9 text-right'}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            cm
          </span>
        </div>
      </div>
      {field.error && (
        <p role="alert" className="mt-1 text-meta text-crimson">
          {field.error}
        </p>
      )}
      {/* montat mereu (gol fara mesaj), ca anuntul sa fie citit cand apare */}
      <p
        id={field.noteId}
        role="status"
        aria-live="polite"
        className={field.note ? 'mt-1 text-meta text-muted-foreground' : 'sr-only'}
      >
        {field.note}
      </p>
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
  minCm,
  maxCm,
}: {
  label: string;
  valueCm: number;
  locked: boolean;
  onValueCm: (v: number) => void;
  onToggleLock: () => void;
  lockLabel: string;
  unlockLabel: string;
  minCm?: number;
  maxCm?: number;
}) {
  // valueCm e valoarea REZOLVATA (dupa clamp la minimul de 10/15cm etc.) —
  // draft local ca sa nu "sara" inapoi la minim la fiecare tasta stearsa,
  // inainte ca userul sa apuce sa scrie noua valoare (vezi DimensionControl)
  // b1: virgula acceptata; 0 / text invalid → ramane valoarea veche, cu mesaj
  // b7: limitele cunoscute (coloana 22-100cm, rand min 10cm) se corecteaza cu
  // mesaj, la fel ca in normalizePieceConfig; campul golit → mesaj
  const field = useDimensionField({ valueCm, minCm, maxCm, onValueCm });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative w-20 shrink-0">
        <Input
          {...field.inputProps}
          aria-label={label}
          className={field.error ? 'h-8 border-crimson pr-7 text-right text-sm' : 'h-8 pr-7 text-right text-sm'}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-micro text-muted-foreground">
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
      {field.error && (
        <p role="alert" className="basis-full text-meta text-crimson">
          {field.error}
        </p>
      )}
      <p
        id={field.noteId}
        role="status"
        aria-live="polite"
        className={field.note ? 'basis-full text-meta text-muted-foreground' : 'sr-only'}
      >
        {field.note}
      </p>
    </div>
  );
}

// Numarul de sertare/polite din modul "campuri clasice": acelasi tipar draft —
// clamp-ul la [1, max] se aplica DOAR la commit (blur/Enter), nu la fiecare tasta.
function ZoneCountInput({
  max,
  value,
  onValue,
  label,
}: {
  max: number;
  value: number;
  onValue: (v: number) => void;
  label: string;
}) {
  // b1: numar intreg intre 1 si max; altfel ramane valoarea veche, cu mesaj
  // (nu se mai taie pe tacute la max)
  const t = useTranslations('Configurator');
  const field = useDecimalField({
    value,
    commitOn: 'blur',
    maxFractionDigits: 0,
    validate: (v) =>
      !Number.isInteger(v)
        ? t('validation.wholeNumber')
        : v < 1 || v > max
          ? t('validation.outOfRangeKept', { range: `1–${max}` })
          : null,
    onValue: (v) => {
      if (v !== undefined) onValue(v);
    },
  });
  return (
    <span className="inline-flex flex-col">
      <Input
        {...field.inputProps}
        inputMode="numeric"
        title={label}
        aria-label={label}
        className={field.error ? 'w-16 border-crimson text-right' : 'w-16 text-right'}
      />
      {field.error && (
        <span role="alert" className="mt-1 max-w-48 text-meta text-crimson">
          {field.error}
        </span>
      )}
    </span>
  );
}

export default function Configurator3dStepUI(props: Configurator3dStepUIProps) {
  return (
    <>
      {isFurnitureKind(props.piece) ? <FurnitureControls {...props} /> : <CabinetControls {...props} />}
      {/* d4: in formular (onSnapshot dat) imaginea urca imediat ca fisier al ciornei; montat
          dupa controale, ca la iesirea de pe ecran sa gaseasca si captura facuta atunci */}
      {props.onSnapshot && <Snapshot3dAutoUpload />}
    </>
  );
}

function CabinetControls({
  piece,
  value,
  onChange,
  onSnapshot,
}: Configurator3dStepUIProps) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  const rules = PIECE3D_RULES[piece];
  const [webgl] = useState(() => hasWebGl());
  const [mode, setMode] = useState<'3d' | 'fields'>(webgl ? '3d' : 'fields');
  const [activeZone, setActiveZone] = useState<ZoneRef | null>(null);
  const snapshotFn = useRef<SnapshotFn | null>(null);

  const config = isPieceConfig3d(value) ? value : null;
  const { openZones, setOpenZones, toggleZone, onFrontSettled } = useCabinetFronts(piece, config);

  // raspunsul exista mereu dupa montare — configul implicit al piesei
  useEffect(() => {
    if (!config) onChange(defaultPieceConfig(piece));
  }, [config, onChange, piece]);

  // b7: "intentia" clientului = configuratia DINAINTE de curatare. Fiecare
  // schimbare se aplica peste ea; curatarea (normalizePieceConfig) se face doar
  // pentru ce se afiseaza si se SALVEAZA (onChange primeste mereu varianta
  // curatata). Asa, la 40 → 60 cm adancime barele revin. Intentia traieste
  // doar aici: e valabila cat timp raspunsul salvat e exact cel produs din ea
  // (altfel — reincarcare, alt pas, alta piesa — pornim de la cel salvat).
  const [intentState, setIntentState] = useState<{
    piece: Piece3dKind;
    intent: PieceConfig3d;
    cleanedKey: string;
  } | null>(null);
  const configKey = useMemo(() => (config ? stableKey(config) : ''), [config]);
  const intent: PieceConfig3d | null =
    config && intentState && intentState.piece === piece && intentState.cleanedKey === configKey
      ? intentState.intent
      : config;

  const apply = useCallback(
    (next: PieceConfig3d) => {
      const cleaned = normalizePieceConfig(piece, next);
      setIntentState({ piece, intent: next, cleanedKey: stableKey(cleaned) });
      onChange(cleaned);
    },
    [onChange, piece],
  );

  // ce a scos curatarea din intentie si de ce (linie scurta in panou)
  const cleanupNotes = useMemo(
    () => (config && intent ? explainPieceCleanup(piece, intent, config) : []),
    [piece, intent, config],
  );

  // snapshot PNG debounced dupa fiecare schimbare (R4); doar in modul 3D
  // d4: o captura inca neluata cand clientul paraseste ecranul se ia la iesire (altfel
  // "Continua" apasat repede lasa piesa fara imagine)
  const capturePending = useRef(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  useEffect(() => {
    if (!config || !onSnapshot || mode !== '3d') {
      capturePending.current = false;
      return;
    }
    capturePending.current = true;
    const timer = setTimeout(() => {
      capturePending.current = false;
      onSnapshot(snapshotFn.current ? snapshotFn.current() : null);
    }, 800);
    return () => clearTimeout(timer);
  }, [config, mode, onSnapshot]);
  useEffect(() => () => {
    if (!capturePending.current || !snapshotFn.current) return;
    capturePending.current = false;
    const dataUrl = snapshotFn.current();
    if (dataUrl) onSnapshotRef.current?.(dataUrl);
  }, []);

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

  // intentia completata cu ce a adaugat curatarea (coloane / zone implicite),
  // ca indicii din UI (luati din config-ul curatat) sa existe si in intentie
  const src = intent ?? config;
  const b: PieceConfig3d = {
    ...src,
    columns: [
      ...config.columns.map((column, i) => {
        const own = src.columns[i];
        if (!own) return column;
        return own.zones.length < column.zones.length
          ? { ...own, zones: [...own.zones, ...column.zones.slice(own.zones.length)] }
          : own;
      }),
      ...src.columns.slice(config.columns.length),
    ],
  };

  const setColumns = (n: number) => {
    const columns = Array.from(
      { length: Math.max(rules.minColumns, n) },
      (_, i) => b.columns[i] ?? rules.defaultColumn(),
    );
    apply({ ...b, columns });
    setActiveZone(null);
    setOpenZones(new Set());
  };

  const updateZone = (ref: ZoneRef, patch: Partial<Piece3dZone>) => {
    const columns = b.columns.map((column, ci) =>
      ci === ref.col
        ? {
            ...column,
            zones: column.zones.map((zone, zi) =>
              zi === ref.zone ? ({ ...zone, ...patch } as Piece3dZone) : zone,
            ),
          }
        : column,
    );
    apply({ ...b, columns });
  };

  const updateColumn = (col: number, patch: Partial<Piece3dColumn>) => {
    const columns = b.columns.map((column, ci) =>
      ci === col ? { ...column, ...patch } : column,
    );
    apply({ ...b, columns });
  };

  const setZoneType = (ref: ZoneRef, type: Piece3dZoneType) => {
    const zone = b.columns[ref.col].zones[ref.zone];
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
    const columns = b.columns.map((column, ci) =>
      ci === col && column.zones.length < rules.maxZonesPerColumn
        ? { ...column, zones: [...column.zones, fresh] }
        : column,
    );
    apply({ ...b, columns });
    setActiveZone({ col, zone: Math.min(b.columns[col].zones.length, rules.maxZonesPerColumn - 1) });
  };

  const removeZone = (ref: ZoneRef) => {
    const columns = b.columns.map((column, ci) =>
      ci === ref.col
        ? { ...column, zones: column.zones.filter((_, zi) => zi !== ref.zone) }
        : column,
    );
    apply({ ...b, columns });
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

  // b7: optiunile ascunse ale zonei active au motivul sub ele (o linie scurta);
  // bara de haine se explica doar la piesele care o pot avea vreodata
  // b7: inaltimea interioara a unei coloane = maximul unui rand ("8,5" la
  // rand nu se mai citeste ca 850 cm, ci ca 8,5 cm → corectat la minim)
  const columnInnerH = (ci: number) =>
    (layout?.[ci]?.zones ?? []).reduce((sum, z) => sum + z.height, 0);

  // b7: textele de motiv primesc pragurile din ACELEASI constante ca regula
  const cmText = (m: number) => formatDecimal(cmExact(m), locale, 1);
  const msg = {
    drawersTooHigh: t('config3d.drawersTooHigh', { cm: cmText(DRAWERS_MAX_TOP) }),
    drawersTooShort: t('config3d.drawersTooShort', { cm: cmText(DRAWER_H_MIN) }),
    hangingNeeds: t('config3d.hangingNeeds', {
      depth: cmText(HANGING_MIN_DEPTH),
      height: cmText(HANGING_MIN_ZONE_H),
    }),
    shelvesNeedSpace: t('config3d.shelvesNeedSpace', { cm: cmText(SHELF_GAP_MIN) }),
    slidingNeeds: t('config3d.slidingNeeds', { min: SLIDING_COLUMNS_MIN, max: SLIDING_COLUMNS_MAX }),
    slidingLost: t('config3d.slidingLost', { min: SLIDING_COLUMNS_MIN, max: SLIDING_COLUMNS_MAX }),
    pedestalsNeedWidth: t('config3d.pedestalsNeedWidth', { width: cmText(DESK_TWO_PEDESTALS_FROM_W) }),
  };

  const hangingPossible =
    rules.depth.max >= HANGING_MIN_DEPTH - GEOM_EPS &&
    rules.height.max >= HANGING_MIN_ZONE_H + 0.1;
  const zoneHiddenReasons: string[] =
    activeZoneData && activeResolved
      ? [
          ...(!drawersAllowed && activeZoneData.type !== 'DRAWERS' && rules.zoneTypes.includes('DRAWERS')
            ? [
                activeResolved.top > DRAWERS_MAX_TOP + GEOM_EPS
                  ? msg.drawersTooHigh
                  : msg.drawersTooShort,
              ]
            : []),
          ...(activeZoneData.type !== 'DRAWERS' &&
          hangingPossible &&
          !hangingAllowed &&
          activeZoneData.fill !== 'HANGING'
            ? [msg.hangingNeeds]
            : []),
          ...(activeZoneData.type !== 'DRAWERS' && !shelvesAllowed && activeZoneData.fill !== 'SHELVES'
            ? [msg.shelvesNeedSpace]
            : []),
        ]
      : [];

  // b7: ce a scos curatarea din intentia clientului (mesaje unice)
  const cleanupMessage = ({ reason, kept = 1 }: Piece3dCleanupNote): string => {
    switch (reason) {
      case 'HANGING_COUNT':
        return t('config3d.hangingReduced', { n: kept, cm: cmText(HANGING_MIN_ZONE_H) });
      case 'SHELVES_COUNT':
        return t('config3d.shelvesReduced', { n: kept, cm: cmText(SHELF_GAP_MIN) });
      case 'DRAWERS_COUNT':
        return t('config3d.drawersReduced', { n: kept, cm: cmText(DRAWER_H_MIN) });
      case 'HANGING_DEPTH':
      case 'HANGING_HEIGHT':
        return msg.hangingNeeds;
      case 'DRAWERS_TOO_HIGH':
        return msg.drawersTooHigh;
      case 'DRAWERS_TOO_SHORT':
        return msg.drawersTooShort;
      case 'SHELVES_SPACE':
        return msg.shelvesNeedSpace;
      case 'PEDESTALS_WIDTH':
        return msg.pedestalsNeedWidth;
      case 'COLUMNS_WIDTH':
        return t('config3d.columnsFitWidth', { min: cm(COLUMN_W_MIN), max: cm(COLUMN_W_MAX) });
      case 'SLIDING_COLUMNS':
        return msg.slidingLost;
    }
  };
  const cleanupLines = Array.from(new Set(cleanupNotes.map(cleanupMessage)));
  const slidingLost = cleanupNotes.some((n) => n.reason === 'SLIDING_COLUMNS');

  // b7: de ce Coloane "−" / "+" sunt dezactivate
  const columnLimits = columnStepperLimits(piece, config);
  const columnLimitMessage = (limit: Piece3dColumnLimit): string => {
    switch (limit) {
      case 'MAX_COLUMNS':
        return piece === 'DESK'
          ? t('config3d.pedestalsMaxReached', { n: rules.maxColumns })
          : t('config3d.columnsMaxReached', { n: rules.maxColumns });
      case 'SLIDING_COLUMNS':
        return msg.slidingNeeds;
      case 'PEDESTALS_WIDTH':
        return msg.pedestalsNeedWidth;
      case 'COLUMN_WIDTH':
        return t('config3d.columnWidthRange', { min: cm(COLUMN_W_MIN), max: cm(COLUMN_W_MAX) });
    }
  };
  const columnLimitLines = Array.from(
    new Set(
      [columnLimits.remove, columnLimits.add]
        .filter((l): l is Piece3dColumnLimit => l !== null)
        .map(columnLimitMessage),
    ),
  );

  const zoneToolbar =validActiveZone && activeZoneData && activeResolved && (
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
      {zoneHiddenReasons.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-meta text-muted-foreground" data-testid="zone-hidden-reasons">
          {zoneHiddenReasons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
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
          minCm={cmExact(ZONE_H_MIN)}
          maxCm={cmExact(columnInnerH(validActiveZone.col))}
          valueCm={cmExact(activeResolved.height)}
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
            minCm={cmExact(COLUMN_W_MIN)}
            maxCm={cmExact(COLUMN_W_MAX)}
            valueCm={cmExact(activeColWidth)}
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
      <CatalogControls kind={piece} config={config} apply={(patch) => apply({ ...b, ...patch })} />
      <DimensionControl
        label={t('config3d.width')}
        min={rules.width.min}
        max={rules.width.max}
        valueM={config.widthM}
        onValueM={(v) => apply({ ...b, widthM: v })}
      />
      <DimensionControl
        label={t('config3d.height')}
        min={rules.height.min}
        max={rules.height.max}
        valueM={config.heightM}
        onValueM={(v) => apply({ ...b, heightM: v })}
      />
      <DimensionControl
        label={t('config3d.depth')}
        min={rules.depth.min}
        max={rules.depth.max}
        valueM={config.depthM}
        onValueM={(v) => apply({ ...b, depthM: v })}
      />
    </div>
  );

  const columnsControl = (
    <div className="flex flex-wrap items-center gap-4">
      {/* piesele cu o singura coloana posibila (noptiera) nu afiseaza deloc
          controlul — nu doar dezactivat (feedback PO 2026-07-13) */}
      {rules.maxColumns > 1 && (
        <div className="flex flex-col gap-1">
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
          {/* b7: motivul butoanelor dezactivate, sub ele */}
          {columnLimitLines.map((line) => (
            <p key={line} className="max-w-64 text-meta text-muted-foreground" data-testid="column-limit-reason">
              {line}
            </p>
          ))}
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
              onClick={() => apply({ ...b, finish })}
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
                apply({ ...b, finish: 'CUSTOM', customColor: e.target.value })
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
          apply({ ...b, frontStyle: style as PieceConfig3d['frontStyle'] })
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
          onSelect={(base) => apply({ ...b, legs: base === 'LEGS' ? true : undefined })}
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
            apply({ ...b, doorMode: mode === 'SLIDING' ? 'SLIDING' : undefined });
            setOpenZones(new Set());
          }}
        />
      )}
      {/* la 1 sau 4+ coloane optiunea de glisare nu exista — explicam de ce */}
      {rules.slidingDoors && !sliding && !canSlide && !slidingLost && (
        <p className="text-meta text-muted-foreground">{msg.slidingNeeds}</p>
      )}
      {/* b7: ce s-a scos din alegerile clientului si de ce; revine singur
          cand regula nu mai e incalcata (intentia se pastreaza) */}
      {/* regiunea live sta montata mereu (goala fara motive), ca motivele
          noi sa fie anuntate de cititoarele de ecran */}
      <div
        role="status"
        aria-live="polite"
        className={cleanupLines.length > 0 ? 'basis-full text-meta text-muted-foreground' : 'sr-only'}
        data-testid="cleanup-reasons"
      >
        {cleanupLines.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {cleanupLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
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
                    minCm={cmExact(COLUMN_W_MIN)}
                    maxCm={cmExact(COLUMN_W_MAX)}
                    valueCm={cmExact(layout[ci].width)}
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
                    <ZoneCountInput
                      max={max}
                      value={zone.count ?? 1}
                      label={t('config3d.countLabel')}
                      onValue={(v) => updateZone({ col: ci, zone: zi }, { count: v })}
                    />
                  )}
                  {resolved && (
                    <LockableSize
                      label={t('config3d.rowHeight')}
                      minCm={cmExact(ZONE_H_MIN)}
                      maxCm={cmExact(columnInnerH(ci))}
                      valueCm={cmExact(resolved.height)}
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
              onFrontSettled={onFrontSettled}
              onZoneClick={(ref) => {
                // click pe zona: o selecteaza; daca are usa/sertare, le deschide
                // sau le inchide (NU mai cicleaza tipul — tipul se alege din bara)
                setActiveZone(ref);
                toggleZone(ref);
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
