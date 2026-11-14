import { ROOM_TYPES } from '@marketplace/shared';

// d5: fila "Ciorne" — tipurile de camera citite din configuratorState (JSON controlat de client)
// se pastreaza doar daca sunt cunoscute. Serverul citeste din JSON doar campurile listei (SQL).
const KNOWN_ROOM_TYPES = new Set<string>(ROOM_TYPES);
export const MAX_LISTED_ROOMS = 20;
// revizie m4: cele mai recente ciorne, nu toate
export const MAX_LISTED_DRAFTS = 20;

export function knownRoomTypes(values: unknown): (typeof ROOM_TYPES)[number][] {
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, MAX_LISTED_ROOMS)
    .filter((v): v is (typeof ROOM_TYPES)[number] => typeof v === 'string' && KNOWN_ROOM_TYPES.has(v));
}

export function draftCityText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}
