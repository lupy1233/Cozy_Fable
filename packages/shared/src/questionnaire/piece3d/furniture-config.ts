import { z } from 'zod';
import type { Piece3dKind, PieceConfig3d } from './config';
import { isNewFurnitureKind, defaultNewFurniture, normalizeNewFurniture } from './catalog-config';

export const BED_MATTRESS_SIZES = ['S_90', 'M_140', 'Q_160', 'K_180'] as const;
export const BED_MATTRESS_WIDTH = { S_90: 0.9, M_140: 1.4, Q_160: 1.6, K_180: 1.8 } as const;
export const BED_STORAGES = ['NONE', 'LIFT_UP', 'DRAWERS'] as const;
export const TABLE_TYPES = ['DINING', 'COFFEE', 'CONSOLE'] as const;
export const TABLE_SHAPES = ['RECTANGULAR', 'ROUND', 'EXTENDABLE'] as const;
export const TABLE_SEATS = ['FOUR', 'SIX', 'EIGHT_PLUS'] as const;
export const BENCH_STYLES = ['WITH_STORAGE', 'WITH_SHOE_SPACE', 'SIMPLE'] as const;

// Etapa 10 (c9 / c5, DESIGN §4.3 / §6): limitele campurilor noi optionale. Schema verifica doar
// plaja fiecarui camp; regulile care depind de alte campuri (lungimea deschisa fata de latime si
// doar la masa extensibila, inaltimea pe tipul mesei) stau in normalizare / validFurnitureConfig.
export const BED_CUSTOM_SIZE_LIMITS = { widthM: { min: 0.7, max: 2.2 }, lengthM: { min: 1.6, max: 2.4 } } as const;
// lungimea deschisa: latimea + 0,3 … min(latimea + 1,2; 4) — masa extensibila e doar dining (1,2–3 m)
export const TABLE_OPEN_LENGTH_ACCEPTED = { min: 1.5, max: 4 } as const;
export const TABLE_CUSTOM_HEIGHT = {
  DINING: { min: 0.7, max: 0.8 },
  COFFEE: { min: 0.3, max: 0.55 },
  CONSOLE: { min: 0.7, max: 0.9 },
} as const;
// plaja acceptata de schema = reuniunea intervalelor pe tip
export const TABLE_CUSTOM_HEIGHT_ACCEPTED = { min: 0.3, max: 0.9 } as const;
export const BENCH_CUSTOM_HEIGHT = { min: 0.35, max: 0.55 } as const;

const rangeM = (r: { min: number; max: number }) =>
  z
    .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
    .min(r.min, 'validation.dimensionOutOfRange')
    .max(r.max, 'validation.dimensionOutOfRange');

export const bedOptionsSchema = z.object({
  // obligatoriu (cererile vechi). Cu customSize (etapa 10) ramane salvata ultima marime standard,
  // dar NU mai e folosita: gabaritul, geometria, descrierea, chips si costul citesc intai customSize
  mattressSize: z.enum(BED_MATTRESS_SIZES),
  storage: z.enum(BED_STORAGES),
  upholstered: z.boolean(),
  // etapa 10 (BED_CUSTOM_SIZE): "Alta marime" de saltea; lipsa = marimea standard din mattressSize
  customSize: z
    .object({ widthM: rangeM(BED_CUSTOM_SIZE_LIMITS.widthM), lengthM: rangeM(BED_CUSTOM_SIZE_LIMITS.lengthM) })
    .strict()
    .optional(),
}).strict();
export const tableOptionsSchema = z.object({
  type: z.enum(TABLE_TYPES),
  shape: z.enum(TABLE_SHAPES),
  seats: z.enum(TABLE_SEATS).optional(),
  // etapa 10 (TABLE_OPEN_LENGTH): lungimea mesei extensibile deschise; lipsa = nespecificata
  openLengthM: rangeM(TABLE_OPEN_LENGTH_ACCEPTED).optional(),
  // etapa 10 (TABLE_CUSTOM_HEIGHT): inaltimea dorita; lipsa = TABLE_HEIGHT[type]
  customHeightM: rangeM(TABLE_CUSTOM_HEIGHT_ACCEPTED).optional(),
}).strict();
export const benchOptionsSchema = z.object({
  style: z.enum(BENCH_STYLES),
  upholsteredSeat: z.boolean(),
  // etapa 10 (BENCH_CUSTOM_HEIGHT): inaltimea dorita; lipsa = 0,45 m
  customHeightM: rangeM(BENCH_CUSTOM_HEIGHT).optional(),
}).strict();
export type BedOptions3d = z.infer<typeof bedOptionsSchema>;
export type TableOptions3d = z.infer<typeof tableOptionsSchema>;
export type BenchOptions3d = z.infer<typeof benchOptionsSchema>;

