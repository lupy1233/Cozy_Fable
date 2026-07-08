import type { ItemSystem, Material } from '../../../enums';
import { dimensionValues, STANDARD_CABINET_DEPTH } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { pieceMaterialWithSystems, pieceSketchStep } from './builder';

// Piesa ghidata: Comoda. Chei i18n sub 'flows.PIECE_DRESSER.*'.

const F = 'flows.PIECE_DRESSER';

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.6, max: 2.5 }),
    {
      id: 'height',
      labelKey: `${F}.dimensions.slots.height`,
      unit: 'm',
      min: 0.6,
      max: 1.4,
      step: 0.05,
    },
  ],
};

export const pieceDresserFlow: RoomFlow = {
  roomType: 'PIECE_DRESSER',
  version: 1,
  steps: [
    {
      id: 'configuration',
      type: 'single-choice',
      titleKey: `${F}.configuration.title`,
      subtitleKey: `${F}.configuration.subtitle`,
      options: [
        { value: 'DRAWERS_ONLY', icon: 'archive' },
        { value: 'MIXED', icon: 'columns-2' },
        { value: 'DOORS_ONLY', icon: 'door-closed' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.configuration.options.${o.value}.label`,
        descriptionKey: `${F}.configuration.options.${o.value}.description`,
        info: {
          titleKey: `${F}.configuration.options.${o.value}.info.title`,
          bodyKey: `${F}.configuration.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.configuration.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.configuration.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.configuration.options.${o.value}.info.price`,
        },
      })),
    },
    dimensionsStep,
    ...pieceMaterialWithSystems(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const systems = Array.isArray(answers.openingSystems)
      ? (answers.openingSystems as ItemSystem[])
      : [];
    return {
      lengthM: values.width ?? 0,
      widthM: STANDARD_CABINET_DEPTH * 0.75,
      heightM: values.height ?? 0.9,
      items: [
        {
          name: 'Comoda',
          material: (answers.material as Material) ?? 'PAL',
          systems,
          quantity: 1,
        },
      ],
    };
  },
};
