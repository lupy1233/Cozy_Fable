import { z } from 'zod';
import type { Piece3dKind, PieceConfig3d, Piece3dRules } from './config';

export const NEW_PIECE_KINDS = ['SIDEBOARD', 'WALL_CABINET', 'BATHROOM_VANITY', 'ENTRYWAY', 'SOFA', 'ARMCHAIR', 'OTTOMAN'] as const;
export const UPHOLSTERY_FABRICS = ['WOVEN', 'BOUCLE', 'VELVET'] as const;
export const SEAT_FIRMNESSES = ['SOFT', 'MEDIUM', 'FIRM'] as const;
export const SEATING_BASES = ['OAK', 'WALNUT', 'BLACK', 'PLINTH'] as const;
export const SOFA_LAYOUTS = ['STRAIGHT', 'CHAISE_LEFT', 'CHAISE_RIGHT'] as const;
export const upholsterySchema = z.object({
  fabric: z.enum(UPHOLSTERY_FABRICS), color: z.string().regex(/^#[0-9a-f]{6}$/i),
  firmness: z.enum(SEAT_FIRMNESSES), base: z.enum(SEATING_BASES),
}).strict();
export const sofaSchema = z.object({ seats: z.number().int().min(2).max(4), layout: z.enum(SOFA_LAYOUTS), bodyDepthM: z.number().min(0.8).max(1.15),
  arms: z.enum(['SLIM', 'WIDE']), cushions: z.enum(['SPLIT', 'BENCH']), chaiseDepthM: z.number().min(1.35).max(2),
}).strict();
export const armchairSchema = z.object({ arms: z.enum(['SLIM', 'WIDE']) }).strict();
export const ottomanSchema = z.object({ shape: z.enum(['RECTANGULAR', 'ROUND']), storage: z.boolean() }).strict();
export const vanitySchema = z.object({ mounting: z.enum(['WALL', 'FLOOR']), basins: z.enum(['SINGLE', 'DOUBLE']),
  storage: z.enum(['DRAWERS', 'DOORS', 'OPEN']), handles: z.enum(['PUSH', 'HANDLE']), countertop: z.enum(['LIGHT', 'DARK']),
}).strict();
export const entrywaySchema = z.object({ hooks: z.number().int().min(2).max(6), mirror: z.enum(['NONE', 'LEFT', 'RIGHT']),
  upperShelf: z.boolean(), upholsteredSeat: z.boolean(), shoeStorage: z.enum(['OPEN', 'DOORS']),
}).strict();
export type Upholstery3d = z.infer<typeof upholsterySchema>;
export type Sofa3d = z.infer<typeof sofaSchema>;
export type Armchair3d = z.infer<typeof armchairSchema>;
export type Ottoman3d = z.infer<typeof ottomanSchema>;
export type Vanity3d = z.infer<typeof vanitySchema>;
export type Entryway3d = z.infer<typeof entrywaySchema>;

const rule = (name: string, w: [number, number, number], h: [number, number, number], d: [number, number, number]): Piece3dRules => ({
  itemName: name, width: { min: w[0], max: w[1], default: w[2] }, height: { min: h[0], max: h[1], default: h[2] },
  depth: { min: d[0], max: d[1], default: d[2] }, zoneTypes: [], maxZonesPerColumn: 0, maxColumns: 0, minColumns: 0,
  hasPlinth: false, defaultColumn: () => ({ zones: [] }),
});
// Limite de previzualizare; fezabilitatea de executie se confirma in oferta.
export const NEW_PIECE_RULES: Record<typeof NEW_PIECE_KINDS[number], Piece3dRules> = {
  SIDEBOARD: { ...rule('Bufet', [0.6, 3, 1.8], [0.6, 1.2, 0.85], [0.3, 0.6, 0.45]),
    zoneTypes: ['DOOR', 'DRAWERS', 'OPEN'], maxZonesPerColumn: 3, maxColumns: 6, minColumns: 1, hasPlinth: true, legsOption: true,
    defaultColumn: () => ({ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 1 }] }) },
  WALL_CABINET: { ...rule('Corp suspendat', [0.4, 3, 1.2], [0.3, 1.2, 0.6], [0.2, 0.5, 0.35]),
    zoneTypes: ['DOOR', 'OPEN'], maxZonesPerColumn: 3, maxColumns: 6, minColumns: 1,
    defaultColumn: () => ({ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 1 }] }) },
  BATHROOM_VANITY: rule('Mobilier lavoar', [0.6, 2, 1], [0.5, 0.95, 0.65], [0.4, 0.6, 0.5]),
  ENTRYWAY: rule('Mobilier hol', [0.8, 2.4, 1.4], [1.6, 2.4, 2], [0.35, 0.55, 0.42]),
  SOFA: rule('Canapea', [1.4, 3.4, 2.2], [0.75, 1.05, 0.85], [0.8, 2, 0.95]),
  ARMCHAIR: rule('Fotoliu', [0.7, 1.3, 0.9], [0.75, 1.05, 0.85], [0.8, 1.15, 0.9]),
  OTTOMAN: rule('Taburet tapitat', [0.4, 1.4, 0.8], [0.35, 0.5, 0.43], [0.4, 1.4, 0.6]),
};

