import type { RoomType } from '../../enums';
import type { RoomFlow } from '../types';
import { balconyFlow } from './balcony';
import { balconyFlowV2 } from './balcony.v2';
import { balconyFlowV3 } from './balcony.v3';
import { bathroomFlow } from './bathroom';
import { bathroomFlowV2 } from './bathroom.v2';
import { bathroomFlowV3 } from './bathroom.v3';
import { bedroomFlow } from './bedroom';
import { bedroomFlowV2 } from './bedroom.v2';
import { bedroomFlowV3 } from './bedroom.v3';
import { dressingFlow } from './dressing';
import { dressingFlowV2 } from './dressing.v2';
import { dressingFlowV3 } from './dressing.v3';
import { dressingFlowV4 } from './dressing.v4';
import {
  pieceBedFlow,
  pieceBedFlowV2,
  pieceBedFlowV3,
  pieceBedFlowV4,
  pieceBenchFlow,
  pieceBenchFlowV2,
  pieceBenchFlowV3,
  pieceBenchFlowV4,
  pieceBookcaseFlow,
  pieceBookcaseFlowV2,
  pieceBookcaseFlowV3,
  pieceBookcaseFlowV4,
  pieceDeskFlow,
  pieceDeskFlowV2,
  pieceDeskFlowV3,
  pieceDeskFlowV4,
  pieceDresserFlow,
  pieceDresserFlowV2,
  pieceDresserFlowV3,
  pieceDresserFlowV4,
  pieceNightstandFlow,
  pieceNightstandFlowV2,
  pieceNightstandFlowV3,
  pieceNightstandFlowV4,
  pieceShoeCabinetFlow,
  pieceShoeCabinetFlowV2,
  pieceShoeCabinetFlowV3,
  pieceShoeCabinetFlowV4,
  pieceTableFlow,
  pieceTableFlowV2,
  pieceTableFlowV3,
  pieceTableFlowV4,
  pieceTvUnitFlow,
  pieceTvUnitFlowV2,
  pieceTvUnitFlowV3,
  pieceTvUnitFlowV4,
  pieceWardrobeFlow,
  pieceWardrobeFlowV2,
  pieceWardrobeFlowV3,
  pieceWardrobeFlowV4,
} from './guided-pieces';
import { hallwayFlow } from './hallway';
import { hallwayFlowV2 } from './hallway.v2';
import { kitchenFlow } from './kitchen';
import { kitchenFlowV2 } from './kitchen.v2';
import { kitchenFlowV3 } from './kitchen.v3';
import { kitchenFlowV4 } from './kitchen.v4';
import { laundryFlow } from './laundry';
import { laundryFlowV2 } from './laundry.v2';
import { laundryFlowV3 } from './laundry.v3';
import { livingFlow } from './living';
import { livingFlowV2 } from './living.v2';
import { livingFlowV3 } from './living.v3';
import { livingFlowV4 } from './living.v4';
import { officeFlow } from './office';
import { officeFlowV2 } from './office.v2';
import { officeFlowV3 } from './office.v3';
import { pantryFlow } from './pantry';
import { pantryFlowV2 } from './pantry.v2';
import { pantryFlowV3 } from './pantry.v3';
import { piecesFlow } from './pieces';
import { piecesFlowV2 } from './pieces.v2';
import { catalogFlowRegistry, catalogFlowVersions } from './guided-pieces/catalog-v1';
import { catalogFlowRegistryV2, catalogFlowVersionsV2 } from './guided-pieces/catalog-v2';

type CatalogRoomType = keyof typeof catalogFlowRegistry;
// piesele de catalog: v1 (inghetata) + v2 (etapa 6), pe acelasi tip de camera
const catalogRegistryAll = Object.fromEntries(
  (Object.keys(catalogFlowRegistry) as CatalogRoomType[]).map((rt) => [
    rt,
    { ...catalogFlowRegistry[rt], ...catalogFlowRegistryV2[rt] },
  ]),
) as Record<CatalogRoomType, Record<number, RoomFlow>>;

