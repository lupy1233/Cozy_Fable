import type { RoomFlow } from '../types';
import { balconyFlowV3 } from './balcony.v3';

// Etapa 10 (formularul v7, DESIGN §3 / §5): SCHELET pus de fundatie (e10-found) — copie a v3
// cu versiunea 4. Continutul (intrebarile c9 / masurile c5) il scrie agentul valului 1.
// Inregistrat in FLOW_REGISTRY, dar NU e curent (CURRENT_FLOW_VERSION se schimba in valul 2).
export const balconyFlowV4: RoomFlow = { ...balconyFlowV3, version: 4 };
