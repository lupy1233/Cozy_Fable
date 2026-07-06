import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// FROZEN v1 — NU MODIFICA. Cererile publicate pe versiunea 1 se valideaza si
// se rezuma permanent contra acestei definitii. Schimbari noi → bathroom.v2.ts+.
//
// Flow baie. Materialul are info la nivel de step (recomandare pentru umiditate).
// Chei i18n sub 'flows.BATHROOM.*'.

const F = 'flows.BATHROOM';

const PIECES: PieceDef[] = [
  { value: 'VANITY_UNIT', icon: 'droplets', itemName: 'Corp lavoar' },
  { value: 'MIRROR_CABINET', icon: 'square', itemName: 'Dulap oglinda' },
  { value: 'TALL_STORAGE', icon: 'rows-3', itemName: 'Coloana baie' },
];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.4, max: 3 }),
    ceilingHeightSlot(),
  ],
};

export const bathroomFlow: RoomFlow = {
  roomType: 'BATHROOM',
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
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      info: {
        titleKey: `${F}.material.info.title`,
        bodyKey: `${F}.material.info.body`,
      },
      options: materialOptions(),
    },
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
    items: buildPiecesItems(answers, PIECES, 'Mobilier baie'),
  }),
};
