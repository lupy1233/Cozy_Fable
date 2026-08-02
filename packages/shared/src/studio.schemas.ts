import { z } from 'zod';
import {
  PIECE3D_KINDS,
  pieceConfig3dSchema,
  type Piece3dKind,
  type PieceConfig3d,
} from './questionnaire/piece3d';

// Studio 3D ("modul Sims", cerinta PO 2026-08-02) — modelul de date al
// drafturilor salvate in cont: biblioteca de piese + camerele (scene) cu
// asezari si goluri. Sursa UNICA de constante si validare pentru frontend
// (stores/studio-store) si backend (modules/studio); datele sunt JSON in
// studio_drafts.data, validate identic cu configuratorul (pieceConfig3dSchema).

// peretii camerei: N = spate (-z), S = fata (+z), W = stanga (-x), E = dreapta (+x)
export const STUDIO_WALLS = ['N', 'E', 'S', 'W'] as const;
export type StudioWall = (typeof STUDIO_WALLS)[number];

// OUTLET (priza) nu taie peretele — sta montata PE el (cutout: false)
export const STUDIO_OPENING_KINDS = [
  'DOOR',
  'DOOR_DOUBLE',
  'WINDOW',
  'WINDOW_WIDE',
  'OUTLET',
] as const;
export type StudioOpeningKind = (typeof STUDIO_OPENING_KINDS)[number];

// gabaritele IMPLICITE ale variantelor (latime × inaltime, cota de la podea)
export const OPENING_SPECS: Record<
  StudioOpeningKind,
  { w: number; h: number; sill: number; cutout: boolean }
> = {
  DOOR: { w: 0.9, h: 2.05, sill: 0, cutout: true },
  DOOR_DOUBLE: { w: 1.5, h: 2.05, sill: 0, cutout: true },
  WINDOW: { w: 1.2, h: 1.3, sill: 0.9, cutout: true },
  WINDOW_WIDE: { w: 2.0, h: 1.4, sill: 0.8, cutout: true },
  OUTLET: { w: 0.15, h: 0.09, sill: 0.3, cutout: false },
};

// intervalele in care fiecare varianta se poate redimensiona (cerinta PO:
// usi/ferestre pe dimensiuni proprii); min === max inseamna ne-ajustabil
interface DimRange {
  min: number;
  max: number;
}
export const OPENING_DIM_LIMITS: Record<
  StudioOpeningKind,
  { w: DimRange; h: DimRange; sill: DimRange }
> = {
  DOOR: { w: { min: 0.6, max: 1.2 }, h: { min: 1.9, max: 2.4 }, sill: { min: 0, max: 0 } },
  DOOR_DOUBLE: { w: { min: 1.1, max: 2.4 }, h: { min: 1.9, max: 2.4 }, sill: { min: 0, max: 0 } },
  WINDOW: { w: { min: 0.4, max: 2.4 }, h: { min: 0.4, max: 2.2 }, sill: { min: 0.1, max: 1.6 } },
  WINDOW_WIDE: { w: { min: 1.2, max: 3.4 }, h: { min: 0.4, max: 2.2 }, sill: { min: 0.1, max: 1.6 } },
  OUTLET: { w: { min: 0.15, max: 0.15 }, h: { min: 0.09, max: 0.09 }, sill: { min: 0.1, max: 1.5 } },
};

export const STUDIO_ROTATIONS = [0, 90, 180, 270] as const;
export type StudioRotation = (typeof STUDIO_ROTATIONS)[number];

export const STUDIO_ROOM_LIMITS = {
  width: { min: 2, max: 8 },
  depth: { min: 2, max: 8 },
  wallHeight: { min: 2.2, max: 3.2 },
} as const;

export const STUDIO_MAX_SCENES = 12;
export const STUDIO_MAX_PIECES = 60;
export const STUDIO_MAX_PLACEMENTS_PER_SCENE = 120;
export const STUDIO_MAX_OPENINGS_PER_SCENE = 24;
export const STUDIO_MAX_DRAFTS_PER_USER = 20;
export const MAX_STUDIO_DRAFT_NAME_LENGTH = 80;
// plafonul intregului JSON serializat (aparare de umplere a tabelei)
export const MAX_STUDIO_DRAFT_BYTES = 300_000;

export interface StudioPiece {
  id: string;
  name: string;
  kind: Piece3dKind;
  config: PieceConfig3d;
  updatedAt: number;
}

export interface StudioPlacement {
  id: string;
  pieceId: string;
  // centrul piesei in metri; originea camerei in centrul podelei
  x: number;
  z: number;
  rotation: StudioRotation;
}

export interface StudioOpening {
  id: string;
  wall: StudioWall;
  kind: StudioOpeningKind;
  // centrul golului fata de mijlocul peretelui, pe axa LUMII (x la N/S, z la E/W)
  offset: number;
  // dimensiuni PROPRII (m) — lipsa = implicitele variantei din OPENING_SPECS
  w?: number;
  h?: number;
  sill?: number;
}

// Dimensiunile EFECTIVE ale unui gol: override-urile taiate la limitele
// variantei, altfel implicitele — sursa unica pentru randare/coliziuni/UI.
export function openingSize(o: Pick<StudioOpening, 'kind' | 'w' | 'h' | 'sill'>): {
  w: number;
  h: number;
  sill: number;
  cutout: boolean;
} {
  const spec = OPENING_SPECS[o.kind];
  const lim = OPENING_DIM_LIMITS[o.kind];
  const clamp = (v: number | undefined, fallback: number, r: DimRange) =>
    v === undefined || !Number.isFinite(v) ? fallback : Math.min(r.max, Math.max(r.min, v));
  return {
    w: clamp(o.w, spec.w, lim.w),
    h: clamp(o.h, spec.h, lim.h),
    sill: clamp(o.sill, spec.sill, lim.sill),
    cutout: spec.cutout,
  };
}

