import type { RoomFlow } from '../types';
import { hallwayFlowV2 } from './hallway.v2';

// Etapa 10 (formularul v7, DESIGN §3 / §5): SCHELET pus de fundatie (e10-found) — copie a v2
// cu versiunea 3. Continutul (intrebarile c9 / masurile c5) il scrie agentul valului 1.
// Inregistrat in FLOW_REGISTRY, dar NU e curent (CURRENT_FLOW_VERSION se schimba in valul 2).
export const hallwayFlowV3: RoomFlow = { ...hallwayFlowV2, version: 3 };
