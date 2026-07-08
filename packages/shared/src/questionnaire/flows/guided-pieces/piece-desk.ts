import type { Material } from '../../../enums';
import { dimensionValues } from '../../mapping';
import type { DimensionGroupStep, DimensionSlot, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Birou. Chei i18n sub 'flows.PIECE_DESK.*'.

const F = 'flows.PIECE_DESK';

const depthSlot: DimensionSlot = {
  id: 'depth',
  labelKey: `${F}.dimensions.slots.depth`,
  unit: 'm',
  min: 0.5,
  max: 0.9,
  step: 0.05,
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = [linearSlot('widthA', `${F}.dimensions.slots.widthA`, { min: 0.8, max: 3 })];
    if (answers.shape === 'L_SHAPE') {
      slots.push(linearSlot('widthB', `${F}.dimensions.slots.widthB`, { min: 0.6, max: 2.5 }));
    }
    slots.push(depthSlot);
    return slots;
  },
};

export const pieceDeskFlow: RoomFlow = {
  roomType: 'PIECE_DESK',
  version: 1,
  steps: [
    {
      id: 'shape',
      type: 'single-choice',
      titleKey: `${F}.shape.title`,
      subtitleKey: `${F}.shape.subtitle`,
      screenGroup: 'config',
      options: ['STRAIGHT', 'L_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.shape.options.${value}.label`,
        descriptionKey: `${F}.shape.options.${value}.description`,
        icon: value === 'STRAIGHT' ? 'minus' : 'corner-down-right',
        info: {
          titleKey: `${F}.shape.options.${value}.info.title`,
          bodyKey: `${F}.shape.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.shape.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.shape.options.${value}.info.cons${i}`),
        },
      })),
    },
    {
      // lipsa raspuns = fara canal de cabluri
      id: 'cableManagement',
      type: 'boolean',
      titleKey: `${F}.cableManagement.title`,
      optional: true,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.cableManagement.info.title`,
        bodyKey: `${F}.cableManagement.info.body`,
      },
    },
    dimensionsStep,
    {
      id: 'storage',
      type: 'multi-choice',
      titleKey: `${F}.storage.title`,
      subtitleKey: `${F}.storage.subtitle`,
      optional: true,
      options: [
        { value: 'DRAWER_UNIT', icon: 'archive' },
        { value: 'SHELF_ABOVE', icon: 'rows-3' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.storage.options.${o.value}.label`,
        descriptionKey: `${F}.storage.options.${o.value}.description`,
        info: {
          titleKey: `${F}.storage.options.${o.value}.info.title`,
          bodyKey: `${F}.storage.options.${o.value}.info.body`,
          priceHintKey: `${F}.storage.options.${o.value}.info.price`,
        },
      })),
    },
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const extras = Array.isArray(answers.storage) ? (answers.storage as string[]) : [];
    const notes: string[] = [];
    if (extras.includes('DRAWER_UNIT')) notes.push('corp sertare');
    if (extras.includes('SHELF_ABOVE')) notes.push('etajera');
    if (answers.cableManagement === true) notes.push('canal cabluri');
    return {
      lengthM: (values.widthA ?? 0) + (values.widthB ?? 0),
      widthM: values.depth ?? 0.6,
      heightM: 0.75,
      items: [
        {
          name: 'Birou',
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          description: notes.length > 0 ? `Cu: ${notes.join(', ')}` : undefined,
          quantity: 1,
        },
      ],
    };
  },
};
