// Mini-flow-urile pieselor ghidate (PIECE_*). "Alta piesa" (PIECES, formular
// liber) ramane in ../pieces.ts — fallback-ul legacy, nu se atinge.

export { pieceWardrobeFlow } from './piece-wardrobe';
export { pieceTvUnitFlow } from './piece-tv-unit';
export { pieceBookcaseFlow } from './piece-bookcase';
export { pieceDeskFlow } from './piece-desk';
export { pieceBedFlow } from './piece-bed';
export { pieceDresserFlow } from './piece-dresser';
export { pieceTableFlow } from './piece-table';
export { pieceShoeCabinetFlow } from './piece-shoe-cabinet';
export { pieceNightstandFlow } from './piece-nightstand';
export { pieceBenchFlow } from './piece-bench';
export { pieceBedFlowV3, pieceTableFlowV3, pieceBenchFlowV3, furnitureLegacyAnswers } from './furniture-v3';
export {
  pieceWardrobeFlowV2,
  pieceTvUnitFlowV2,
  pieceBookcaseFlowV2,
  pieceDeskFlowV2,
  pieceBedFlowV2,
  pieceDresserFlowV2,
  pieceTableFlowV2,
  pieceShoeCabinetFlowV2,
  pieceNightstandFlowV2,
  pieceBenchFlowV2,
} from './v2';
export {
  pieceBookcaseFlowV3,
  pieceWardrobeFlowV3,
  pieceTvUnitFlowV3,
  pieceShoeCabinetFlowV3,
  pieceDresserFlowV3,
  pieceNightstandFlowV3,
  pieceDeskFlowV3,
} from './v3';
// etapa 6 (versiunile noi; schelete in valul 1, continut in valul 2)
export {
  pieceWardrobeFlowV4,
  pieceTvUnitFlowV4,
  pieceBookcaseFlowV4,
  pieceDeskFlowV4,
  pieceDresserFlowV4,
  pieceShoeCabinetFlowV4,
  pieceNightstandFlowV4,
} from './v4';
export { pieceBedFlowV4, pieceTableFlowV4, pieceBenchFlowV4 } from './furniture-v4';
// etapa 10 (formularul v7; schelete puse de fundatie, continut in valul 1)
export { pieceBedFlowV5, pieceTableFlowV5, pieceBenchFlowV5 } from './furniture-v5';
export { pieceSofaFlowV3 } from './catalog-v3';
