'use client';

import {
  normalizePieceConfig,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Studio 3D ("modul Sims") — joc SEPARAT de formular: biblioteca de piese
// create in configuratorul 3D + camere (scene) in care piesele se aseaza
// liber, cu usi si ferestre pe pereti. Totul e draft local (localStorage);
// piesele pot fi trimise in cerere prin configurator-store.addRoomWithAnswers,
// iar intregul studio poate fi salvat in cont (drafturi pe server).

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

export interface StudioOpening {
  id: string;
  wall: StudioWall;
  kind: StudioOpeningKind;
  // centrul golului de-a lungul peretelui, in metri fata de mijlocul peretelui,
  // pe axa LUMII (x pentru N/S, z pentru E/W)
  offset: number;
}

export interface StudioRoom {
  widthM: number;
  depthM: number;
  wallHeightM: number;
  // id-uri din paletele WALL_COLORS/FLOOR_COLORS (components/studio/palette)
  wallColor: string;
  floorColor: string;
}

// o scena = o camera a "apartamentului": gabarit + piese asezate + goluri
export interface StudioScene {
  id: string;
  name: string;
  room: StudioRoom;
  placements: StudioPlacement[];
  openings: StudioOpening[];
}

export const STUDIO_ROOM_LIMITS = {
  width: { min: 2, max: 8 },
  depth: { min: 2, max: 8 },
} as const;

export const STUDIO_MAX_SCENES = 12;

// pasul de asezare pe podea: 1cm (cerinta PO — miscare fina, nu pe dale)
export const STUDIO_SNAP = 0.01;
// distanta minima intre goluri si pana la colturile peretelui
const OPENING_GAP = 0.05;
const OPENING_CORNER = 0.1;

const DEFAULT_ROOM: StudioRoom = {
  widthM: 4.2,
  depthM: 3.4,
  wallHeightM: 2.6,
  wallColor: 'VAR',
  floorColor: 'STEJAR',
};

const round3 = (v: number) => Math.round(v * 1000) / 1000;

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
  return {
    x: round3(Math.min(maxX, Math.max(-maxX, x))),
    z: round3(Math.min(maxZ, Math.max(-maxZ, z))),
  };
}

export const snapToGrid = (v: number) => round3(Math.round(v / STUDIO_SNAP) * STUDIO_SNAP);

// lungimea utila a unui perete (dimensiunea camerei pe axa lui)
export function wallLength(room: StudioRoom, wall: StudioWall): number {
  return wall === 'N' || wall === 'S' ? room.widthM : room.depthM;
}

// limita centrului unui gol pe perete (colturile raman pline)
function openingMaxOffset(room: StudioRoom, wall: StudioWall, kind: StudioOpeningKind): number {
  return wallLength(room, wall) / 2 - OPENING_SPECS[kind].w / 2 - OPENING_CORNER;
}

// Ordoneaza golurile unui perete si limiteaza offsetul intre vecini.
function clampOpeningOffset(
  room: StudioRoom,
  openings: StudioOpening[],
  target: StudioOpening,
  rawOffset: number,
): number {
  const maxOff = openingMaxOffset(room, target.wall, target.kind);
  if (maxOff < 0) return 0;
  let low = -maxOff;
  let high = maxOff;
  const w = OPENING_SPECS[target.kind].w;
  for (const other of openings) {
    if (other.id === target.id || other.wall !== target.wall) continue;
    const half = (w + OPENING_SPECS[other.kind].w) / 2 + OPENING_GAP;
    // vecinul din stanga ridica pragul de jos, cel din dreapta pe cel de sus
    if (other.offset <= target.offset) low = Math.max(low, other.offset + half);
    else high = Math.min(high, other.offset - half);
  }
  if (low > high) return target.offset;
  return round3(Math.min(high, Math.max(low, rawOffset)));
}

// Primul loc liber pentru un gol nou: peretele din spate intai (vizibil in
// vederea implicita), apoi lateralele, apoi fata; pe fiecare perete cauta
// intervalul liber cel mai apropiat de mijloc.
function findOpeningSpot(
  room: StudioRoom,
  openings: StudioOpening[],
  kind: StudioOpeningKind,
  walls: readonly StudioWall[] = ['N', 'E', 'W', 'S'],
): { wall: StudioWall; offset: number } | null {
  const w = OPENING_SPECS[kind].w;
  for (const wall of walls) {
    const maxOff = openingMaxOffset(room, wall, kind);
    if (maxOff < 0) continue;
    // intervalele ocupate pe perete (in pozitii de CENTRU interzise)
    const blocked = openings
      .filter((o) => o.wall === wall)
      .map((o) => {
        const half = (w + OPENING_SPECS[o.kind].w) / 2 + OPENING_GAP;
        return [o.offset - half, o.offset + half] as const;
      })
      .sort((a, b) => a[0] - b[0]);
    // candidele: mijlocul peretelui, apoi capetele fiecarui interval blocat
    const candidates = [0, -maxOff, maxOff];
    for (const [lo, hi] of blocked) {
      candidates.push(lo, hi);
    }
    const free = (c: number) =>
      c >= -maxOff && c <= maxOff && blocked.every(([lo, hi]) => c <= lo || c >= hi);
    const valid = candidates.filter(free).sort((a, b) => Math.abs(a) - Math.abs(b));
    if (valid.length > 0) return { wall, offset: round3(valid[0]) };
  }
  return null;
}

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

