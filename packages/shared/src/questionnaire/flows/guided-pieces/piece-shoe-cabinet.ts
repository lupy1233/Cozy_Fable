import type { Material } from '../../../enums';
import { dimensionValues } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Pantofar. Chei i18n sub 'flows.PIECE_SHOE_CABINET.*'.

const F = 'flows.PIECE_SHOE_CABINET';

// adancimea corpului depinde de mecanism (slim rabatabil vs rafturi clasice)
const DEPTH_BY_STYLE: Record<string, number> = {
  SLIM_TILT: 0.25,
  STANDARD: 0.35,
  WITH_SEAT: 0.4,
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.4, max: 2 }),
    {
      id: 'height',
      labelKey: `${F}.dimensions.slots.height`,
      unit: 'm',
      min: 0.5,
      max: 2,
      step: 0.05,
    },
  ],
};

export const pieceShoeCabinetFlow: RoomFlow = {
  roomType: 'PIECE_SHOE_CABINET',
  version: 1,
  steps: [
    {
      id: 'style',
      type: 'single-choice',
      titleKey: `${F}.style.title`,
      subtitleKey: `${F}.style.subtitle`,
      options: [
        { value: 'SLIM_TILT', icon: 'chevrons-right-left' },
        { value: 'STANDARD', icon: 'rows-3' },
        { value: 'WITH_SEAT', icon: 'armchair' },
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
    dimensionsStep,
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const style = answerString(answers, 'style', 'STANDARD');
    return {
      lengthM: values.width ?? 0,
      widthM: DEPTH_BY_STYLE[style] ?? DEPTH_BY_STYLE.STANDARD,
      heightM: values.height ?? 1.2,
      items: [
        {
          name: style === 'WITH_SEAT' ? 'Pantofar cu bancuta' : 'Pantofar',
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          quantity: 1,
        },
      ],
    };
  },
};
