import { describe, expect, it, vi } from 'vitest';
import { defaultPieceConfig, readStudioDraftData } from '@marketplace/shared';
import { studioVersionedStorage } from './studio-persistence';

function fixture() {
  return { version: 2, activeSceneId: 'room', pieces: { p: { id: 'p', name: 'Legacy nightstand', kind: 'NIGHTSTAND', config: defaultPieceConfig('NIGHTSTAND'), updatedAt: 0 } }, scenes: [{ id: 'room', name: 'Old room', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, openings: [], placements: [{ id: 'unit', pieceId: 'p', x: 0, z: 0, rotation: 0 }] }] };
}
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

describe('Studio compatibility and non-destructive recovery', () => {
  it('reads v2 account JSON without mutating its authoritative dimensions or source', () => {
    const original = fixture(), before = JSON.stringify(original);
    const next = readStudioDraftData(original);
    expect(next.version).toBe(3);
    expect(next.pieces.p.config).toEqual(original.pieces.p.config);
    expect(next.scenes).toEqual(original.scenes);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('retains the v2 recovery copy during v3 writes and ignores a stale old tab', async () => {
    const backend = memory(), raw = JSON.stringify({ version: 2, state: fixture() });
    backend.values.set('mm_studio_v1', raw);
    const storage = studioVersionedStorage(backend, vi.fn());
    const converted = await storage.getItem('mm_studio_v3');
    await storage.setItem('mm_studio_v3', converted!);
    expect(backend.values.get('mm_studio_v1')).toBe(raw);
    backend.values.set('mm_studio_v1', JSON.stringify({ version: 1, state: { pieces: {} } }));
    expect(await storage.getItem('mm_studio_v3')).toBe(converted);
  });
  it.each([0, 4, 99])('refuses version %s without overwrite or deletion', async (version) => {
    const backend = memory(), raw = JSON.stringify({ version, state: fixture() }), warning = vi.fn();
    backend.values.set('mm_studio_v3', raw);
    const storage = studioVersionedStorage(backend, warning);
    await expect(storage.getItem('mm_studio_v3')).rejects.toThrow('preserved');
    await storage.setItem('mm_studio_v3', 'replacement');
    await storage.removeItem('mm_studio_v3');
    expect(backend.values.get('mm_studio_v3')).toBe(raw);
    expect(warning).toHaveBeenCalledTimes(1);
  });
  it('does not replace a corrupt current value with an older valid recovery copy', async () => {
    const backend = memory();
    backend.values.set('mm_studio_v3', '{truncated');
    backend.values.set('mm_studio_v1', JSON.stringify({ version: 2, state: fixture() }));
    const storage = studioVersionedStorage(backend, vi.fn());
    await expect(storage.getItem('mm_studio_v3')).rejects.toThrow();
    expect(backend.values.get('mm_studio_v3')).toBe('{truncated');
    expect(backend.values.has('mm_studio_v1')).toBe(true);
  });
  it('preserves the old copy if conversion write is interrupted by quota exhaustion', async () => {
    const backend = memory(), raw = JSON.stringify({ version: 2, state: fixture() });
    backend.values.set('mm_studio_v1', raw);
    const warning = vi.fn();
    const storage = studioVersionedStorage({ ...backend, setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); } }, warning);
    const converted = await storage.getItem('mm_studio_v3');
    expect(() => storage.setItem('mm_studio_v3', converted!)).not.toThrow();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(backend.values.get('mm_studio_v1')).toBe(raw);
    expect(backend.values.has('mm_studio_v3')).toBe(false);
    expect(await storage.getItem('mm_studio_v3')).toBe(converted);
  });
  it('reports blocked storage reads and prevents subsequent writes', async () => {
    const backend = memory(), warning = vi.fn(), save = vi.fn();
    const storage = studioVersionedStorage({ ...backend, getItem: () => { throw new DOMException('Denied', 'SecurityError'); }, setItem: save }, warning);
    await expect(storage.getItem('mm_studio_v3')).rejects.toThrow('preserved');
    storage.setItem('mm_studio_v3', 'replacement');
    expect(save).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
  });
  it('handles asynchronous write failures without unhandled rejection', async () => {
    const backend = memory(), warning = vi.fn();
    const storage = studioVersionedStorage({ ...backend, setItem: async () => { throw new Error('Unavailable'); } }, warning);
    await expect(storage.setItem('mm_studio_v3', 'test')).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
