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

export const STUDIO_OPENING_KINDS = ['DOOR', 'DOOR_DOUBLE', 'WINDOW', 'WINDOW_WIDE'] as const;
export type StudioOpeningKind = (typeof STUDIO_OPENING_KINDS)[number];

// gabaritele variantelor de goluri (latime × inaltime, parapetul ferestrei)
export const OPENING_SPECS: Record<StudioOpeningKind, { w: number; h: number; sill: number }> = {
  DOOR: { w: 0.9, h: 2.05, sill: 0 },
  DOOR_DOUBLE: { w: 1.5, h: 2.05, sill: 0 },
  WINDOW: { w: 1.2, h: 1.3, sill: 0.9 },
  WINDOW_WIDE: { w: 2.0, h: 1.4, sill: 0.8 },
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
  })
  .strict();

const studioSceneSchema: z.ZodType<StudioScene> = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(60),
    room: studioRoomSchema,
    placements: z.array(studioPlacementSchema).max(STUDIO_MAX_PLACEMENTS_PER_SCENE),
    openings: z.array(studioOpeningSchema).max(STUDIO_MAX_OPENINGS_PER_SCENE),
  })
  .strict();

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
