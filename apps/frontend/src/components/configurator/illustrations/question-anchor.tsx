// Vizual-ancora pentru intrebarile de material / sistem de deschidere
// (PO r10): o mica ilustratie a corpului la care se refera intrebarea, afisata
// langa titlu — cititorul intelege tinta fara sa parcurga textul.
// Rezolvare: screenGroup 'piece:<VALUE>' (flow-urile per-piesa) → ilustratia
// optiunii din piecesNeeded; altfel registrul explicit de mai jos; altfel null
// (ramane iconul lucide existent).
import type { QuestionStep, RoomType } from '@marketplace/shared';
import { getIllustration, type Illustration } from './index';
import { IlluVanityUnit } from './bathroom';
import { IlluBaseUnits, IlluIslandUnits, IlluWallUnits } from './kitchen';
import {
  IlluApplianceHousing,
  IlluBed,
  IlluBench,
  IlluBookshelf,
  IlluClosedCabinets,
  IlluDesk,
  IlluDresser,
  IlluNightstand,
  IlluOpenShelves,
  IlluShoeCabinet,
  IlluTvUnit,
  IlluWardrobe,
} from './room-pieces';
import { IlluBenchStorage, IlluTableDining } from './piece-configs';

// tinta intrebarilor cu id-uri fixe (kitchen v1/v2, pantry v2, flow-uri legacy
// cu material/sisteme comune pe camera, piesele ghidate PIECE_*)
const ANCHOR_OVERRIDES: Partial<Record<RoomType, Record<string, Illustration>>> = {
  KITCHEN: {
    frontMaterialBase: IlluBaseUnits,
    openingSystemsBase: IlluBaseUnits,
    frontMaterialWall: IlluWallUnits,
    openingSystemsWall: IlluWallUnits,
    frontMaterialIsland: IlluIslandUnits,
    openingSystemsIsland: IlluIslandUnits,
    frontMaterial: IlluBaseUnits,
    openingSystems: IlluBaseUnits,
  },
  PANTRY: {
    materialShelves: IlluOpenShelves,
    materialCabinets: IlluClosedCabinets,
    systemsCabinets: IlluClosedCabinets,
    material: IlluClosedCabinets,
  },
  DRESSING: { material: IlluWardrobe },
  BEDROOM: { material: IlluWardrobe, openingSystems: IlluWardrobe },
  LIVING: { material: IlluTvUnit, openingSystems: IlluTvUnit },
  BATHROOM: { material: IlluVanityUnit },
  LAUNDRY: { material: IlluApplianceHousing },
  BALCONY: { material: IlluBenchStorage },
  HALLWAY: { material: IlluShoeCabinet },
  OFFICE: { material: IlluDesk, openingSystems: IlluDesk },
  PIECE_WARDROBE: { material: IlluWardrobe, openingSystems: IlluWardrobe },
  PIECE_TV_UNIT: { material: IlluTvUnit, openingSystems: IlluTvUnit },
  PIECE_BOOKCASE: { material: IlluBookshelf, openingSystems: IlluBookshelf },
  PIECE_DESK: { material: IlluDesk, openingSystems: IlluDesk },
  PIECE_BED: { material: IlluBed, openingSystems: IlluBed },
  PIECE_DRESSER: { material: IlluDresser, openingSystems: IlluDresser },
  PIECE_TABLE: { material: IlluTableDining, openingSystems: IlluTableDining },
  PIECE_SHOE_CABINET: { material: IlluShoeCabinet, openingSystems: IlluShoeCabinet },
  PIECE_NIGHTSTAND: { material: IlluNightstand, openingSystems: IlluNightstand },
  PIECE_BENCH: { material: IlluBench, openingSystems: IlluBench },
};

export function getQuestionAnchor(roomType: RoomType, step: QuestionStep): Illustration | null {
  // doar intrebarile de material / sisteme de deschidere au ancora
  if (!/material|system/i.test(step.id)) return null;

  const piece = step.screenGroup?.match(/^piece:([A-Z0-9_]+)/)?.[1];
  if (piece) {
    const illu = getIllustration(roomType, 'piecesNeeded', piece);
    if (illu) return illu;
  }
  return ANCHOR_OVERRIDES[roomType]?.[step.id] ?? null;
}
