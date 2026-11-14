import type { RoomType } from '../../enums';
import type { RoomFlow } from '../types';
import { balconyFlow } from './balcony';
import { balconyFlowV2 } from './balcony.v2';
import { balconyFlowV3 } from './balcony.v3';
import { balconyFlowV4 } from './balcony.v4';
import { bathroomFlow } from './bathroom';
import { bathroomFlowV2 } from './bathroom.v2';
import { bathroomFlowV3 } from './bathroom.v3';
import { bathroomFlowV4 } from './bathroom.v4';
import { bedroomFlow } from './bedroom';
import { bedroomFlowV2 } from './bedroom.v2';
import { bedroomFlowV3 } from './bedroom.v3';
import { bedroomFlowV4 } from './bedroom.v4';
import { dressingFlow } from './dressing';
import { dressingFlowV2 } from './dressing.v2';
import { dressingFlowV3 } from './dressing.v3';
import { dressingFlowV4 } from './dressing.v4';
import { dressingFlowV5 } from './dressing.v5';
import {
  pieceBedFlow,
  pieceBedFlowV2,
  pieceBedFlowV3,
  pieceBedFlowV4,
  pieceBedFlowV5,
  pieceBenchFlow,
  pieceBenchFlowV2,
  pieceBenchFlowV3,
  pieceBenchFlowV4,
  pieceBenchFlowV5,
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
  pieceTableFlowV5,
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
import { hallwayFlowV3 } from './hallway.v3';
import { kitchenFlow } from './kitchen';
import { kitchenFlowV2 } from './kitchen.v2';
import { kitchenFlowV3 } from './kitchen.v3';
import { kitchenFlowV4 } from './kitchen.v4';
import { kitchenFlowV5 } from './kitchen.v5';
import { laundryFlow } from './laundry';
import { laundryFlowV2 } from './laundry.v2';
import { laundryFlowV3 } from './laundry.v3';
import { laundryFlowV4 } from './laundry.v4';
import { livingFlow } from './living';
import { livingFlowV2 } from './living.v2';
import { livingFlowV3 } from './living.v3';
import { livingFlowV4 } from './living.v4';
import { livingFlowV5 } from './living.v5';
import { officeFlow } from './office';
import { officeFlowV2 } from './office.v2';
import { officeFlowV3 } from './office.v3';
import { officeFlowV4 } from './office.v4';
import { pantryFlow } from './pantry';
import { pantryFlowV2 } from './pantry.v2';
import { pantryFlowV3 } from './pantry.v3';
import { pantryFlowV4 } from './pantry.v4';
import { piecesFlow } from './pieces';
import { piecesFlowV2 } from './pieces.v2';
import { catalogFlowRegistry, catalogFlowVersions } from './guided-pieces/catalog-v1';
import { catalogFlowRegistryV2, catalogFlowVersionsV2 } from './guided-pieces/catalog-v2';
import { catalogFlowRegistryV3, catalogFlowVersionsV3, pieceSofaFlowV3 } from './guided-pieces/catalog-v3';

type CatalogRoomType = keyof typeof catalogFlowRegistry;
// piesele de catalog: v1 (inghetata) + v2 (etapa 6) + v3 (etapa 10, doar canapeaua), pe acelasi tip de camera
const catalogRegistryAll = Object.fromEntries(
  (Object.keys(catalogFlowRegistry) as CatalogRoomType[]).map((rt) => [
    rt,
    { ...catalogFlowRegistry[rt], ...catalogFlowRegistryV2[rt], ...(catalogFlowRegistryV3[rt] ?? {}) },
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
    [kitchenFlowV5.version]: kitchenFlowV5,
  },
  DRESSING: {
    [dressingFlow.version]: dressingFlow,
    [dressingFlowV2.version]: dressingFlowV2,
    [dressingFlowV3.version]: dressingFlowV3,
    [dressingFlowV4.version]: dressingFlowV4,
    [dressingFlowV5.version]: dressingFlowV5,
  },
  LIVING: {
    [livingFlow.version]: livingFlow,
    [livingFlowV2.version]: livingFlowV2,
    [livingFlowV3.version]: livingFlowV3,
    [livingFlowV4.version]: livingFlowV4,
    [livingFlowV5.version]: livingFlowV5,
  },
  OFFICE: { [officeFlow.version]: officeFlow, [officeFlowV2.version]: officeFlowV2, [officeFlowV3.version]: officeFlowV3, [officeFlowV4.version]: officeFlowV4 },
  BEDROOM: { [bedroomFlow.version]: bedroomFlow, [bedroomFlowV2.version]: bedroomFlowV2, [bedroomFlowV3.version]: bedroomFlowV3, [bedroomFlowV4.version]: bedroomFlowV4 },
  BATHROOM: { [bathroomFlow.version]: bathroomFlow, [bathroomFlowV2.version]: bathroomFlowV2, [bathroomFlowV3.version]: bathroomFlowV3, [bathroomFlowV4.version]: bathroomFlowV4 },
  PIECES: { [piecesFlow.version]: piecesFlow, [piecesFlowV2.version]: piecesFlowV2 },
  HALLWAY: { [hallwayFlow.version]: hallwayFlow, [hallwayFlowV2.version]: hallwayFlowV2, [hallwayFlowV3.version]: hallwayFlowV3 },
  PANTRY: { [pantryFlow.version]: pantryFlow, [pantryFlowV2.version]: pantryFlowV2, [pantryFlowV3.version]: pantryFlowV3, [pantryFlowV4.version]: pantryFlowV4 },
  LAUNDRY: { [laundryFlow.version]: laundryFlow, [laundryFlowV2.version]: laundryFlowV2, [laundryFlowV3.version]: laundryFlowV3, [laundryFlowV4.version]: laundryFlowV4 },
  BALCONY: { [balconyFlow.version]: balconyFlow, [balconyFlowV2.version]: balconyFlowV2, [balconyFlowV3.version]: balconyFlowV3, [balconyFlowV4.version]: balconyFlowV4 },
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
    [pieceBedFlowV5.version]: pieceBedFlowV5,
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
    [pieceTableFlowV5.version]: pieceTableFlowV5,
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
    [pieceBenchFlowV5.version]: pieceBenchFlowV5,
  },
};

// Versiunea cu care pornesc camerele NOI in wizard.
// Etapa 6 (valul 3): toate tipurile pornesc pe versiunea noua (material + deschidere pe un ecran,
// "decide firma"). Versiunile vechi raman inregistrate: ciornele si cererile publicate isi pastreaza flowVersion.
// Inainte: KITCHEN/DRESSING/LIVING v3, OFFICE/BEDROOM/BATHROOM/PANTRY/LAUNDRY/BALCONY v2, PIECES/HALLWAY v1,
// piesele ghidate v3, piesele de catalog v1 (vezi FLOW_VERSIONS_BEFORE_ETAPA6).
// Etapa 10 (valul 2): comutarea pe formularul v7 (= ETAPA10_FLOW_VERSION; inainte = ETAPA6_FLOW_VERSION).
export const CURRENT_FLOW_VERSION: Record<RoomType, number> = {
  ...catalogFlowVersions,
  ...catalogFlowVersionsV2,
  // etapa 10 (valul 2): canapeaua v3
  ...catalogFlowVersionsV3,
  KITCHEN: kitchenFlowV5.version,
  DRESSING: dressingFlowV5.version,
  LIVING: livingFlowV5.version,
  OFFICE: officeFlowV4.version,
  BEDROOM: bedroomFlowV4.version,
  BATHROOM: bathroomFlowV4.version,
  PIECES: piecesFlowV2.version,
  HALLWAY: hallwayFlowV3.version,
  PANTRY: pantryFlowV4.version,
  LAUNDRY: laundryFlowV4.version,
  BALCONY: balconyFlowV4.version,
  PIECE_WARDROBE: pieceWardrobeFlowV4.version,
  PIECE_TV_UNIT: pieceTvUnitFlowV4.version,
  PIECE_BOOKCASE: pieceBookcaseFlowV4.version,
  PIECE_DESK: pieceDeskFlowV4.version,
  PIECE_BED: pieceBedFlowV5.version,
  PIECE_DRESSER: pieceDresserFlowV4.version,
  PIECE_TABLE: pieceTableFlowV5.version,
  PIECE_SHOE_CABINET: pieceShoeCabinetFlowV4.version,
  PIECE_NIGHTSTAND: pieceNightstandFlowV4.version,
  PIECE_BENCH: pieceBenchFlowV5.version,
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
// Etapa 10 (E10-N26): INGHETATA ca valori literale — calculata ca "versiunea maxima" s-ar fi mutat
// singura pe versiunile etapei 10 (si ar fi stricat testele etapei 6).
export const ETAPA6_FLOW_VERSION: Record<RoomType, number> = {
  ...(Object.fromEntries(
    (Object.keys(catalogFlowVersions) as CatalogRoomType[]).map((rt) => [rt, 2]),
  ) as Record<CatalogRoomType, number>),
  KITCHEN: 4,
  DRESSING: 4,
  LIVING: 4,
  OFFICE: 3,
  BEDROOM: 3,
  BATHROOM: 3,
  PIECES: 2,
  HALLWAY: 2,
  PANTRY: 3,
  LAUNDRY: 3,
  BALCONY: 3,
  PIECE_WARDROBE: 4,
  PIECE_TV_UNIT: 4,
  PIECE_BOOKCASE: 4,
  PIECE_DESK: 4,
  PIECE_BED: 4,
  PIECE_DRESSER: 4,
  PIECE_TABLE: 4,
  PIECE_SHOE_CABINET: 4,
  PIECE_NIGHTSTAND: 4,
  PIECE_BENCH: 4,
};

// Etapa 10: toate versiunile inregistrate INAINTE de etapa 10 (vechi + etapa 6). Filtrul fixture-urilor
// 'etapa6' = aici si NU in FLOW_VERSIONS_BEFORE_ETAPA6 → instantaneele score-v6 / firm-text-v6 raman identice.
export const FLOW_VERSIONS_BEFORE_ETAPA10: Record<RoomType, number[]> = Object.fromEntries(
  (Object.keys(FLOW_VERSIONS_BEFORE_ETAPA6) as RoomType[]).map((rt) => [
    rt,
    [...FLOW_VERSIONS_BEFORE_ETAPA6[rt], ETAPA6_FLOW_VERSION[rt]],
  ]),
) as Record<RoomType, number[]>;

// Etapa 10 (formularul v7): versiunea noua pe cele 14 tipuri din DESIGN §3; pe celelalte = versiunea etapei 6.
// Tinta lui CURRENT_FLOW_VERSION in valul 2 (coordonatorul).
export const ETAPA10_FLOW_VERSION: Record<RoomType, number> = {
  ...ETAPA6_FLOW_VERSION,
  KITCHEN: kitchenFlowV5.version,
  DRESSING: dressingFlowV5.version,
  LIVING: livingFlowV5.version,
  OFFICE: officeFlowV4.version,
  BEDROOM: bedroomFlowV4.version,
  BATHROOM: bathroomFlowV4.version,
  PANTRY: pantryFlowV4.version,
  LAUNDRY: laundryFlowV4.version,
  BALCONY: balconyFlowV4.version,
  HALLWAY: hallwayFlowV3.version,
  PIECE_BED: pieceBedFlowV5.version,
  PIECE_TABLE: pieceTableFlowV5.version,
  PIECE_BENCH: pieceBenchFlowV5.version,
  PIECE_SOFA: pieceSofaFlowV3.version,
};

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
  // etapa 10 (formularul v7)
  kitchenFlowV5,
  dressingFlowV5,
  livingFlowV5,
  officeFlowV4,
  bedroomFlowV4,
  bathroomFlowV4,
  pantryFlowV4,
  laundryFlowV4,
  balconyFlowV4,
  hallwayFlowV3,
  pieceBedFlowV5,
  pieceTableFlowV5,
  pieceBenchFlowV5,
  pieceSofaFlowV3,
};