export function isFurnitureKind(kind: Piece3dKind): boolean {
  return kind === 'BED' || kind === 'TABLE' || kind === 'BENCH' || isNewFurnitureKind(kind);
}

export const TABLE_HEIGHT = { DINING: 0.75, COFFEE: 0.45, CONSOLE: 0.8 } as const;
export const TABLE_LENGTH_LIMITS = {
  DINING: { min: 1.2, max: 3 }, COFFEE: { min: 0.5, max: 1.5 }, CONSOLE: { min: 0.6, max: 2 },
} as const;
// Etapa 9 (l1): diametrul mesei rotunde pe tip, aplicat la creare/editare (edit-rules.ts).
export const TABLE_ROUND_DIAMETER = {
  DINING: { min: 0.8, max: 1.6 },
  COFFEE: { min: 0.5, max: 1.0 },
  CONSOLE: { min: 0.6, max: 1.0 },
} as const;
// Plaja ACCEPTATA la validare pentru masa rotunda: vechea 70-180 cm (cererile publicate raman
// valide), largita in jos doar cat cer minimele noi (cafea 50, consola 60).
const tableRoundAcceptedMin = (type: keyof typeof TABLE_ROUND_DIAMETER) =>
  Math.min(0.7, TABLE_ROUND_DIAMETER[type].min);

// Gabaritul include cadrul. Dimensiunile saltelei raman separate pentru oferta/scoring.
// Etapa 10 (BED_CUSTOM_SIZE): cu "Alta marime" latimea vine din customSize.widthM, iar adancimea
// = lungimea saltelei + 20 cm (2,2 m la salteaua standard de 200). Fara customSize: ca inainte.
export function bedFootprint(bed: BedOptions3d): { widthM: number; depthM: number } {
  const rail = bed.upholstered ? 0.09 : 0.045;
  const mattressW = bed.customSize?.widthM ?? BED_MATTRESS_WIDTH[bed.mattressSize];
  return {
    widthM: Math.round((mattressW + rail * 2 + 0.04) * 1000) / 1000,
    depthM: bed.customSize ? Math.round((bed.customSize.lengthM + 0.2) * 1000) / 1000 : 2.2,
  };
}

// Etapa 10 (TABLE_OPEN_LENGTH): lungimea deschisa a mesei extensibile, fata de lungimea inchisa.
export function tableOpenLengthRange(widthM: number): { min: number; max: number } {
  return {
    min: Math.round((widthM + 0.3) * 1000) / 1000,
    max: Math.round(Math.min(widthM + 1.2, TABLE_OPEN_LENGTH_ACCEPTED.max) * 1000) / 1000,
  };
}

// Etapa 10: inaltimea mesei (TABLE_CUSTOM_HEIGHT) e valabila doar in intervalul tipului ei.
export function tableCustomHeightFits(type: TableOptions3d['type'], heightM: number): boolean {
  const r = TABLE_CUSTOM_HEIGHT[type];
  return heightM >= r.min - 1e-9 && heightM <= r.max + 1e-9;
}

// Etapa 10: textele pentru firma ale campurilor noi (doar cand campul exista — descrierile
// configuratiilor vechi raman identice).
export function describeFurnitureOptions(config: PieceConfig3d): string[] {
  const cm = (v: number) => Math.round(v * 100);
  const parts: string[] = [];
  const size = config.bed?.customSize;
  if (size) parts.push(`Saltea: ${cm(size.widthM)} × ${cm(size.lengthM)} cm (altă mărime)`);
  if (config.table?.openLengthM !== undefined) parts.push(`Lungime deschisă: ${cm(config.table.openLengthM)} cm`);
  if (config.table?.customHeightM !== undefined) parts.push(`Înălțime: ${cm(config.table.customHeightM)} cm`);
  if (config.bench?.customHeightM !== undefined) parts.push(`Înălțime: ${cm(config.bench.customHeightM)} cm`);
  return parts;
}

export function defaultFurnitureConfig(kind: Piece3dKind): PieceConfig3d {
  if (isNewFurnitureKind(kind)) return defaultNewFurniture(kind);
  const base = { widthM: 1.4, heightM: 0.75, depthM: 0.8, columns: [], finish: 'STEJAR' as const };
  if (kind === 'BED') {
    const bed: BedOptions3d = { mattressSize: 'Q_160', storage: 'NONE', upholstered: false };
    return { ...base, ...bedFootprint(bed), heightM: 1, bed };
  }
  if (kind === 'TABLE') return { ...base, table: { type: 'DINING', shape: 'RECTANGULAR', seats: 'SIX' } };
  return { ...base, widthM: 1.2, heightM: 0.45, depthM: 0.4, bench: { style: 'SIMPLE', upholsteredSeat: false } };
}

