import { pieceElevation, type PieceConfig3d } from './questionnaire/piece3d';
import type { StudioPiece, StudioPlacement, StudioRoom, StudioRotation, StudioScene } from './studio.schemas';

const EPS = 1e-7;
type Dimensions = Pick<PieceConfig3d, 'widthM' | 'heightM' | 'depthM' | 'mountingHeightM'>;
export interface StudioPosition { x: number; z: number }
export interface StudioFootprint extends StudioPosition { hx: number; hz: number; id?: string; yMin?: number; yMax?: number }
export type StudioCollisionReason = 'FURNITURE' | 'ROOM_BOUNDS' | 'NO_SPACE';

// Rotatiile Studio sunt exclusiv 0/90/180/270; gabaritul rotit ramane dreptunghiular.
export function placementHalfExtents(config: Dimensions, rotation: StudioRotation): { hx: number; hz: number } {
  const swap = rotation === 90 || rotation === 270;
  return { hx: (swap ? config.depthM : config.widthM) / 2, hz: (swap ? config.widthM : config.depthM) / 2 };
}

export function studioFootprint(config: Dimensions, placement: StudioPosition & { rotation: StudioRotation; id?: string }): StudioFootprint {
  return { x: placement.x, z: placement.z, id: placement.id, yMin: pieceElevation(config), yMax: pieceElevation(config) + config.heightM, ...placementHalfExtents(config, placement.rotation) };
}

export function studioVerticalOverlap(a: StudioFootprint, b: StudioFootprint): boolean {
  return (a.yMin ?? 0) < (b.yMax ?? Infinity) - EPS && (b.yMin ?? 0) < (a.yMax ?? Infinity) - EPS;
}

export function studioFootprintsOverlap(a: StudioFootprint, b: StudioFootprint): boolean {
  return studioVerticalOverlap(a, b) && Math.abs(a.x - b.x) < a.hx + b.hx - EPS && Math.abs(a.z - b.z) < a.hz + b.hz - EPS;
}

export function studioSceneFootprints(placements: readonly StudioPlacement[], pieces: Record<string, StudioPiece>, excludeId?: string): StudioFootprint[] {
  return placements.flatMap((placement) => placement.id === excludeId || !pieces[placement.pieceId]
    ? [] : [studioFootprint(pieces[placement.pieceId].config, placement)]);
}

// Verificare explicita la publicare; citirea proiectelor istorice ramane recuperabila.
export function studioScenePlacementIssues(scene: StudioScene, pieces: Record<string, StudioPiece>): Array<{ placementId: string; reason: StudioCollisionReason }> {
  const footprints = studioSceneFootprints(scene.placements, pieces);
  return scene.placements.flatMap(placement => {
    const piece = pieces[placement.pieceId];
    if (!piece) return [{ placementId: placement.id, reason: 'ROOM_BOUNDS' as const }];
    const reason = studioPlacementReason(scene.room, piece.config, placement, footprints.filter(p => p.id !== placement.id));
    return reason ? [{ placementId: placement.id, reason }] : [];
  });
}

export function studioRoomPosition(room: StudioRoom, config: Dimensions, rotation: StudioRotation, position: StudioPosition): StudioPosition | null {
  const { hx, hz } = placementHalfExtents(config, rotation);
  const maxX = room.widthM / 2 - hx, maxZ = room.depthM / 2 - hz;
  if (![position.x, position.z, hx, hz, config.heightM, pieceElevation(config)].every(Number.isFinite) || hx <= 0 || hz <= 0 || maxX < -EPS || maxZ < -EPS || pieceElevation(config) < 0 || pieceElevation(config) + config.heightM > room.wallHeightM + EPS) return null;
  return { x: Math.max(-Math.max(0, maxX), Math.min(Math.max(0, maxX), position.x)), z: Math.max(-Math.max(0, maxZ), Math.min(Math.max(0, maxZ), position.z)) };
}

export function studioPlacementReason(room: StudioRoom, config: Dimensions, placement: StudioPosition & { rotation: StudioRotation }, obstacles: readonly StudioFootprint[]): StudioCollisionReason | null {
  const inside = studioRoomPosition(room, config, placement.rotation, placement);
  if (!inside || Math.abs(inside.x - placement.x) > EPS || Math.abs(inside.z - placement.z) > EPS) return 'ROOM_BOUNDS';
  const footprint = studioFootprint(config, placement);
  return obstacles.some((other) => studioFootprintsOverlap(footprint, other)) ? 'FURNITURE' : null;
}