function newScene(name: string): StudioScene {
  return { id: newId('sc'), name, room: { ...DEFAULT_ROOM }, placements: [], openings: [] };
}

// Dupa micsorarea camerei: piesele raman inauntru, golurile care nu mai incap
// pe perete dispar, restul se trag intre limite.
function fitSceneToRoom(scene: StudioScene, pieces: Record<string, StudioPiece>): StudioScene {
  const placements = scene.placements.map((p) => {
    const piece = pieces[p.pieceId];
    if (!piece) return p;
    return { ...p, ...clampToRoom(scene.room, piece.config, p.rotation, p.x, p.z) };
  });
  const openings: StudioOpening[] = [];
  for (const o of [...scene.openings].sort((a, b) => a.offset - b.offset)) {
    if (openingMaxOffset(scene.room, o.wall, o.kind) < 0) continue;
    openings.push({ ...o, offset: clampOpeningOffset(scene.room, openings, o, o.offset) });
  }
  return { ...scene, placements, openings };
}

// Serializabil pentru drafturile din cont (fara selectii).
export interface StudioSnapshot {
  version: 2;
  pieces: Record<string, StudioPiece>;
  scenes: StudioScene[];
  activeSceneId: string;
}

interface StudioStore {
  pieces: Record<string, StudioPiece>;
  scenes: StudioScene[];
  activeSceneId: string;
  // selectiile din scena activa — UI pur, nepersistat
  selectedId: string | null;
  selectedOpeningId: string | null;

  savePiece: (input: {
    id?: string;
    name: string;
    kind: Piece3dKind;
    config: PieceConfig3d;
  }) => StudioPiece;
  deletePiece: (id: string) => void;

  addScene: (name: string) => void;
  renameScene: (id: string, name: string) => void;
  deleteScene: (id: string) => void;
  setActiveScene: (id: string) => void;

  placePiece: (pieceId: string) => void;
  movePlacement: (id: string, x: number, z: number) => void;
  rotatePlacement: (id: string) => void;
  duplicatePlacement: (id: string) => void;
  removePlacement: (id: string) => void;
  clearPlacements: () => void;

  addOpening: (kind: StudioOpeningKind) => boolean;
  moveOpening: (id: string, offset: number) => void;
  cycleOpeningWall: (id: string) => void;
  removeOpening: (id: string) => void;

  setRoom: (patch: Partial<StudioRoom>) => void;
  setSelected: (id: string | null) => void;
  setSelectedOpening: (id: string | null) => void;

  snapshot: () => StudioSnapshot;
  loadSnapshot: (snapshot: StudioSnapshot) => void;
}

