import type { ItemSystem, Material } from '../../../enums';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, STANDARD_CABINET_DEPTH } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { ceilingHeightSlot, linearSlot } from '../common';
import { pieceMaterialWithSystems, pieceSketchStep } from './builder';

// Piesa ghidata: Biblioteca / rafturi. Chei i18n sub 'flows.PIECE_BOOKCASE.*'.

const F = 'flows.PIECE_BOOKCASE';

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = [linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.4, max: 4 })];
    if (answers.toCeiling === true) {
      slots.push(ceilingHeightSlot());
    } else {
      slots.push({
        id: 'height',
        labelKey: `${F}.dimensions.slots.height`,
        unit: 'm',
        min: 0.8,
        max: 2.8,
        step: 0.05,
      });
    }
    return slots;
  },
};

export const pieceBookcaseFlow: RoomFlow = {
  roomType: 'PIECE_BOOKCASE',
  version: 1,
  steps: [
    {
      id: 'style',
      type: 'single-choice',
      titleKey: `${F}.style.title`,
      subtitleKey: `${F}.style.subtitle`,
      screenGroup: 'config',
      options: [
        { value: 'OPEN', icon: 'rows-3' },
        { value: 'BASE_CABINETS', icon: 'gallery-vertical-end' },
        { value: 'GLASS_DOORS', icon: 'app-window' },
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
      // lipsa raspuns = inaltime libera (slot manual)
      id: 'toCeiling',
      type: 'boolean',
      titleKey: `${F}.toCeiling.title`,
      optional: true,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.toCeiling.info.title`,
        bodyKey: `${F}.toCeiling.info.body`,
      },
    },
    dimensionsStep,
    // sistemele au sens doar daca exista usi/sertare (nu la rafturi deschise)
    ...pieceMaterialWithSystems(F, { questionId: 'style', in: ['BASE_CABINETS', 'GLASS_DOORS'] }),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const systems = Array.isArray(answers.openingSystems)
      ? (answers.openingSystems as ItemSystem[])
      : [];
    return {
      lengthM: values.width ?? 0,
      widthM: 0.35,
      heightM:
        answers.toCeiling === true
          ? (values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT)
          : (values.height ?? 2),
      items: [
        {
          name: 'Biblioteca',
          material: (answers.material as Material) ?? 'PAL',
          systems,
          quantity: 1,
        },
      ],
    };
  },
};
