import type { RequestItemInput } from '../../request.schemas';
import { DEFAULT_CEILING_HEIGHT, STANDARD_CABINET_DEPTH } from '../mapping';
import type { RoomFlow } from '../types';

// Flow "piese individuale": utilizatorul vrea doar cateva corpuri de mobilier
// (un dulap, un birou etc.), fara o camera dedicata. Tab separat in cart.
// Chei i18n sub 'flows.PIECES.*'.

const F = 'flows.PIECES';

export const piecesFlow: RoomFlow = {
  roomType: 'PIECES',
  version: 1,
  steps: [
    {
      id: 'pieces',
      type: 'pieces',
      titleKey: `${F}.pieces.title`,
      subtitleKey: `${F}.pieces.subtitle`,
      minPieces: 1,
      maxPieces: 10,
    },
    {
      id: 'sketch',
      type: 'upload',
      titleKey: `${F}.sketch.title`,
      subtitleKey: `${F}.sketch.subtitle`,
      optional: true,
      maxFiles: 7,
    },
  ],
  deriveRoom: (answers) => {
    const items = Array.isArray(answers.pieces) ? (answers.pieces as RequestItemInput[]) : [];
    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
    return {
      // euristica: ~1 metru liniar per piesa, ca ROOM_SIZE sa scaleze cu volumul
      lengthM: Math.max(0.5, totalQty),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
