import { z } from 'zod';

// Configuratorul 3D de piese (stil Tylko) — docs/10, sprinturile R1-R6.
// Config-ul e serializabil si intra in answers ca orice raspuns de step;
// modelul 3D e GENERAT din acest config (model.ts), nu desenat manual.
// Materialul autoritativ ramane intrebarea de material a flow-ului (R3);
// `finish` de aici e doar paleta vizuala a randarii (R4).

export const PIECE3D_KINDS = [
  'BOOKCASE',
  'WARDROBE',
  'TV_UNIT',
  'SHOE_CABINET',
  'DRESSER',
  'NIGHTSTAND',
  'DESK',
] as const;
export type Piece3dKind = (typeof PIECE3D_KINDS)[number];

// R5.3 (cerinta PO): tipurile ACTIVE de zona sunt DOAR OPEN/DRAWERS/DOOR.
// SHELVES/HANGING/TILT_OUT raman in enum numai pentru datele salvate inainte
// de R5.3 — normalizePieceConfig le migreaza (SHELVES→OPEN+fill, HANGING→
// OPEN+fill, TILT_OUT→DRAWERS); schema noua NU le mai accepta la publish.
export const PIECE3D_ZONE_TYPES = [
  'OPEN',
  'SHELVES',
  'DRAWERS',
  'DOOR',
  'HANGING',
  'TILT_OUT',
] as const;
export type Piece3dZoneType = (typeof PIECE3D_ZONE_TYPES)[number];

// Continutul interior al zonelor OPEN/DOOR (R5.3): polite sau bara de haine.
export const PIECE3D_ZONE_FILLS = ['SHELVES', 'HANGING'] as const;
export type Piece3dZoneFill = (typeof PIECE3D_ZONE_FILLS)[number];

// Finisaje vizuale (culoare + rugozitate in frontend; fara texturi in MVP).
export const PIECE3D_FINISHES = ['ALB', 'STEJAR', 'NUC', 'GRI', 'VERDE_SALVIE'] as const;
export type Piece3dFinish = (typeof PIECE3D_FINISHES)[number];

export const DRAWERS_COUNT_MAX = 6;
export const SHELVES_COUNT_MAX = 8;

// Reguli geometrice (cerinte PO R5.3):
// - bara de haine cere adancime >= 55cm si 80cm de inaltime PER BARA
//   (R5.4: pana la 3 bare suprapuse intr-o zona, daca inaltimea permite)
// - sertarele nu au sens cu marginea de sus peste 160cm (nu ajungi la ele)
export const HANGING_MIN_DEPTH = 0.55;
export const HANGING_MIN_ZONE_H = 0.8;
export const HANGING_COUNT_MAX = 3;
export const DRAWERS_MAX_TOP = 1.6;
// inaltimea minima a unui rand (zona) rezultata din impartire
export const ZONE_H_MIN = 0.1;
// toleranta comparatiilor geometrice (5mm) — partajata FE/BE
export const GEOM_EPS = 0.005;

export interface Piece3dZone {
  type: Piece3dZoneType;
  // OPEN/DOOR: continutul interior — polite sau bara de haine (lipsa = gol)
  fill?: Piece3dZoneFill;
  // DRAWERS: numarul de sertare; fill SHELVES: numarul de polite;
  // fill HANGING: numarul de bare suprapuse (optional, implicit 1)
  count?: number;
  // inaltime BLOCATA (m): randul ramane fix cand restul se redistribuie;
  // lipsa = imparte egal spatiul ramas cu celelalte randuri libere
  heightM?: number;
}

export interface Piece3dColumn {
  zones: Piece3dZone[];
  // latime BLOCATA (m); lipsa = imparte egal spatiul ramas
  widthM?: number;
}

export interface PieceConfig3d {
  widthM: number;
  heightM: number;
  depthM: number;
  // coloanele de la stanga la dreapta; zonele unei coloane de sus in jos
  columns: Piece3dColumn[];
  finish: Piece3dFinish;
}

// Plafonul de elemente numarabile ale unei zone; undefined = zona nu are
// elemente numarabile (count interzis).
export function zoneCountMax(zone: Pick<Piece3dZone, 'type' | 'fill'>): number | undefined {
  if (zone.type === 'DRAWERS' || zone.type === 'TILT_OUT') return DRAWERS_COUNT_MAX;
  if (zone.type === 'SHELVES' || zone.fill === 'SHELVES') return SHELVES_COUNT_MAX;
  if (zone.fill === 'HANGING') return HANGING_COUNT_MAX;
  return undefined;
}

