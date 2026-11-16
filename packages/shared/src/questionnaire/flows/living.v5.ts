import { linearMeters } from '../mapping';
import type { DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { livingFlowV4 } from './living.v4';
import { ceilingIfTall, optionalHeightSlot, pieceWidthSlot } from './measure-sets';
import { selectedPieces } from './per-piece';

// Living v5 (etapa 10 — c5, DESIGN §5.3 / tabelul 5.0, E10-N12):
// - latimea fiecarei piese ramane obligatorie (intervalele v3);
// - inaltimea ramane DOAR la biblioteca si vitrina, optionala (tipic 2,0 / 1,9 m);
//   dispare la comoda TV, masuta, rafturi si piesa libera (PO c5-2);
// - tavanul doar cand e bifata biblioteca sau vitrina.
// Restul pasilor si derivarea pieselor sunt cele din v4 (inghetat), refolosite nemodificate.

const F = 'flows.LIVING';
const V = `${F}.v5`;

const PIECE_SLOTS: Record<string, () => DimensionSlot[]> = {
  TV_UNIT: () => [pieceWidthSlot('tvUnitWidth', `${F}.dimensions.slots.tvUnitWidth`, { min: 1, max: 5 })],
  BOOKSHELF: () => [
    pieceWidthSlot('bookshelfWidth', `${F}.dimensions.slots.bookshelfWidth`, { min: 0.4, max: 4 }),
    optionalHeightSlot('bookshelfHeight', `${F}.dimensions.slots.bookshelfHeight`, { min: 0.6, max: 3 }, 2),
  ],
  DISPLAY_CABINET: () => [
    pieceWidthSlot('displayWidth', `${F}.dimensions.slots.displayWidth`, { min: 0.4, max: 2.5 }),
    optionalHeightSlot('displayHeight', `${F}.dimensions.slots.displayHeight`, { min: 0.8, max: 2.8 }, 1.9),
  ],
  COFFEE_TABLE: () => [
    pieceWidthSlot('coffeeTableLength', `${F}.dimensions.slots.coffeeTableLength`, { min: 0.5, max: 1.5 }),
  ],
  WALL_SHELVES: () => [pieceWidthSlot('shelvesTotal', `${F}.dimensions.slots.shelvesTotal`, { min: 0.4, max: 6 })],
  OTHER: () => [pieceWidthSlot('otherWidth', `${F}.dimensions.slots.otherWidth`, { min: 0.3, max: 6 })],
};
const TALL_PIECES = ['BOOKSHELF', 'DISPLAY_CABINET'];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  slots: (answers) => {
    const selected = selectedPieces(answers);
    return [
      ...selected.filter((p) => PIECE_SLOTS[p]).flatMap((p) => PIECE_SLOTS[p]()),
      ...ceilingIfTall(selected, TALL_PIECES),
    ];
  },
};

export const livingFlowV5: RoomFlow = {
  roomType: 'LIVING',
  version: 5,
  steps: livingFlowV4.steps.map((s) => (s.id === 'dimensions' ? dimensionsStep : s)),
  // piesele, LED-ul, numele si tavanul ca v4; lungimea din latimile pasului nou
  deriveRoom: (answers) => ({ ...livingFlowV4.deriveRoom(answers), lengthM: linearMeters(dimensionsStep, answers) }),
};
