'use client';

import {
  normalizePieceConfig,
  OPENING_DIM_LIMITS,
  openingSize,
  OPENING_SPECS,
  STUDIO_MAX_SCENES,
  STUDIO_OPENING_KINDS,
  STUDIO_ROOM_LIMITS,
  STUDIO_WALLS,
  type Piece3dKind,
  type PieceConfig3d,
  type StudioDraftData,
  type StudioOpening,
  type StudioOpeningKind,
  type StudioPiece,
  type StudioPlacement,
  type StudioRoom,
  type StudioRotation,
  type StudioScene,
  type StudioWall,
} from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Studio 3D ("modul Sims") — joc SEPARAT de formular: biblioteca de piese
// create in configuratorul 3D + camere (scene) in care piesele se aseaza
// liber, cu usi si ferestre pe pereti. Modelul de date + validarea stau in
// packages/shared (studio.schemas); aici e doar starea de joc (zustand,
// persistata local). Piesele pot fi trimise in cerere prin
// configurator-store.addRoomWithAnswers, iar intregul studio se poate salva
// in cont ca draft (hooks/use-studio-drafts).

// re-export: componentele studio importa modelul prin store, nu direct din shared
export {
  OPENING_DIM_LIMITS,
  openingSize,
  OPENING_SPECS,
  STUDIO_MAX_SCENES,
  STUDIO_OPENING_KINDS,
  STUDIO_ROOM_LIMITS,
  STUDIO_WALLS,
};
export type {
  StudioOpening,
  StudioOpeningKind,
  StudioPiece,
  StudioPlacement,
  StudioRoom,
  StudioRotation,
  StudioScene,
  StudioWall,
};

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
function openingMaxOffset(room: StudioRoom, wall: StudioWall, w: number): number {
  return wallLength(room, wall) / 2 - w / 2 - OPENING_CORNER;
}

// forma minima pentru calculele de geometrie (gol existent sau "sonda" noua)
type OpeningProbe = Pick<StudioOpening, 'kind' | 'w' | 'h' | 'sill'>;

// doua goluri se blocheaza reciproc doar daca se suprapun SI pe verticala
// (priza de la 30cm nu blocheaza fereastra cu parapetul la 90cm)
function verticalOverlap(a: OpeningProbe, b: OpeningProbe): boolean {
  const sa = openingSize(a);
  const sb = openingSize(b);
  return sa.sill < sb.sill + sb.h - 1e-6 && sb.sill < sa.sill + sa.h - 1e-6;
}

// Ordoneaza golurile unui perete si limiteaza offsetul intre vecinii care
// conteaza (aceeasi banda verticala).
function clampOpeningOffset(
  room: StudioRoom,
  openings: StudioOpening[],
  target: StudioOpening,
  rawOffset: number,
): number {
  const w = openingSize(target).w;
  const maxOff = openingMaxOffset(room, target.wall, w);
  if (maxOff < 0) return 0;
  let low = -maxOff;
  let high = maxOff;
  for (const other of openings) {
    if (other.id === target.id || other.wall !== target.wall) continue;
    if (!verticalOverlap(target, other)) continue;
    const half = (w + openingSize(other).w) / 2 + OPENING_GAP;
    // vecinul din stanga ridica pragul de jos, cel din dreapta pe cel de sus
    if (other.offset <= target.offset) low = Math.max(low, other.offset + half);
    else high = Math.min(high, other.offset - half);
  }
  if (low > high) return target.offset;
  return round3(Math.min(high, Math.max(low, rawOffset)));
}

