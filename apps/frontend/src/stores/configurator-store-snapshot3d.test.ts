import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { enterEditSession, leaveEditSession, useConfiguratorStore, type RoomInstance } from './configurator-store';
import { CONFIGURATOR_STORAGE_KEY } from './configurator-keys';
import { readEditSnapshotFiles, recordEditReplaced, recordEditUpload } from './edit-snapshot-files';

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn(async () => undefined) }));
import { config3dKey, snapshot3dStatus } from './snapshot3d';

const OLD = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const NEW = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
const config = defaultPieceConfig('DESK');
const desk = (answers: Record<string, unknown>, extra: Partial<RoomInstance> = {}): RoomInstance => ({
  localId: 'd',
  roomType: 'PIECE_DESK',
  flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK,
  answers: answers as never,
  completed: false,
  ...extra,
});
const s = () => useConfiguratorStore.getState();
function load(rooms: RoomInstance[]) {
  s().loadSnapshot({ ...s().snapshot(), startMode: 'STANDARD', phase: 'review', roomInstances: rooms });
}

// d4: imaginea 3D a piesei — ce rezista la reincarcare si cand e veche
describe('configurator store — 3D picture (d4)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    leaveEditSession();
    s().reset();
  });

  it('a capture carries the key of the current configuration; rooms without a 3D piece are ignored', () => {
    load([desk({ config3d: config }), { localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: false }]);
    s().setSnapshot3d('d', 'data:image/png;base64,AAA');
    s().setSnapshot3d('k', 'data:image/png;base64,AAA');
    expect(s().snapshots3d).toEqual({ d: { dataUrl: 'data:image/png;base64,AAA', key: config3dKey(config) } });
    s().setSnapshot3d('d', null);
    expect(s().snapshots3d).toEqual({});
  });

  it('the uploaded picture lives in the answers with its key, survives a reload and returns the replaced file', () => {
    load([desk({ config3d: config, snapshot3d: [OLD] }, { snapshot3dKey: 'old' })]);
    const replaced = s().setSnapshot3dFile('d', NEW, config3dKey(config));
    expect(replaced).toEqual([OLD]);
    const room = s().roomInstances[0];
    expect(room.answers.snapshot3d).toEqual([NEW]);
    expect(snapshot3dStatus(room)).toBe('fresh');
    // ciorna trimisa serverului si cea din localStorage au fisierul + cheia
    expect(s().snapshot().roomInstances[0]).toMatchObject({ answers: { snapshot3d: [NEW] }, snapshot3dKey: config3dKey(config) });
    const persisted = JSON.parse(localStorage.getItem(CONFIGURATOR_STORAGE_KEY) ?? '{}') as { state: { roomInstances: RoomInstance[] } };
    expect(persisted.state.roomInstances[0]).toMatchObject({ answers: { snapshot3d: [NEW] }, snapshot3dKey: config3dKey(config) });
    // "reincarcare": aceeasi ciorna incarcata din nou → imaginea e tot a configuratiei
    const saved = s().snapshot();
    s().reset();
    s().loadSnapshot(saved);
    expect(snapshot3dStatus(s().roomInstances[0])).toBe('fresh');
    // camera disparuta → null (fisierul nou e de sters de apelant)
    expect(s().setSnapshot3dFile('nope', NEW, 'x')).toBeNull();
  });

  it('changing the configuration makes the picture stale', () => {
    load([desk({ config3d: config, snapshot3d: [OLD] }, { snapshot3dKey: config3dKey(config) })]);
    s().setAnswer('d', 'config3d', { ...config, widthM: config.widthM + 0.1 } as never);
    expect(snapshot3dStatus(s().roomInstances[0])).toBe('stale');
  });

  it('a picture without key is stale on a new request, but adopted when editing a published one', () => {
    load([desk({ config3d: config, snapshot3d: [OLD] })]);
    expect(snapshot3dStatus(s().roomInstances[0])).toBe('stale');
    enterEditSession('req-1');
    s().loadSnapshot({ ...s().snapshot(), startMode: 'STANDARD', roomInstances: [desk({ config3d: config, snapshot3d: [OLD] })] });
    expect(snapshot3dStatus(s().roomInstances[0])).toBe('fresh');
    leaveEditSession();
  });

  // revizuire M2: tab inchis in mijlocul editarii → la urmatoarea intrare se curata
  it('entering an edit built from the saved request deletes leftover 3D files the request does not use', () => {
    recordEditUpload('req-2', NEW);
    recordEditReplaced('req-2', [OLD]);
    enterEditSession('req-2');
    s().loadSnapshot({ ...s().snapshot(), startMode: 'STANDARD', roomInstances: [desk({ config3d: config, snapshot3d: [OLD] })] });
    expect(api.api).toHaveBeenCalledWith(`/requests/req-2/attachments/${NEW}`, { method: 'DELETE' });
    expect(api.api).not.toHaveBeenCalledWith(`/requests/req-2/attachments/${OLD}`, expect.anything());
    expect(readEditSnapshotFiles('req-2')).toEqual({ uploads: [], replaced: [] });
    leaveEditSession();
  });

  it('discardFiles adds files once', () => {
    s().discardFiles([OLD]);
    s().discardFiles([OLD, NEW]);
    expect(s().discardedFiles).toEqual([OLD, NEW]);
  });
});
