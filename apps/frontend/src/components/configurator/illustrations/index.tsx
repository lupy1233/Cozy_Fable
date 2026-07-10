// Registrul de ilustratii pentru cardurile configuratorului (item 2: fiecare
// optiune din formular are un desen dedicat, sugestiv).
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
import {
  IlluAltMaterial,
  IlluAventos,
  IlluCountertopHpl,
  IlluGola,
  IlluManer,
  IlluMdfFurnir,
  IlluMdfInfoliat,
  IlluMdfVopsit,
} from './materials-systems';
import {
  IlluAccessories,
  IlluApplianceHousing,
  IlluBalconyEnclosed,
  IlluBalconyOpen,
  IlluBed,
  IlluBedCustom,
  IlluBedDouble140,
  IlluBedDrawers,
  IlluBedKing,
  IlluBedLiftUp,
  IlluBedNoStorage,
  IlluBedQueen,
  IlluBedSingle,
  IlluBench,
  IlluBookshelf,
  IlluClosedCabinets,
  IlluClosetLighting,
  IlluCoatUnit,
  IlluCoffeeTable,
  IlluDesk,
  IlluDeskL,
  IlluDeskStraight,
  IlluDeskU,
  IlluDisplayCabinet,
  IlluDresser,
  IlluHangingRods,
  IlluLaundryStorage,
  IlluLedLighting,
  IlluMirrorShelf,
  IlluMixedStorage,
  IlluNightstand,
  IlluNightstandOne,
  IlluNightstandTwo,
  IlluOfficeStorage,
  IlluOpenShelves,
  IlluOtherPiece,
  IlluShoeCabinet,
  IlluShoeRack,
  IlluSideBySide,
  IlluSinkUnit,
  IlluStacked,
  IlluTvComplexUnit,
  IlluTvFloating,
  IlluTvOnFloor,
  IlluTvUnit,
  IlluUpholstered,
  IlluVanityTable,
  IlluWalkIn,
  IlluWallShelves,
  IlluWardrobe,
  IlluWasher,
  IlluWorktop,
} from './room-pieces';
import {
  IlluBenchShoes,
  IlluBenchSimple,
  IlluBenchStorage,
  IlluBookcaseBase,
  IlluBookcaseGlass,
  IlluBookcaseOpen,
  IlluCableManagement,
  IlluDrawerUnit,
  IlluNightstandDrawers,
  IlluNightstandOpenShelf,
  IlluNightstandSuspended,
  IlluShelfAbove,
  IlluShoeSlim,
  IlluShoeStandard,
  IlluShoeWithSeat,
  IlluTableConsole,
  IlluTableDining,
  IlluTableExtendable,
  IlluTableRect,
  IlluTableRound,
  IlluTvLowUnit,
  IlluTvMediaWall,
  IlluTvOnUnit,
  IlluTvOnWall,
  IlluTvUndecided,
  IlluToCeiling,
  IlluUpholsteredSeat,
  IlluWardrobeHinged,
  IlluWardrobeSliding,
} from './piece-configs';

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
    // v1 (FROZEN): LAMINATE/WOOD; v2: PAL/HPL/QUARTZ/GRANITE
    LAMINATE: IlluCountertopLaminate,
    PAL: IlluCountertopLaminate,
    HPL: IlluCountertopHpl,
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

const DRESSING_MAP: StepMap = {
  layout: {
    LINEAR: IlluLayoutStraight,
    L_SHAPE: IlluLayoutL,
    U_SHAPE: IlluLayoutU,
    WALK_IN: IlluWalkIn,
  },
  doorType: {
    SLIDING: IlluWardrobeSliding,
    HINGED: IlluWardrobeHinged,
  },
  interiorModules: {
    HANGING_RODS: IlluHangingRods,
    SHELVES: IlluOpenShelves,
    DRAWERS: IlluDresser,
    SHOE_RACK: IlluShoeRack,
    ACCESSORIES: IlluAccessories,
  },
  lighting: { YES: IlluClosetLighting },
};

const LIVING_MAP: StepMap = {
  piecesNeeded: {
    TV_UNIT: IlluTvUnit,
    BOOKSHELF: IlluBookshelf,
    DISPLAY_CABINET: IlluDisplayCabinet,
    COFFEE_TABLE: IlluCoffeeTable,
    WALL_SHELVES: IlluWallShelves,
    OTHER: IlluOtherPiece,
  },
  tvStyle: {
    FLOATING: IlluTvFloating,
    ON_FLOOR: IlluTvOnFloor,
    COMPLEX_UNIT: IlluTvComplexUnit,
  },
  ledLighting: { YES: IlluLedLighting },
};