export function isNewFurnitureKind(kind: Piece3dKind): boolean {
  return kind === 'BATHROOM_VANITY' || kind === 'ENTRYWAY' || kind === 'SOFA' || kind === 'ARMCHAIR' || kind === 'OTTOMAN';
}
export function pieceElevation(config: Pick<PieceConfig3d, 'mountingHeightM'>): number { return config.mountingHeightM ?? 0; }
// Gabaritul canapelei include sezlongul; adancimea corpului ramane o optiune separata.
export function pieceDepth(config: Pick<PieceConfig3d, 'depthM' | 'sofa'>): number {
  return config.depthM;
}
export function defaultNewFurniture(kind: Piece3dKind): PieceConfig3d {
  const r = NEW_PIECE_RULES[kind as keyof typeof NEW_PIECE_RULES];
  if (!r || !isNewFurnitureKind(kind)) throw new Error(`Unsupported furniture: ${kind}`);
  const base: PieceConfig3d = { widthM: r.width.default, heightM: r.height.default, depthM: r.depth.default, columns: [], finish: 'STEJAR' };
  const upholstery: Upholstery3d = { fabric: 'WOVEN', color: '#a69d8e', firmness: 'MEDIUM', base: 'OAK' };
  if (kind === 'BATHROOM_VANITY') return { ...base, mountingHeightM: 0.2, vanity: { mounting: 'WALL', basins: 'SINGLE', storage: 'DRAWERS', handles: 'PUSH', countertop: 'LIGHT' } };
  if (kind === 'ENTRYWAY') return { ...base, entryway: { hooks: 4, mirror: 'RIGHT', upperShelf: true, upholsteredSeat: true, shoeStorage: 'OPEN' } };
  if (kind === 'SOFA') return { ...base, upholstery, sofa: { seats: 3, layout: 'STRAIGHT', bodyDepthM: 0.95, arms: 'SLIM', cushions: 'SPLIT', chaiseDepthM: 1.6 } };
  if (kind === 'ARMCHAIR') return { ...base, upholstery, armchair: { arms: 'SLIM' } };
  return { ...base, upholstery, ottoman: { shape: 'RECTANGULAR', storage: false } };
}
const clamp = (v: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)) * 1000) / 1000;
export function normalizeNewFurniture(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  const r = NEW_PIECE_RULES[kind as keyof typeof NEW_PIECE_RULES];
  const defaults = defaultNewFurniture(kind);
  const next: PieceConfig3d = { widthM: clamp(config.widthM, r.width.min, r.width.max), heightM: clamp(config.heightM, r.height.min, r.height.max),
    depthM: clamp(config.depthM, r.depth.min, r.depth.max), columns: [], finish: config.finish, ...(config.customColor ? { customColor: config.customColor } : {}) };
  if (kind === 'BATHROOM_VANITY') {
    next.vanity = vanitySchema.parse(config.vanity ?? defaults.vanity);
    if (next.vanity.basins === 'DOUBLE') next.widthM = Math.max(1.2, next.widthM);
    if (next.vanity.mounting === 'WALL') next.mountingHeightM = clamp(config.mountingHeightM ?? 0.2, 0.1, 0.6);
    else next.heightM = Math.max(0.8, next.heightM);
  }
  if (kind === 'ENTRYWAY') next.entryway = entrywaySchema.parse(config.entryway ?? defaults.entryway);
  if (kind === 'SOFA' || kind === 'ARMCHAIR' || kind === 'OTTOMAN') next.upholstery = upholsterySchema.parse(config.upholstery ?? defaults.upholstery);
  if (kind === 'SOFA') {
    next.sofa = sofaSchema.parse(config.sofa ?? defaults.sofa);
    next.depthM = next.sofa.layout === 'STRAIGHT' ? next.sofa.bodyDepthM : next.sofa.chaiseDepthM;
    if (next.sofa.layout !== 'STRAIGHT') next.sofa.cushions = 'SPLIT';
    next.widthM = Math.max(next.widthM, next.sofa.seats * 0.5 + (next.sofa.arms === 'WIDE' ? 0.44 : 0.24));
  }
  if (kind === 'ARMCHAIR') {
    next.armchair = armchairSchema.parse(config.armchair ?? defaults.armchair);
    next.widthM = Math.max(next.widthM, next.armchair.arms === 'WIDE' ? 0.94 : 0.74);
  }
  if (kind === 'OTTOMAN') {
    next.ottoman = ottomanSchema.parse(config.ottoman ?? defaults.ottoman);
    if (next.ottoman.shape === 'ROUND') next.depthM = next.widthM;
  }
  return next;
}

