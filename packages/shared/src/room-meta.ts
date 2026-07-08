import type { RoomType } from './enums';

// Metadate de prezentare si ordonare per RoomType. Stau separat de enums.ts
// (ala ramane VERBATIM docs/04 §5.5) pentru ca nu sunt valori de DB, ci reguli
// de UI/ordonare decise de PO (2026-07-07).

// 'room' = camera intreaga (grila principala din cart);
// 'piece' = piesa individuala (tab-ul "Piese individuale" din cart).
// PIECES (legacy, formular liber) e tratat ca piesa — cardul "Alta piesa".
export const ROOM_KIND: Record<RoomType, 'room' | 'piece'> = {
  KITCHEN: 'room',
  DRESSING: 'room',
  LIVING: 'room',
  OFFICE: 'room',
  BEDROOM: 'room',
  BATHROOM: 'room',
  HALLWAY: 'room',
  PANTRY: 'room',
  LAUNDRY: 'room',
  BALCONY: 'room',
  PIECE_WARDROBE: 'piece',
  PIECE_TV_UNIT: 'piece',
  PIECE_BOOKCASE: 'piece',
  PIECE_DESK: 'piece',
  PIECE_BED: 'piece',
  PIECE_DRESSER: 'piece',
  PIECE_TABLE: 'piece',
  PIECE_SHOE_CABINET: 'piece',
  PIECE_NIGHTSTAND: 'piece',
  PIECE_BENCH: 'piece',
  PIECES: 'piece',
};

// Ordinea FIXA a intrebarilor in wizard, dupa complexitatea camerei (decizie PO):
// intai camerele (bucataria prima), apoi piesele individuale, "Alta piesa" mereu
// ultima. Ordinea NU depinde de ordinea adaugarii in cos. Valori spatiate ca sa
// se poata insera tipuri noi fara renumerotare.
export const ROOM_ORDER: Record<RoomType, number> = {
  KITCHEN: 10,
  DRESSING: 20,
  LIVING: 30,
  BEDROOM: 40,
  OFFICE: 50,
  BATHROOM: 60,
  HALLWAY: 70,
  LAUNDRY: 80,
  PANTRY: 90,
  BALCONY: 100,
  PIECE_WARDROBE: 200,
  PIECE_TV_UNIT: 210,
  PIECE_BOOKCASE: 220,
  PIECE_DESK: 230,
  PIECE_BED: 240,
  PIECE_DRESSER: 250,
  PIECE_TABLE: 260,
  PIECE_SHOE_CABINET: 270,
  PIECE_NIGHTSTAND: 280,
  PIECE_BENCH: 290,
  PIECES: 999,
};

export function compareRoomTypes(a: RoomType, b: RoomType): number {
  return ROOM_ORDER[a] - ROOM_ORDER[b];
}

// Sortare stabila dupa ROOM_ORDER (Array.prototype.sort e stabil per spec):
// instantele de acelasi tip isi pastreaza ordinea relativa (Baie 1 ramane
// inaintea Baii 2). Returneaza un array NOU — nu muteaza inputul.
export function sortByRoomOrder<T extends { roomType: RoomType }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => compareRoomTypes(a.roomType, b.roomType));
}