// Cate bare de haine incap intr-o zona de inaltimea data (80cm per bara);
// 0 = bara nu incape deloc (fill-ul HANGING e invalid acolo).
export function hangingCountFor(zoneHeightM: number): number {
  return Math.min(
    HANGING_COUNT_MAX,
    Math.floor((zoneHeightM + GEOM_EPS) / HANGING_MIN_ZONE_H),
  );
}

interface DimRule {
  min: number;
  max: number;
  default: number;
}

export interface Piece3dRules {
  width: DimRule;
  height: DimRule;
  depth: DimRule;
  // tipurile de zona permise piesei (primul = implicitul la zona noua)
  zoneTypes: Piece3dZoneType[];
  maxZonesPerColumn: number;
  maxColumns: number;
  // DESK: coloanele sunt casetiere sub blat (0 = birou doar pe picioare)
  minColumns: number;
  hasPlinth: boolean;
  // numele itemului derivat (RO, ca in flow-urile existente)
  itemName: string;
  // coloanele implicite ale unei piese noi (functie de nr. de coloane sugerat)
  defaultColumn: () => Piece3dColumn;
}

const col = (...zones: Piece3dZone[]): Piece3dColumn => ({ zones });

export const PIECE3D_RULES: Record<Piece3dKind, Piece3dRules> = {
  BOOKCASE: {
    width: { min: 0.4, max: 4, default: 1.6 },
    height: { min: 0.8, max: 2.8, default: 2.0 },
    depth: { min: 0.2, max: 0.5, default: 0.35 },
    zoneTypes: ['OPEN', 'DRAWERS', 'DOOR'],
    maxZonesPerColumn: 4,
    maxColumns: 6,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Biblioteca',
    defaultColumn: () => col({ type: 'OPEN', fill: 'SHELVES', count: 4 }),
  },
  WARDROBE: {
    width: { min: 0.6, max: 6, default: 2.4 },
    height: { min: 1.8, max: 2.8, default: 2.4 },
    depth: { min: 0.35, max: 0.8, default: 0.6 },
    zoneTypes: ['OPEN', 'DRAWERS', 'DOOR'],
    maxZonesPerColumn: 4,
    maxColumns: 8,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Dulap',
    defaultColumn: () => col({ type: 'OPEN', fill: 'HANGING' }, { type: 'DRAWERS', count: 2 }),
  },
  TV_UNIT: {
    width: { min: 1, max: 3.6, default: 1.8 },
    height: { min: 0.25, max: 0.9, default: 0.45 },
    depth: { min: 0.3, max: 0.6, default: 0.4 },
    zoneTypes: ['OPEN', 'DRAWERS', 'DOOR'],
    maxZonesPerColumn: 2,
    maxColumns: 6,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Comoda TV',
    defaultColumn: () => col({ type: 'OPEN' }),
  },
  SHOE_CABINET: {
    width: { min: 0.5, max: 1.6, default: 0.8 },
    height: { min: 0.5, max: 1.8, default: 1.2 },
    depth: { min: 0.2, max: 0.4, default: 0.3 },
    zoneTypes: ['DOOR', 'DRAWERS', 'OPEN'],
    maxZonesPerColumn: 3,
    maxColumns: 3,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Pantofar',
    defaultColumn: () => col({ type: 'DOOR', fill: 'SHELVES', count: 3 }),
  },
  DRESSER: {
    width: { min: 0.4, max: 2.4, default: 1.2 },
    height: { min: 0.5, max: 1.4, default: 0.9 },
    depth: { min: 0.35, max: 0.6, default: 0.45 },
    zoneTypes: ['DRAWERS', 'DOOR', 'OPEN'],
    maxZonesPerColumn: 3,
    maxColumns: 4,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Comoda',
    defaultColumn: () => col({ type: 'DRAWERS', count: 3 }),
  },
  NIGHTSTAND: {
    width: { min: 0.3, max: 0.8, default: 0.45 },
    height: { min: 0.3, max: 0.8, default: 0.55 },
    depth: { min: 0.3, max: 0.5, default: 0.4 },
    zoneTypes: ['DRAWERS', 'OPEN', 'DOOR'],
    maxZonesPerColumn: 3,
    maxColumns: 1,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Noptiera',
    defaultColumn: () => col({ type: 'DRAWERS', count: 1 }, { type: 'OPEN' }),
  },
  DESK: {
    width: { min: 0.8, max: 2.4, default: 1.4 },
    height: { min: 0.68, max: 0.8, default: 0.75 },
    depth: { min: 0.5, max: 0.8, default: 0.6 },
    zoneTypes: ['DRAWERS', 'OPEN', 'DOOR'],
    maxZonesPerColumn: 3,
    maxColumns: 2,
    minColumns: 0,
    hasPlinth: false,
    itemName: 'Birou',
    defaultColumn: () => col({ type: 'DRAWERS', count: 3 }),
  },
};