const BEDROOM_MAP: StepMap = {
  piecesNeeded: {
    WARDROBE: IlluWardrobe,
    BED_FRAME: IlluBed,
    NIGHTSTANDS: IlluNightstand,
    DRESSER: IlluDresser,
    TV_UNIT: IlluTvUnit,
    VANITY: IlluVanityTable,
  },
  wardrobeDoorType: {
    SLIDING: IlluWardrobeSliding,
    HINGED: IlluWardrobeHinged,
  },
  bedSize: {
    S_90: IlluBedSingle,
    M_140: IlluBedDouble140,
    Q_160: IlluBedQueen,
    K_180: IlluBedKing,
    CUSTOM: IlluBedCustom,
  },
  bedStorage: {
    NONE: IlluBedNoStorage,
    LIFT_UP: IlluBedLiftUp,
    DRAWERS: IlluBedDrawers,
  },
  bedUpholstered: { YES: IlluUpholstered },
  nightstandsCount: {
    ONE: IlluNightstandOne,
    TWO: IlluNightstandTwo,
  },
};

const OFFICE_MAP: StepMap = {
  piecesNeeded: {
    DESK: IlluDesk,
    BOOKSHELF: IlluBookshelf,
    STORAGE: IlluOfficeStorage,
    WALL_SHELVES: IlluWallShelves,
  },
  deskShape: {
    STRAIGHT: IlluDeskStraight,
    L_SHAPE: IlluDeskL,
    U_SHAPE: IlluDeskU,
  },
};

const HALLWAY_MAP: StepMap = {
  piecesNeeded: {
    SHOE_CABINET: IlluShoeCabinet,
    COAT_UNIT: IlluCoatUnit,
    WARDROBE: IlluWardrobe,
    BENCH: IlluBench,
    MIRROR: IlluMirrorShelf,
  },
};

const LAUNDRY_MAP: StepMap = {
  applianceSetup: {
    WASHER_ONLY: IlluWasher,
    STACKED: IlluStacked,
    SIDE_BY_SIDE: IlluSideBySide,
  },
  piecesNeeded: {
    APPLIANCE_HOUSING: IlluApplianceHousing,
    STORAGE: IlluLaundryStorage,
    COUNTERTOP: IlluWorktop,
    SINK_UNIT: IlluSinkUnit,
  },
  ventilation: {
    WINDOW: IlluWindow,
    FAN: IlluFan,
    NONE: IlluNoVentilation,
  },
};

const PANTRY_MAP: StepMap = {
  wallsUsed: {
    ONE_WALL: IlluLayoutStraight,
    L_SHAPE: IlluLayoutL,
    U_SHAPE: IlluLayoutU,
  },
  storageStyle: {
    OPEN_SHELVES: IlluOpenShelves,
    CLOSED_CABINETS: IlluClosedCabinets,
    MIXED: IlluMixedStorage,
  },
};

const BALCONY_MAP: StepMap = {
  enclosed: {
    ENCLOSED: IlluBalconyEnclosed,
    OPEN: IlluBalconyOpen,
  },
  piecesNeeded: {
    STORAGE_BENCH: IlluBenchStorage,
    TALL_CABINET: IlluWardrobe,
    WORKTOP: IlluWorktop,
    SHELVES: IlluOpenShelves,
  },
};

// --- piesele ghidate ---

const PIECE_WARDROBE_MAP: StepMap = {
  doorType: {
    SLIDING: IlluWardrobeSliding,
    HINGED: IlluWardrobeHinged,
  },
  toCeiling: { YES: IlluToCeiling },
  interiorModules: {
    HANGING_RODS: IlluHangingRods,
    SHELVES: IlluOpenShelves,
    DRAWERS: IlluDresser,
    SHOE_RACK: IlluShoeRack,
  },
};

const PIECE_TV_UNIT_MAP: StepMap = {
  style: {
    LOW_UNIT: IlluTvLowUnit,
    MEDIA_WALL: IlluTvMediaWall,
  },
  tvSetup: {
    TV_ON_WALL: IlluTvOnWall,
    TV_ON_UNIT: IlluTvOnUnit,
    UNDECIDED: IlluTvUndecided,
  },
};

const PIECE_BOOKCASE_MAP: StepMap = {
  style: {
    OPEN: IlluBookcaseOpen,
    BASE_CABINETS: IlluBookcaseBase,
    GLASS_DOORS: IlluBookcaseGlass,
  },
  toCeiling: { YES: IlluToCeiling },
};

