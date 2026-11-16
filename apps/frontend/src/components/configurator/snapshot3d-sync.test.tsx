import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { config3dKey, snapshot3dStatus } from '@/stores/snapshot3d';
import { syncRoomSnapshot, type Snapshot3dIo } from './snapshot3d-sync';

const OLD = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const NEW = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const config = defaultPieceConfig('DESK');
const s = () => useConfiguratorStore.getState();

function load(extra: Partial<RoomInstance> = {}, answers: Record<string, unknown> = {}) {
  s().loadSnapshot({
    ...s().snapshot(),
    startMode: 'STANDARD',
    phase: 'rooms',
    roomInstances: [{ localId: 'd', roomType: 'PIECE_DESK', flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK, answers: { config3d: config, ...answers } as never, completed: false, ...extra }],
  });
}

function io(overrides: Partial<Snapshot3dIo> = {}) {
  return {
    upload: vi.fn(async (_file: File) => ({ id: NEW })),
    remove: vi.fn(async (_id: string) => undefined),
    ...overrides,
  };
}

// d4 pas 1: imaginea urca imediat ca fisier al ciornei; cea veche se sterge
describe('syncRoomSnapshot (d4)', () => {
  beforeEach(() => {
    localStorage.clear();
    s().reset();
  });

  it('uploads the capture of the current configuration, keeps it in the answers and deletes the replaced file', async () => {
    load({ snapshot3dKey: 'old' }, { snapshot3d: [OLD] });
    s().setSnapshot3d('d', PNG);
    const fake = io();
    await expect(syncRoomSnapshot('d', fake)).resolves.toBe(true);
    expect(fake.upload).toHaveBeenCalledTimes(1);
    const file = vi.mocked(fake.upload).mock.calls[0][0];
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('configurare-3d-piece_desk.png');
    expect(s().roomInstances[0].answers.snapshot3d).toEqual([NEW]);
    expect(s().roomInstances[0].snapshot3dKey).toBe(config3dKey(config));
    expect(fake.remove).toHaveBeenCalledWith(OLD);
    // deja la zi: nu mai urca inca o data
    await syncRoomSnapshot('d', fake);
    expect(fake.upload).toHaveBeenCalledTimes(1);
  });

  it('a capture of an older configuration is not uploaded', async () => {
    load();
    s().setSnapshot3d('d', PNG);
    s().setAnswer('d', 'config3d', { ...config, widthM: config.widthM + 0.1 } as never);
    const fake = io();
    await expect(syncRoomSnapshot('d', fake)).resolves.toBe(false);
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it('if the configuration changes during the upload, the new file is deleted and the room keeps no stale picture', async () => {
    load();
    s().setSnapshot3d('d', PNG);
    const fake = io({
      upload: vi.fn(async () => {
        s().setAnswer('d', 'config3d', { ...config, widthM: config.widthM + 0.1 } as never);
        return { id: NEW };
      }),
    });
    await expect(syncRoomSnapshot('d', fake)).resolves.toBe(false);
    expect(fake.remove).toHaveBeenCalledWith(NEW);
    expect(snapshot3dStatus(s().roomInstances[0])).toBe('missing');
  });

  it('a failed upload leaves the room as it was', async () => {
    load();
    s().setSnapshot3d('d', PNG);
    const fake = io({ upload: vi.fn(async () => { throw new Error('down'); }) });
    await expect(syncRoomSnapshot('d', fake)).resolves.toBe(false);
    expect(s().roomInstances[0].answers.snapshot3d).toBeUndefined();
  });

  it('uploads for the same room run one after another', async () => {
    load();
    s().setSnapshot3d('d', PNG);
    let active = 0;
    let maxActive = 0;
    const fake = io({
      upload: vi.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return { id: NEW };
      }),
    });
    await Promise.all([syncRoomSnapshot('d', fake), syncRoomSnapshot('d', fake)]);
    expect(maxActive).toBe(1);
    expect(fake.upload).toHaveBeenCalledTimes(1);
  });
});
