import type { RoomType } from '../../enums';
import type { RoomFlow } from '../types';
import { balconyFlow } from './balcony';
import { balconyFlowV2 } from './balcony.v2';
import { bathroomFlow } from './bathroom';
import { bathroomFlowV2 } from './bathroom.v2';
import { bedroomFlow } from './bedroom';
import { bedroomFlowV2 } from './bedroom.v2';
import { dressingFlow } from './dressing';
import { dressingFlowV2 } from './dressing.v2';
import {
  pieceBedFlow,
  pieceBedFlowV2,
  pieceBenchFlow,
  pieceBenchFlowV2,
  pieceBookcaseFlow,
  pieceBookcaseFlowV2,
  pieceDeskFlow,
  pieceDeskFlowV2,
  pieceDresserFlow,
  pieceDresserFlowV2,
  pieceNightstandFlow,
  pieceNightstandFlowV2,
  pieceShoeCabinetFlow,
  pieceShoeCabinetFlowV2,
  pieceTableFlow,
  pieceTableFlowV2,
  pieceTvUnitFlow,
  pieceTvUnitFlowV2,
  pieceWardrobeFlow,
  pieceWardrobeFlowV2,
} from './guided-pieces';
import { hallwayFlow } from './hallway';
import { kitchenFlow } from './kitchen';
import { kitchenFlowV2 } from './kitchen.v2';
import { laundryFlow } from './laundry';
import { laundryFlowV2 } from './laundry.v2';
import { livingFlow } from './living';
import { livingFlowV2 } from './living.v2';
import { officeFlow } from './office';
import { officeFlowV2 } from './office.v2';
import { pantryFlow } from './pantry';
import { pantryFlowV2 } from './pantry.v2';
import { piecesFlow } from './pieces';

// Registrul canonic VERSIONAT al flow-urilor. Cererile publicate raman valabile
// contra versiunii lor originale (flow_version persistat pe request_rooms):
// o versiune odata publicata NU se modifica — schimbarile breaking inseamna un
// fisier nou (ex. kitchen.v2.ts) inregistrat aici sub versiunea urmatoare.
// FROZEN: toate versiunile 1 (camere + piese ghidate).
// PIECES v1 ramane CURENT ca "Alta piesa" (formular liber, fallback).
export const FLOW_REGISTRY: Record<RoomType, Record<number, RoomFlow>> = {
  KITCHEN: { [kitchenFlow.version]: kitchenFlow, [kitchenFlowV2.version]: kitchenFlowV2 },
  DRESSING: { [dressingFlow.version]: dressingFlow, [dressingFlowV2.version]: dressingFlowV2 },
  LIVING: { [livingFlow.version]: livingFlow, [livingFlowV2.version]: livingFlowV2 },
  OFFICE: { [officeFlow.version]: officeFlow, [officeFlowV2.version]: officeFlowV2 },
  BEDROOM: { [bedroomFlow.version]: bedroomFlow, [bedroomFlowV2.version]: bedroomFlowV2 },
  BATHROOM: { [bathroomFlow.version]: bathroomFlow, [bathroomFlowV2.version]: bathroomFlowV2 },
  PIECES: { [piecesFlow.version]: piecesFlow },
  HALLWAY: { [hallwayFlow.version]: hallwayFlow },
  PANTRY: { [pantryFlow.version]: pantryFlow, [pantryFlowV2.version]: pantryFlowV2 },
  LAUNDRY: { [laundryFlow.version]: laundryFlow, [laundryFlowV2.version]: laundryFlowV2 },
  BALCONY: { [balconyFlow.version]: balconyFlow, [balconyFlowV2.version]: balconyFlowV2 },
  PIECE_WARDROBE: {
    [pieceWardrobeFlow.version]: pieceWardrobeFlow,
    [pieceWardrobeFlowV2.version]: pieceWardrobeFlowV2,
  },
  PIECE_TV_UNIT: {
    [pieceTvUnitFlow.version]: pieceTvUnitFlow,
    [pieceTvUnitFlowV2.version]: pieceTvUnitFlowV2,
  },
  PIECE_BOOKCASE: {
    [pieceBookcaseFlow.version]: pieceBookcaseFlow,
    [pieceBookcaseFlowV2.version]: pieceBookcaseFlowV2,
  },
  PIECE_DESK: {
    [pieceDeskFlow.version]: pieceDeskFlow,
    [pieceDeskFlowV2.version]: pieceDeskFlowV2,
  },
  PIECE_BED: {
    [pieceBedFlow.version]: pieceBedFlow,
    [pieceBedFlowV2.version]: pieceBedFlowV2,
  },
  PIECE_DRESSER: {
    [pieceDresserFlow.version]: pieceDresserFlow,
    [pieceDresserFlowV2.version]: pieceDresserFlowV2,
  },
  PIECE_TABLE: {
    [pieceTableFlow.version]: pieceTableFlow,
    [pieceTableFlowV2.version]: pieceTableFlowV2,
  },
  PIECE_SHOE_CABINET: {
    [pieceShoeCabinetFlow.version]: pieceShoeCabinetFlow,
    [pieceShoeCabinetFlowV2.version]: pieceShoeCabinetFlowV2,
  },
  PIECE_NIGHTSTAND: {
    [pieceNightstandFlow.version]: pieceNightstandFlow,
    [pieceNightstandFlowV2.version]: pieceNightstandFlowV2,
  },
  PIECE_BENCH: {
    [pieceBenchFlow.version]: pieceBenchFlow,
    [pieceBenchFlowV2.version]: pieceBenchFlowV2,
  },
};

