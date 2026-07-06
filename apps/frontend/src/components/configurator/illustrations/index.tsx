// Registrul de ilustratii pentru cardurile configuratorului.
// Rezolvare: harta per camera (roomType.stepId.optionValue) → harta comuna per
// valoare (materiale/sisteme, valabile in orice camera) → null (fallback icon lucide).
import type { RoomType } from '@marketplace/shared';
import {
  IlluButonPresiune,
  IlluGlisante,
  IlluLemnMasiv,
  IlluMdf,
  IlluNo,
  IlluPal,
  IlluPush,
  IlluYes,
  type IllustrationProps,
} from './common';
import {
  IlluFan,
  IlluMirrorCabinet,
  IlluNoVentilation,
  IlluTallStorage,
  IlluVanityUnit,
  IlluWindow,
} from './bathroom';
import {
  IlluBaseUnits,
  IlluCountertopGranite,
  IlluCountertopLaminate,
  IlluCountertopQuartz,
  IlluCountertopWood,
  IlluDishwasher,
  IlluFridge,
  IlluHob,
  IlluHood,
  IlluIsland,
  IlluIslandUnits,
  IlluLayoutL,
  IlluLayoutParallel,
  IlluLayoutStraight,
  IlluLayoutU,
  IlluMicrowave,
  IlluOven,
  IlluTallPantry,
  IlluWallUnits,
} from './kitchen';

export type Illustration = React.ComponentType<IllustrationProps>;

type StepMap = Record<string, Record<string, Illustration>>;

const KITCHEN_MAP: StepMap = {
  layout: {
    STRAIGHT: IlluLayoutStraight,
    L_SHAPE: IlluLayoutL,
    U_SHAPE: IlluLayoutU,
    PARALLEL: IlluLayoutParallel,
  },
  // boolean insula: vizualul pentru cardul-comutator (valoarea 'YES')
  hasIsland: { YES: IlluIsland },
  cabinetZones: {
    BASE_UNITS: IlluBaseUnits,
    WALL_UNITS: IlluWallUnits,
    TALL_PANTRY: IlluTallPantry,
    ISLAND_UNITS: IlluIslandUnits,
  },
  countertop: {
    LAMINATE: IlluCountertopLaminate,
    QUARTZ: IlluCountertopQuartz,
    GRANITE: IlluCountertopGranite,
    WOOD: IlluCountertopWood,
  },
  appliances: {
    OVEN: IlluOven,
    HOB: IlluHob,
    HOOD: IlluHood,
    DISHWASHER: IlluDishwasher,
    FRIDGE: IlluFridge,
    MICROWAVE: IlluMicrowave,
  },
};

const BATHROOM_MAP: StepMap = {
  piecesNeeded: {
    VANITY_UNIT: IlluVanityUnit,
    MIRROR_CABINET: IlluMirrorCabinet,
    TALL_STORAGE: IlluTallStorage,
  },
  ventilation: {
    WINDOW: IlluWindow,
    FAN: IlluFan,
    NONE: IlluNoVentilation,
  },
};

const ROOM_MAPS: Partial<Record<RoomType, StepMap>> = {
  KITCHEN: KITCHEN_MAP,
  BATHROOM: BATHROOM_MAP,
};

// Valori comune in orice camera/step (materiale si sisteme de deschidere).
const COMMON_BY_VALUE: Record<string, Illustration> = {
  PAL: IlluPal,
  MDF: IlluMdf,
  LEMN_MASIV: IlluLemnMasiv,
  PUSH: IlluPush,
  GLISANTE: IlluGlisante,
  BUTON_PRESIUNE: IlluButonPresiune,
};

export function getIllustration(
  roomType: RoomType,
  stepId: string,
  optionValue: string,
): Illustration | null {
  const room = ROOM_MAPS[roomType]?.[stepId]?.[optionValue];
  if (room) return room;
  return COMMON_BY_VALUE[optionValue] ?? null;
}

// Vizualuri pentru cardurile boolean (da/nu).
export const BOOLEAN_ILLUSTRATIONS = { yes: IlluYes, no: IlluNo };
