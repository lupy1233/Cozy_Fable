import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions, systemOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Flow living. Chei i18n sub 'flows.LIVING.*'.

const F = 'flows.LIVING';

const PIECES: PieceDef[] = [
  { value: 'TV_UNIT', icon: 'tv', itemName: 'Comoda TV' },
  { value: 'BOOKSHELF', icon: 'library', itemName: 'Biblioteca' },
  { value: 'DISPLAY_CABINET', icon: 'gallery-vertical-end', itemName: 'Vitrina' },
  { value: 'COFFEE_TABLE', icon: 'table', itemName: 'Masuta cafea' },
];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('wallWidth', `${F}.dimensions.slots.wallWidth`, { min: 1 }),
    ceilingHeightSlot(),
  ],
};

export const livingFlow: RoomFlow = {
  roomType: 'LIVING',
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
    items: buildPiecesItems(answers, PIECES, 'Mobilier living'),
  }),
};