export function normalizeFurnitureConfig(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  if (isNewFurnitureKind(kind)) return normalizeNewFurniture(kind, config);
  const next = { ...config, columns: [] };
  delete next.frontStyle;
  delete next.doorMode;
  delete next.legs;
  delete next.bed;
  delete next.table;
  delete next.bench;
  delete next.vanity;
  delete next.entryway;
  delete next.sofa;
  delete next.armchair;
  delete next.ottoman;
  delete next.upholstery;
  delete next.mountingHeightM;
  const clamp = (v: number, min: number, max: number) =>
    Math.round(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)) * 1000) / 1000;
  if (kind === 'BED') {
    const bed = bedOptionsSchema.parse(config.bed ?? defaultFurnitureConfig('BED').bed);
    return { ...next, ...bedFootprint(bed), heightM: 1, bed };
  }
  if (kind === 'TABLE') {
    const table = tableOptionsSchema.parse(config.table ?? defaultFurnitureConfig('TABLE').table);
    if (table.type !== 'DINING') {
      if (table.shape === 'EXTENDABLE') table.shape = 'RECTANGULAR';
      delete table.seats;
    } else table.seats ??= 'SIX';
    const limits = TABLE_LENGTH_LIMITS[table.type];
    const widthM = table.shape === 'ROUND' ? clamp(config.widthM, tableRoundAcceptedMin(table.type), 1.8) : clamp(config.widthM, limits.min, limits.max);
    // etapa 10: lungimea deschisa doar la masa extensibila, in intervalul fata de lungimea inchisa
    if (table.shape !== 'EXTENDABLE') delete table.openLengthM;
    else if (table.openLengthM !== undefined) {
      const open = tableOpenLengthRange(widthM);
      table.openLengthM = clamp(table.openLengthM, open.min, open.max);
    }
    // etapa 10: inaltimea aleasa doar in intervalul tipului (la schimbarea tipului revine la implicit)
    if (table.customHeightM !== undefined) {
      if (tableCustomHeightFits(table.type, table.customHeightM)) table.customHeightM = clamp(table.customHeightM, 0, 1);
      else delete table.customHeightM;
    }
    return { ...next, widthM, depthM: table.shape === 'ROUND' ? widthM : clamp(config.depthM, 0.4, 1.2), heightM: table.customHeightM ?? TABLE_HEIGHT[table.type], table };
  }
  const bench = benchOptionsSchema.parse(config.bench ?? defaultFurnitureConfig('BENCH').bench);
  return { ...next, widthM: clamp(config.widthM, 0.6, 2), heightM: bench.customHeightM ?? 0.45, depthM: 0.4, bench };
}

const sameOptional = (a: number | undefined, b: number | undefined) =>
  a === undefined ? b === undefined : b !== undefined && Math.abs(a - b) < 1e-6;

export function validFurnitureConfig(kind: Piece3dKind, config: PieceConfig3d): boolean {
  if (!isFurnitureKind(kind)) return !config.bed && !config.table && !config.bench;
  if (config.columns.length || config.frontStyle !== undefined || config.doorMode !== undefined || config.legs !== undefined) return false;
  if ((kind === 'BED') !== !!config.bed || (kind === 'TABLE') !== !!config.table || (kind === 'BENCH') !== !!config.bench) return false;
  // etapa 10: o optiune in afara plajei (ex. inaltimea bancutei) e deja o eroare a schemei; aici
  // doar nu lasam curatarea sa arunce in mijlocul validarii
  let canonical: PieceConfig3d;
  try {
    canonical = normalizeFurnitureConfig(kind, config);
  } catch {
    return false;
  }
  return Math.abs(canonical.widthM - config.widthM) < 1e-6 &&
    Math.abs(canonical.depthM - config.depthM) < 1e-6 &&
    Math.abs(canonical.heightM - config.heightM) < 1e-6 &&
    canonical.table?.type === config.table?.type && canonical.table?.shape === config.table?.shape && canonical.table?.seats === config.table?.seats &&
    // etapa 10: lungimea deschisa (doar la extensibila, in interval) si inaltimea pe tip
    sameOptional(canonical.table?.openLengthM, config.table?.openLengthM) &&
    sameOptional(canonical.table?.customHeightM, config.table?.customHeightM);
}