export interface StudioRoom {
  widthM: number;
  depthM: number;
  wallHeightM: number;
  wallColor: string;
  floorColor: string;
}

export interface StudioScene {
  id: string;
  name: string;
  room: StudioRoom;
  placements: StudioPlacement[];
  openings: StudioOpening[];
}

// Snapshotul complet al studioului — forma din localStorage si din
// studio_drafts.data (versionata pentru migrari viitoare).
export interface StudioDraftData {
  version: 2;
  pieces: Record<string, StudioPiece>;
  scenes: StudioScene[];
  activeSceneId: string;
}

const idSchema = z.string().min(1).max(40);
// coordonate finite, generoase fata de camera maxima (clamp-ul real e in UI)
const coordSchema = z.number().finite().min(-20).max(20);

const studioPieceSchema: z.ZodType<StudioPiece> = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(60),
    kind: z.enum(PIECE3D_KINDS),
    config: z.unknown(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((piece, ctx) => {
    // configul piesei se valideaza cu ACEEASI schema ca answers.config3d
    const parsed = pieceConfig3dSchema(piece.kind).safeParse(piece.config);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid piece config', path: ['config'] });
    }
  }) as unknown as z.ZodType<StudioPiece>;

const studioRoomSchema: z.ZodType<StudioRoom> = z
  .object({
    widthM: z.number().min(STUDIO_ROOM_LIMITS.width.min).max(STUDIO_ROOM_LIMITS.width.max),
    depthM: z.number().min(STUDIO_ROOM_LIMITS.depth.min).max(STUDIO_ROOM_LIMITS.depth.max),
    wallHeightM: z
      .number()
      .min(STUDIO_ROOM_LIMITS.wallHeight.min)
      .max(STUDIO_ROOM_LIMITS.wallHeight.max),
    wallColor: z.string().max(20),
    floorColor: z.string().max(20),
  })
  .strict();

const studioPlacementSchema: z.ZodType<StudioPlacement> = z
  .object({
    id: idSchema,
    pieceId: idSchema,
    x: coordSchema,
    z: coordSchema,
    rotation: z
      .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  })
  .strict();

const studioOpeningSchema: z.ZodType<StudioOpening> = z
  .object({
    id: idSchema,
    wall: z.enum(STUDIO_WALLS),
    kind: z.enum(STUDIO_OPENING_KINDS),
    offset: coordSchema,
    w: z.number().finite().positive().max(4).optional(),
    h: z.number().finite().positive().max(3).optional(),
    sill: z.number().finite().min(0).max(2).optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    // dimensiunile proprii raman in intervalele variantei
    const lim = OPENING_DIM_LIMITS[o.kind];
    const bad = (field: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dimension out of range', path: [field] });
    if (o.w !== undefined && (o.w < lim.w.min - 1e-6 || o.w > lim.w.max + 1e-6)) bad('w');
    if (o.h !== undefined && (o.h < lim.h.min - 1e-6 || o.h > lim.h.max + 1e-6)) bad('h');
    if (o.sill !== undefined && (o.sill < lim.sill.min - 1e-6 || o.sill > lim.sill.max + 1e-6))
      bad('sill');
  }) as unknown as z.ZodType<StudioOpening>;

const studioSceneSchema: z.ZodType<StudioScene> = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(60),
    room: studioRoomSchema,
    placements: z.array(studioPlacementSchema).max(STUDIO_MAX_PLACEMENTS_PER_SCENE),
    openings: z.array(studioOpeningSchema).max(STUDIO_MAX_OPENINGS_PER_SCENE),
  })
  .strict()
  .superRefine((scene, ctx) => {
    // golurile raman in perete: varful sub tavan, latimea in lungimea peretelui
    scene.openings.forEach((o, i) => {
      const size = openingSize(o);
      const wallLen = o.wall === 'N' || o.wall === 'S' ? scene.room.widthM : scene.room.depthM;
      if (size.sill + size.h > scene.room.wallHeightM + 1e-6 || size.w > wallLen + 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'opening does not fit the wall',
          path: ['openings', i],
        });
      }
    });
  }) as unknown as z.ZodType<StudioScene>;

export const studioDraftDataSchema: z.ZodType<StudioDraftData> = z
  .object({
    version: z.literal(2),
    pieces: z.record(studioPieceSchema),
    scenes: z.array(studioSceneSchema).min(1).max(STUDIO_MAX_SCENES),
    activeSceneId: idSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data.pieces).length > STUDIO_MAX_PIECES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'too many pieces',
        path: ['pieces'],
      });
    }
    // asezarile arata spre piese existente (fara referinte agatate in DB)
    for (let i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].placements.some((p) => !data.pieces[p.pieceId])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'placement references missing piece',
          path: ['scenes', i, 'placements'],
        });
      }
    }
  }) as unknown as z.ZodType<StudioDraftData>;

// DTO-urile endpointurilor /studio/drafts
export interface StudioDraftSummaryDto {
  id: string;
  name: string;
  updatedAt: string;
}

export interface StudioDraftDetailDto extends StudioDraftSummaryDto {
  data: StudioDraftData;
}