// Registrul canonic VERSIONAT al flow-urilor. Cererile publicate raman valabile
// contra versiunii lor originale (flow_version persistat pe request_rooms):
// o versiune odata publicata NU se modifica — schimbarile breaking inseamna un
// fisier nou (ex. kitchen.v2.ts) inregistrat aici sub versiunea urmatoare.
// FROZEN: toate versiunile 1 (camere + piese ghidate).
// PIECES v1 ramane CURENT ca "Alta piesa" (formular liber, fallback).
// Etapa 6: versiunile noi (kitchen v4, ..., catalog v2) sunt inregistrate din valul 1;
// CURRENT_FLOW_VERSION se schimba separat, in valul 3 (coordonator).
export const FLOW_REGISTRY: Record<RoomType, Record<number, RoomFlow>> = {
  ...catalogRegistryAll,
  KITCHEN: {
    [kitchenFlow.version]: kitchenFlow,
    [kitchenFlowV2.version]: kitchenFlowV2,
    [kitchenFlowV3.version]: kitchenFlowV3,
    [kitchenFlowV4.version]: kitchenFlowV4,
  },
  DRESSING: {
    [dressingFlow.version]: dressingFlow,
    [dressingFlowV2.version]: dressingFlowV2,
    [dressingFlowV3.version]: dressingFlowV3,
    [dressingFlowV4.version]: dressingFlowV4,
  },
  LIVING: {
    [livingFlow.version]: livingFlow,
    [livingFlowV2.version]: livingFlowV2,
    [livingFlowV3.version]: livingFlowV3,
    [livingFlowV4.version]: livingFlowV4,
  },
  OFFICE: { [officeFlow.version]: officeFlow, [officeFlowV2.version]: officeFlowV2, [officeFlowV3.version]: officeFlowV3 },
  BEDROOM: { [bedroomFlow.version]: bedroomFlow, [bedroomFlowV2.version]: bedroomFlowV2, [bedroomFlowV3.version]: bedroomFlowV3 },
  BATHROOM: { [bathroomFlow.version]: bathroomFlow, [bathroomFlowV2.version]: bathroomFlowV2, [bathroomFlowV3.version]: bathroomFlowV3 },
  PIECES: { [piecesFlow.version]: piecesFlow, [piecesFlowV2.version]: piecesFlowV2 },
  HALLWAY: { [hallwayFlow.version]: hallwayFlow, [hallwayFlowV2.version]: hallwayFlowV2 },
  PANTRY: { [pantryFlow.version]: pantryFlow, [pantryFlowV2.version]: pantryFlowV2, [pantryFlowV3.version]: pantryFlowV3 },
  LAUNDRY: { [laundryFlow.version]: laundryFlow, [laundryFlowV2.version]: laundryFlowV2, [laundryFlowV3.version]: laundryFlowV3 },
  BALCONY: { [balconyFlow.version]: balconyFlow, [balconyFlowV2.version]: balconyFlowV2, [balconyFlowV3.version]: balconyFlowV3 },
  PIECE_WARDROBE: {
    [pieceWardrobeFlow.version]: pieceWardrobeFlow,
    [pieceWardrobeFlowV2.version]: pieceWardrobeFlowV2,
    [pieceWardrobeFlowV3.version]: pieceWardrobeFlowV3,
    [pieceWardrobeFlowV4.version]: pieceWardrobeFlowV4,
  },
  PIECE_TV_UNIT: {
    [pieceTvUnitFlow.version]: pieceTvUnitFlow,
    [pieceTvUnitFlowV2.version]: pieceTvUnitFlowV2,
    [pieceTvUnitFlowV3.version]: pieceTvUnitFlowV3,
    [pieceTvUnitFlowV4.version]: pieceTvUnitFlowV4,
  },
  PIECE_BOOKCASE: {
    [pieceBookcaseFlow.version]: pieceBookcaseFlow,
    [pieceBookcaseFlowV2.version]: pieceBookcaseFlowV2,
    [pieceBookcaseFlowV3.version]: pieceBookcaseFlowV3,
    [pieceBookcaseFlowV4.version]: pieceBookcaseFlowV4,
  },
  PIECE_DESK: {
    [pieceDeskFlow.version]: pieceDeskFlow,
    [pieceDeskFlowV2.version]: pieceDeskFlowV2,
    [pieceDeskFlowV3.version]: pieceDeskFlowV3,
    [pieceDeskFlowV4.version]: pieceDeskFlowV4,
  },
  PIECE_BED: {
    [pieceBedFlow.version]: pieceBedFlow,
    [pieceBedFlowV2.version]: pieceBedFlowV2,
    [pieceBedFlowV3.version]: pieceBedFlowV3,
    [pieceBedFlowV4.version]: pieceBedFlowV4,
  },
  PIECE_DRESSER: {
    [pieceDresserFlow.version]: pieceDresserFlow,
    [pieceDresserFlowV2.version]: pieceDresserFlowV2,
    [pieceDresserFlowV3.version]: pieceDresserFlowV3,
    [pieceDresserFlowV4.version]: pieceDresserFlowV4,
  },
  PIECE_TABLE: {
    [pieceTableFlow.version]: pieceTableFlow,
    [pieceTableFlowV2.version]: pieceTableFlowV2,
    [pieceTableFlowV3.version]: pieceTableFlowV3,
    [pieceTableFlowV4.version]: pieceTableFlowV4,
  },
  PIECE_SHOE_CABINET: {
    [pieceShoeCabinetFlow.version]: pieceShoeCabinetFlow,
    [pieceShoeCabinetFlowV2.version]: pieceShoeCabinetFlowV2,
    [pieceShoeCabinetFlowV3.version]: pieceShoeCabinetFlowV3,
    [pieceShoeCabinetFlowV4.version]: pieceShoeCabinetFlowV4,
  },
  PIECE_NIGHTSTAND: {
    [pieceNightstandFlow.version]: pieceNightstandFlow,
    [pieceNightstandFlowV2.version]: pieceNightstandFlowV2,
    [pieceNightstandFlowV3.version]: pieceNightstandFlowV3,
    [pieceNightstandFlowV4.version]: pieceNightstandFlowV4,
  },
  PIECE_BENCH: {
    [pieceBenchFlow.version]: pieceBenchFlow,
    [pieceBenchFlowV2.version]: pieceBenchFlowV2,
    [pieceBenchFlowV3.version]: pieceBenchFlowV3,
    [pieceBenchFlowV4.version]: pieceBenchFlowV4,
  },
};

