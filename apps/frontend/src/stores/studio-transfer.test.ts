import { describe, expect, it } from 'vitest';
import { NEW_PIECE_KINDS, defaultPieceConfig, defaultStudioHouse, type StudioDraftData } from '@marketplace/shared';
import { prepareStudioTransfer, synchronizeStudioSnapshots, invalidStudioRequestEntries } from './studio-transfer';
import { studioVersionedStorage } from './studio-persistence';

const fixture = (): StudioDraftData => ({ version: 3, activeSceneId: 'room', pieces: { p: { id: 'p', name: 'Nightstand', kind: 'NIGHTSTAND', config: defaultPieceConfig('NIGHTSTAND'), updatedAt: 0 } }, scenes: [{ id: 'room', name: 'Bedroom', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, openings: [], placements: [{ id: 'one', pieceId: 'p', x: -0.6, z: 0, rotation: 0 }, { id: 'two', pieceId: 'p', x: 0.6, z: 0, rotation: 0 }] }] });
let counter = 0;
const id = () => `entry${++counter}`;
describe('studio request transfer and recovery', () => {
  it('marks an edited mounted cabinet invalid before publication while preserving the stored scene', () => {
    const data = fixture();
    data.pieces.p = { ...data.pieces.p, kind: 'WALL_CABINET', config: defaultPieceConfig('WALL_CABINET') };
    data.scenes[0].placements = [data.scenes[0].placements[0]];
    const transfer = prepareStudioTransfer(data, [], [], id);
    if (!transfer.ok) throw new Error(transfer.error);
    const rooms = transfer.roomInstances.map(room => ({ ...room, answers: { config3d: { ...data.pieces.p.config, mountingHeightM: 2.2 } } }));
    const snapshots = synchronizeStudioSnapshots(transfer.studioScenes, rooms);
    expect(invalidStudioRequestEntries(snapshots)).toEqual(new Set([rooms[0].localId]));
    expect(data.pieces.p.config.mountingHeightM).toBe(1.2);
  });
  it.each(NEW_PIECE_KINDS)('preserves %s as its own request type and retains every configuration field', (kind) => {
    const data = fixture();
    data.pieces.p = { ...data.pieces.p, kind, config: defaultPieceConfig(kind) };
    data.scenes[0].placements = [data.scenes[0].placements[0]];
    const transfer = prepareStudioTransfer(JSON.parse(JSON.stringify(data)), [], [], id);
    if (!transfer.ok) throw new Error(transfer.error);
    expect(transfer.roomInstances[0].roomType).toBe(`PIECE_${kind}`);
    expect(transfer.roomInstances[0].flowVersion).toBe(1);
    expect(transfer.roomInstances[0].answers.config3d).toEqual(data.pieces.p.config);
    expect(transfer.studioScenes[0].pieces.p.config).toEqual(data.pieces.p.config);
  });
  it('upgrades the single-room v1 envelope including its historical room defaults', async () => {
    const data = fixture(), raw = JSON.stringify({ version: 1, state: { pieces: data.pieces, placements: data.scenes[0].placements } });
    const storage = studioVersionedStorage({ getItem: (key) => key === 'mm_studio_v1' ? raw : null, setItem: () => undefined, removeItem: () => undefined }, () => undefined);
    const restored = JSON.parse((await storage.getItem('mm_studio_v3'))!);
    expect(restored.version).toBe(3); expect(restored.state.scenes[0].placements).toHaveLength(2);
    expect(restored.state.scenes[0].room.widthM).toBe(4.2); expect(restored.state.activeSceneId).toBe('legacy-room');
  });
  it('resending updates existing units without duplication and preserves specification attachments', () => {
    const data = fixture(), first = prepareStudioTransfer(data, [], [], id); if (!first.ok) throw new Error();
    first.roomInstances[0].answers.material = 'MDF'; first.roomInstances[0].answers.sketch = ['file1'];
    const second = prepareStudioTransfer(data, first.roomInstances, first.studioScenes, id); if (!second.ok) throw new Error();
    expect(second.roomInstances).toHaveLength(2);
    expect(second.roomInstances.map((r) => r.localId)).toEqual(first.roomInstances.map((r) => r.localId));
    expect(second.roomInstances.every((r) => r.answers.count === 'ONE')).toBe(true);
    expect(second.roomInstances[0].answers.sketch).toEqual(['file1']);
    data.scenes[0].placements.pop();
    const removed = prepareStudioTransfer(data, second.roomInstances, second.studioScenes, id); if (!removed.ok) throw new Error();
    expect(removed.roomInstances).toHaveLength(1);
  });
  it('editing a single quoted unit does not edit a shared library duplicate', () => {
    const transfer = prepareStudioTransfer(fixture(), [], [], id); if (!transfer.ok) throw new Error();
    transfer.roomInstances[0].answers.config3d = { ...defaultPieceConfig('NIGHTSTAND'), finish: 'ALB' };
    const snapshots = synchronizeStudioSnapshots(transfer.studioScenes, transfer.roomInstances);
    const scene = snapshots[0];
    expect(scene.pieces[scene.scene.placements[0].pieceId].config.finish).toBe('ALB');
    expect(scene.pieces[scene.scene.placements[1].pieceId].config.finish).toBe('STEJAR');
  });
  it('refuses overflow atomically and retains every source placement', () => {
    const data = fixture(); data.scenes[0].placements = Array.from({ length: 51 }, (_, i) => ({ id: `pl${i}`, pieceId: 'p', x: 0, z: 0, rotation: 0 }));
    expect(prepareStudioTransfer(data, [], [], id)).toEqual({ ok: false, error: 'CAPACITY' });
    expect(data.scenes[0].placements).toHaveLength(51);
  });
  it('copies legacy local data once without changing the old storage key and blocks future versions', async () => {
    const values = new Map<string, string>(); const data = fixture();
    values.set('mm_studio_v1', JSON.stringify({ version: 2, state: data }));
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    const original = values.get('mm_studio_v1');
    let errors = 0;
    const safe = studioVersionedStorage(storage, () => { errors++; });
    const restored = await safe.getItem('mm_studio_v3');
    expect(JSON.parse(restored!).version).toBe(3); expect(values.get('mm_studio_v1')).toBe(original);
    values.set('mm_studio_v3', JSON.stringify({ version: 99, state: data }));
    await expect(safe.getItem('mm_studio_v3')).rejects.toThrow();
    await safe.setItem('mm_studio_v3', 'lost'); expect(JSON.parse(values.get('mm_studio_v3')!).version).toBe(99); expect(errors).toBe(1);
  });
  it('retains overlapping local room edits for recovery, but refuses transfer', async () => {
    const data = fixture(); data.scenes.push({ ...data.scenes[0], id: 'second', placements: [] }); data.house = defaultStudioHouse(data.scenes);
    data.house.roomTransforms.second = { ...data.house.roomTransforms.room };
    const raw = JSON.stringify({ version: 3, state: data });
    const storage = studioVersionedStorage({ getItem: () => raw, setItem: () => undefined, removeItem: () => undefined }, () => undefined);
    expect(await storage.getItem('mm_studio_v3')).not.toBeNull();
    expect(prepareStudioTransfer(data, [], [], id)).toEqual({ ok: false, error: 'INVALID_LAYOUT' });
  });
});
