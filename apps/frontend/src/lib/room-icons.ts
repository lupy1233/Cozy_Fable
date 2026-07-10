import type { RoomType } from '@marketplace/shared';

// Iconita lucide per tip de camera/piesa — partajata de cosul configuratorului,
// cardurile "Cererile mele" si prezentarea cererii (marketplace + client).
export const ROOM_ICONS: Record<RoomType, string> = {
  KITCHEN: 'chef-hat',
  DRESSING: 'shirt',
  LIVING: 'sofa',
  OFFICE: 'briefcase',
  BEDROOM: 'bed-double',
  BATHROOM: 'bath',
  PIECES: 'package',
  HALLWAY: 'door-open',
  PANTRY: 'boxes',
  LAUNDRY: 'washing-machine',
  BALCONY: 'sun',
  PIECE_WARDROBE: 'door-closed',
  PIECE_TV_UNIT: 'tv',
  PIECE_BOOKCASE: 'library',
  PIECE_DESK: 'monitor',
  PIECE_BED: 'bed-double',
  PIECE_DRESSER: 'archive',
  PIECE_TABLE: 'table',
  PIECE_SHOE_CABINET: 'footprints',
  PIECE_NIGHTSTAND: 'lamp',
  PIECE_BENCH: 'armchair',
};