// Patch pe scena activa — toate mutatiile de continut trec pe aici.
function patchActive(
  s: Pick<StudioStore, 'scenes' | 'activeSceneId'>,
  fn: (scene: StudioScene) => StudioScene,
): StudioScene[] {
  return s.scenes.map((scene) => (scene.id === s.activeSceneId ? fn(scene) : scene));
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => {
      const initial = newScene('Camera 1');
      return {
        pieces: {},
        scenes: [initial],
        activeSceneId: initial.id,
        selectedId: null,
        selectedOpeningId: null,

        savePiece: ({ id, name, kind, config }) => {
          const piece: StudioPiece = {
            id: id ?? newId('p'),
            name: name.trim() || 'Piesa mea',
            kind,
            config: normalizePieceConfig(kind, config),
            updatedAt: Date.now(),
          };
          set((s) => {
            const pieces = { ...s.pieces, [piece.id]: piece };
            // piesa editata poate fi mai mare — asezarile ei din TOATE camerele
            // raman in interiorul camerei lor
            const scenes = s.scenes.map((scene) => ({
              ...scene,
              placements: scene.placements.map((p) =>
                p.pieceId === piece.id
                  ? { ...p, ...clampToRoom(scene.room, piece.config, p.rotation, p.x, p.z) }
                  : p,
              ),
            }));
            return { pieces, scenes };
          });
          return piece;
        },

        deletePiece: (id) =>
          set((s) => {
            const { [id]: _removed, ...pieces } = s.pieces;
            const scenes = s.scenes.map((scene) => ({
              ...scene,
              placements: scene.placements.filter((p) => p.pieceId !== id),
            }));
            const active = scenes.find((sc) => sc.id === s.activeSceneId);
            const selectedId =
              s.selectedId && active?.placements.some((p) => p.id === s.selectedId)
                ? s.selectedId
                : null;
            return { pieces, scenes, selectedId };
          }),

        addScene: (name) =>
          set((s) => {
            if (s.scenes.length >= STUDIO_MAX_SCENES) return s;
            const scene = newScene(name);
            return {
              scenes: [...s.scenes, scene],
              activeSceneId: scene.id,
              selectedId: null,
              selectedOpeningId: null,
            };
          }),

        renameScene: (id, name) =>
          set((s) => ({
            scenes: s.scenes.map((scene) =>
              scene.id === id ? { ...scene, name: name.trim() || scene.name } : scene,
            ),
          })),

        deleteScene: (id) =>
          set((s) => {
            if (s.scenes.length <= 1) return s;
            const scenes = s.scenes.filter((scene) => scene.id !== id);
            return {
              scenes,
              activeSceneId: s.activeSceneId === id ? scenes[0].id : s.activeSceneId,
              selectedId: null,
              selectedOpeningId: null,
            };
          }),

        setActiveScene: (id) =>
          set((s) =>
            s.scenes.some((scene) => scene.id === id)
              ? { activeSceneId: id, selectedId: null, selectedOpeningId: null }
              : s,
          ),

        placePiece: (pieceId) =>
          set((s) => {
            const piece = s.pieces[pieceId];
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            if (!piece || !active) return s;
            const spot = findFreeSpot(active.room, active.placements, s.pieces, piece.config);
            const placement: StudioPlacement = {
              id: newId('pl'),
              pieceId,
              x: spot.x,
              z: spot.z,
              rotation: 0,
            };
            return {
              scenes: patchActive(s, (scene) => ({
                ...scene,
                placements: [...scene.placements, placement],
              })),
              selectedId: placement.id,
              selectedOpeningId: null,
            };
          }),

        movePlacement: (id, x, z) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const placement = scene.placements.find((p) => p.id === id);
              const piece = placement && s.pieces[placement.pieceId];
              if (!placement || !piece) return scene;
              const next = clampToRoom(
                scene.room,
                piece.config,
                placement.rotation,
                snapToGrid(x),
                snapToGrid(z),
              );
              return {
                ...scene,
                placements: scene.placements.map((p) => (p.id === id ? { ...p, ...next } : p)),
              };
            }),
          })),

        rotatePlacement: (id) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const placement = scene.placements.find((p) => p.id === id);
              const piece = placement && s.pieces[placement.pieceId];
              if (!placement || !piece) return scene;
              const rotation = ((placement.rotation + 90) % 360) as StudioRotation;
              // dupa rotire piesa poate iesi din camera — o tragem inapoi
              const pos = clampToRoom(scene.room, piece.config, rotation, placement.x, placement.z);
              return {
                ...scene,
                placements: scene.placements.map((p) =>
                  p.id === id ? { ...p, rotation, ...pos } : p,
                ),
              };
            }),
          })),

        duplicatePlacement: (id) =>
          set((s) => {
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            const placement = active?.placements.find((p) => p.id === id);
            const piece = placement && s.pieces[placement.pieceId];
            if (!active || !placement || !piece) return s;
            const spot = findFreeSpot(active.room, active.placements, s.pieces, piece.config);
            const copy: StudioPlacement = {
              id: newId('pl'),
              pieceId: placement.pieceId,
              x: spot.x,
              z: spot.z,
              rotation: placement.rotation,
            };
            return {
              scenes: patchActive(s, (scene) => ({
                ...scene,
                placements: [...scene.placements, copy],
              })),
              selectedId: copy.id,
            };
          }),

        removePlacement: (id) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => ({
              ...scene,
              placements: scene.placements.filter((p) => p.id !== id),
            })),
            selectedId: s.selectedId === id ? null : s.selectedId,
          })),

        clearPlacements: () =>
          set((s) => ({
            scenes: patchActive(s, (scene) => ({ ...scene, placements: [] })),
            selectedId: null,
          })),

        addOpening: (kind) => {
          let added = false;
          set((s) => {
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            if (!active) return s;
            const spot = findOpeningSpot(active.room, active.openings, kind);
            if (!spot) return s;
            added = true;
            const opening: StudioOpening = { id: newId('op'), kind, ...spot };
            return {
              scenes: patchActive(s, (scene) => ({
                ...scene,
                openings: [...scene.openings, opening],
              })),
              selectedOpeningId: opening.id,
              selectedId: null,
            };
          });
          return added;
        },

        moveOpening: (id, offset) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const opening = scene.openings.find((o) => o.id === id);
              if (!opening) return scene;
              const next = clampOpeningOffset(
                scene.room,
                scene.openings,
                opening,
                snapToGrid(offset),
              );
              return {
                ...scene,
                openings: scene.openings.map((o) => (o.id === id ? { ...o, offset: next } : o)),
              };
            }),
          })),

        cycleOpeningWall: (id) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const opening = scene.openings.find((o) => o.id === id);
              if (!opening) return scene;
              // urmatorul perete (in sensul N→E→S→W) cu loc pentru acest gol
              const start = STUDIO_WALLS.indexOf(opening.wall);
              const others = scene.openings.filter((o) => o.id !== id);
              for (let i = 1; i <= STUDIO_WALLS.length; i++) {
                const wall = STUDIO_WALLS[(start + i) % STUDIO_WALLS.length];
                // cautarea e restransa la peretele tinta — altfel functia ar
                // intoarce mereu primul perete liber din ordinea ei interna
                const spot = findOpeningSpot(scene.room, others, opening.kind, [wall]);
                if (spot) {
                  return {
                    ...scene,
                    openings: scene.openings.map((o) =>
                      o.id === id ? { ...o, wall, offset: spot.offset } : o,
                    ),
                  };
                }
              }
              return scene;
            }),
          })),

        removeOpening: (id) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => ({
              ...scene,
              openings: scene.openings.filter((o) => o.id !== id),
            })),
            selectedOpeningId: s.selectedOpeningId === id ? null : s.selectedOpeningId,
          })),

        setRoom: (patch) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const room: StudioRoom = {
                ...scene.room,
                ...patch,
                widthM: clampDim(patch.widthM ?? scene.room.widthM, STUDIO_ROOM_LIMITS.width),
                depthM: clampDim(patch.depthM ?? scene.room.depthM, STUDIO_ROOM_LIMITS.depth),
              };
              return fitSceneToRoom({ ...scene, room }, s.pieces);
            }),
          })),

        setSelected: (id) => set({ selectedId: id, ...(id ? { selectedOpeningId: null } : {}) }),
        setSelectedOpening: (id) =>
          set({ selectedOpeningId: id, ...(id ? { selectedId: null } : {}) }),

        snapshot: () => {
          const s = get();
          return {
            version: 2,
            pieces: s.pieces,
            scenes: s.scenes,
            activeSceneId: s.activeSceneId,
          };
        },

        loadSnapshot: (snapshot) =>
          set(() => {
            const scenes =
              snapshot.scenes.length > 0 ? snapshot.scenes : [newScene('Camera 1')];
            const activeSceneId = scenes.some((sc) => sc.id === snapshot.activeSceneId)
              ? snapshot.activeSceneId
              : scenes[0].id;
            return {
              pieces: snapshot.pieces,
              scenes,
              activeSceneId,
              selectedId: null,
              selectedOpeningId: null,
            };
          }),
      };
    },
    {
      name: 'mm_studio_v1',
      // v2: o singura camera → scene multiple (Camera 1 pastreaza tot) + goluri
      version: 2,
      migrate: (persisted, version) => {
        if (version >= 2) return persisted;
        const old = persisted as {
          pieces?: Record<string, StudioPiece>;
          placements?: StudioPlacement[];
          room?: StudioRoom;
        };
        const scene: StudioScene = {
          ...newScene('Camera 1'),
          room: { ...DEFAULT_ROOM, ...(old.room ?? {}) },
          placements: old.placements ?? [],
        };
        return { pieces: old.pieces ?? {}, scenes: [scene], activeSceneId: scene.id };
      },
      partialize: (s) => ({ pieces: s.pieces, scenes: s.scenes, activeSceneId: s.activeSceneId }),
    },
  ),
);

// scena activa — selector partajat de pagina si canvas
export function useActiveScene(): StudioScene {
  return useStudioStore((s) => s.scenes.find((sc) => sc.id === s.activeSceneId) ?? s.scenes[0]);
}

function clampDim(v: number, limit: { min: number; max: number }): number {
  // precizie de 1cm (cerinta PO: si 3.45m, nu doar din 10 in 10 cm)
  return Math.round(Math.max(limit.min, Math.min(limit.max, v)) * 100) / 100;
}
