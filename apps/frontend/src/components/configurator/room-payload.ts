import { approxLengthApplies, getFlow, type AnswerMap, type RoomType } from '@marketplace/shared';
import type { RoomInstance } from '@/stores/configurator-store';

// Forma unei camere trimise la server (publicare, editare, estimare) — b8, PO g0-8 / b8-3:
// camera bifata "am nevoie de ajutor" pleaca doar cu tipul, fisierele ei si bifa;
// raspunsurile la intrebari raman doar in ciorna locala (le regaseste daca debifeaza).

export interface ServerRoomPayload {
  roomType: RoomType;
  flowVersion: number;
  answers: AnswerMap;
  needsDesignHelp: boolean;
  // d3 (PO d3-2): lungimea aproximativa (m); store-ul o tine doar in "Am deja un proiect"
  approxLengthM?: number;
}

// Doar raspunsurile pasilor de fisiere vizibili (schitele camerei); restul cade.
export function fileAnswersOnly(room: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers'>): AnswerMap {
  let steps;
  try {
    steps = getFlow(room.roomType, room.flowVersion).steps;
  } catch {
    return {};
  }
  const out: AnswerMap = {};
  for (const step of steps) {
    if (step.type !== 'upload' || step.hidden) continue;
    const value = room.answers[step.id];
    if (Array.isArray(value) && value.length > 0) out[step.id] = value;
  }
  return out;
}

export function toServerRoom(
  room: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers' | 'needsDesignHelp' | 'sourceStudio' | 'approxLengthM'>,
): ServerRoomPayload {
  // o piesa din Studio 3D e deja configurata: nu pleaca niciodata ca "cere ajutor"
  const needsDesignHelp = room.needsDesignHelp === true && !room.sourceStudio;
  return {
    roomType: room.roomType,
    flowVersion: room.flowVersion,
    answers: needsDesignHelp ? fileAnswersOnly(room) : room.answers,
    needsDesignHelp,
    // d3 (revizuire M1): doar cat campul are sens pentru raspunsurile de acum
    ...(!needsDesignHelp && typeof room.approxLengthM === 'number' && approxLengthApplies(room.roomType, room.answers, room.flowVersion)
      ? { approxLengthM: room.approxLengthM }
      : {}),
  };
}

// Numele fiecarei camere din cos ("Dormitor", "Dormitor 2"…), ca pe pasul Fisiere.
export function roomInstanceLabels(
  rooms: Pick<RoomInstance, 'localId' | 'roomType'>[],
  typeLabel: (roomType: RoomType) => string,
): Map<string, string> {
  const totals = new Map<RoomType, number>();
  for (const r of rooms) totals.set(r.roomType, (totals.get(r.roomType) ?? 0) + 1);
  const seen = new Map<RoomType, number>();
  const out = new Map<string, string>();
  for (const r of rooms) {
    const n = (seen.get(r.roomType) ?? 0) + 1;
    seen.set(r.roomType, n);
    out.set(r.localId, typeLabel(r.roomType) + ((totals.get(r.roomType) ?? 0) > 1 ? ` ${n}` : ''));
  }
  return out;
}

// "Cu proiectare" = macar o camera bifata (acelasi calcul ca serverul).
export function anyRoomNeedsDesignHelp(rooms: Pick<RoomInstance, 'needsDesignHelp'>[]): boolean {
  return rooms.some((r) => r.needsDesignHelp === true);
}