// Versiunea cu care pornesc camerele NOI in wizard.
// Etapa 6 (valul 3): toate tipurile pornesc pe versiunea noua (material + deschidere pe un ecran,
// "decide firma"). Versiunile vechi raman inregistrate: ciornele si cererile publicate isi pastreaza flowVersion.
// Inainte: KITCHEN/DRESSING/LIVING v3, OFFICE/BEDROOM/BATHROOM/PANTRY/LAUNDRY/BALCONY v2, PIECES/HALLWAY v1,
// piesele ghidate v3, piesele de catalog v1 (vezi FLOW_VERSIONS_BEFORE_ETAPA6).
export const CURRENT_FLOW_VERSION: Record<RoomType, number> = {
  ...catalogFlowVersions,
  ...catalogFlowVersionsV2,
  KITCHEN: kitchenFlowV4.version,
  DRESSING: dressingFlowV4.version,
  LIVING: livingFlowV4.version,
  OFFICE: officeFlowV3.version,
  BEDROOM: bedroomFlowV3.version,
  BATHROOM: bathroomFlowV3.version,
  PIECES: piecesFlowV2.version,
  HALLWAY: hallwayFlowV2.version,
  PANTRY: pantryFlowV3.version,
  LAUNDRY: laundryFlowV3.version,
  BALCONY: balconyFlowV3.version,
  PIECE_WARDROBE: pieceWardrobeFlowV4.version,
  PIECE_TV_UNIT: pieceTvUnitFlowV4.version,
  PIECE_BOOKCASE: pieceBookcaseFlowV4.version,
  PIECE_DESK: pieceDeskFlowV4.version,
  PIECE_BED: pieceBedFlowV4.version,
  PIECE_DRESSER: pieceDresserFlowV4.version,
  PIECE_TABLE: pieceTableFlowV4.version,
  PIECE_SHOE_CABINET: pieceShoeCabinetFlowV4.version,
  PIECE_NIGHTSTAND: pieceNightstandFlowV4.version,
  PIECE_BENCH: pieceBenchFlowV4.version,
};

