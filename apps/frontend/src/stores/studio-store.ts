'use client';

import {
  defaultPieceConfig,
  normalizePieceConfig,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Studio 3D ("modul Sims") — joc SEPARAT de formular: biblioteca de piese
// create in configuratorul 3D + o camera in care piesele se aseaza liber.
// Totul e draft local (localStorage), fara server; piesele pot fi trimise
// ulterior in cerere prin configurator-store.addRoomWithAnswers.

export interface StudioPiece {
  id: string;
  name: string;
  kind: Piece3dKind;
  config: PieceConfig3d;
  updatedAt: number;
}

// rotatia in jurul axei Y, doar multipli de 90° (asezare pe grila, stil Sims)
export type StudioRotation = 0 | 90 | 180 | 270;

export interface StudioPlacement {
  id: string;
  pieceId: string;
  // centrul piesei in metri; originea camerei in centrul podelei
  x: number;
  z: number;
  rotation: StudioRotation;
}

export interface StudioRoom {
  widthM: number;
  depthM: number;
  wallHeightM: number;
  // id-uri din paletele WALL_COLORS/FLOOR_COLORS (components/studio/palette)
  wallColor: string;
  floorColor: string;
}

export const STUDIO_ROOM_LIMITS = {
  width: { min: 2, max: 8 },
  depth: { min: 2, max: 8 },
} as const;

// pasul de asezare pe grila (10cm) — destul de fin pentru mobilier, destul de
// "magnetic" ca piesele sa se alinieze intre ele
export const STUDIO_SNAP = 0.1;

const DEFAULT_ROOM: StudioRoom = {
  widthM: 4.2,
  depthM: 3.4,
  wallHeightM: 2.6,
  wallColor: 'VAR',
  floorColor: 'STEJAR',
};

// Gabaritul pe podea al unei asezari (jumatati de latura, dupa rotatie).
export function placementHalfExtents(
  config: PieceConfig3d,
  rotation: StudioRotation,
): { hx: number; hz: number } {
  const swap = rotation === 90 || rotation === 270;
  return {
    hx: (swap ? config.depthM : config.widthM) / 2,
    hz: (swap ? config.widthM : config.depthM) / 2,
  };
}

export function clampToRoom(
  room: StudioRoom,
  config: PieceConfig3d,
  rotation: StudioRotation,
  x: number,
  z: number,
): { x: number; z: number } {
  const { hx, hz } = placementHalfExtents(config, rotation);
  const maxX = Math.max(0, room.widthM / 2 - hx);
  const maxZ = Math.max(0, room.depthM / 2 - hz);
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    x: round3(Math.min(maxX, Math.max(-maxX, x))),
    z: round3(Math.min(maxZ, Math.max(-maxZ, z))),
  };
}

export const snapToGrid = (v: number) => Math.round(v / STUDIO_SNAP) * STUDIO_SNAP;

interface Footprint {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

const overlaps = (a: Footprint, b: Footprint) =>
  Math.abs(a.x - b.x) < a.hx + b.hx - 1e-6 && Math.abs(a.z - b.z) < a.hz + b.hz - 1e-6;

// Id-urile asezarilor care se suprapun cu alta piesa (evidentiate in scena).
export function overlappingPlacements(
  placements: StudioPlacement[],
  pieces: Record<string, StudioPiece>,
): Set<string> {
  const boxes = placements.flatMap((p) => {
    const piece = pieces[p.pieceId];
    if (!piece) return [];
    const { hx, hz } = placementHalfExtents(piece.config, p.rotation);
    return [{ id: p.id, x: p.x, z: p.z, hx, hz }];
  });
  const bad = new Set<string>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        bad.add(boxes[i].id);
        bad.add(boxes[j].id);
      }
    }
  }
  return bad;
}