// Primul loc liber pentru un gol: peretele din spate intai (vizibil in vederea
// implicita), apoi lateralele, apoi fata; pe fiecare perete cauta pozitia
// libera cea mai apropiata de mijloc.
function findOpeningSpot(
  room: StudioRoom,
  openings: StudioOpening[],
  probe: OpeningProbe,
  walls: readonly StudioWall[] = ['N', 'E', 'W', 'S'],
): { wall: StudioWall; offset: number } | null {
  const w = openingSize(probe).w;
  for (const wall of walls) {
    const maxOff = openingMaxOffset(room, wall, w);
    if (maxOff < 0) continue;
    // intervalele ocupate pe perete (in pozitii de CENTRU interzise)
    const blocked = openings
      .filter((o) => o.wall === wall && verticalOverlap(probe, o))
      .map((o) => {
        const half = (w + openingSize(o).w) / 2 + OPENING_GAP;
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
// pe perete dispar, restul se trag intre limite (inaltimile taiate sub tavan).
function fitSceneToRoom(scene: StudioScene, pieces: Record<string, StudioPiece>): StudioScene {
  const placements = scene.placements.map((p) => {
    const piece = pieces[p.pieceId];
    if (!piece) return p;
    return { ...p, ...clampToRoom(scene.room, piece.config, p.rotation, p.x, p.z) };
  });
  const openings: StudioOpening[] = [];
  for (const o of [...scene.openings].sort((a, b) => a.offset - b.offset)) {
    const size = openingSize(o);
    if (openingMaxOffset(scene.room, o.wall, size.w) < 0) continue;
    const fitted: StudioOpening = { ...o };
    // varful golului ramane sub tavan: intai coboara parapetul, apoi scurteaza
    const maxTop = scene.room.wallHeightM - 0.05;
    if (size.sill + size.h > maxTop) {
      const lim = OPENING_DIM_LIMITS[o.kind];
      const sill = Math.max(lim.sill.min, Math.min(size.sill, maxTop - size.h));
      fitted.sill = round3(sill);
      if (sill + size.h > maxTop) fitted.h = round3(Math.max(lim.h.min, maxTop - sill));
    }
    openings.push({ ...fitted, offset: clampOpeningOffset(scene.room, openings, fitted, o.offset) });
  }
  return { ...scene, placements, openings };
}

interface StudioStore {
  pieces: Record<string, StudioPiece>;
  scenes: StudioScene[];
  activeSceneId: string;
  // selectiile din scena activa — UI pur, nepersistat
  selectedId: string | null;
  selectedOpeningId: string | null;
  // undo/redo (nepersistat): snapshoturi ale continutului; starea e imutabila,
  // deci pastrarea referintelor e sigura
  history: StudioDraftData[];
  future: StudioDraftData[];
  // drag & drop din paleta in camera (nepersistat): pagina seteaza payload-ul
  // la ridicare, canvas-ul il consuma la eliberare
  dropPayload: StudioDropPayload | null;
  // draftul din cont incarcat/salvat ultima data — tinta "Actualizeaza";
  // persistat, ca butonul sa supravietuiasca refresh-ului (feedback PO r2)
  accountDraft: { id: string; name: string } | null;

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
  // copia completa a unei camere (piese asezate + goluri), ca punct de pornire
  duplicateScene: (id: string, name: string) => void;
  setActiveScene: (id: string) => void;

  placePiece: (pieceId: string) => void;
  // asezare EXACT unde a fost lasata piesa la drag & drop (clamp + snap)
  placePieceAt: (pieceId: string, x: number, z: number) => void;
  movePlacement: (id: string, x: number, z: number) => void;
  rotatePlacement: (id: string) => void;
  duplicatePlacement: (id: string) => void;
  removePlacement: (id: string) => void;
  clearPlacements: () => void;

  addOpening: (kind: StudioOpeningKind) => boolean;
  // gol lasat cu drag & drop pe un perete anume, cat mai aproape de punctul
  // de drop; daca acolo nu incape, cade pe primul loc liber al peretelui
  addOpeningAt: (kind: StudioOpeningKind, wall: StudioWall, offset: number) => boolean;
  moveOpening: (id: string, offset: number) => void;
  // dimensiuni proprii pe gol; false = schimbarea nu incape (vecin/tavan)
  resizeOpening: (id: string, patch: { w?: number; h?: number; sill?: number }) => boolean;
  cycleOpeningWall: (id: string) => void;
  removeOpening: (id: string) => void;

  setRoom: (patch: Partial<StudioRoom>) => void;
  setSelected: (id: string | null) => void;
  setSelectedOpening: (id: string | null) => void;

  // undo/redo: actiunile discrete inregistreaza singure; gesturile continue
  // (drag, slidere) apeleaza recordHistory O DATA, la inceputul gestului
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;

  setAccountDraft: (draft: { id: string; name: string } | null) => void;
  setDropPayload: (payload: StudioDropPayload | null) => void;

  snapshot: () => StudioDraftData;
  loadSnapshot: (snapshot: StudioDraftData) => void;
}

// ce se afla "in mana" in timpul unui drag din paleta spre camera
export type StudioDropPayload =
  | { type: 'piece'; pieceId: string }
  | { type: 'opening'; kind: StudioOpeningKind };

// continutul curent ca snapshot (referinte — starea e imutabila)
function currentData(s: Pick<StudioStore, 'pieces' | 'scenes' | 'activeSceneId'>): StudioDraftData {
  return { version: 2, pieces: s.pieces, scenes: s.scenes, activeSceneId: s.activeSceneId };
}

const HISTORY_CAP = 60;

// patch-ul de istorie inclus in actiunile care schimba continutul
function remember(s: StudioStore): Pick<StudioStore, 'history' | 'future'> {
  return { history: [...s.history.slice(-(HISTORY_CAP - 1)), currentData(s)], future: [] };
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
        history: [],
        future: [],
        accountDraft: null,
        dropPayload: null,

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
            return { pieces, scenes, ...remember(s) };
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
            return { pieces, scenes, selectedId, ...remember(s) };
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
              ...remember(s),
            };
          }),

        renameScene: (id, name) =>
          set((s) => ({
            scenes: s.scenes.map((scene) =>
              scene.id === id ? { ...scene, name: name.trim() || scene.name } : scene,
            ),
            ...remember(s),
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
              ...remember(s),
            };
          }),

        duplicateScene: (id, name) =>
          set((s) => {
            if (s.scenes.length >= STUDIO_MAX_SCENES) return s;
            const source = s.scenes.find((scene) => scene.id === id);
            if (!source) return s;
            // copie adanca cu id-uri noi — cele doua camere raman independente
            const copy: StudioScene = {
              id: newId('sc'),
              name: name.trim() || source.name,
              room: { ...source.room },
              placements: source.placements.map((p) => ({ ...p, id: newId('pl') })),
              openings: source.openings.map((o) => ({ ...o, id: newId('op') })),
            };
            return {
              scenes: [...s.scenes, copy],
              activeSceneId: copy.id,
              selectedId: null,
              selectedOpeningId: null,
              ...remember(s),
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
              ...remember(s),
            };
          }),

        placePieceAt: (pieceId, x, z) =>
          set((s) => {
            const piece = s.pieces[pieceId];
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            if (!piece || !active) return s;
            const spot = clampToRoom(active.room, piece.config, 0, snapToGrid(x), snapToGrid(z));
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
              ...remember(s),
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
            ...remember(s),
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
              ...remember(s),
            };
          }),

        removePlacement: (id) =>
          set((s) => ({
            scenes: patchActive(s, (scene) => ({
              ...scene,
              placements: scene.placements.filter((p) => p.id !== id),
            })),
            selectedId: s.selectedId === id ? null : s.selectedId,
            ...remember(s),
          })),

        clearPlacements: () =>
          set((s) => ({
            scenes: patchActive(s, (scene) => ({ ...scene, placements: [] })),
            selectedId: null,
            ...remember(s),
          })),

        addOpening: (kind) => {
          let added = false;
          set((s) => {
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            if (!active) return s;
            const spot = findOpeningSpot(active.room, active.openings, { kind });
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
              ...remember(s),
            };
          });
          return added;
        },

        addOpeningAt: (kind, wall, offset) => {
          let added = false;
          set((s) => {
            const active = s.scenes.find((sc) => sc.id === s.activeSceneId);
            if (!active) return s;
            const probe: StudioOpening = { id: newId('op'), kind, wall, offset: snapToGrid(offset) };
            const size = openingSize(probe);
            let spot: { wall: StudioWall; offset: number } | null = null;
            if (openingMaxOffset(active.room, wall, size.w) >= 0) {
              const clamped = clampOpeningOffset(active.room, active.openings, probe, probe.offset);
              const overlapping = active.openings.some((o) => {
                if (o.wall !== wall || !verticalOverlap(probe, o)) return false;
                return Math.abs(o.offset - clamped) < (size.w + openingSize(o).w) / 2 + OPENING_GAP - 1e-6;
              });
              if (!overlapping) spot = { wall, offset: clamped };
            }
            // punctul exact e ocupat → primul loc liber pe ACELASI perete,
            // apoi oriunde in camera
            spot ??=
              findOpeningSpot(active.room, active.openings, probe, [wall]) ??
              findOpeningSpot(active.room, active.openings, probe);
            if (!spot) return s;
            added = true;
            const opening: StudioOpening = { ...probe, ...spot };
            return {
              scenes: patchActive(s, (scene) => ({
                ...scene,
                openings: [...scene.openings, opening],
              })),
              selectedOpeningId: opening.id,
              selectedId: null,
              ...remember(s),
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

        resizeOpening: (id, patch) => {
          let applied = false;
          set((s) => ({
            scenes: patchActive(s, (scene) => {
              const opening = scene.openings.find((o) => o.id === id);
              if (!opening) return scene;
              const lim = OPENING_DIM_LIMITS[opening.kind];
              const clampDimTo = (v: number | undefined, r: { min: number; max: number }) =>
                v === undefined ? undefined : round3(Math.max(r.min, Math.min(r.max, v)));
              const next: StudioOpening = {
                ...opening,
                ...(patch.w !== undefined ? { w: clampDimTo(patch.w, lim.w) } : {}),
                ...(patch.h !== undefined ? { h: clampDimTo(patch.h, lim.h) } : {}),
                ...(patch.sill !== undefined ? { sill: clampDimTo(patch.sill, lim.sill) } : {}),
              };
              const size = openingSize(next);
              // varful sub tavan si latimea in perete — altfel schimbarea nu se aplica
              if (size.sill + size.h > scene.room.wallHeightM - 0.05 + 1e-6) return scene;
              if (openingMaxOffset(scene.room, next.wall, size.w) < 0) return scene;
              // latimea noua nu are voie sa intre peste vecini (banda verticala comuna)
              const offset = clampOpeningOffset(scene.room, scene.openings, next, next.offset);
              const overlapping = scene.openings.some((o) => {
                if (o.id === id || o.wall !== next.wall || !verticalOverlap(next, o)) return false;
                return Math.abs(o.offset - offset) < (size.w + openingSize(o).w) / 2 + OPENING_GAP - 1e-6;
              });
              if (overlapping) return scene;
              applied = true;
              return {
                ...scene,
                openings: scene.openings.map((o) => (o.id === id ? { ...next, offset } : o)),
              };
            }),
          }));
          return applied;
        },

        cycleOpeningWall: (id) =>
          set((s) => ({
            ...remember(s),
            scenes: patchActive(s, (scene) => {
              const opening = scene.openings.find((o) => o.id === id);
              if (!opening) return scene;
              // urmatorul perete (in sensul N→E→S→W) cu loc pentru acest gol
              const start = STUDIO_WALLS.indexOf(opening.wall);
              const others = scene.openings.filter((o) => o.id !== id);
              for (let i = 1; i <= STUDIO_WALLS.length; i++) {
                const wall = STUDIO_WALLS[(start + i) % STUDIO_WALLS.length];
                // cautarea e restransa la peretele tinta — altfel functia ar
                // intoarce mereu primul perete liber din ordinea ei interna;
                // sonda e golul insusi (dimensiunile proprii se pastreaza)
                const spot = findOpeningSpot(scene.room, others, opening, [wall]);
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
            ...remember(s),
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

        recordHistory: () => set((s) => remember(s)),

        undo: () =>
          set((s) => {
            const prev = s.history[s.history.length - 1];
            if (!prev) return s;
            return {
              pieces: prev.pieces,
              scenes: prev.scenes,
              activeSceneId: prev.activeSceneId,
              history: s.history.slice(0, -1),
              future: [...s.future.slice(-(HISTORY_CAP - 1)), currentData(s)],
              selectedId: null,
              selectedOpeningId: null,
            };
          }),

        redo: () =>
          set((s) => {
            const next = s.future[s.future.length - 1];
            if (!next) return s;
            return {
              pieces: next.pieces,
              scenes: next.scenes,
              activeSceneId: next.activeSceneId,
              future: s.future.slice(0, -1),
              history: [...s.history.slice(-(HISTORY_CAP - 1)), currentData(s)],
              selectedId: null,
              selectedOpeningId: null,
            };
          }),

        setAccountDraft: (draft) => set({ accountDraft: draft }),
        setDropPayload: (payload) => set({ dropPayload: payload }),

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
          set((s) => {
            // apararea la incarcare: configurile trec prin normalize (regulile
            // geometrice curente), iar scenele prin fit (clamp in camera)
            const pieces: Record<string, StudioPiece> = {};
            for (const piece of Object.values(snapshot.pieces)) {
              pieces[piece.id] = {
                ...piece,
                config: normalizePieceConfig(piece.kind, piece.config),
              };
            }
            const rawScenes =
              snapshot.scenes.length > 0 ? snapshot.scenes : [newScene('Camera 1')];
            const scenes = rawScenes.map((scene) => fitSceneToRoom(scene, pieces));
            const activeSceneId = scenes.some((sc) => sc.id === snapshot.activeSceneId)
              ? snapshot.activeSceneId
              : scenes[0].id;
            return {
              pieces,
              scenes,
              activeSceneId,
              selectedId: null,
              selectedOpeningId: null,
              ...remember(s),
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
      partialize: (s) => ({
        pieces: s.pieces,
        scenes: s.scenes,
        activeSceneId: s.activeSceneId,
        accountDraft: s.accountDraft,
      }),
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