// Etapa 6: versiunile care existau INAINTE de etapa 6 (inghetate). Testele de invarianta
// (score-invariance, firm-text) ruleaza doar pe ele → instantaneele vechi raman byte-identice.
export const FLOW_VERSIONS_BEFORE_ETAPA6: Record<RoomType, number[]> = {
  ...(Object.fromEntries(
    (Object.keys(catalogFlowVersions) as CatalogRoomType[]).map((rt) => [rt, [1]]),
  ) as Record<CatalogRoomType, number[]>),
  KITCHEN: [1, 2, 3],
  DRESSING: [1, 2, 3],
  LIVING: [1, 2, 3],
  OFFICE: [1, 2],
  BEDROOM: [1, 2],
  BATHROOM: [1, 2],
  PIECES: [1],
  HALLWAY: [1],
  PANTRY: [1, 2],
  LAUNDRY: [1, 2],
  BALCONY: [1, 2],
  PIECE_WARDROBE: [1, 2, 3],
  PIECE_TV_UNIT: [1, 2, 3],
  PIECE_BOOKCASE: [1, 2, 3],
  PIECE_DESK: [1, 2, 3],
  PIECE_BED: [1, 2, 3],
  PIECE_DRESSER: [1, 2, 3],
  PIECE_TABLE: [1, 2, 3],
  PIECE_SHOE_CABINET: [1, 2, 3],
  PIECE_NIGHTSTAND: [1, 2, 3],
  PIECE_BENCH: [1, 2, 3],
};

// Etapa 6: versiunea noua a fiecarui tip de camera (tinta lui CURRENT_FLOW_VERSION in valul 3).
export const ETAPA6_FLOW_VERSION: Record<RoomType, number> = Object.fromEntries(
  (Object.keys(FLOW_REGISTRY) as RoomType[]).map((rt) => [rt, Math.max(...Object.keys(FLOW_REGISTRY[rt]).map(Number))]),
) as Record<RoomType, number>;

export {
  kitchenFlow,
  kitchenFlowV2,
  kitchenFlowV3,
  kitchenFlowV4,
  dressingFlow,
  dressingFlowV2,
  dressingFlowV3,
  dressingFlowV4,
  livingFlow,
  livingFlowV2,
  livingFlowV3,
  livingFlowV4,
  officeFlow,
  officeFlowV2,
  officeFlowV3,
  bedroomFlow,
  bedroomFlowV2,
  bedroomFlowV3,
  bathroomFlow,
  bathroomFlowV2,
  bathroomFlowV3,
  piecesFlow,
  piecesFlowV2,
  hallwayFlow,
  hallwayFlowV2,
  pantryFlow,
  pantryFlowV2,
  pantryFlowV3,
  laundryFlow,
  laundryFlowV2,
  laundryFlowV3,
  balconyFlow,
  balconyFlowV2,
  balconyFlowV3,
  pieceWardrobeFlow,
  pieceWardrobeFlowV2,
  pieceWardrobeFlowV3,
  pieceTvUnitFlow,
  pieceTvUnitFlowV2,
  pieceTvUnitFlowV3,
  pieceBookcaseFlow,
  pieceBookcaseFlowV2,
  pieceBookcaseFlowV3,
  pieceDeskFlow,
  pieceDeskFlowV2,
  pieceDeskFlowV3,
  pieceBedFlow,
  pieceBedFlowV2,
  pieceDresserFlow,
  pieceDresserFlowV2,
  pieceDresserFlowV3,
  pieceTableFlow,
  pieceTableFlowV2,
  pieceShoeCabinetFlow,
  pieceShoeCabinetFlowV2,
  pieceShoeCabinetFlowV3,
  pieceNightstandFlow,
  pieceNightstandFlowV2,
  pieceNightstandFlowV3,
  pieceBenchFlow,
  pieceBenchFlowV2,
  pieceWardrobeFlowV4,
  pieceTvUnitFlowV4,
  pieceBookcaseFlowV4,
  pieceDeskFlowV4,
  pieceBedFlowV4,
  pieceDresserFlowV4,
  pieceTableFlowV4,
  pieceShoeCabinetFlowV4,
  pieceNightstandFlowV4,
  pieceBenchFlowV4,
};
