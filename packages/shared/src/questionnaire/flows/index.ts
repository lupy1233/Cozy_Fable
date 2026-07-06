import type { RoomType } from '../../enums';
import type { RoomFlow } from '../types';
import { bathroomFlow } from './bathroom';
import { bathroomFlowV2 } from './bathroom.v2';
import { bedroomFlow } from './bedroom';
import { dressingFlow } from './dressing';
import { kitchenFlow } from './kitchen';
import { kitchenFlowV2 } from './kitchen.v2';
import { livingFlow } from './living';
import { officeFlow } from './office';
import { piecesFlow } from './pieces';

// Registrul canonic VERSIONAT al flow-urilor. Cererile publicate raman valabile
// contra versiunii lor originale (flow_version persistat pe request_rooms):
// o versiune odata publicata NU se modifica — schimbarile breaking inseamna un
// fisier nou (ex. kitchen.v2.ts) inregistrat aici sub versiunea urmatoare.
export const FLOW_REGISTRY: Record<RoomType, Record<number, RoomFlow>> = {
  KITCHEN: { [kitchenFlow.version]: kitchenFlow, [kitchenFlowV2.version]: kitchenFlowV2 },
  DRESSING: { [dressingFlow.version]: dressingFlow },
  LIVING: { [livingFlow.version]: livingFlow },
  OFFICE: { [officeFlow.version]: officeFlow },
  BEDROOM: { [bedroomFlow.version]: bedroomFlow },
  BATHROOM: { [bathroomFlow.version]: bathroomFlow, [bathroomFlowV2.version]: bathroomFlowV2 },
  PIECES: { [piecesFlow.version]: piecesFlow },
};

// Versiunea cu care pornesc camerele NOI in wizard.
export const CURRENT_FLOW_VERSION: Record<RoomType, number> = {
  KITCHEN: kitchenFlowV2.version,
  DRESSING: dressingFlow.version,
  LIVING: livingFlow.version,
  OFFICE: officeFlow.version,
  BEDROOM: bedroomFlow.version,
  BATHROOM: bathroomFlowV2.version,
  PIECES: piecesFlow.version,
};

export {
  kitchenFlow,
  kitchenFlowV2,
  dressingFlow,
  livingFlow,
  officeFlow,
  bedroomFlow,
  bathroomFlow,
  bathroomFlowV2,
  piecesFlow,
};