export function validCatalogOptions(kind: Piece3dKind, config: PieceConfig3d): boolean {
  if ((kind === 'BATHROOM_VANITY') !== !!config.vanity || (kind === 'ENTRYWAY') !== !!config.entryway ||
    (kind === 'SOFA') !== !!config.sofa || (kind === 'ARMCHAIR') !== !!config.armchair || (kind === 'OTTOMAN') !== !!config.ottoman ||
    (kind === 'SOFA' || kind === 'ARMCHAIR' || kind === 'OTTOMAN') !== !!config.upholstery) return false;
  if (kind !== 'WALL_CABINET' && !(kind === 'BATHROOM_VANITY' && config.vanity?.mounting === 'WALL') && config.mountingHeightM !== undefined) return false;
  if (kind === 'WALL_CABINET' && (config.mountingHeightM === undefined || config.mountingHeightM < 0.3)) return false;
  if (isNewFurnitureKind(kind)) {
    const canonical = normalizeNewFurniture(kind, config);
    return canonical.widthM === config.widthM && canonical.heightM === config.heightM && canonical.depthM === config.depthM && canonical.mountingHeightM === config.mountingHeightM && canonical.sofa?.cushions === config.sofa?.cushions;
  }
  return true;
}

export function describeCatalogOptions(config: PieceConfig3d): string[] {
  const parts: string[] = [];
  const label = (value: string) => ({ WOVEN: 'tesatura', BOUCLE: 'boucle', VELVET: 'catifea', SOFT: 'moale', MEDIUM: 'medie', FIRM: 'ferma',
    OAK: 'picioare stejar', WALNUT: 'picioare nuc', BLACK: 'picioare negre', PLINTH: 'baza retrasa', STRAIGHT: 'dreapta', CHAISE_LEFT: 'sezlong stanga (din fata)', CHAISE_RIGHT: 'sezlong dreapta (din fata)',
    SLIM: 'inguste', WIDE: 'late', SPLIT: 'separate', BENCH: 'perna continua', RECTANGULAR: 'dreptunghiular', ROUND: 'rotund', WALL: 'suspendat', FLOOR: 'pe podea', SINGLE: 'un lavoar', DOUBLE: 'doua lavoare',
    DRAWERS: 'sertare', DOORS: 'usi', OPEN: 'deschis', PUSH: 'push', HANDLE: 'manere', LIGHT: 'deschis', DARK: 'inchis', NONE: 'fara', LEFT: 'stanga', RIGHT: 'dreapta' } as Record<string, string>)[value] ?? value;
  const u = config.upholstery;
  if (u) parts.push(`Tapiterie: ${label(u.fabric)}, ${u.color}`, `Preferinta fermitate: ${label(u.firmness)}`, `Baza: ${label(u.base)}`);
  if (config.sofa) parts.push(`Locuri: ${config.sofa.seats}`, `Canapea: ${label(config.sofa.layout)}`, `Brate: ${label(config.sofa.arms)}`, `Perne: ${label(config.sofa.cushions)}`, `Adancime corp principal: ${Math.round(config.sofa.bodyDepthM * 100)} cm`,
    ...(config.sofa.layout === 'STRAIGHT' ? [] : [`Adancime totala sezlong: ${Math.round(pieceDepth(config) * 100)} cm`]));
  if (config.armchair) parts.push(`Brate: ${label(config.armchair.arms)}`);
  if (config.ottoman) parts.push(`Forma: ${label(config.ottoman.shape)}`, `Depozitare: ${config.ottoman.storage ? 'da' : 'nu'}`);
  if (config.vanity) parts.push(`Montaj: ${label(config.vanity.mounting)}`, `Lavoare: ${label(config.vanity.basins)}`, `Depozitare: ${label(config.vanity.storage)}`,
    ...(config.vanity.storage === 'OPEN' ? [] : [`Fronturi: ${label(config.vanity.handles)}`]), `Blat: ${label(config.vanity.countertop)}`, 'Pozitia instalatiilor se confirma la masuratori');
  if (config.entryway) parts.push(`Cuiere: ${config.entryway.hooks}`, `Oglinda: ${label(config.entryway.mirror)}`, `Polita superioara: ${config.entryway.upperShelf ? 'da' : 'nu'}`, `Sezut tapitat: ${config.entryway.upholsteredSeat ? 'da' : 'nu'}`, `Pantofar: ${label(config.entryway.shoeStorage)}`);
  if (config.mountingHeightM !== undefined) parts.push(`Cota inferioara montaj: ${Math.round(config.mountingHeightM * 100)} cm`);
  return parts;
}