// Primul loc liber pentru o piesa noua: centrul, apoi inele concentrice pe
// grila — piesa "cade" in camera fara sa se aseze peste alta.
function findFreeSpot(
  room: StudioRoom,
  placements: StudioPlacement[],
  pieces: Record<string, StudioPiece>,
  config: PieceConfig3d,
): { x: number; z: number } {
  const { hx, hz } = placementHalfExtents(config, 0);
  const taken = placements.flatMap((p) => {
    const piece = pieces[p.pieceId];
    if (!piece) return [];
    const half = placementHalfExtents(piece.config, p.rotation);
    return [{ x: p.x, z: p.z, hx: half.hx, hz: half.hz }];
  });
  const step = 0.25;
  for (let ring = 0; ring * step <= Math.max(room.widthM, room.depthM); ring++) {
    for (let ix = -ring; ix <= ring; ix++) {
      for (let iz = -ring; iz <= ring; iz++) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== ring) continue;
        const spot = clampToRoom(room, config, 0, snapToGrid(ix * step), snapToGrid(iz * step));
        const box = { x: spot.x, z: spot.z, hx, hz };
        if (!taken.some((t) => overlaps(box, t))) return spot;
      }
    }
  }
  return { x: 0, z: 0 };
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface StudioStore {
  pieces: Record<string, StudioPiece>;
  placements: StudioPlacement[];
  room: StudioRoom;
  // selectia din scena — UI pur, nepersistat
  selectedId: string | null;

  savePiece: (input: {
    id?: string;
    name: string;
    kind: Piece3dKind;
    config: PieceConfig3d;
  }) => StudioPiece;
  deletePiece: (id: string) => void;
  placePiece: (pieceId: string) => void;
  movePlacement: (id: string, x: number, z: number) => void;
  rotatePlacement: (id: string) => void;
  duplicatePlacement: (id: string) => void;
  removePlacement: (id: string) => void;
  clearPlacements: () => void;
  setRoom: (patch: Partial<StudioRoom>) => void;
  setSelected: (id: string | null) => void;
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      pieces: {},
      placements: [],
      room: DEFAULT_ROOM,
      selectedId: null,

      savePiece: ({ id, name, kind, config }) => {
        const piece: StudioPiece = {
          id: id ?? newId('p'),
          name: name.trim() || 'Piesa mea',
          kind,
          config: normalizePieceConfig(kind, config),
          updatedAt: Date.now(),
        };
        set((s) => ({
          pieces: { ...s.pieces, [piece.id]: piece },
          // piesa editata poate fi mai mare decat inainte — asezarile ei
          // raman in interiorul camerei
          placements: s.placements.map((p) =>
            p.pieceId === piece.id
              ? { ...p, ...clampToRoom(s.room, piece.config, p.rotation, p.x, p.z) }
              : p,
          ),
        }));
        return piece;
      },

      deletePiece: (id) =>
        set((s) => {
          const { [id]: _removed, ...pieces } = s.pieces;
          const placements = s.placements.filter((p) => p.pieceId !== id);
          const selectedId =
            s.selectedId && placements.some((p) => p.id === s.selectedId) ? s.selectedId : null;
          return { pieces, placements, selectedId };
        }),

      placePiece: (pieceId) =>
        set((s) => {
          const piece = s.pieces[pieceId];
          if (!piece) return s;
          const spot = findFreeSpot(s.room, s.placements, s.pieces, piece.config);
          const placement: StudioPlacement = {
            id: newId('pl'),
            pieceId,
            x: spot.x,
            z: spot.z,
            rotation: 0,
          };
          return { placements: [...s.placements, placement], selectedId: placement.id };
        }),

      movePlacement: (id, x, z) =>
        set((s) => {
          const placement = s.placements.find((p) => p.id === id);
          const piece = placement && s.pieces[placement.pieceId];
          if (!placement || !piece) return s;
          const next = clampToRoom(
            s.room,
            piece.config,
            placement.rotation,
            snapToGrid(x),
            snapToGrid(z),
          );
          return {
            placements: s.placements.map((p) => (p.id === id ? { ...p, ...next } : p)),
          };
        }),

      rotatePlacement: (id) =>
        set((s) => {
          const placement = s.placements.find((p) => p.id === id);
          const piece = placement && s.pieces[placement.pieceId];
          if (!placement || !piece) return s;
          const rotation = ((placement.rotation + 90) % 360) as StudioRotation;
          // dupa rotire piesa poate iesi din camera — o tragem inapoi
          const pos = clampToRoom(s.room, piece.config, rotation, placement.x, placement.z);
          return {
            placements: s.placements.map((p) =>
              p.id === id ? { ...p, rotation, ...pos } : p,
            ),
          };
        }),

      duplicatePlacement: (id) =>
        set((s) => {
          const placement = s.placements.find((p) => p.id === id);
          const piece = placement && s.pieces[placement.pieceId];
          if (!placement || !piece) return s;
          const spot = findFreeSpot(s.room, s.placements, s.pieces, piece.config);
          const copy: StudioPlacement = {
            id: newId('pl'),
            pieceId: placement.pieceId,
            x: spot.x,
            z: spot.z,
            rotation: placement.rotation,
          };
          return { placements: [...s.placements, copy], selectedId: copy.id };
        }),

      removePlacement: (id) =>
        set((s) => ({
          placements: s.placements.filter((p) => p.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),

      clearPlacements: () => set({ placements: [], selectedId: null }),

      setRoom: (patch) =>
        set((s) => {
          const room: StudioRoom = {
            ...s.room,
            ...patch,
            widthM: clampDim(patch.widthM ?? s.room.widthM, STUDIO_ROOM_LIMITS.width),
            depthM: clampDim(patch.depthM ?? s.room.depthM, STUDIO_ROOM_LIMITS.depth),
          };
          // piesele raman in camera si cand camera se micsoreaza
          const placements = s.placements.map((p) => {
            const piece = s.pieces[p.pieceId];
            if (!piece) return p;
            return { ...p, ...clampToRoom(room, piece.config, p.rotation, p.x, p.z) };
          });
          return { room, placements };
        }),

      setSelected: (id) => set({ selectedId: id }),
    }),
    {
      name: 'mm_studio_v1',
      version: 1,
      partialize: (s) => ({ pieces: s.pieces, placements: s.placements, room: s.room }),
    },
  ),
);

function clampDim(v: number, limit: { min: number; max: number }): number {
  return Math.round(Math.max(limit.min, Math.min(limit.max, v)) * 10) / 10;
}

// O piesa de pornire pentru biblioteca goala (prima vizita nu arata un studio
// pustiu): biblioteca implicita din configurator, gata de asezat.
export function starterPieceConfig(kind: Piece3dKind): PieceConfig3d {
  return defaultPieceConfig(kind);
}
