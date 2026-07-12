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

// OPEN/SHELVES/DRAWERS/DOOR din docs/10 §2; HANGING (bara de haine, dulap) si
// TILT_OUT (fronturi rabatabile, pantofar) acopera "regulile proprii per piesa"
// din R5 — inlocuiesc informatia pierduta prin renuntarea la interiorModules.
export const PIECE3D_ZONE_TYPES = [
  'OPEN',
  'SHELVES',
  'DRAWERS',
  'DOOR',
  'HANGING',
  'TILT_OUT',
] as const;
export type Piece3dZoneType = (typeof PIECE3D_ZONE_TYPES)[number];

// Finisaje vizuale (culoare + rugozitate in frontend; fara texturi in MVP).
export const PIECE3D_FINISHES = ['ALB', 'STEJAR', 'NUC', 'GRI', 'VERDE_SALVIE'] as const;
export type Piece3dFinish = (typeof PIECE3D_FINISHES)[number];

// Zonele cu numar reglabil de elemente si plafonul fiecareia.
// La DOOR, count = politele INTERIOARE din spatele usii (optional, poate lipsi).
export const ZONE_COUNT_MAX: Partial<Record<Piece3dZoneType, number>> = {
  SHELVES: 8,
  DRAWERS: 6,
  TILT_OUT: 4,
  DOOR: 8,
};

// Tipurile la care count e OBLIGATORIU (cate elemente are zona); la DOOR e
// optional (usa fara polite interioare e valida).
export const ZONE_COUNT_REQUIRED: readonly Piece3dZoneType[] = [
  'SHELVES',
  'DRAWERS',
  'TILT_OUT',
];

export function zoneCountRequired(type: Piece3dZoneType): boolean {
  return ZONE_COUNT_REQUIRED.includes(type);
}

export interface Piece3dZone {
  type: Piece3dZoneType;
  // SHELVES/DRAWERS/TILT_OUT: numarul de polite/sertare/fronturi (obligatoriu);
  // DOOR: numarul de polite interioare din spatele usii (optional)
  count?: number;
}

export interface Piece3dColumn {
  zones: Piece3dZone[];
}

