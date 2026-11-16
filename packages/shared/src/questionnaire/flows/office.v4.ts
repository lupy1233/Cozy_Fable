import { linearMeters } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingIfTall, optionalHeightSlot, pieceWidthSlot } from './measure-sets';
import { officeFlowV3 } from './office.v3';
import { selectedPieces } from './per-piece';

// Birou (camera) v4 (etapa 10 — c5, DESIGN §5.4 / tabelul 5.0):
// - latimile v2 raman obligatorii (biroul A / B / C dupa forma);
// - inaltimea optionala la biblioteca si la dulapul de depozitare (tipic 2,0 m);
// - tavanul doar cand e bifata biblioteca sau dulapul.
// Restul pasilor si derivarea pieselor sunt cele din v3 (inghetat), refolosite nemodificate.

const F = 'flows.OFFICE';
const V = `${F}.v4`;

const PIECE_SLOTS: Record<string, (answers: AnswerMap) => DimensionSlot[]> = {
  DESK: (answers) => {
    const slots = [pieceWidthSlot('deskWidthA', `${F}.dimensions.slots.deskWidthA`, { min: 0.8, max: 3 })];
    if (answers.deskShape === 'L_SHAPE' || answers.deskShape === 'U_SHAPE') {
      slots.push(pieceWidthSlot('deskWidthB', `${F}.dimensions.slots.deskWidthB`, { min: 0.6, max: 2.5 }));
    }
    if (answers.deskShape === 'U_SHAPE') {
      slots.push(pieceWidthSlot('deskWidthC', `${F}.dimensions.slots.deskWidthC`, { min: 0.6, max: 2.5 }));
    }
    return slots;
  },
  BOOKSHELF: () => [
    pieceWidthSlot('bookshelfWidth', `${F}.dimensions.slots.bookshelfWidth`, { min: 0.4, max: 4 }),
    optionalHeightSlot('bookshelfHeight', `${F}.dimensions.slots.bookshelfHeight`, { min: 0.6, max: 3 }, 2),
  ],
  STORAGE: () => [
    pieceWidthSlot('storageWidth', `${F}.dimensions.slots.storageWidth`, { min: 0.5, max: 3 }),
    optionalHeightSlot('storageHeight', `${F}.dimensions.slots.storageHeight`, { min: 0.6, max: 3 }, 2),
  ],
  WALL_SHELVES: () => [pieceWidthSlot('shelvesTotal', `${F}.dimensions.slots.shelvesTotal`, { min: 0.4, max: 6 })],
};
const TALL_PIECES = ['BOOKSHELF', 'STORAGE'];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  slots: (answers) => {
    const selected = selectedPieces(answers);
    return [
      ...selected.filter((p) => PIECE_SLOTS[p]).flatMap((p) => PIECE_SLOTS[p](answers)),
      ...ceilingIfTall(selected, TALL_PIECES),
    ];
  },
};

export const officeFlowV4: RoomFlow = {
  roomType: 'OFFICE',
  version: 4,
  steps: officeFlowV3.steps.map((s) => (s.id === 'dimensions' ? dimensionsStep : s)),
  // piesele si tavanul ca v3; lungimea din latimile pasului nou
  deriveRoom: (answers) => ({ ...officeFlowV3.deriveRoom(answers), lengthM: linearMeters(dimensionsStep, answers) }),
};
