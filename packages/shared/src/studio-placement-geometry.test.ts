import { describe, expect, it } from 'vitest';
import { findStudioFreePosition, placementHalfExtents, resolveStudioMove, studioFootprint, studioFootprintsOverlap, studioPlacementReason, studioRoomPosition } from './studio-placement-geometry';
import type { StudioRoom } from './studio.schemas';

const room: StudioRoom = { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' };
const unit = { widthM: 0.4, depthM: 0.4, heightM: 0.8 };
const obstacle = { x: 0, z: 0, hx: 0.25, hz: 0.5 };

describe('Studio footprint geometry', () => {
  it('allows floor furniture below a floating cabinet and stops same-height collisions', () => {
    const upper = { ...unit, mountingHeightM: 1.2, heightM: 0.6 };
    const above = studioFootprint(upper, { x: 0, z: 0, rotation: 0 });
    expect(studioPlacementReason(room, unit, { x: 0, z: 0, rotation: 0 }, [above])).toBeNull();
    expect(findStudioFreePosition(room, unit, 0, [above])).toEqual({ x: 0, z: 0 });
    expect(resolveStudioMove(room, unit, 0, { x: -1, z: 0 }, { x: 1, z: 0 }, [above])).toEqual({ position: { x: 1, z: 0 }, reason: null });
    expect(studioPlacementReason(room, { ...unit, heightM: 1.2 }, { x: 0, z: 0, rotation: 0 }, [above])).toBeNull();
    expect(studioPlacementReason(room, { ...unit, heightM: 1.3 }, { x: 0, z: 0, rotation: 0 }, [above])).toBe('FURNITURE');
    expect(studioRoomPosition(room, { ...upper, mountingHeightM: 2.1 }, 90, { x: 0, z: 0 })).toBeNull();
  });
  it.each([0, 180] as const)('keeps the footprint at %s degrees', (rotation) => {
    expect(placementHalfExtents({ ...unit, widthM: 1 }, rotation)).toEqual({ hx: 0.5, hz: 0.2 });
  });
  it.each([90, 270] as const)('swaps width and depth at %s degrees', (rotation) => {
    expect(placementHalfExtents({ ...unit, widthM: 1 }, rotation)).toEqual({ hx: 0.2, hz: 0.5 });
  });
  it('permits touching furniture and walls without adding invented clearance', () => {
    expect(studioFootprintsOverlap({ ...obstacle, x: 0.5 }, obstacle)).toBe(false);
    expect(studioPlacementReason(room, unit, { x: 1.8, z: 1.8, rotation: 0 }, [])).toBeNull();
    expect(studioPlacementReason(room, unit, { x: 1.81, z: 1.8, rotation: 0 }, [])).toBe('ROOM_BOUNDS');
  });
  it('checks rotated room fit and ceiling height', () => {
    const narrow = { ...room, widthM: 2, depthM: 4 };
    expect(studioRoomPosition(narrow, { ...unit, widthM: 3 }, 0, { x: 0, z: 0 })).toBeNull();
    expect(studioRoomPosition(narrow, { ...unit, widthM: 3 }, 90, { x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
    expect(studioRoomPosition(room, { ...unit, heightM: 2.7 }, 0, { x: 0, z: 0 })).toBeNull();
    expect(studioRoomPosition(room, unit, 0, { x: NaN, z: 0 })).toBeNull();
  });
  it('finds narrow free intervals missed by a coarse placement grid', () => {
    const bounds = { ...room, widthM: 2, depthM: 2 };
    const blockers = [{ x: -0.6, z: 0, hx: 0.4, hz: 1 }, { x: 0.55, z: 0, hx: 0.45, hz: 1 }];
    const config = { ...unit, widthM: 0.28, depthM: 2 };
    const result = findStudioFreePosition(bounds, config, 0, blockers);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(-0.04, 7);
    expect(studioPlacementReason(bounds, config, { ...result!, rotation: 0 }, blockers)).toBeNull();
  });
  it('reports no free place instead of falling back to an occupied center', () => {
    expect(findStudioFreePosition(room, unit, 0, [{ x: 0, z: 0, hx: 2, hz: 2 }])).toBeNull();
  });
});

describe('continuous collision response', () => {
  it('stops a large drag at first contact even when the requested endpoint is free', () => {
    const result = resolveStudioMove(room, unit, 0, { x: -1, z: 0 }, { x: 1.5, z: 0 }, [obstacle]);
    expect(result.position.x).toBeCloseTo(-0.45, 8);
    expect(result.reason).toBe('FURNITURE');
    expect(studioFootprintsOverlap(studioFootprint(unit, { ...result.position, rotation: 0 }), obstacle)).toBe(false);
  });
  it('slides along the contacted edge and can then move beyond the obstacle', () => {
    const contact = resolveStudioMove(room, unit, 0, { x: -1, z: 0 }, { x: 1, z: 1 }, [obstacle]);
    expect(contact.position.x).toBeCloseTo(-0.45, 8);
    expect(contact.position.z).toBe(1);
    const clear = resolveStudioMove(room, unit, 0, contact.position, { x: 1, z: 1 }, [obstacle]);
    expect(clear).toEqual({ position: { x: 1, z: 1 }, reason: null });
  });
  it('allows parallel movement at contact and movement away from contact', () => {
    expect(resolveStudioMove(room, unit, 0, { x: -0.45, z: 0 }, { x: -0.45, z: 1 }, [obstacle]).position).toEqual({ x: -0.45, z: 1 });
    expect(resolveStudioMove(room, unit, 0, { x: -0.45, z: 0 }, { x: -1, z: 0 }, [obstacle]).reason).toBeNull();
  });
  it('stops diagonal corner entry and checks a second obstacle while sliding', () => {
    const corner = resolveStudioMove(room, unit, 0, { x: -1, z: -1.25 }, { x: 1, z: 0.75 }, [obstacle]);
    expect(corner.position.x).toBeCloseTo(-0.45, 8);
    expect(corner.position.z).toBeCloseTo(-0.7, 8);
    const second = { x: -0.45, z: 1, hx: 0.3, hz: 0.1 };
    const slide = resolveStudioMove(room, unit, 0, { x: -1, z: 0 }, { x: 1, z: 1.5 }, [obstacle, second]);
    expect(slide.position.z).toBeCloseTo(0.7, 8);
    expect([obstacle, second].some((p) => studioFootprintsOverlap({ ...slide.position, hx: 0.2, hz: 0.2 }, p))).toBe(false);
  });
  it('lets inherited overlaps move out while refusing deeper penetration', () => {
    expect(resolveStudioMove(room, unit, 0, { x: -0.1, z: 0 }, { x: -0.8, z: 0 }, [obstacle]).position.x).toBe(-0.8);
    expect(resolveStudioMove(room, unit, 0, { x: -0.1, z: 0 }, { x: 0.1, z: 0 }, [obstacle])).toEqual({ position: { x: -0.1, z: 0 }, reason: 'FURNITURE' });
    expect(resolveStudioMove(room, unit, 0, { x: 0, z: 0 }, { x: 0, z: 1 }, [obstacle]).position.z).toBe(1);
  });
  it('clamps to room walls and respects rotated extents while moving', () => {
    const result = resolveStudioMove(room, { ...unit, widthM: 1.2 }, 90, { x: 0, z: 0 }, { x: 3, z: 3 }, []);
    expect(result).toEqual({ position: { x: 1.8, z: 1.4 }, reason: 'ROOM_BOUNDS' });
  });
});
