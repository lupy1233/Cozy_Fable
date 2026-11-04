import { describe, expect, it } from 'vitest';
import { defaultStudioHouse, connectHouseRooms, houseLayoutErrors, houseConnectionValid, houseWorldPoint, updateHouseDoor, syncHouseRooms } from './studio-house';
import { buildHouseWallPanels } from './studio-house-walls';
import { readRequestStudioSceneData, readStudioDraftData, studioDraftDataSchema, type StudioScene, type StudioDraftData } from './studio.schemas';
import { defaultPieceConfig } from './questionnaire/piece3d';

const scene = (id: string): StudioScene => ({ id, name: id, room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] });
const draft = (): StudioDraftData => ({ version: 3, pieces: {}, scenes: [scene('a'), scene('b')], activeSceneId: 'a' });

describe('house geometry and versioned readers', () => {
  it('normalizes only unmapped historical published furniture without mutating the source', () => {
    const raw = { scene: scene('a'), pieces: { p: { id: 'p', name: 'Legacy', kind: 'NIGHTSTAND', updatedAt: 0, config: { ...defaultPieceConfig('NIGHTSTAND'), columns: [{ zones: [{ type: 'SHELVES', count: 1 }] }] } } } };
    const original = JSON.stringify(raw);
    expect(readRequestStudioSceneData(raw).pieces.p.config.columns[0].zones[0]).toMatchObject({ type: 'OPEN', fill: 'SHELVES' });
    expect(JSON.stringify(raw)).toBe(original);
    const invalid = { ...raw, pieces: { p: { ...raw.pieces.p, config: {} } }, requestEntryIds: {}, requestEntryIdKind: 'LOCAL' };
    expect(() => readRequestStudioSceneData(invalid)).toThrow();
  });
  for (const rotationA of [0, 90, 180, 270] as const) for (const rotationB of [0, 90, 180, 270] as const) {
    it(`aligns doorway at room rotations ${rotationA}/${rotationB}`, () => {
      const scenes = [scene('a'), scene('b')], house = defaultStudioHouse(scenes);
      house.roomTransforms.a.rotation = rotationA; house.roomTransforms.b.rotation = rotationB;
      const result = connectHouseRooms(house, scenes, 'a', 'b', 'E', 'test');
      expect(result).not.toBeNull();
      expect(houseLayoutErrors(result!.house, result!.scenes)).toEqual([]);
      expect(houseConnectionValid(result!.house.connections[0], result!.house, result!.scenes)).toBe(true);
      const changed = updateHouseDoor(result!.house, result!.scenes, 'test', 'ha_test', { w: 1.1, offset: 0.3 });
      expect(changed).not.toBeNull();
      expect(houseConnectionValid(result!.house.connections[0], result!.house, changed!)).toBe(true);
    });
  }
  it('does not change furniture local coordinates during room transforms', () => {
    const data = draft(); data.scenes[0].placements.push({ id: 'pl', pieceId: 'bed', x: 0.2, z: 0.3, rotation: 90 });
    data.pieces.bed = { id: 'bed', name: 'Bed', kind: 'BED', config: defaultPieceConfig('BED'), updatedAt: 0 };
    const house = defaultStudioHouse(data.scenes);
    house.roomTransforms.a = { floorId: 'ground', x: 10, z: 5, rotation: 90 };
    expect(houseWorldPoint(house.roomTransforms.a, 0.2, 0.3)).toEqual({ x: 10.3, z: 4.8 });
    expect(data.scenes[0].placements[0]).toMatchObject({ x: 0.2, z: 0.3, rotation: 90 });
  });
  it('renders a common wall exactly once including its doorway cutout', () => {
    const scenes = [scene('a'), scene('b')];
    const result = connectHouseRooms(defaultStudioHouse(scenes), scenes, 'a', 'b', 'E', 'test')!;
    const panels = buildHouseWallPanels(result.house, result.scenes);
    const volume = panels.reduce((n, p) => n + p.w * p.h * p.d, 0);
    expect(volume).toBeCloseTo((28 * 2.6 - 0.9 * 2.05) * 0.09, 5);
    expect(panels.every((p) => p.h > 0 && p.w > 0 && p.d > 0)).toBe(true);
  });
  it('rejects overlaps, invalid references, oversized doors and future formats', () => {
    const data = draft(); const house = defaultStudioHouse(data.scenes);
    house.roomTransforms.b = { ...house.roomTransforms.a };
    expect(studioDraftDataSchema.safeParse({ ...data, house }).success).toBe(false);
    expect(() => readStudioDraftData({ ...data, version: 4 })).toThrow('Unsupported');
    const valid = connectHouseRooms(defaultStudioHouse(data.scenes), data.scenes, 'a', 'b', 'E', 'link')!;
    expect(updateHouseDoor(valid.house, valid.scenes, 'link', 'ha_link', { w: 1.3 })).toBeNull();
    expect(updateHouseDoor(valid.house, valid.scenes, 'link', 'ha_link', { offset: 2 })).toBeNull();
  });
  it('preserves incomplete local placement for correction while preventing account save', () => {
    const data = draft(), house = defaultStudioHouse(data.scenes);
    house.roomTransforms.b = { ...house.roomTransforms.a };
    expect(readStudioDraftData({ ...data, house }, true).house).toEqual(house);
    expect(() => readStudioDraftData({ ...data, house })).toThrow();
  });
  it('upgrades v2 JSON without changing the original or historical piece answers', () => {
    const original = { ...draft(), version: 2, pieces: { p: { id: 'p', name: 'Wardrobe', kind: 'WARDROBE', config: defaultPieceConfig('WARDROBE'), updatedAt: 0 } } };
    const before = JSON.stringify(original), upgraded = readStudioDraftData(original);
    expect(upgraded.version).toBe(3); expect(upgraded.house).toBeUndefined();
    expect(JSON.stringify(original)).toBe(before);
    expect(readStudioDraftData(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded);
  });
  it('removes transforms/connections for deleted rooms and places duplicates separately', () => {
    const scenes = [scene('a'), scene('b')];
    const linked = connectHouseRooms(defaultStudioHouse(scenes), scenes, 'a', 'b', 'E', 'link')!;
    const next = syncHouseRooms(linked.house, [scenes[0], scene('copy')]);
    expect(next.connections).toEqual([]); expect(next.roomTransforms.b).toBeUndefined();
    expect(houseLayoutErrors(next, [scenes[0], scene('copy')])).toEqual([]);
  });
  it('does not overwrite existing windows while connecting rooms', () => {
    const scenes = [scene('a'), scene('b')];
    scenes[0].openings.push({ id: 'window', wall: 'E', offset: 0, kind: 'WINDOW' });
    expect(connectHouseRooms(defaultStudioHouse(scenes), scenes, 'a', 'b', 'E', 'link')).toBeNull();
    expect(scenes[0].openings).toHaveLength(1);
  });
});
