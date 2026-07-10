import type { RoomFlow } from '../../types';
import { pieceFlowV2 } from './builder';
import { pieceBedFlow } from './piece-bed';
import { pieceBenchFlow } from './piece-bench';
import { pieceBookcaseFlow } from './piece-bookcase';
import { pieceDeskFlow } from './piece-desk';
import { pieceDresserFlow } from './piece-dresser';
import { pieceNightstandFlow } from './piece-nightstand';
import { pieceShoeCabinetFlow } from './piece-shoe-cabinet';
import { pieceTableFlow } from './piece-table';
import { pieceTvUnitFlow } from './piece-tv-unit';
import { pieceWardrobeFlow } from './piece-wardrobe';

// Versiunile 2 ale pieselor ghidate (item 1, 2026-07-11): aliniere la modelul
// bucatariei v2 — "Altul" la material are text liber pe acelasi ecran, iar
// textul ajunge in description-ul itemului derivat. Definitiile v1 raman
// FROZEN in fisierele lor; aici doar le derivam prin pieceFlowV2.

export const pieceWardrobeFlowV2: RoomFlow = pieceFlowV2(pieceWardrobeFlow, 2);
export const pieceTvUnitFlowV2: RoomFlow = pieceFlowV2(pieceTvUnitFlow, 2);
export const pieceBookcaseFlowV2: RoomFlow = pieceFlowV2(pieceBookcaseFlow, 2);
export const pieceDeskFlowV2: RoomFlow = pieceFlowV2(pieceDeskFlow, 2);
export const pieceBedFlowV2: RoomFlow = pieceFlowV2(pieceBedFlow, 2);
export const pieceDresserFlowV2: RoomFlow = pieceFlowV2(pieceDresserFlow, 2);
export const pieceTableFlowV2: RoomFlow = pieceFlowV2(pieceTableFlow, 2);
export const pieceShoeCabinetFlowV2: RoomFlow = pieceFlowV2(pieceShoeCabinetFlow, 2);
export const pieceNightstandFlowV2: RoomFlow = pieceFlowV2(pieceNightstandFlow, 2);
export const pieceBenchFlowV2: RoomFlow = pieceFlowV2(pieceBenchFlow, 2);
