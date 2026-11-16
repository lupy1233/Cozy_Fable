import { getFlow, isPieceConfig3d, type AnswerMap, type Piece3dKind, type PieceConfig3d, type RoomType } from '@marketplace/shared';

// d4 (PO d4-1): imaginea 3D a piesei. Fisierul sta in answers.snapshot3d (pasul ascuns al
// fluxului), iar RoomInstance.snapshot3dKey tine minte pentru ce configuratie a fost facut.
// Cheile de mai jos sunt functii pure, folosite de store, de ecranul 3D si de Sumar.

export const SNAPSHOT3D_STEP_ID = 'snapshot3d';

// cheie de comparatie independenta de ordinea cheilor (raspunsul trece prin validare / store)
export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

// amprenta scurta a configuratiei (FNV-1a pe 32 de biti + lungimea), ca ciorna sa nu creasca
export function config3dKey(config: unknown): string {
  const text = stableKey(config);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `c${hash.toString(16).padStart(8, '0')}${text.length.toString(16)}`;
}

export interface Piece3dOfRoom {
  stepId: string;
  piece: Piece3dKind;
  config: PieceConfig3d;
  key: string;
}

type RoomLike = { roomType: RoomType; flowVersion: number; answers: AnswerMap; needsDesignHelp?: boolean };

// Piesa configurata 3D a camerei: fluxul are ecranul 3D si pasul ascuns al imaginii, iar
// raspunsul e o configuratie valida. Camera bifata "am nevoie de ajutor" nu-si trimite
// configuratia, deci nici imaginea.
export function piece3dOf(room: RoomLike): Piece3dOfRoom | null {
  if (room.needsDesignHelp) return null;
  let steps;
  try {
    steps = getFlow(room.roomType, room.flowVersion).steps;
  } catch {
    return null;
  }
  if (!steps.some((s) => s.id === SNAPSHOT3D_STEP_ID && s.type === 'upload')) return null;
  const step = steps.find((s) => s.type === 'configurator-3d');
  if (!step || step.type !== 'configurator-3d') return null;
  const config = room.answers?.[step.id];
  if (!isPieceConfig3d(config)) return null;
  return { stepId: step.id, piece: step.piece, config, key: config3dKey(config) };
}

export function snapshot3dIds(room: { answers: AnswerMap }): string[] {
  const value = room.answers?.[SNAPSHOT3D_STEP_ID];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

// 'none' = camera nu are piesa 3D; 'fresh' = imaginea e a configuratiei de acum;
// 'stale' = imagine facuta pentru alta configuratie (sau fara cheie); 'missing' = fara imagine
export type Snapshot3dStatus = 'none' | 'fresh' | 'stale' | 'missing';

export function snapshot3dStatus(room: RoomLike & { snapshot3dKey?: string }): Snapshot3dStatus {
  const piece = piece3dOf(room);
  if (!piece) return 'none';
  if (snapshot3dIds(room).length === 0) return 'missing';
  return room.snapshot3dKey === piece.key ? 'fresh' : 'stale';
}

// dataURL PNG → File, fara fetch (merge si cand fetch pe data: e blocat)
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  try {
    const mime = match[1] || 'image/png';
    const raw = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}
