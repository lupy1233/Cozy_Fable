import type { RoomFlow } from '../../types';
import { pieceBedFlowV4, pieceBenchFlowV4, pieceTableFlowV4 } from './furniture-v4';

// Etapa 10 (formularul v7, DESIGN §3 / §6): SCHELETE puse de fundatie (e10-found) — pat, masa, banca v5 =
// copii ale v4 (furniture-v4 ramane INGHETAT) cu versiunea 5. Agentul e10-3d scrie continutul:
// `features` pe pasul configurator-3d (BED_CUSTOM_SIZE / TABLE_OPEN_LENGTH + TABLE_CUSTOM_HEIGHT /
// BENCH_CUSTOM_HEIGHT), scorul si descrierea. Inregistrate, dar NU curente (valul 2).
export const pieceBedFlowV5: RoomFlow = { ...pieceBedFlowV4, version: 5 };
export const pieceTableFlowV5: RoomFlow = { ...pieceTableFlowV4, version: 5 };
export const pieceBenchFlowV5: RoomFlow = { ...pieceBenchFlowV4, version: 5 };
