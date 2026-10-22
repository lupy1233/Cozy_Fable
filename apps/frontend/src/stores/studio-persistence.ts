import { readStudioDraftData } from '@marketplace/shared';
import type { StateStorage } from 'zustand/middleware';

// Cheie noua: taburile vechi continua sa scrie doar copia lor v1/v2.
// Copia istorica ramane disponibila pentru recuperare si rollback.
export function studioVersionedStorage(storage: StateStorage, onError: () => void): StateStorage {
  let blocked = false;
  const fail = () => { blocked = true; onError(); };
  const write = (operation: () => unknown) => {
    if (blocked) return;
    try {
      const result = operation();
      if (result) return Promise.resolve(result).catch(() => { fail(); });
    } catch { fail(); }
  };
  return {
    getItem: async (name) => {
      try {
        const current = await storage.getItem(name);
        const raw = current ?? await storage.getItem('mm_studio_v1');
        if (!raw) return null;
        const envelope = JSON.parse(raw);
        if (![1, 2, 3].includes(envelope.version)) throw new Error('Unsupported version');
        let state = envelope.state;
        if (envelope.version === 1) state = {
          ...state,
          scenes: [{ id: 'legacy-room', name: 'Camera 1', room: { widthM: 4.2, depthM: 3.4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR', ...(state.room ?? {}) }, placements: state.placements ?? [], openings: [] }],
          activeSceneId: 'legacy-room',
        };
        const data = readStudioDraftData({ version: envelope.version === 3 ? 3 : 2, pieces: state.pieces ?? {}, scenes: state.scenes, activeSceneId: state.activeSceneId, ...(state.house ? { house: state.house } : {}) }, true);
        return JSON.stringify({ version: 3, state: { ...state, ...data, cutawayWalls: state.cutawayWalls === true } });
      } catch {
        fail();
        // Arunca pentru ca rehidratarea sa nu considere datele absente.
        throw new Error('Studio data is preserved but cannot be read by this version');
      }
    },
    setItem: (name, value) => write(() => storage.setItem(name, value)),
    removeItem: (name) => write(() => storage.removeItem(name)),
  };
}