const PIECE_DESK_MAP: StepMap = {
  shape: {
    STRAIGHT: IlluDeskStraight,
    L_SHAPE: IlluDeskL,
  },
  cableManagement: { YES: IlluCableManagement },
  storage: {
    DRAWER_UNIT: IlluDrawerUnit,
    SHELF_ABOVE: IlluShelfAbove,
  },
};

const PIECE_BED_MAP: StepMap = {
  bedSize: {
    S_90: IlluBedSingle,
    M_140: IlluBedDouble140,
    Q_160: IlluBedQueen,
    K_180: IlluBedKing,
  },
  upholstered: { YES: IlluUpholstered },
  storage: {
    NONE: IlluBedNoStorage,
    LIFT_UP: IlluBedLiftUp,
    DRAWERS: IlluBedDrawers,
  },
};

const PIECE_DRESSER_MAP: StepMap = {
  configuration: {
    DRAWERS_ONLY: IlluDresser,
    MIXED: IlluMixedStorage,
    DOORS_ONLY: IlluClosedCabinets,
  },
};

const PIECE_TABLE_MAP: StepMap = {
  tableType: {
    DINING: IlluTableDining,
    COFFEE: IlluCoffeeTable,
    CONSOLE: IlluTableConsole,
  },
  shape: {
    RECTANGULAR: IlluTableRect,
    ROUND: IlluTableRound,
    EXTENDABLE: IlluTableExtendable,
  },
};

const PIECE_SHOE_CABINET_MAP: StepMap = {
  style: {
    SLIM_TILT: IlluShoeSlim,
    STANDARD: IlluShoeStandard,
    WITH_SEAT: IlluShoeWithSeat,
  },
};

const PIECE_NIGHTSTAND_MAP: StepMap = {
  style: {
    DRAWERS: IlluNightstandDrawers,
    OPEN_SHELF: IlluNightstandOpenShelf,
    SUSPENDED: IlluNightstandSuspended,
  },
  count: {
    ONE: IlluNightstandOne,
    TWO: IlluNightstandTwo,
  },
};

const PIECE_BENCH_MAP: StepMap = {
  style: {
    WITH_STORAGE: IlluBenchStorage,
    WITH_SHOE_SPACE: IlluBenchShoes,
    SIMPLE: IlluBenchSimple,
  },
  upholsteredSeat: { YES: IlluUpholsteredSeat },
};

const ROOM_MAPS: Partial<Record<RoomType, StepMap>> = {
  KITCHEN: KITCHEN_MAP,
  BATHROOM: BATHROOM_MAP,
  DRESSING: DRESSING_MAP,
  LIVING: LIVING_MAP,
  BEDROOM: BEDROOM_MAP,
  OFFICE: OFFICE_MAP,
  HALLWAY: HALLWAY_MAP,
  LAUNDRY: LAUNDRY_MAP,
  PANTRY: PANTRY_MAP,
  BALCONY: BALCONY_MAP,
  PIECE_WARDROBE: PIECE_WARDROBE_MAP,
  PIECE_TV_UNIT: PIECE_TV_UNIT_MAP,
  PIECE_BOOKCASE: PIECE_BOOKCASE_MAP,
  PIECE_DESK: PIECE_DESK_MAP,
  PIECE_BED: PIECE_BED_MAP,
  PIECE_DRESSER: PIECE_DRESSER_MAP,
  PIECE_TABLE: PIECE_TABLE_MAP,
  PIECE_SHOE_CABINET: PIECE_SHOE_CABINET_MAP,
  PIECE_NIGHTSTAND: PIECE_NIGHTSTAND_MAP,
  PIECE_BENCH: PIECE_BENCH_MAP,
};

// Valori comune in orice camera/step (materiale si sisteme de deschidere).
const COMMON_BY_VALUE: Record<string, Illustration> = {
  PAL: IlluPal,
  MDF: IlluMdf,
  MDF_INFOLIAT: IlluMdfInfoliat,
  MDF_VOPSIT: IlluMdfVopsit,
  MDF_FURNIR: IlluMdfFurnir,
  LEMN_MASIV: IlluLemnMasiv,
  ALTUL: IlluAltMaterial,
  PUSH: IlluPush,
  GLISANTE: IlluGlisante,
  BUTON_PRESIUNE: IlluButonPresiune,
  MANER: IlluManer,
  GOLA: IlluGola,
  AVENTOS: IlluAventos,
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
