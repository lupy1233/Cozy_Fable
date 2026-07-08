import type { Material } from '../../../enums';
import { dimensionValues } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Bancuta (hol/dormitor). Chei i18n sub 'flows.PIECE_BENCH.*'.

const F = 'flows.PIECE_BENCH';

const ITEM_NAME: Record<string, string> = {
  WITH_STORAGE: 'Bancuta cu depozitare',
  WITH_SHOE_SPACE: 'Bancuta cu spatiu pantofi',
  SIMPLE: 'Bancuta',
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.6, max: 2 })],
};

export const pieceBenchFlow: RoomFlow = {
  roomType: 'PIECE_BENCH',
  version: 1,
  steps: [
    {
      id: 'style',
      type: 'single-choice',
      titleKey: `${F}.style.title`,
      subtitleKey: `${F}.style.subtitle`,
      screenGroup: 'config',
      options: [
        { value: 'WITH_STORAGE', icon: 'archive' },
        { value: 'WITH_SHOE_SPACE', icon: 'footprints' },
        { value: 'SIMPLE', icon: 'minus' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.style.options.${o.value}.label`,
        descriptionKey: `${F}.style.options.${o.value}.description`,
        info: {
          titleKey: `${F}.style.options.${o.value}.info.title`,
          bodyKey: `${F}.style.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.style.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.style.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.style.options.${o.value}.info.price`,
        },
      })),
    },
    {
      // lipsa raspuns = sezut netapitat
      id: 'upholsteredSeat',
      type: 'boolean',
      titleKey: `${F}.upholsteredSeat.title`,
      optional: true,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.upholsteredSeat.info.title`,
        bodyKey: `${F}.upholsteredSeat.info.body`,
      },
    },
    dimensionsStep,
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const style = answerString(answers, 'style', 'SIMPLE');
    return {
      lengthM: values.width ?? 0,
      widthM: 0.4,
      heightM: 0.45,
      items: [
        {
          name: ITEM_NAME[style] ?? ITEM_NAME.SIMPLE,
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          description: answers.upholsteredSeat === true ? 'Sezut tapitat' : undefined,
          quantity: 1,
        },
      ],
    };
  },
};
