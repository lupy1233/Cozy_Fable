import { describe, expect, it } from 'vitest';
import { HOUSE_ROOM_SNAP_DISTANCE, houseRoomPlacementCollisions, resolveHouseRoomPlacement } from './house-room-placement';
import { defaultStudioHouse, houseLayoutErrors, type HouseTransform } from './studio-house';
import type { StudioScene } from './studio.schemas';

const scene = (id: string, widthM = 2, depthM = 2): StudioScene => ({ id, name: id,
  room: { widthM, depthM, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [],
});
const transform = (x: number, z = 0, rotation: HouseTransform['rotation'] = 0, floorId = 'ground'): HouseTransform => ({ x, z, rotation, floorId });
function fixture() {
  const moving = scene('moving'), other = scene('other', 4, 4), scenes = [moving, other];
  const house = defaultStudioHouse(scenes);
  house.roomTransforms.moving = transform(6);
  house.roomTransforms.other = transform(0);
  return { moving, other, scenes, house };
}

describe('house room collision and alignment', () => {
  it.each([[3.09, 0], [-3.09, 0], [0, 3.09], [0, -3.09], [3.09, 3.09]])('allows walls touching at %s/%s', (x, z) => {
    const { moving, scenes, house } = fixture();
    expect(houseRoomPlacementCollisions(moving, transform(x, z), house, scenes)).toEqual([]);
  });

  it('rejects room interiors and insufficient shared-wall clearance', () => {
    const { moving, scenes, house } = fixture();
    for (const x of [0, 2.9, 3, 3.08]) expect(houseRoomPlacementCollisions(moving, transform(x), house, scenes)).toEqual(['other']);
    expect(resolveHouseRoomPlacement(moving, transform(0), house, scenes)).toEqual({ transform: null, collisionIds: ['other'], snapped: false });
  });

  it('matches persisted-layout overlap validation, including its existing 6mm tolerance', () => {
    const { moving, scenes, house } = fixture();
    for (const x of [3.08, 3.083, 3.085, 3.09, 3.2]) {
      const proposed = transform(x);
      const next = { ...house, roomTransforms: { ...house.roomTransforms, moving: proposed } };
      expect(houseRoomPlacementCollisions(moving, proposed, house, scenes).length > 0).toBe(houseLayoutErrors(next, scenes).includes('ROOM_OVERLAP'));
    }
  });

  it('uses rotated room dimensions when testing collisions and resolving wall adjacency', () => {
    const { moving, scenes, house } = fixture();
    moving.room.depthM = 4;
    expect(houseRoomPlacementCollisions(moving, transform(3.09, 0, 90), house, scenes)).toEqual(['other']);
    const result = resolveHouseRoomPlacement(moving, transform(4.16, 0, 90), house, scenes);
    expect(result.transform).toEqual(transform(4.09, 0, 90));
    expect(result.snapped).toBe(true);
  });

  it('ignores self, rooms without a transform, and rooms on another floor', () => {
    const { moving, other, scenes, house } = fixture();
    house.roomTransforms.other.floorId = 'upper';
    scenes.push(scene('unplaced'));
    expect(houseRoomPlacementCollisions(moving, transform(0), house, scenes)).toEqual([]);
    expect(resolveHouseRoomPlacement(moving, transform(3.14), house, [moving, other])).toEqual({ transform: transform(3.14), collisionIds: [], snapped: false });
    expect(houseRoomPlacementCollisions(moving, house.roomTransforms.moving, house, [moving])).toEqual([]);
  });

  it('snaps a nearby side while preserving an unaligned tangential coordinate', () => {
    const { moving, scenes, house } = fixture();
    expect(resolveHouseRoomPlacement(moving, transform(3.17, 0.63), house, scenes)).toEqual({ transform: transform(3.09, 0.63), collisionIds: [], snapped: true });
  });

  it('aligns unequal room corners along a shared side on both axes', () => {
    const { moving, scenes, house } = fixture();
    moving.room.depthM = 3;
    const result = resolveHouseRoomPlacement(moving, transform(3.17, -0.56), house, scenes);
    expect(result).toEqual({ transform: transform(3.09, -0.5), collisionIds: [], snapped: true });
  });

  it('snaps approaching outer corners on both axes without requiring a doorway', () => {
    const { moving, scenes, house } = fixture();
    expect(resolveHouseRoomPlacement(moving, transform(3.17, 3.17), house, scenes)).toEqual({ transform: transform(3.09, 3.09), collisionIds: [], snapped: true });
    expect(house.connections).toEqual([]);
  });

  it('never snaps to a distant room merely sharing a nearby axis coordinate', () => {
    const { moving, scenes, house } = fixture();
    expect(resolveHouseRoomPlacement(moving, transform(3.14, 20.023), house, scenes)).toEqual({ transform: transform(3.14, 20.02), collisionIds: [], snapped: false });
  });

  it('includes the 12cm threshold, excludes values beyond it, and supports a smaller threshold', () => {
    const { moving, scenes, house } = fixture();
    expect(HOUSE_ROOM_SNAP_DISTANCE).toBe(0.12);
    expect(resolveHouseRoomPlacement(moving, transform(3.21, 0.6), house, scenes).snapped).toBe(true);
    expect(resolveHouseRoomPlacement(moving, transform(3.21001, 0.6), house, scenes).snapped).toBe(false);
    expect(resolveHouseRoomPlacement(moving, transform(3.16, 0.6), house, scenes, { snapDistance: 0.05 }).snapped).toBe(false);
  });

  it('breaks equal-distance ties by coordinates regardless of scene order', () => {
    const moving = scene('moving'), left = scene('left'), right = scene('right'), scenes = [moving, left, right];
    const house = defaultStudioHouse(scenes);
    house.roomTransforms.left = transform(-2.14);
    house.roomTransforms.right = transform(2.14);
    const result = resolveHouseRoomPlacement(moving, transform(0), house, scenes);
    expect(result.transform?.x).toBeCloseTo(-0.05, 10);
    expect(result.snapped).toBe(true);
    expect(resolveHouseRoomPlacement(moving, transform(0), house, [...scenes].reverse())).toEqual(result);
  });

  it('rejects a snap candidate that would hit a third room and chooses another clear alignment', () => {
    const { moving, scenes, house } = fixture();
    scenes.push(scene('blocker'));
    house.roomTransforms.blocker = transform(3.09, 2.06);
    expect(houseRoomPlacementCollisions(moving, transform(3.09, 0), house, scenes)).toEqual(['blocker']);
    const result = resolveHouseRoomPlacement(moving, transform(3.15, -0.06), house, scenes);
    expect(result.transform).not.toBeNull();
    expect(result.transform?.x).toBeCloseTo(3.09, 10);
    expect(result.transform?.z).toBeCloseTo(-0.03, 10);
    expect(houseRoomPlacementCollisions(moving, result.transform!, house, scenes)).toEqual([]);
  });

  it('leaves exact coordinates when snapping is off but still rejects collisions', () => {
    const { moving, scenes, house } = fixture();
    expect(resolveHouseRoomPlacement(moving, transform(3.145, 0.621), house, scenes, { snap: false })).toEqual({ transform: transform(3.145, 0.621), collisionIds: [], snapped: false });
    expect(resolveHouseRoomPlacement(moving, transform(3), house, scenes, { snap: false }).transform).toBeNull();
  });

  it('keeps a valid precise position if centimeter rounding would collide', () => {
    const { moving, scenes, house } = fixture();
    const proposed = transform(3.0849, 0.6);
    expect(houseRoomPlacementCollisions(moving, transform(3.08, 0.6), house, scenes)).toEqual(['other']);
    expect(resolveHouseRoomPlacement(moving, proposed, house, scenes, { snapDistance: 0 })).toEqual({ transform: proposed, collisionIds: [], snapped: false });
  });

  it('rejects non-finite/out-of-range proposals without mutating rooms or transforms', () => {
    const { moving, scenes, house } = fixture();
    const before = JSON.stringify({ scenes, house });
    for (const x of [NaN, Infinity, 100.1]) expect(resolveHouseRoomPlacement(moving, transform(x), house, scenes).transform).toBeNull();
    resolveHouseRoomPlacement(moving, transform(3.12, 0.03), house, scenes);
    expect(JSON.stringify({ scenes, house })).toBe(before);
  });
});