// Versiunea cu care pornesc camerele NOI in wizard.
export const CURRENT_FLOW_VERSION: Record<RoomType, number> = {
  KITCHEN: kitchenFlowV2.version,
  DRESSING: dressingFlowV2.version,
  LIVING: livingFlowV2.version,
  OFFICE: officeFlowV2.version,
  BEDROOM: bedroomFlowV2.version,
  BATHROOM: bathroomFlowV2.version,
  PIECES: piecesFlow.version,
  HALLWAY: hallwayFlow.version,
  PANTRY: pantryFlowV2.version,
  LAUNDRY: laundryFlowV2.version,
  BALCONY: balconyFlowV2.version,
  PIECE_WARDROBE: pieceWardrobeFlowV2.version,
  PIECE_TV_UNIT: pieceTvUnitFlowV2.version,
  PIECE_BOOKCASE: pieceBookcaseFlowV2.version,
  PIECE_DESK: pieceDeskFlowV2.version,
  PIECE_BED: pieceBedFlowV2.version,
  PIECE_DRESSER: pieceDresserFlowV2.version,
  PIECE_TABLE: pieceTableFlowV2.version,
  PIECE_SHOE_CABINET: pieceShoeCabinetFlowV2.version,
  PIECE_NIGHTSTAND: pieceNightstandFlowV2.version,
  PIECE_BENCH: pieceBenchFlowV2.version,
};

export {
  kitchenFlow,
  kitchenFlowV2,
  dressingFlow,
  dressingFlowV2,
  livingFlow,
  livingFlowV2,
  officeFlow,
  officeFlowV2,
  bedroomFlow,
  bedroomFlowV2,
  bathroomFlow,
  bathroomFlowV2,
  piecesFlow,
  hallwayFlow,
  pantryFlow,
  pantryFlowV2,
  laundryFlow,
  laundryFlowV2,
  balconyFlow,
  balconyFlowV2,
  pieceWardrobeFlow,
  pieceWardrobeFlowV2,
  pieceTvUnitFlow,
  pieceTvUnitFlowV2,
  pieceBookcaseFlow,
  pieceBookcaseFlowV2,
  pieceDeskFlow,
  pieceDeskFlowV2,
  pieceBedFlow,
  pieceBedFlowV2,
  pieceDresserFlow,
  pieceDresserFlowV2,
  pieceTableFlow,
  pieceTableFlowV2,
  pieceShoeCabinetFlow,
  pieceShoeCabinetFlowV2,
  pieceNightstandFlow,
  pieceNightstandFlowV2,
  pieceBenchFlow,
  pieceBenchFlowV2,
};
