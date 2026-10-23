// Registrul de ilustratii pentru cardurile configuratorului (item 2: fiecare
// optiune din formular are un desen dedicat, sugestiv).
// Rezolvare: harta per camera (roomType.stepId.optionValue) → harta comuna per
// valoare (materiale/sisteme, valabile in orice camera) → null (fallback icon lucide).
import type { RoomType } from '@marketplace/shared';
import { IlluNo, IlluYes, type IllustrationProps } from './common';
import { showroomPhoto, type ShowroomConcept } from './showroom-atlas';
import { optionPhoto } from './option-photo';
import {
  PhotoAltMaterial,
  PhotoAventos,
  PhotoGola,
  PhotoLemnMasiv,
  PhotoManer,
  PhotoMdfFurnir,
  PhotoMdfInfoliat,
  PhotoMdfVopsit,
  PhotoPal,
  PhotoPush,
} from './photo';
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
import { IlluCountertopHpl } from './materials-systems';
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

const SHOWROOM_REPLACEMENTS = new Map<Illustration, Illustration>(
  ([
    [IlluWardrobe, 'wardrobe'], [IlluBed, 'bed'], [IlluBedNoStorage, 'bed'],
    [IlluNightstand, 'nightstand'], [IlluNightstandOne, 'nightstand'], [IlluDresser, 'dresser'],
    [IlluTvUnit, 'tv-unit'], [IlluBookshelf, 'bookcase'], [IlluDesk, 'desk'],
    [IlluTableDining, 'dining-table'], [IlluCoffeeTable, 'coffee-table'], [IlluTableConsole, 'console-table'],
    [IlluShoeCabinet, 'shoe-cabinet'], [IlluBench, 'bench'], [IlluBenchSimple, 'bench'],
    [IlluCoatUnit, 'coat-unit'], [IlluMirrorShelf, 'mirror-shelf'], [IlluVanityTable, 'vanity-table'], [IlluDisplayCabinet, 'glass-display'],
    [IlluBaseUnits, 'base-cabinet'], [IlluWallUnits, 'wall-cabinet'], [IlluTallPantry, 'tall-pantry'],
    [IlluIsland, 'island'], [IlluIslandUnits, 'island'], [IlluOven, 'oven'], [IlluHob, 'hob'],
    [IlluHood, 'hood'], [IlluDishwasher, 'dishwasher'], [IlluFridge, 'fridge'], [IlluMicrowave, 'microwave'],
    [IlluVanityUnit, 'vanity-sink'], [IlluMirrorCabinet, 'mirror-cabinet'], [IlluTallStorage, 'tall-bath-storage'],
    [IlluWasher, 'washer'], [IlluStacked, 'stacked-washer-dryer'],
    // Diagramele pastreaza detaliile absente din atlas: sertare laterale, polite suspendate si LED interior.
    [IlluBedLiftUp, 'bed-lift-up'], [IlluUpholstered, 'upholstered-bed'],
    [IlluHangingRods, 'hanging-rod'], [IlluOpenShelves, 'open-shelves'],
    [IlluShoeRack, 'shoe-rack'], [IlluAccessories, 'wardrobe-accessories'], [IlluLedLighting, 'led-shelf'],
    [IlluClosedCabinets, 'closed-cabinet'], [IlluOfficeStorage, 'closed-cabinet'], [IlluLaundryStorage, 'closed-cabinet'],
    [IlluMixedStorage, 'mixed-storage'], [IlluBenchStorage, 'storage-bench'], [IlluBenchShoes, 'shoe-bench'],
    [IlluTableRound, 'round-table'], [IlluTableExtendable, 'extendable-table'], [IlluDrawerUnit, 'drawer-pedestal'],
    [IlluCableManagement, 'desk-cable-port'],
  ] satisfies [Illustration, ShowroomConcept][]).map(([original, concept]) => [original, showroomPhoto(concept)]),
);

export function showroomIllustration(original: Illustration): Illustration {
  return SHOWROOM_REPLACEMENTS.get(original) ?? original;
}

type StepMap = Record<string, Record<string, Illustration>>;

const optionPhotos = (concepts: Record<string, string>): Record<string, Illustration> =>
  Object.fromEntries(Object.entries(concepts).map(([value, concept]) => [value, optionPhoto(concept)]));

const WARDROBE_DOOR_PHOTOS = optionPhotos({ SLIDING: 'sliding-doors', HINGED: 'wardrobe-hinged' });
const MATTRESS_PHOTOS = optionPhotos({ S_90: 'mattress-90', M_140: 'mattress-140', Q_160: 'mattress-160', K_180: 'mattress-180', CUSTOM: 'mattress-custom' });
const DESK_SHAPE_PHOTOS = optionPhotos({ STRAIGHT: 'desk-straight', L_SHAPE: 'desk-l', U_SHAPE: 'desk-u' });
const VENTILATION_PHOTOS = optionPhotos({ WINDOW: 'ventilation-window', FAN: 'ventilation-fan', NONE: 'ventilation-none' });

