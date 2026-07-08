import type { Material } from '../../../enums';
import { dimensionValues } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Noptiere (una sau pereche). Chei i18n sub 'flows.PIECE_NIGHTSTAND.*'.

const F = 'flows.PIECE_NIGHTSTAND';

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.35, max: 0.8 })],
};

export const pieceNightstandFlow: RoomFlow = {
  roomType: 'PIECE_NIGHTSTAND',
  version: 1,
  steps: [
    {
      id: 'style',
      type: 'single-choice',
      titleKey: `${F}.style.title`,
      subtitleKey: `${F}.style.subtitle`,
      screenGroup: 'config',
      options: [
        { value: 'DRAWERS', icon: 'archive' },
        { value: 'OPEN_SHELF', icon: 'rows-3' },
        { value: 'SUSPENDED', icon: 'move-up' },
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
      id: 'count',
      type: 'single-choice',
      titleKey: `${F}.count.title`,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.count.info.title`,
        bodyKey: `${F}.count.info.body`,
      },
      options: ['ONE', 'TWO'].map((value) => ({
        value,
        labelKey: `${F}.count.options.${value}.label`,
      })),
    },
    dimensionsStep,
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const quantity = answerString(answers, 'count', 'TWO') === 'ONE' ? 1 : 2;
    const suspended = answers.style === 'SUSPENDED';
    return {
      lengthM: (values.width ?? 0.5) * quantity,
      widthM: 0.4,
      heightM: 0.5,
      items: [
        {
          name: suspended ? 'Noptiere suspendate' : 'Noptiere',
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          quantity,
        },
      ],
    };
  },
};
