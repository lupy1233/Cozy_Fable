import type { RoomFlow } from '../types';
import { dressingFlowV4 } from './dressing.v4';

// Etapa 10 (formularul v7, DESIGN §3 / §5): SCHELET pus de fundatie (e10-found) — copie a v4
// cu versiunea 5. Continutul (intrebarile c9 / masurile c5) il scrie agentul valului 1.
// Inregistrat in FLOW_REGISTRY, dar NU e curent (CURRENT_FLOW_VERSION se schimba in valul 2).
export const dressingFlowV5: RoomFlow = { ...dressingFlowV4, version: 5 };