// Imaginile de forma depind de camera: aceeasi litera L nu inseamna acelasi mobilier.
export const ROOM_OPTION_PHOTOS: Partial<Record<RoomType, StepMap>> = {
  KITCHEN: {
    layout: optionPhotos({ STRAIGHT: 'kitchen-layout-straight', L_SHAPE: 'kitchen-layout-l', U_SHAPE: 'kitchen-layout-u' }),
    countertop: optionPhotos({ PAL: 'countertop-pal', HPL: 'countertop-hpl', QUARTZ: 'countertop-quartz', GRANITE: 'countertop-granite' }),
  },
  DRESSING: {
    layout: optionPhotos({ LINEAR: 'dressing-layout-linear', L_SHAPE: 'dressing-layout-l', U_SHAPE: 'dressing-layout-u', WALK_IN: 'dressing-layout-walk-in' }),
    doorType: { ...WARDROBE_DOOR_PHOTOS, ...optionPhotos({ OPEN: 'wardrobe-open' }) },
    interiorModules: optionPhotos({ LED_LIGHTING: 'wardrobe-led' }),
    lighting: optionPhotos({ YES: 'wardrobe-led' }),
  },
  LIVING: {
    piecesNeeded: optionPhotos({ WALL_SHELVES: 'wall-shelves' }),
    tvStyle: optionPhotos({ FLOATING: 'tv-floating', ON_FLOOR: 'tv-on-floor', COMPLEX_UNIT: 'tv-complex' }),
    ledPieces: optionPhotos({ WALL_SHELVES: 'wall-shelves' }),
  },
  BEDROOM: {
    wardrobeDoorType: WARDROBE_DOOR_PHOTOS,
    bedSize: MATTRESS_PHOTOS,
    bedStorage: optionPhotos({ DRAWERS: 'bed-side-drawers' }),
    nightstandsCount: optionPhotos({ TWO: 'nightstands-pair' }),
  },
  OFFICE: {
    piecesNeeded: optionPhotos({ WALL_SHELVES: 'wall-shelves' }),
    deskShape: DESK_SHAPE_PHOTOS,
  },
  BATHROOM: { ventilation: VENTILATION_PHOTOS },
  LAUNDRY: {
    piecesNeeded: optionPhotos({ APPLIANCE_HOUSING: 'laundry-appliance-housing', COUNTERTOP: 'laundry-worktop', SINK_UNIT: 'laundry-sink-unit' }),
    ventilation: VENTILATION_PHOTOS,
  },
  PANTRY: {
    wallsUsed: optionPhotos({ ONE_WALL: 'pantry-layout-one-wall', L_SHAPE: 'pantry-layout-l', U_SHAPE: 'pantry-layout-u' }),
  },
  BALCONY: {
    enclosed: optionPhotos({ ENCLOSED: 'balcony-enclosed', OPEN: 'balcony-open' }),
    piecesNeeded: optionPhotos({ WORKTOP: 'balcony-worktop' }),
  },
  PIECE_WARDROBE: { doorType: WARDROBE_DOOR_PHOTOS },
  PIECE_DESK: { shape: DESK_SHAPE_PHOTOS },
  PIECE_BED: { bedSize: MATTRESS_PHOTOS, storage: optionPhotos({ DRAWERS: 'bed-side-drawers' }) },
  PIECE_NIGHTSTAND: { count: optionPhotos({ TWO: 'nightstands-pair' }) },
};

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
    OPEN: IlluWalkIn,
    SLIDING: IlluWardrobeSliding,
    HINGED: IlluWardrobeHinged,
  },
  interiorModules: {
    HANGING_RODS: IlluHangingRods,
    SHELVES: IlluOpenShelves,
    DRAWERS: IlluDresser,
    SHOE_RACK: IlluShoeRack,
    ACCESSORIES: IlluAccessories,
    // v3: LED-ul e modul interior, nu intrebare separata
    LED_LIGHTING: IlluClosetLighting,
  },
  // v1/v2 (FROZEN): intrebarea separata de iluminare
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
  // v1/v2 (FROZEN): intrebarea comuna pe camera
  ledLighting: { YES: IlluLedLighting },
  // v3: LED per corp — vizualul piesei pe fiecare optiune
  ledPieces: {
    TV_UNIT: IlluTvUnit,
    BOOKSHELF: IlluBookshelf,
    DISPLAY_CABINET: IlluDisplayCabinet,
    WALL_SHELVES: IlluWallShelves,
  },
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
    SIDE_BY_SIDE: showroomPhoto('side-by-side-washer-dryer'),
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
// Redari foto 3D (PO 2026-07-31); MDF generic si BUTON_PRESIUNE apar doar in
// flow-urile legacy v1 si refolosesc redarea cea mai apropiata.
const COMMON_BY_VALUE: Record<string, Illustration> = {
  PAL: PhotoPal,
  MDF: PhotoMdfVopsit,
  MDF_INFOLIAT: PhotoMdfInfoliat,
  MDF_VOPSIT: PhotoMdfVopsit,
  MDF_FURNIR: PhotoMdfFurnir,
  LEMN_MASIV: PhotoLemnMasiv,
  ALTUL: PhotoAltMaterial,
  PUSH: PhotoPush,
  GLISANTE: optionPhoto('sliding-doors'),
  BUTON_PRESIUNE: PhotoPush,
  MANER: PhotoManer,
  GOLA: PhotoGola,
  AVENTOS: PhotoAventos,
};

export function getIllustration(
  roomType: RoomType,
  stepId: string,
  optionValue: string,
): Illustration | null {
  const option = ROOM_OPTION_PHOTOS[roomType]?.[stepId]?.[optionValue];
  if (option) return option;
  const room = ROOM_MAPS[roomType]?.[stepId]?.[optionValue];
  if (room) return showroomIllustration(room);
  return COMMON_BY_VALUE[optionValue] ?? null;
}

// Vizualuri pentru cardurile boolean (da/nu).
export const BOOLEAN_ILLUSTRATIONS = { yes: IlluYes, no: IlluNo };
