import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { pieceChoiceOptions } from './pieces-flow';
import { buildPerPieceItems, pieceConfigSteps, selectedPieces, type PieceWithMaterialDef } from './per-piece';

// Flow hol/intrare (v1, nou 2026-07): piese → dimensiuni per piesa →
// material + deschidere per piesa → schita. Chei i18n sub 'flows.HALLWAY.*'.
// Feedback PO F4 (item 14): intrebarea de latime a holului (depthProfile)
// ELIMINATA — dimensiunea exacta e ceruta oricum; adancimea derivata ramane
// standard (0.5 m).

const F = 'flows.HALLWAY';

const PIECES: PieceWithMaterialDef[] = [
  { value: 'SHOE_CABINET', icon: 'footprints', itemName: 'Pantofar', materialStepId: 'materialShoeCabinet', systemsStepId: 'systemsShoeCabinet' },
  { value: 'COAT_UNIT', icon: 'shirt', itemName: 'Cuier cu panou', materialStepId: 'materialCoatUnit', systemsStepId: 'systemsCoatUnit' },
  { value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap hol', materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe' },
  { value: 'BENCH', icon: 'armchair', itemName: 'Bancuta hol', materialStepId: 'materialBench', systemsStepId: 'systemsBench' },
  { value: 'MIRROR', icon: 'square', itemName: 'Oglinda cu polita', materialStepId: 'materialMirror', systemsStepId: 'systemsMirror' },
];

const PIECE_WIDTH_SLOTS: Record<string, () => DimensionSlot> = {
  SHOE_CABINET: () =>
    linearSlot('shoeCabinetWidth', `${F}.dimensions.slots.shoeCabinetWidth`, { min: 0.4, max: 2.5 }),
  COAT_UNIT: () =>
    linearSlot('coatUnitWidth', `${F}.dimensions.slots.coatUnitWidth`, { min: 0.5, max: 2.5 }),
  WARDROBE: () =>
    linearSlot('wardrobeWidth', `${F}.dimensions.slots.wardrobeWidth`, { min: 0.5, max: 3 }),
  BENCH: () => linearSlot('benchWidth', `${F}.dimensions.slots.benchWidth`, { min: 0.5, max: 2 }),
  MIRROR: () => linearSlot('mirrorWidth', `${F}.dimensions.slots.mirrorWidth`, { min: 0.4, max: 1.5 }),
};

// tavanul conteaza doar pentru corpurile inalte
const TALL_PIECES = ['WARDROBE', 'COAT_UNIT'];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers: AnswerMap) => {
    const selected = selectedPieces(answers);
    const slots = selected.filter((p) => PIECE_WIDTH_SLOTS[p]).map((p) => PIECE_WIDTH_SLOTS[p]());
    if (selected.some((p) => TALL_PIECES.includes(p))) slots.push(ceilingHeightSlot());
    return slots;
  },
};

export const hallwayFlow: RoomFlow = {
  roomType: 'HALLWAY',
  version: 1,
  steps: [
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      minSelected: 1,
      options: pieceChoiceOptions(F, PIECES),
    },
    dimensionsStep,
    ...pieceConfigSteps(F, PIECES),
    {
      id: 'sketch',
      type: 'upload',
      titleKey: `${F}.sketch.title`,
      subtitleKey: `${F}.sketch.subtitle`,
      optional: true,
      maxFiles: 3,
    },
  ],
  deriveRoom: (answers) => ({
    lengthM: linearMeters(dimensionsStep, answers),
    // adancime standard de corp hol — intrebarea de profil a fost eliminata
    widthM: 0.5,
    heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    items: buildPerPieceItems(answers, PIECES, 'Mobilier hol'),
  }),
};
