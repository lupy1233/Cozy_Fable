import { HOUSE_WALL_THICKNESS, houseRoomBounds, houseRoomsOverlap, type HouseTransform, type StudioHouse } from './studio-house';
import type { StudioScene } from './studio.schemas';

export const HOUSE_ROOM_SNAP_DISTANCE = 0.12;
const EPS = 1e-7;

export interface HouseRoomPlacementOptions { snap?: boolean; snapDistance?: number }
export interface HouseRoomPlacementResult {
  transform: HouseTransform | null;
  collisionIds: string[];
  snapped: boolean;
}

export function houseRoomPlacementCollisions(scene: StudioScene, transform: HouseTransform, house: StudioHouse, scenes: readonly StudioScene[]): string[] {
  return scenes.filter((other) => {
    const otherTransform = house.roomTransforms[other.id];
    return other.id !== scene.id && otherTransform && houseRoomsOverlap(scene, transform, other, otherTransform);
  }).map((other) => other.id).sort();
}

function validTransform(transform: HouseTransform): boolean {
  return [transform.x, transform.z].every((value) => Number.isFinite(value) && Math.abs(value) <= 100) &&
    [0, 90, 180, 270].includes(transform.rotation);
}

// Rezolva o propunere de pozitie, fara a muta alte camere sau a schimba conexiuni.
export function resolveHouseRoomPlacement(scene: StudioScene, proposed: HouseTransform, house: StudioHouse, scenes: readonly StudioScene[], options: HouseRoomPlacementOptions = {}): HouseRoomPlacementResult {
  if (!validTransform(proposed)) return { transform: null, collisionIds: [], snapped: false };
  const collisions = (transform: HouseTransform) => houseRoomPlacementCollisions(scene, transform, house, scenes);
  if (options.snap === false) {
    const collisionIds = collisions(proposed);
    return { transform: collisionIds.length ? null : { ...proposed }, collisionIds, snapped: false };
  }
  const distance = options.snapDistance ?? HOUSE_ROOM_SNAP_DISTANCE;
  const threshold = Number.isFinite(distance) ? Math.max(0, distance) : HOUSE_ROOM_SNAP_DISTANCE;
  const base = { ...proposed, x: Math.round(proposed.x * 100) / 100, z: Math.round(proposed.z * 100) / 100 };
  const a = houseRoomBounds(scene, proposed);
  const candidates: { transform: HouseTransform; axes: number; distanceSquared: number }[] = [];
  const near = (value: number, axis: 'x' | 'z') => Math.abs(value - proposed[axis]) <= threshold + EPS;
  const add = (x: number, z: number, axes: number) => {
    const transform = { ...proposed, x, z };
    if (validTransform(transform)) candidates.push({ transform, axes, distanceSquared: (x - proposed.x) ** 2 + (z - proposed.z) ** 2 });
  };
  for (const other of scenes) {
    const otherTransform = house.roomTransforms[other.id];
    if (other.id === scene.id || !otherTransform || otherTransform.floorId !== proposed.floorId) continue;
    const b = houseRoomBounds(other, otherTransform);
    const contactX = [b.left - HOUSE_WALL_THICKNESS - a.w / 2, b.right + HOUSE_WALL_THICKNESS + a.w / 2];
    const contactZ = [b.top - HOUSE_WALL_THICKNESS - a.d / 2, b.bottom + HOUSE_WALL_THICKNESS + a.d / 2];
    const alignX = [b.left + a.w / 2, b.right - a.w / 2, b.x];
    const alignZ = [b.top + a.d / 2, b.bottom - a.d / 2, b.z];
    // Aliniem doar vecini apropiati si pe axa perpendiculara, nu linii indepartate.
    const nearbyZ = Math.max(a.top - b.bottom, b.top - a.bottom, 0) <= HOUSE_WALL_THICKNESS + threshold + EPS;
    const nearbyX = Math.max(a.left - b.right, b.left - a.right, 0) <= HOUSE_WALL_THICKNESS + threshold + EPS;
    if (nearbyZ) for (const x of contactX.filter((value) => near(value, 'x'))) {
      add(x, base.z, 1);
      for (const z of [...alignZ, ...contactZ].filter((value) => near(value, 'z'))) add(x, z, 2);
    }
    if (nearbyX) for (const z of contactZ.filter((value) => near(value, 'z'))) {
      add(base.x, z, 1);
      for (const x of [...alignX, ...contactX].filter((value) => near(value, 'x'))) add(x, z, 2);
    }
  }
  // Colturile se aliniaza pe ambele axe; egalitatile nu depind de ordinea scenelor.
  candidates.sort((first, second) => second.axes - first.axes ||
    (Math.abs(first.distanceSquared - second.distanceSquared) > EPS * EPS ? first.distanceSquared - second.distanceSquared : 0) ||
    first.transform.x - second.transform.x || first.transform.z - second.transform.z);
  for (const candidate of candidates) if (collisions(candidate.transform).length === 0) return {
    transform: candidate.transform, collisionIds: [], snapped: true,
  };
  // Grila de 1cm nu are voie sa transforme o propunere libera intr-o coliziune.
  for (const fallback of [base, proposed]) if (collisions(fallback).length === 0) return { transform: { ...fallback }, collisionIds: [], snapped: false };
  return { transform: null, collisionIds: collisions(proposed), snapped: false };
}
