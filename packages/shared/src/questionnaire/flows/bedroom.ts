import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions, systemOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Flow dormitor. Chei i18n sub 'flows.BEDROOM.*'.

const F = 'flows.BEDROOM';

const PIECES: PieceDef[] = [
  { value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap dormitor' },
  { value: 'BED_FRAME', icon: 'bed-double', itemName: 'Cadru pat' },
  { value: 'NIGHTSTANDS', icon: 'lamp', itemName: 'Noptiere', quantity: 2 },
  { value: 'DRESSER', icon: 'archive', itemName: 'Comoda' },
  { value: 'TV_UNIT', icon: 'tv', itemName: 'Comoda TV' },
];

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const slots = [
    // latimea spatiului disponibil pentru mobilier — semnalul liniar de scoring
    linearSlot('spaceWidth', `${F}.dimensions.slots.spaceWidth`, { min: 1 }),
    ceilingHeightSlot(),
  ];
  const selected = Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
  if (selected.includes('WARDROBE')) {
    slots.push({
      id: 'wardrobeWidth',
      labelKey: `${F}.dimensions.slots.wardrobeWidth`,
      unit: 'm',
      min: 0.5,
      max: 6,
      step: 0.1,
    });
  }
  return slots;
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: dimensionSlots,
};

export const bedroomFlow: RoomFlow = {
  roomType: 'BEDROOM',
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
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'openingSystems',
      type: 'multi-choice',
      titleKey: `${F}.openingSystems.title`,
      subtitleKey: `${F}.openingSystems.subtitle`,
      optional: true,
      options: systemOptions(),
    },
    dimensionsStep,
    {
      id: 'notes',
      type: 'text',
      titleKey: `${F}.notes.title`,
      subtitleKey: `${F}.notes.subtitle`,
      optional: true,
      maxLength: 2000,
      multiline: true,
    },
  ],
  deriveRoom: (answers) => ({
    lengthM: linearMeters(dimensionsStep, answers),
    widthM: STANDARD_CABINET_DEPTH,
    heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    items: buildPiecesItems(answers, PIECES, 'Mobilier dormitor'),
  }),
};
