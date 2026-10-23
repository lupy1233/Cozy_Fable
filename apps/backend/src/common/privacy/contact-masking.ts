import { maskContactInfo, maskRoomAnswers, type AnswerMap, type RequestStudioSceneData, type RoomType } from '@marketplace/shared';

// E-admin-platform-45 (F2-16, docs/03 4.2): mascarea la citire a datelor de contact
// scrise in texte libere, pentru DTO-urile catre firme fara acces la contacte
// (marketplace; fisa de lucru cand access.clientVisible = false). Textul stocat ramane
// cel scris de client; clientul si firma cu acces vad textul brut.

// numele din Studio au maxim 60 de caractere (schema stricta citita si in frontend)
const STUDIO_NAME_MAX = 60;

export function maskFreeText(s: string | null | undefined): string {
  return maskContactInfo(s ?? '');
}

interface MaskableRoom {
  roomType: RoomType;
  // null (cereri vechi) → parcurgere completa a raspunsurilor
  flowVersion: number | null;
  answers: Record<string, unknown> | null;
  items: { name: string; description: string | null }[];
}

export function maskRoomForFirm<R extends MaskableRoom>(room: R): R {
  return {
    ...room,
    answers: room.answers
      ? (maskRoomAnswers(room.roomType, room.flowVersion ?? -1, room.answers as AnswerMap) as Record<string, unknown>)
      : null,
    items: room.items.map((it) => ({
      ...it,
      name: maskFreeText(it.name),
      description: it.description == null ? it.description : maskFreeText(it.description),
    })),
  };
}

export function maskSceneName(name: string): string {
  return maskFreeText(name).slice(0, STUDIO_NAME_MAX);
}

// Numele scenei si ale pieselor din snapshotul Studio (etichetele casei raman —
// maxim 60 de caractere, follow-up separat).
export function maskSceneData(data: RequestStudioSceneData): RequestStudioSceneData {
  if (!data || typeof data !== 'object' || !data.scene) return data;
  const pieces = data.pieces && typeof data.pieces === 'object'
    ? Object.fromEntries(
        Object.entries(data.pieces).map(([id, piece]) => [
          id,
          piece && typeof piece.name === 'string' ? { ...piece, name: maskSceneName(piece.name) } : piece,
        ]),
      )
    : data.pieces;
  return {
    ...data,
    scene: typeof data.scene.name === 'string' ? { ...data.scene, name: maskSceneName(data.scene.name) } : data.scene,
    pieces,
  };
}
