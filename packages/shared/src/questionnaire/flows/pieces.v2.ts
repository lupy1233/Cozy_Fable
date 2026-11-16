import { DEFAULT_CEILING_HEIGHT, STANDARD_CABINET_DEPTH } from '../mapping';
import { derivePieceRowsV2 } from '../pieces-row';
import type { PiecesStep, QuestionStep, RoomFlow } from '../types';
import { piecesFlow } from './pieces';

// "Alta piesa" v2 (etapa 6, DESIGN §5.11 — c10, partea a doua):
// - pasul `pieces` cu rowVersion 2: dimensiuni optionale in cm, "decide firma" la material /
//   deschidere, "Fara usi sau sertare", fara "Usi glisante" (regula unica, N13);
// - campurile noi stau doar in raspunsuri; derivarea le muta in descrierea piesei;
// - lungimea pentru cost = aceeasi euristica v1, ~1 m pe bucata (N14).
// v1 ramane FROZEN.

const v1 = (id: string): QuestionStep => {
  const step = piecesFlow.steps.find((s) => s.id === id);
  if (!step) throw new Error(`pieces v1 step lipsa: ${id}`);
  return step;
};

const piecesStep: PiecesStep = { ...(v1('pieces') as PiecesStep), rowVersion: 2 };

export const piecesFlowV2: RoomFlow = {
  roomType: 'PIECES',
  version: 2,
  steps: [piecesStep, v1('sketch')],
  deriveRoom: (answers) => {
    const { items, firmRecommendations } = derivePieceRowsV2(answers.pieces);
    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
    return {
      lengthM: Math.max(0.5, totalQty),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