// Grosimi si limite geometrice partajate de model + validare.
export const PANEL_T = 0.018;
export const BACK_T = 0.008;
// luft vizibil intre fronturi (stil Tylko): 4mm la margini → ~8mm intre
// doua fronturi vecine; rostul se citeste pe fundalul intunecat din spate
export const FRONT_GAP = 0.004;
export const PLINTH_H = 0.06;
// latimea casetierei de birou (coloanele DESK au latime fixa, nu impartire egala)
export const DESK_PEDESTAL_W = 0.42;
// spatiu minim pentru genunchi/scaun intre doua casetiere; sub el, a doua
// casetiera s-ar suprapune cu prima (feedback PO 2026-07-13, docs/12 S6)
export const DESK_KNEE_MIN = 0.4;

// Cate casetiere incap la latimea curenta a biroului: doua doar daca raman
// laterale + 2 casetiere + spatiul de genunchi.
export function deskMaxColumns(widthM: number): number {
  return widthM >= 2 * PANEL_T + 2 * DESK_PEDESTAL_W + DESK_KNEE_MIN - GEOM_EPS ? 2 : 1;
}
// limitele latimii unei coloane rezultate din impartire (docs/10: max ~90cm)
export const COLUMN_W_MIN = 0.22;
export const COLUMN_W_MAX = 1.0;

// Latimea interioara disponibila coloanelor.
export function interiorWidth(widthM: number): number {
  return widthM - 2 * PANEL_T;
}

// Latimea unei coloane la n coloane FARA blocaje (impartire egala) — folosita
// de euristicile de numar de coloane; latimile reale vin din resolvePieceLayout.
export function columnWidth(widthM: number, n: number): number {
  return (interiorWidth(widthM) - (n - 1) * PANEL_T) / n;
}

// Numarul de coloane sugerat din latime (~80cm per coloana, docs/10 R2),
// limitat la [minColumns, maxColumns] si la latimile valide de coloana.
export function suggestedColumns(kind: Piece3dKind, widthM: number): number {
  const rules = PIECE3D_RULES[kind];
  if (kind === 'DESK') return Math.min(1, rules.maxColumns);
  const raw = Math.round(interiorWidth(widthM) / 0.8) || 1;
  return clampColumns(kind, widthM, raw);
}

// Limiteaza n la un numar de coloane cu latime valida pentru piesa data.
export function clampColumns(kind: Piece3dKind, widthM: number, n: number): number {
  const rules = PIECE3D_RULES[kind];
  let v = Math.max(rules.minColumns || 1, Math.min(rules.maxColumns, Math.round(n)));
  if (kind === 'DESK') {
    // casetierele au latime fixa: la birouri inguste a doua nu mai incape
    const max = Math.min(rules.maxColumns, deskMaxColumns(widthM));
    return Math.max(rules.minColumns, Math.min(max, Math.round(n)));
  }
  while (v > 1 && columnWidth(widthM, v) < COLUMN_W_MIN) v--;
  while (v < rules.maxColumns && columnWidth(widthM, v) > COLUMN_W_MAX) v++;
  return v;
}

// --- Impartirea spatiului (R5.3): dimensiunile BLOCATE raman fixe, restul se
// imparte egal intre cele libere. Daca blocajele nu mai incap (gabarit micsorat
// etc.), sunt scalate proportional LA REZOLVARE — config-ul stocat pastreaza
// intentia utilizatorului, geometria ramane mereu valida.