export interface PieceConfig3d {
  widthM: number;
  heightM: number;
  depthM: number;
  // coloanele de la stanga la dreapta; zonele unei coloane de sus in jos
  columns: Piece3dColumn[];
  finish: Piece3dFinish;
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
  // tipurile de zona permise piesei (primul = implicitul la click-cycle)
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
    zoneTypes: ['OPEN', 'SHELVES', 'DRAWERS', 'DOOR'],
    maxZonesPerColumn: 4,
    maxColumns: 6,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Biblioteca',
    defaultColumn: () => col({ type: 'SHELVES', count: 4 }),
  },
  WARDROBE: {
    width: { min: 0.6, max: 6, default: 2.4 },
    height: { min: 1.8, max: 2.8, default: 2.4 },
    depth: { min: 0.35, max: 0.8, default: 0.6 },
    zoneTypes: ['HANGING', 'SHELVES', 'DRAWERS', 'DOOR', 'OPEN'],
    maxZonesPerColumn: 4,
    maxColumns: 8,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Dulap',
    defaultColumn: () => col({ type: 'HANGING' }, { type: 'DRAWERS', count: 2 }),
  },
  TV_UNIT: {
    width: { min: 1, max: 3.6, default: 1.8 },
    height: { min: 0.25, max: 0.9, default: 0.45 },
    depth: { min: 0.3, max: 0.6, default: 0.4 },
    zoneTypes: ['OPEN', 'DRAWERS', 'DOOR', 'SHELVES'],
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
    zoneTypes: ['TILT_OUT', 'DOOR', 'DRAWERS', 'OPEN', 'SHELVES'],
    maxZonesPerColumn: 3,
    maxColumns: 3,
    minColumns: 1,
    hasPlinth: true,
    itemName: 'Pantofar',
    defaultColumn: () => col({ type: 'TILT_OUT', count: 3 }),
  },
  DRESSER: {
    width: { min: 0.4, max: 2.4, default: 1.2 },
    height: { min: 0.5, max: 1.4, default: 0.9 },
    depth: { min: 0.35, max: 0.6, default: 0.45 },
    zoneTypes: ['DRAWERS', 'DOOR', 'OPEN', 'SHELVES'],
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
// limitele latimii unei coloane rezultate din impartire (docs/10: max ~90cm)
export const COLUMN_W_MIN = 0.22;
export const COLUMN_W_MAX = 1.0;

// Latimea interioara disponibila coloanelor.
export function interiorWidth(widthM: number): number {
  return widthM - 2 * PANEL_T;
}

// Latimea unei coloane la n coloane (impartire egala, despartitoare de PANEL_T).
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
  if (kind === 'DESK') return Math.max(rules.minColumns, Math.min(rules.maxColumns, Math.round(n)));
  while (v > 1 && columnWidth(widthM, v) < COLUMN_W_MIN) v--;
  while (v < rules.maxColumns && columnWidth(widthM, v) > COLUMN_W_MAX) v++;
  return v;
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
// existente unde se poate, adauga/scoate coloane la capat, corecteaza count-urile.
export function normalizePieceConfig(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  const rules = PIECE3D_RULES[kind];
  const clampDim = (v: number, r: DimRule) => round3(Math.max(r.min, Math.min(r.max, v)));
  const widthM = clampDim(config.widthM, rules.width);
  const n = clampColumns(kind, widthM, config.columns.length || 1);
  const columns = Array.from({ length: n }, (_, i) => {
    const existing = config.columns[i];
    if (!existing) return rules.defaultColumn();
    const zones = existing.zones.slice(0, rules.maxZonesPerColumn).map((z) => {
      const type = rules.zoneTypes.includes(z.type) ? z.type : rules.zoneTypes[0];
      const max = ZONE_COUNT_MAX[type];
      if (max === undefined) return { type };
      // count optional (DOOR): lipsa sau 0 inseamna usa fara polite interioare
      if (!zoneCountRequired(type) && (z.count === undefined || z.count < 1)) return { type };
      const count = Math.max(1, Math.min(max, Math.round(z.count ?? 1)));
      return { type, count };
    });
    return { zones: zones.length > 0 ? zones : rules.defaultColumn().zones };
  });
  return {
    widthM,
    heightM: clampDim(config.heightM, rules.height),
    depthM: clampDim(config.depthM, rules.depth),
    columns,
    finish: PIECE3D_FINISHES.includes(config.finish) ? config.finish : 'STEJAR',
  };
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
      count: z.number().int().min(1).max(8).optional(),
    })
    .strict()
    .superRefine((zone, ctx) => {
      if (!rules.zoneTypes.includes(zone.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
        return;
      }
      const max = ZONE_COUNT_MAX[zone.type];
      if (max === undefined) {
        // OPEN/HANGING nu au elemente numarabile
        if (zone.count !== undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
        }
      } else if (zone.count === undefined) {
        if (zoneCountRequired(zone.type)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
        }
      } else if (zone.count > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
      }
    });

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
      columns: z
        .array(z.object({ zones: z.array(zoneSchema).min(1).max(rules.maxZonesPerColumn) }).strict())
        .min(rules.minColumns)
        .max(rules.maxColumns),
      finish: z.enum(PIECE3D_FINISHES, {
        errorMap: () => ({ message: 'validation.answerInvalid' }),
      }),
    })
    .strict('validation.unknownAnswer')
    .superRefine((config, ctx) => {
      // latimea de coloana rezultata trebuie sa fie realista (docs/10 R2)
      if (kind === 'DESK' || config.columns.length === 0) return;
      const w = columnWidth(config.widthM, config.columns.length);
      if (w < COLUMN_W_MIN - 1e-9 || w > COLUMN_W_MAX + 1e-9) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.answerInvalid' });
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
  for (const column of config.columns) {
    for (const zone of column.zones) {
      switch (zone.type) {
        case 'SHELVES':
          totals.shelves += zone.count ?? 1;
          break;
        case 'DRAWERS':
          totals.drawers += zone.count ?? 1;
          break;
        case 'DOOR':
          // usa dubla peste ~65cm de coloana (acelasi prag ca in model.ts);
          // politele interioare din spatele usii intra in totalul de polite
          totals.doors += columnWidth(config.widthM, config.columns.length) > 0.65 ? 2 : 1;
          totals.shelves += zone.count ?? 0;
          break;
        case 'HANGING':
          totals.hanging += 1;
          break;
        case 'TILT_OUT':
          totals.tiltOut += zone.count ?? 1;
          break;
        case 'OPEN':
          totals.open += 1;
          break;
      }
    }
  }
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