// Cauta inclusiv spatii inguste intre muchii, nu doar puncte pe o grila grosiera.
export function findStudioFreePosition(room: StudioRoom, config: Dimensions, rotation: StudioRotation, obstacles: readonly StudioFootprint[], preferred: StudioPosition = { x: 0, z: 0 }): StudioPosition | null {
  const target = studioRoomPosition(room, config, rotation, preferred);
  if (!target) return null;
  const half = placementHalfExtents(config, rotation);
  const valid = (position: StudioPosition) => !obstacles.some((other) => studioFootprintsOverlap(studioFootprint(config, { ...position, rotation }), other));
  if (valid(target)) return target;
  const maxX = Math.max(0, room.widthM / 2 - half.hx), maxZ = Math.max(0, room.depthM / 2 - half.hz);
  const xs = [...new Set([target.x, -maxX, maxX, ...obstacles.flatMap((p) => [p.x - p.hx - half.hx, p.x + p.hx + half.hx])])].filter((x) => Math.abs(x) <= maxX + EPS);
  const zs = [...new Set([target.z, -maxZ, maxZ, ...obstacles.flatMap((p) => [p.z - p.hz - half.hz, p.z + p.hz + half.hz])])].filter((z) => Math.abs(z) <= maxZ + EPS);
  xs.sort((a, b) => Math.abs(a - target.x) - Math.abs(b - target.x));
  zs.sort((a, b) => Math.abs(a - target.z) - Math.abs(b - target.z));
  let best: StudioPosition | null = null, bestDistance = Infinity;
  for (const x of xs) {
    if ((x - target.x) ** 2 > bestDistance) break;
    for (const z of zs) {
      const distance = (x - target.x) ** 2 + (z - target.z) ** 2;
      if (distance >= bestDistance) break;
      if (valid({ x, z })) { best = { x, z }; bestDistance = distance; }
    }
  }
  return best;
}

function sweepHit(start: StudioPosition, delta: StudioPosition, half: { hx: number; hz: number }, obstacle: StudioFootprint) {
  const near = { x: -Infinity, z: -Infinity }, far = { x: Infinity, z: Infinity };
  for (const axis of ['x', 'z'] as const) {
    const extent = axis === 'x' ? half.hx + obstacle.hx : half.hz + obstacle.hz;
    const min = obstacle[axis] - extent, max = obstacle[axis] + extent;
    if (Math.abs(delta[axis]) <= EPS) {
      if (start[axis] <= min + EPS || start[axis] >= max - EPS) return null;
    } else {
      const a = (min - start[axis]) / delta[axis], b = (max - start[axis]) / delta[axis];
      near[axis] = Math.min(a, b); far[axis] = Math.max(a, b);
    }
  }
  const enter = Math.max(near.x, near.z), leave = Math.min(far.x, far.z);
  if (leave <= Math.max(0, enter) + EPS || enter < -EPS || enter >= 1 - EPS) return null;
  return { time: Math.max(0, enter), x: near.x >= near.z - EPS, z: near.z >= near.x - EPS };
}

export function resolveStudioMove(room: StudioRoom, config: Dimensions, rotation: StudioRotation, from: StudioPosition, desired: StudioPosition, obstacles: readonly StudioFootprint[]): { position: StudioPosition; reason: StudioCollisionReason | null } {
  const target = studioRoomPosition(room, config, rotation, desired);
  if (!target) return { position: from, reason: 'ROOM_BOUNDS' };
  let reason: StudioCollisionReason | null = Math.abs(target.x - desired.x) > EPS || Math.abs(target.z - desired.z) > EPS ? 'ROOM_BOUNDS' : null;
  const half = placementHalfExtents(config, rotation);
  let delta = { x: target.x - from.x, z: target.z - from.z };
  const blockers: StudioFootprint[] = [];
  for (const obstacle of obstacles) {
    const footprint = studioFootprint(config, { ...from, rotation });
    if (!studioVerticalOverlap(footprint, obstacle)) continue;
    if (!studioFootprintsOverlap(footprint, obstacle)) { blockers.push(obstacle); continue; }
    // Un proiect vechi suprapus poate fi reparat: permitem iesirea, nu adancirea.
    for (const axis of ['x', 'z'] as const) if (delta[axis] * (from[axis] - obstacle[axis]) < -EPS) {
      delta = { ...delta, [axis]: 0 }; reason = 'FURNITURE';
    }
  }
  let position = { ...from };
  for (let pass = 0; pass < 3 && Math.abs(delta.x) + Math.abs(delta.z) > EPS; pass++) {
    let hit: ReturnType<typeof sweepHit> = null;
    for (const obstacle of blockers) {
      const candidate = sweepHit(position, delta, half, obstacle);
      if (candidate && (!hit || candidate.time < hit.time - EPS)) hit = candidate;
      else if (candidate && hit && Math.abs(candidate.time - hit.time) <= EPS) hit = { time: hit.time, x: hit.x || candidate.x, z: hit.z || candidate.z };
    }
    if (!hit) { position = { x: position.x + delta.x, z: position.z + delta.z }; break; }
    position = { x: position.x + delta.x * hit.time, z: position.z + delta.z * hit.time };
    delta = { x: hit.x ? 0 : delta.x * (1 - hit.time), z: hit.z ? 0 : delta.z * (1 - hit.time) };
    reason = 'FURNITURE';
  }
  return { position, reason };
}
