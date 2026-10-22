import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPieceConfig, type StudioPiece, type StudioPlacement, type StudioRoom, type StudioScene } from '@marketplace/shared';
import { overlappingPlacements, useStudioStore } from './studio-store';

const room: StudioRoom = { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' };
const piece = (id = 'p', widthM = 0.6, depthM = 0.4): StudioPiece => ({ id, name: id, kind: 'NIGHTSTAND', config: { ...defaultPieceConfig('NIGHTSTAND'), widthM, depthM }, updatedAt: 0 });
const placement = (id: string, pieceId: string, x: number, z = 0, rotation: StudioPlacement['rotation'] = 0): StudioPlacement => ({ id, pieceId, x, z, rotation });
function setup(pieces: StudioPiece[], placements: StudioPlacement[], rooms: StudioScene[] = []) {
  useStudioStore.setState({ pieces: Object.fromEntries(pieces.map((p) => [p.id, p])), scenes: [{ id: 'room', name: 'Room', room, placements, openings: [] }, ...rooms], activeSceneId: 'room', history: [], future: [], gestureHistoryPending: false, selectedId: null, selectedOpeningId: null, collisionReason: null, house: undefined });
}
const state = () => useStudioStore.getState();
const active = () => state().scenes[0];
beforeEach(() => { localStorage.clear(); setup([piece()], []); });

describe('Studio collision-safe mutations', () => {
  it('rejects lowering a floating cabinet into a floor piece and raising it through the ceiling atomically', () => {
    const upper: StudioPiece = { id: 'upper', name: 'Upper', kind: 'WALL_CABINET', config: defaultPieceConfig('WALL_CABINET'), updatedAt: 0 };
    setup([piece(), upper], [placement('a', 'p', 0), placement('b', 'upper', 0)]);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
    expect(state().savePiece({ ...upper, config: { ...upper.config, mountingHeightM: 0.3 } })).toBeNull();
    expect(state().collisionReason).toBe('FURNITURE');
    expect(state().savePiece({ ...upper, config: { ...upper.config, mountingHeightM: 2.2 } })).toBeNull();
    expect(state().collisionReason).toBe('ROOM_BOUNDS');
    expect(state().pieces.upper.config.mountingHeightM).toBe(1.2);
    expect(state().history).toHaveLength(0);
  });
  it('rejects an occupied drop without replacing selection or adding history', () => {
    setup([piece()], [placement('a', 'p', 0)]);
    expect(state().placePieceAt('p', 0, 0)).toBe(false);
    expect(active().placements).toHaveLength(1);
    expect(state().history).toHaveLength(0);
    expect(state().collisionReason).toBe('FURNITURE');
    expect(state().placePieceAt('p', 0.6, 0)).toBe(true);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
    expect(state().collisionReason).toBeNull();
  });
  it('places new pieces in a free location and refuses oversized pieces', () => {
    setup([piece()], [placement('a', 'p', 0)]);
    expect(state().placePiece('p')).toBe(true);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
    setup([piece('large', 5)], []);
    expect(state().placePiece('large')).toBe(false);
    expect(state().placePieceAt('large', 0, 0)).toBe(false);
    expect(active().placements).toHaveLength(0);
    expect(state().collisionReason).toBe('ROOM_BOUNDS');
  });
  it('does not tunnel when dragged or nudged across furniture', () => {
    setup([piece()], [placement('moving', 'p', -1), placement('fixed', 'p', 0)]);
    expect(state().movePlacement('moving', 1.2, 0)).toBe(true);
    expect(active().placements[0].x).toBeCloseTo(-0.6, 8);
    expect(state().movePlacement('moving', -0.59, 0)).toBe(false);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
  });
  it('rejects a rotation that would intersect furniture without changing history', () => {
    setup([piece()], [placement('a', 'p', 0), placement('b', 'p', 0, 0.45)]);
    expect(state().rotatePlacement('a')).toBe(false);
    expect(active().placements[0].rotation).toBe(0);
    expect(state().history).toHaveLength(0);
    expect(state().collisionReason).toBe('FURNITURE');
  });
  it('rotates valid placements and duplicate search uses their rotated footprint', () => {
    setup([piece()], [placement('a', 'p', 1.7, 0)]);
    expect(state().rotatePlacement('a')).toBe(true);
    expect(active().placements[0].rotation).toBe(90);
    expect(state().duplicatePlacement('a')).toBe(true);
    expect(active().placements[1].rotation).toBe(90);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
  });
  it('returns no space instead of adding an overlapping duplicate', () => {
    setup([piece('full', 4, 4)], [placement('a', 'full', 0)]);
    expect(state().placePiece('full')).toBe(false);
    expect(state().duplicatePlacement('a')).toBe(false);
    expect(active().placements).toHaveLength(1);
    expect(state().collisionReason).toBe('NO_SPACE');
  });
  it('rejects a shared piece enlargement atomically if any room would collide', () => {
    const original = piece();
    const other: StudioScene = { id: 'other', name: 'Other', room, openings: [], placements: [placement('b', 'p', 0), placement('c', 'p', 0.62)] };
    setup([original], [placement('a', 'p', 0)], [other]);
    const scenes = state().scenes, pieces = state().pieces;
    expect(state().savePiece({ id: 'p', name: 'Edited', kind: 'NIGHTSTAND', config: { ...original.config, widthM: 0.8 } })).toBeNull();
    expect(state().scenes).toBe(scenes);
    expect(state().pieces).toBe(pieces);
    expect(state().history).toHaveLength(0);
  });
  it('accepts geometry edits that fit and finish edits in inherited overlaps', () => {
    setup([piece()], [placement('a', 'p', 0)]);
    expect(state().savePiece({ ...state().pieces.p, config: { ...state().pieces.p.config, widthM: 0.7 } })).not.toBeNull();
    setup([piece()], [placement('a', 'p', 0), placement('b', 'p', 0.1)]);
    expect(state().savePiece({ ...state().pieces.p, config: { ...state().pieces.p.config, finish: 'ALB' } })).not.toBeNull();
    expect(state().movePlacement('b', 0.8, 0)).toBe(true);
    expect(overlappingPlacements(active().placements, state().pieces).size).toBe(0);
  });
  it('rejects room shrinking that squeezes furniture together and preserves all room data', () => {
    setup([piece('wide', 1.2, 0.4)], [placement('a', 'wide', -0.8), placement('b', 'wide', 0.8)]);
    const scenes = state().scenes;
    expect(state().setRoom({ widthM: 2 })).toBe(false);
    expect(state().scenes).toBe(scenes);
    expect(state().collisionReason).toBe('FURNITURE');
    expect(state().setRoom({ floorColor: 'NUC' })).toBe(true);
    expect(active().room.floorColor).toBe('NUC');
  });
  it('clamps furniture on a valid room resize and rejects ceiling penetration', () => {
    setup([piece()], [placement('a', 'p', 1.6)]);
    expect(state().setRoom({ widthM: 2 })).toBe(true);
    expect(active().placements[0].x).toBeCloseTo(0.7, 8);
    const wardrobe: StudioPiece = { id: 'w', name: 'Wardrobe', kind: 'WARDROBE', config: defaultPieceConfig('WARDROBE'), updatedAt: 0 };
    setup([wardrobe], [placement('a', 'w', 0)]);
    expect(state().setRoom({ wallHeightM: 2.2 })).toBe(false);
    expect(active().room.wallHeightM).toBe(2.6);
    expect(state().collisionReason).toBe('ROOM_BOUNDS');
  });
  it('keeps collision feedback transient and restores valid geometry with undo', () => {
    expect(state().placePiece('p')).toBe(true);
    expect(state().placePieceAt('p', 0, 0)).toBe(false);
    expect(JSON.stringify(state().snapshot())).not.toContain('collisionReason');
    state().clearCollision();
    expect(state().collisionReason).toBeNull();
    state().undo();
    expect(active().placements).toHaveLength(0);
  });
});

describe('Studio deferred gesture history', () => {
  it('preserves redo after a click, unchanged move, or completely blocked move', () => {
    setup([piece()], [placement('moving', 'p', -0.6), placement('fixed', 'p', 0)]);
    expect(state().placePieceAt('p', 1.5, 0)).toBe(true);
    state().undo();
    const future = state().future;
    state().recordHistory();
    expect(state().future).toBe(future);
    expect(state().history).toHaveLength(0);
    expect(state().movePlacement('moving', -0.6, 0)).toBe(false);
    state().recordHistory();
    expect(state().movePlacement('moving', 0, 0)).toBe(false);
    expect(state().history).toHaveLength(0);
    expect(state().future).toBe(future);
    state().redo();
    expect(active().placements).toHaveLength(3);
    expect(state().gestureHistoryPending).toBe(false);
  });

  it('records one undo for a drag that moves repeatedly, stops at contact, then is blocked', () => {
    setup([piece()], [placement('moving', 'p', -1), placement('fixed', 'p', 0)]);
    state().recordHistory();
    expect(state().movePlacement('moving', -0.9, 0)).toBe(true);
    expect(state().movePlacement('moving', 1, 0)).toBe(true);
    expect(state().movePlacement('moving', 0, 0)).toBe(false);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(active().placements[0].x).toBe(-1);
    state().redo();
    expect(active().placements[0].x).toBeCloseTo(-0.6, 8);
    state().recordHistory();
    expect(state().movePlacement('moving', -0.8, 0)).toBe(true);
    expect(state().history).toHaveLength(2);
    state().undo();
    expect(active().placements[0].x).toBeCloseTo(-0.6, 8);
  });

  it('starts a new undo branch for an accepted nudge after undo even within the same key burst', () => {
    setup([piece()], [placement('moving', 'p', 0)]);
    state().recordHistory();
    state().movePlacement('moving', 0.1, 0);
    state().undo();
    expect(state().movePlacement('moving', -0.1, 0)).toBe(true);
    expect(state().future).toHaveLength(0);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(active().placements[0].x).toBe(0);
  });

  it('keeps redo through rejected/no-op room edits and groups a successful resize', () => {
    setup([piece('wide', 1.2, 0.4)], [placement('a', 'wide', -0.8), placement('b', 'wide', 0.8)]);
    state().recordHistory();
    state().setRoom({ floorColor: 'NUC' });
    state().undo();
    const future = state().future;
    state().recordHistory();
    expect(state().setRoom({ widthM: 2 })).toBe(false);
    expect(state().setRoom({ widthM: 4, floorColor: 'STEJAR' })).toBe(true);
    expect(state().history).toHaveLength(0);
    expect(state().future).toBe(future);
    expect(state().setRoom({ widthM: 3.8 })).toBe(true);
    expect(state().setRoom({ widthM: 3.6 })).toBe(true);
    expect(state().history).toHaveLength(1);
    expect(state().future).toHaveLength(0);
    state().undo();
    expect(active().room.widthM).toBe(4);
    state().redo();
    expect(active().room.widthM).toBe(3.6);
  });

  it('lets a discrete change consume pending history without adding an empty entry', () => {
    setup([piece()], [placement('a', 'p', 0)]);
    state().recordHistory();
    expect(state().rotatePlacement('a')).toBe(true);
    expect(state().gestureHistoryPending).toBe(false);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(active().placements[0].rotation).toBe(0);
    state().recordHistory();
    state().undo();
    expect(state().gestureHistoryPending).toBe(false);
  });

  it('keeps pending gesture state out of snapshots and persisted drafts', () => {
    state().recordHistory();
    expect(state().gestureHistoryPending).toBe(true);
    expect(JSON.stringify(state().snapshot())).not.toContain('gestureHistoryPending');
    expect(localStorage.getItem('mm_studio_v3')).not.toContain('gestureHistoryPending');
  });

  it('groups opening movement and resizing while unchanged values leave history alone', () => {
    expect(state().addOpening('DOOR')).toBe(true);
    const id = active().openings[0].id;
    useStudioStore.setState({ history: [], future: [] });
    state().recordHistory();
    state().moveOpening(id, 0);
    expect(state().resizeOpening(id, { w: 0.9 })).toBe(true);
    expect(state().history).toHaveLength(0);
    state().moveOpening(id, 0.1);
    state().moveOpening(id, 0.2);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(active().openings[0].offset).toBe(0);
    state().recordHistory();
    expect(state().resizeOpening(id, { w: 1 })).toBe(true);
    expect(state().resizeOpening(id, { w: 1.1 })).toBe(true);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(active().openings[0].w ?? 0.9).toBe(0.9);
  });

  it('defers house-room movement until the transform changes', () => {
    state().enableHouse();
    useStudioStore.setState({ history: [], future: [] });
    const transform = state().house!.roomTransforms.room;
    state().recordHistory();
    state().moveHouseRoom('room', transform, false);
    expect(state().history).toHaveLength(0);
    state().moveHouseRoom('room', { x: transform.x + 0.1 }, false);
    state().moveHouseRoom('room', { x: transform.x + 0.2 }, false);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(state().house!.roomTransforms.room.x).toBe(transform.x);
  });

  it('groups linked-door changes across both rooms and ignores unchanged dimensions', () => {
    setup([], [], [{ id: 'other', name: 'Other', room, placements: [], openings: [] }]);
    expect(state().connectRooms('room', 'other', 'E')).toBe(true);
    const connection = state().house!.connections[0], id = connection.openingA;
    useStudioStore.setState({ history: [], future: [] });
    const before = state().scenes;
    const opening = active().openings.find((o) => o.id === id)!;
    state().recordHistory();
    state().moveOpening(id, opening.offset);
    expect(state().resizeOpening(id, { w: opening.w ?? 0.9 })).toBe(true);
    expect(state().history).toHaveLength(0);
    state().moveOpening(id, opening.offset + 0.1);
    state().moveOpening(id, opening.offset + 0.2);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(state().scenes).toBe(before);
    state().recordHistory();
    expect(state().resizeOpening(id, { w: 1 })).toBe(true);
    expect(state().resizeOpening(id, { w: 1.1 })).toBe(true);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(state().scenes).toBe(before);
  });
});
