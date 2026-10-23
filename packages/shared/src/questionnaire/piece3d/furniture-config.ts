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

export const bedOptionsSchema = z.object({
  mattressSize: z.enum(BED_MATTRESS_SIZES),
  storage: z.enum(BED_STORAGES),
  upholstered: z.boolean(),
}).strict();
export const tableOptionsSchema = z.object({
  type: z.enum(TABLE_TYPES),
  shape: z.enum(TABLE_SHAPES),
  seats: z.enum(TABLE_SEATS).optional(),
}).strict();
export const benchOptionsSchema = z.object({
  style: z.enum(BENCH_STYLES),
  upholsteredSeat: z.boolean(),
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

// Gabaritul include cadrul. Dimensiunile saltelei raman separate pentru oferta/scoring.
export function bedFootprint(bed: BedOptions3d): { widthM: number; depthM: number } {
  const rail = bed.upholstered ? 0.09 : 0.045;
  return {
    widthM: Math.round((BED_MATTRESS_WIDTH[bed.mattressSize] + rail * 2 + 0.04) * 1000) / 1000,
    depthM: 2.2,
  };
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
  delete next.handleStyle;
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
    const widthM = table.shape === 'ROUND' ? clamp(config.widthM, 0.7, 1.8) : clamp(config.widthM, limits.min, limits.max);
    return { ...next, widthM, depthM: table.shape === 'ROUND' ? widthM : clamp(config.depthM, 0.4, 1.2), heightM: TABLE_HEIGHT[table.type], table };
  }
  const bench = benchOptionsSchema.parse(config.bench ?? defaultFurnitureConfig('BENCH').bench);
  return { ...next, widthM: clamp(config.widthM, 0.6, 2), heightM: 0.45, depthM: 0.4, bench };
}

export function validFurnitureConfig(kind: Piece3dKind, config: PieceConfig3d): boolean {
  if (!isFurnitureKind(kind)) return !config.bed && !config.table && !config.bench;
  if (config.columns.length || config.frontStyle !== undefined || config.handleStyle !== undefined || config.doorMode !== undefined || config.legs !== undefined) return false;
  if ((kind === 'BED') !== !!config.bed || (kind === 'TABLE') !== !!config.table || (kind === 'BENCH') !== !!config.bench) return false;
  const canonical = normalizeFurnitureConfig(kind, config);
  return Math.abs(canonical.widthM - config.widthM) < 1e-6 &&
    Math.abs(canonical.depthM - config.depthM) < 1e-6 &&
    Math.abs(canonical.heightM - config.heightM) < 1e-6 &&
    canonical.table?.type === config.table?.type && canonical.table?.shape === config.table?.shape && canonical.table?.seats === config.table?.seats;
}