function distribute(
  fixed: (number | undefined)[],
  avail: number,
  min: number,
  max: number,
): number[] {
  const n = fixed.length;
  if (n === 0) return [];
  const equal = () => Array.from({ length: n }, () => avail / n);
  const clamped = fixed.map((v) =>
    v === undefined ? undefined : Math.max(min, Math.min(max, v)),
  );
  const freeIdx = clamped.flatMap((v, i) => (v === undefined ? [i] : []));
  const nFree = freeIdx.length;
  let sumF = clamped.reduce<number>((s, v) => s + (v ?? 0), 0);
  if (nFree === 0) {
    // normalizarea lasa mereu >=1 dimensiune libera; fallback sigur
    return sumF > 0 ? clamped.map((v) => ((v as number) * avail) / sumF) : equal();
  }
  if (nFree === n || sumF <= 0) return equal();
  let scale = 1;
  const freeEach = (avail - sumF) / nFree;
  if (freeEach < min) {
    const target = avail - nFree * min;
    if (target <= 0) return equal();
    scale = target / sumF;
  } else if (freeEach > max) {
    const target = avail - nFree * max;
    if (target > (n - nFree) * max) return equal();
    scale = target / sumF;
  }
  const out = clamped.map((v) =>
    v === undefined ? 0 : Math.max(min, Math.min(max, v * scale)),
  );
  sumF = out.reduce((s, v) => s + v, 0);
  const rest = (avail - sumF) / nFree;
  for (const i of freeIdx) out[i] = rest;
  return out;
}

export interface ResolvedZone3d {
  top: number;
  bottom: number;
  height: number;
}

export interface ResolvedColumn3d {
  width: number;
  zones: ResolvedZone3d[];
}

// Latimile REALE ale coloanelor (blocaje respectate, restul egal).
export function resolveColumnWidths(kind: Piece3dKind, config: PieceConfig3d): number[] {
  if (kind === 'DESK') return config.columns.slice(0, 2).map(() => DESK_PEDESTAL_W);
  const n = config.columns.length;
  if (n === 0) return [];
  const avail = interiorWidth(config.widthM) - (n - 1) * PANEL_T;
  return distribute(
    config.columns.map((c) => c.widthM),
    avail,
    COLUMN_W_MIN,
    COLUMN_W_MAX,
  );
}

// Layout-ul complet: latimea fiecarei coloane + pozitia verticala a fiecarui
// rand (top/bottom absolute, podeaua la y=0) — sursa unica pentru model,
// validare si UI (afisarea dimensiunilor + regulile bara/sertare).
export function resolvePieceLayout(kind: Piece3dKind, config: PieceConfig3d): ResolvedColumn3d[] {
  const rules = PIECE3D_RULES[kind];
  const widths = resolveColumnWidths(kind, config);
  const bottom = (kind === 'DESK' ? 0.02 : rules.hasPlinth ? PLINTH_H : 0) + PANEL_T;
  const top = config.heightM - PANEL_T;
  return config.columns.map((column, i) => {
    const nz = column.zones.length;
    const availH = Math.max(0.01, top - bottom - Math.max(0, nz - 1) * PANEL_T);
    const heights = distribute(
      column.zones.map((z) => z.heightM),
      availH,
      ZONE_H_MIN,
      Number.POSITIVE_INFINITY,
    );
    let cursor = top;
    const zones = heights.map((h) => {
      const zTop = cursor;
      cursor -= h + PANEL_T;
      return { top: zTop, bottom: zTop - h, height: h };
    });
    return { width: widths[i] ?? 0, zones };
  });
}

