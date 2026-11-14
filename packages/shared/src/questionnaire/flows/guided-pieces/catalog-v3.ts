import type { RoomFlow } from '../../types';
import { NEW_PIECE_KINDS } from '../../piece3d';
import { catalogFlowRegistryV2 } from './catalog-v2';

// Etapa 10 (formularul v7, DESIGN §3 / §6): SCHELET pus de fundatie (e10-found) — doar canapeaua v3,
// copie a v2 (catalog-v2 ramane INGHETAT) cu versiunea 3. Agentul e10-3d scrie continutul:
// `features: ['SOFA_SLEEPER', 'SOFA_STORAGE']` pe pasul 3D, scorul d3 (scoreEntries) si descrierea.
// Celelalte piese de catalog raman pe v2. Inregistrat, dar NU curent (valul 2).
type CatalogRoomType = `PIECE_${(typeof NEW_PIECE_KINDS)[number]}`;

export const pieceSofaFlowV3: RoomFlow = { ...catalogFlowRegistryV2.PIECE_SOFA[2], version: 3 };

export const catalogFlowRegistryV3: Partial<Record<CatalogRoomType, Record<number, RoomFlow>>> = {
  PIECE_SOFA: { 3: pieceSofaFlowV3 },
};
export const catalogFlowVersionsV3: Partial<Record<CatalogRoomType, number>> = { PIECE_SOFA: 3 };
