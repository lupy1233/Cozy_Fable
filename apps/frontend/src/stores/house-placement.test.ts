import { beforeEach, describe, expect, it } from 'vitest';
import { houseLayoutErrors, type StudioScene, type StudioHouse } from '@marketplace/shared';
import { useStudioStore } from './studio-store';
import { studioVersionedStorage } from './studio-persistence';

const state = () => useStudioStore.getState();
function setup() {
  const scenes: StudioScene[] = [
    { id: 'study', name: 'Study', room: { widthM: 2, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] },
    { id: 'living', name: 'Living', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] },
  ];
  const house: StudioHouse = { version: 1, floors: [{ id: 'ground', name: '1' }], connections: [], roomTransforms: {
    study: { floorId: 'ground', x: 0, z: 0, rotation: 0 }, living: { floorId: 'ground', x: 3.59, z: 0, rotation: 0 },
  } };
  useStudioStore.setState({ scenes, house, pieces: {}, activeSceneId: 'study', history: [], future: [], gestureHistoryPending: false, collisionReason: null, cutawayWalls: false });
}
beforeEach(() => { localStorage.clear(); setup(); });

describe('House room placement mutations', () => {
  it('blocks overlap through exact or snapping position edits without replacing history', () => {
    const before = state().house;
    state().recordHistory();
    expect(state().moveHouseRoom('study', { x: 2.5 }, false)).toBe(false);
    expect(state().moveHouseRoom('study', { x: 2.5 })).toBe(false);
    expect(state().house).toBe(before);
    expect(state().history).toHaveLength(0);
    expect(state().collisionReason).toBe('HOUSE_ROOMS');
  });
  it('previews and commits a wall snap without allowing overlap, with one undo and redo', () => {
    state().recordHistory();
    expect(state().moveHouseRoom('study', { x: 0.44 })).toBe(true);
    expect(state().house!.roomTransforms.study.x).toBeCloseTo(0.5);
    expect(houseLayoutErrors(state().house!, state().scenes)).toEqual([]);
    expect(state().history).toHaveLength(1);
    state().undo();
    expect(state().house!.roomTransforms.study.x).toBe(0);
    state().redo();
    expect(state().house!.roomTransforms.study.x).toBeCloseTo(0.5);
  });
  it('retains redo when a move, rotation or enlargement is rejected', () => {
    state().recordHistory();
    state().moveHouseRoom('study', { x: -1 }, false);
    state().undo();
    const future = state().future, scenes = state().scenes, house = state().house;
    state().recordHistory();
    expect(state().moveHouseRoom('study', { rotation: 90 })).toBe(false);
    expect(state().setRoom({ widthM: 3.4 })).toBe(false);
    expect(state().moveHouseRoom('study', { x: 2 })).toBe(false);
    expect(state().future).toBe(future);
    expect(state().scenes).toBe(scenes);
    expect(state().house).toBe(house);
    state().redo();
    expect(state().house!.roomTransforms.study.x).toBe(-1);
  });
  it('permits shrinking, finishes and valid rotation while rejecting a larger occupied footprint', () => {
    expect(state().setRoom({ floorColor: 'BETON' })).toBe(true);
    state().recordHistory();
    expect(state().setRoom({ depthM: 2 })).toBe(true);
    state().recordHistory();
    expect(state().moveHouseRoom('study', { rotation: 90 }, false)).toBe(true);
    expect(state().setRoom({ depthM: 4 })).toBe(false);
    expect(state().scenes[0].room.depthM).toBe(2);
  });
  it('places newly added and duplicated rooms in free house positions', () => {
    state().addScene('New room');
    state().duplicateScene('living', 'Living copy');
    const snapshot = state().snapshot();
    expect(snapshot.scenes).toHaveLength(4);
    expect(houseLayoutErrors(snapshot.house!, snapshot.scenes)).toEqual([]);
  });
  it('rejects out-of-range coordinates, invalid floor and rotation without content changes', () => {
    const before = state().house;
    expect(state().moveHouseRoom('study', { x: Number.NaN })).toBe(false);
    expect(state().moveHouseRoom('study', { x: 101 })).toBe(false);
    expect(state().moveHouseRoom('study', { floorId: 'absent' })).toBe(false);
    expect(state().moveHouseRoom('study', { rotation: 45 as 90 })).toBe(false);
    expect(state().house).toBe(before);
  });
});

describe('Wall display preference', () => {
  it('persists both choices without adding history or changing draft content', async () => {
    const snapshot = state().snapshot();
    for (const cutaway of [true, false]) {
      state().setCutawayWalls(cutaway);
      expect(JSON.parse(localStorage.getItem('mm_studio_v3')!).state.cutawayWalls).toBe(cutaway);
      expect(state().snapshot()).toEqual(snapshot);
      expect(state().history).toHaveLength(0);
      // Schimba doar memoria, pastrand copia reala de pe disc pentru rehidratare.
      const saved = localStorage.getItem('mm_studio_v3')!;
      useStudioStore.setState({ cutawayWalls: !cutaway });
      localStorage.setItem('mm_studio_v3', saved);
      await useStudioStore.persist.rehydrate();
      expect(state().cutawayWalls).toBe(cutaway);
    }
  });
  it('keeps the preference through undo, redo and loading another draft', () => {
    const snapshot = state().snapshot();
    state().recordHistory();
    state().moveHouseRoom('study', { x: -1 }, false);
    state().setCutawayWalls(true);
    state().undo();
    expect(state().cutawayWalls).toBe(true);
    state().redo();
    expect(state().cutawayWalls).toBe(true);
    state().loadSnapshot(snapshot);
    expect(state().cutawayWalls).toBe(true);
  });
  it.each([undefined, 'true', 1, null])('defaults old or invalid preference %s to full walls', async (value) => {
    const raw = JSON.stringify({ version: 3, state: { ...state().snapshot(), cutawayWalls: value } });
    const storage = studioVersionedStorage({ getItem: () => raw, setItem: () => {}, removeItem: () => {} }, () => { throw new Error('Unexpected storage error'); });
    expect(JSON.parse((await storage.getItem('mm_studio_v3'))!).state.cutawayWalls).toBe(false);
  });
});