// Config-ul implicit al unei piese noi.
export function defaultPieceConfig(kind: Piece3dKind): PieceConfig3d {
  const rules = PIECE3D_RULES[kind];
  const n = suggestedColumns(kind, rules.width.default);
  return {
    widthM: rules.width.default,
    heightM: rules.height.default,
    depthM: rules.depth.default,
    columns: Array.from({ length: n }, () => rules.defaultColumn()),
    finish: 'STEJAR',
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

// Normalizeaza config-ul dupa o schimbare de gabarit/coloane: pastreaza zonele
// existente unde se poate, migreaza formele vechi (pre-R5.3), corecteaza
// count-urile/blocajele si aplica regulile geometrice (bara/sertare).
export function normalizePieceConfig(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  const rules = PIECE3D_RULES[kind];
  const clampDim = (v: number, r: DimRule) => round3(Math.max(r.min, Math.min(r.max, v)));
  const widthM = clampDim(config.widthM, rules.width);
  const heightM = clampDim(config.heightM, rules.height);
  const depthM = clampDim(config.depthM, rules.depth);
  const n = clampColumns(kind, widthM, config.columns.length || 1);

  // migreaza zonele salvate inainte de R5.3 la forma type+fill
  const migrate = (z: Piece3dZone): Piece3dZone => {
    if (z.type === 'SHELVES') return { type: 'OPEN', fill: 'SHELVES', count: z.count ?? 1, heightM: z.heightM };
    if (z.type === 'HANGING') return { type: 'OPEN', fill: 'HANGING', heightM: z.heightM };
    if (z.type === 'TILT_OUT') return { type: 'DRAWERS', count: z.count ?? 1, heightM: z.heightM };
    if (z.type === 'DOOR' && z.fill === undefined && z.count) return { ...z, fill: 'SHELVES' };
    return z;
  };

  const columns: Piece3dColumn[] = Array.from({ length: n }, (_, i) => {
    const existing = config.columns[i];
    if (!existing) return rules.defaultColumn();
    const zones = existing.zones.slice(0, rules.maxZonesPerColumn).map((raw) => {
      const m = migrate(raw);
      const type = rules.zoneTypes.includes(m.type) ? m.type : rules.zoneTypes[0];
      const zone: Piece3dZone = { type };
      if ((type === 'OPEN' || type === 'DOOR') && m.fill && PIECE3D_ZONE_FILLS.includes(m.fill)) {
        zone.fill = m.fill;
      }
      const max = zoneCountMax(zone);
      if (max !== undefined) zone.count = Math.max(1, Math.min(max, Math.round(m.count ?? 1)));
      if (typeof m.heightM === 'number' && Number.isFinite(m.heightM)) {
        zone.heightM = round3(Math.max(ZONE_H_MIN, Math.min(heightM, m.heightM)));
      }
      return zone;
    });
    const column: Piece3dColumn = { zones: zones.length > 0 ? zones : rules.defaultColumn().zones };
    if (kind !== 'DESK' && typeof existing.widthM === 'number' && Number.isFinite(existing.widthM)) {
      column.widthM = round3(Math.max(COLUMN_W_MIN, Math.min(COLUMN_W_MAX, existing.widthM)));
    }
    return column;
  });

  // cel putin o coloana si cate un rand pe coloana raman FLEXIBILE — altfel
  // suma blocajelor nu ar mai putea urmari gabaritul piesei
  if (columns.length > 0 && columns.every((c) => c.widthM !== undefined)) {
    delete columns[columns.length - 1].widthM;
  }
  for (const column of columns) {
    if (column.zones.every((z) => z.heightM !== undefined)) {
      delete column.zones[column.zones.length - 1].heightM;
    }
  }

  const next: PieceConfig3d = {
    widthM,
    heightM,
    depthM,
    columns,
    finish: PIECE3D_FINISHES.includes(config.finish) ? config.finish : 'STEJAR',
  };

  // regulile geometrice se CORECTEAZA aici (nu se respinge): barele care nu
  // mai incap (55cm adancime, 80cm/bara) se reduc sau dispar, sertarele
  // urcate peste 160cm redevin zona deschisa
  const layout = resolvePieceLayout(kind, next);
  columns.forEach((column, ci) =>
    column.zones.forEach((zone, zi) => {
      const r = layout[ci]?.zones[zi];
      if (!r) return;
      if (zone.fill === 'HANGING') {
        const maxRods = hangingCountFor(r.height);
        if (depthM < HANGING_MIN_DEPTH - GEOM_EPS || maxRods < 1) {
          delete zone.fill;
          delete zone.count;
        } else if ((zone.count ?? 1) > maxRods) {
          zone.count = maxRods;
        }
      }
      if (zone.type === 'DRAWERS' && r.top > DRAWERS_MAX_TOP + GEOM_EPS) {
        zone.type = 'OPEN';
        delete zone.count;
      }
    }),
  );
  return next;
}

// Schema Zod a config-ului pentru o piesa data — validata identic FE/BE
// (mesajele sunt chei i18n relative la namespace-ul Configurator, ca in engine).
export function pieceConfig3dSchema(kind: Piece3dKind): z.ZodType<PieceConfig3d> {
  const rules = PIECE3D_RULES[kind];
  const zoneSchema = z
    .object({
      type: z.enum(PIECE3D_ZONE_TYPES, {
        errorMap: () => ({ message: 'validation.answerInvalid' }),
      }),
      fill: z
        .enum(PIECE3D_ZONE_FILLS, { errorMap: () => ({ message: 'validation.answerInvalid' }) })
        .optional(),
      count: z.number().int().min(1).max(SHELVES_COUNT_MAX).optional(),
      heightM: z.number().min(ZONE_H_MIN).max(rules.height.max).optional(),
    })
    .strict()
    .superRefine((zone, ctx) => {
      const bad = () =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
      if (!rules.zoneTypes.includes(zone.type)) {
        bad();
        return;
      }
      if (zone.type === 'DRAWERS') {
        // sertarele nu au continut interior; count = numarul de sertare
        if (zone.fill !== undefined) bad();
        if (zone.count === undefined || zone.count > DRAWERS_COUNT_MAX) bad();
      } else if (zone.fill === 'SHELVES') {
        if (zone.count === undefined) bad();
      } else if (zone.fill === 'HANGING') {
        // count optional (implicit 1 bara), maxim 3 bare suprapuse
        if (zone.count !== undefined && zone.count > HANGING_COUNT_MAX) bad();
      } else if (zone.count !== undefined) {
        // OPEN/DOOR goale nu au elemente numarabile
        bad();
      }
    });

  const columnSchema = z
    .object({
      zones: z.array(zoneSchema).min(1).max(rules.maxZonesPerColumn),
      widthM: z.number().min(COLUMN_W_MIN).max(COLUMN_W_MAX).optional(),
    })
    .strict();

  return z
    .object({
      widthM: z
        .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
        .min(rules.width.min, 'validation.dimensionOutOfRange')
        .max(rules.width.max, 'validation.dimensionOutOfRange'),
      heightM: z
        .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
        .min(rules.height.min, 'validation.dimensionOutOfRange')
        .max(rules.height.max, 'validation.dimensionOutOfRange'),
      depthM: z
        .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
        .min(rules.depth.min, 'validation.dimensionOutOfRange')
        .max(rules.depth.max, 'validation.dimensionOutOfRange'),
      columns: z.array(columnSchema).min(rules.minColumns).max(rules.maxColumns),
      finish: z.enum(PIECE3D_FINISHES, {
        errorMap: () => ({ message: 'validation.answerInvalid' }),
      }),
    })
    .strict('validation.unknownAnswer')
    .superRefine((config, ctx) => {
      const bad = () =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
      const layout = resolvePieceLayout(kind, config as PieceConfig3d);
      // casetierele biroului nu au voie sa se suprapuna (docs/12 S6)
      if (kind === 'DESK' && config.columns.length > deskMaxColumns(config.widthM)) {
        bad();
        return;
      }
      // latimile REZOLVATE trebuie sa fie realiste (docs/10 R2)
      if (kind !== 'DESK') {
        for (const column of layout) {
          if (column.width < COLUMN_W_MIN - GEOM_EPS || column.width > COLUMN_W_MAX + GEOM_EPS) {
            bad();
            return;
          }
        }
      }
      // regulile geometrice bara/sertare pe geometria rezolvata
      for (let ci = 0; ci < config.columns.length; ci++) {
        const zones = config.columns[ci].zones;
        for (let zi = 0; zi < zones.length; zi++) {
          const r = layout[ci]?.zones[zi];
          if (!r) continue;
          if (zones[zi].type === 'DRAWERS' && r.top > DRAWERS_MAX_TOP + GEOM_EPS) {
            bad();
            return;
          }
          if (
            zones[zi].fill === 'HANGING' &&
            (config.depthM < HANGING_MIN_DEPTH - GEOM_EPS ||
              r.height < (zones[zi].count ?? 1) * HANGING_MIN_ZONE_H - GEOM_EPS)
          ) {
            bad();
            return;
          }
        }
      }
    }) as z.ZodType<PieceConfig3d>;
}

// Totalurile config-ului (pentru descriere + chips in RoomSpecCard).
export interface Piece3dTotals {
  columns: number;
  shelves: number;
  drawers: number;
  doors: number;
  hanging: number;
  tiltOut: number;
  open: number;
}

export function pieceConfigTotals(config: PieceConfig3d): Piece3dTotals {
  const totals: Piece3dTotals = {
    columns: config.columns.length,
    shelves: 0,
    drawers: 0,
    doors: 0,
    hanging: 0,
    tiltOut: 0,
    open: 0,
  };
  const nCols = config.columns.length;
  const availW = interiorWidth(config.widthM) - (nCols - 1) * PANEL_T;
  const widths = distribute(
    config.columns.map((c) => c.widthM),
    availW,
    COLUMN_W_MIN,
    COLUMN_W_MAX,
  );
  config.columns.forEach((column, ci) => {
    for (const zone of column.zones) {
      // continutul interior (R5.3) — plus formele legacy inca nemigrate
      if (zone.fill === 'SHELVES') totals.shelves += zone.count ?? 1;
      else if (zone.fill === 'HANGING') totals.hanging += zone.count ?? 1;
      switch (zone.type) {
        case 'SHELVES':
          totals.shelves += zone.count ?? 1;
          break;
        case 'DRAWERS':
          totals.drawers += zone.count ?? 1;
          break;
        case 'DOOR':
          // usa dubla peste ~65cm de coloana (acelasi prag ca in model.ts)
          totals.doors += (widths[ci] ?? 0) > 0.65 ? 2 : 1;
          // legacy: DOOR cu count si fara fill = polite interioare
          if (!zone.fill) totals.shelves += zone.count ?? 0;
          break;
        case 'HANGING':
          totals.hanging += 1;
          break;
        case 'TILT_OUT':
          totals.tiltOut += zone.count ?? 1;
          break;
        case 'OPEN':
          if (!zone.fill) totals.open += 1;
          break;
      }
    }
  });
  return totals;
}

const FINISH_LABEL_RO: Record<Piece3dFinish, string> = {
  ALB: 'alb',
  STEJAR: 'stejar',
  NUC: 'nuc',
  GRI: 'gri',
  VERDE_SALVIE: 'verde salvie',
};

const cm = (v: number) => Math.round(v * 100);

// Descrierea generata a itemului derivat (RO fara diacritice, ca restul
// descrierilor derivate) — "atelierele vad EXACT aceeasi structura ca azi".
export function describePieceConfig(kind: Piece3dKind, config: PieceConfig3d): string {
  const totals = pieceConfigTotals(config);
  const parts = [
    `Configurat 3D: ${cm(config.widthM)} x ${cm(config.heightM)} x ${cm(config.depthM)} cm`,
  ];
  if (kind !== 'DESK' || totals.columns > 0) {
    parts.push(totals.columns === 1 ? '1 coloana' : `${totals.columns} coloane`);
  }
  if (totals.hanging > 0) {
    parts.push(totals.hanging === 1 ? '1 bara de haine' : `${totals.hanging} bare de haine`);
  }
  if (totals.shelves > 0) parts.push(totals.shelves === 1 ? '1 polita' : `${totals.shelves} polite`);
  if (totals.drawers > 0) {
    parts.push(totals.drawers === 1 ? '1 sertar' : `${totals.drawers} sertare`);
  }
  if (totals.tiltOut > 0) {
    parts.push(
      totals.tiltOut === 1 ? '1 front rabatabil' : `${totals.tiltOut} fronturi rabatabile`,
    );
  }
  if (totals.doors > 0) parts.push(totals.doors === 1 ? '1 usa' : `${totals.doors} usi`);
  if (totals.open > 0) {
    parts.push(totals.open === 1 ? '1 zona deschisa' : `${totals.open} zone deschise`);
  }
  parts.push(`finisaj ${FINISH_LABEL_RO[config.finish]}`);
  return parts.join(', ');
}

// Type guard folosit de engine si frontend pe valoarea unui answer.
export function isPieceConfig3d(value: unknown): value is PieceConfig3d {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as PieceConfig3d).widthM === 'number' &&
    Array.isArray((value as PieceConfig3d).columns)
  );
}
