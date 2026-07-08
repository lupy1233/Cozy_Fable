import type { RoomType } from '../../enums';
import type { RoomFlow } from '../types';
import { balconyFlow } from './balcony';
import { bathroomFlow } from './bathroom';
import { bathroomFlowV2 } from './bathroom.v2';
import { bedroomFlow } from './bedroom';
import { bedroomFlowV2 } from './bedroom.v2';
import { dressingFlow } from './dressing';
import { dressingFlowV2 } from './dressing.v2';
import {
  pieceBedFlow,
  pieceBenchFlow,
  pieceBookcaseFlow,
  pieceDeskFlow,
  pieceDresserFlow,
  pieceNightstandFlow,
  pieceShoeCabinetFlow,
  pieceTableFlow,
  pieceTvUnitFlow,
  pieceWardrobeFlow,
} from './guided-pieces';
import { hallwayFlow } from './hallway';
import { kitchenFlow } from './kitchen';
import { kitchenFlowV2 } from './kitchen.v2';
import { laundryFlow } from './laundry';
import { livingFlow } from './living';
import { livingFlowV2 } from './living.v2';
import { officeFlow } from './office';
import { officeFlowV2 } from './office.v2';
import { pantryFlow } from './pantry';
import { piecesFlow } from './pieces';

// Registrul canonic VERSIONAT al flow-urilor. Cererile publicate raman valabile
// contra versiunii lor originale (flow_version persistat pe request_rooms):
// o versiune odata publicata NU se modifica — schimbarile breaking inseamna un
// fisier nou (ex. kitchen.v2.ts) inregistrat aici sub versiunea urmatoare.
// FROZEN: kitchen v1, bathroom v1, dressing v1, living v1, office v1, bedroom v1.
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
  PANTRY: { [pantryFlow.version]: pantryFlow },
  LAUNDRY: { [laundryFlow.version]: laundryFlow },
  BALCONY: { [balconyFlow.version]: balconyFlow },
  PIECE_WARDROBE: { [pieceWardrobeFlow.version]: pieceWardrobeFlow },
  PIECE_TV_UNIT: { [pieceTvUnitFlow.version]: pieceTvUnitFlow },
  PIECE_BOOKCASE: { [pieceBookcaseFlow.version]: pieceBookcaseFlow },
  PIECE_DESK: { [pieceDeskFlow.version]: pieceDeskFlow },
  PIECE_BED: { [pieceBedFlow.version]: pieceBedFlow },
  PIECE_DRESSER: { [pieceDresserFlow.version]: pieceDresserFlow },
  PIECE_TABLE: { [pieceTableFlow.version]: pieceTableFlow },
  PIECE_SHOE_CABINET: { [pieceShoeCabinetFlow.version]: pieceShoeCabinetFlow },
  PIECE_NIGHTSTAND: { [pieceNightstandFlow.version]: pieceNightstandFlow },
  PIECE_BENCH: { [pieceBenchFlow.version]: pieceBenchFlow },
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
  PANTRY: pantryFlow.version,
  LAUNDRY: laundryFlow.version,
  BALCONY: balconyFlow.version,
  PIECE_WARDROBE: pieceWardrobeFlow.version,
  PIECE_TV_UNIT: pieceTvUnitFlow.version,
  PIECE_BOOKCASE: pieceBookcaseFlow.version,
  PIECE_DESK: pieceDeskFlow.version,
  PIECE_BED: pieceBedFlow.version,
  PIECE_DRESSER: pieceDresserFlow.version,
  PIECE_TABLE: pieceTableFlow.version,
  PIECE_SHOE_CABINET: pieceShoeCabinetFlow.version,
  PIECE_NIGHTSTAND: pieceNightstandFlow.version,
  PIECE_BENCH: pieceBenchFlow.version,
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
  laundryFlow,
  balconyFlow,
  pieceWardrobeFlow,
  pieceTvUnitFlow,
  pieceBookcaseFlow,
  pieceDeskFlow,
  pieceBedFlow,
  pieceDresserFlow,
  pieceTableFlow,
  pieceShoeCabinetFlow,
  pieceNightstandFlow,
  pieceBenchFlow,
};
