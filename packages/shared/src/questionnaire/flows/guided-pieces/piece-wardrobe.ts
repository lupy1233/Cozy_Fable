import type { ItemSystem, Material } from '../../../enums';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, STANDARD_CABINET_DEPTH } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { ceilingHeightSlot, linearSlot } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Dulap. Optiunea "pana in tavan" acopera si cazul "dressing ca
// piesa" (decizie PO 2026-07-07 — nu exista flow separat de dressing-piesa).
// Chei i18n sub 'flows.PIECE_WARDROBE.*'.

const F = 'flows.PIECE_WARDROBE';

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = [linearSlot('width', `${F}.dimensions.slots.width`, { min: 0.6, max: 6 })];
    if (answers.toCeiling === true) {
      slots.push(ceilingHeightSlot());
    } else {
      slots.push({
        id: 'height',
        labelKey: `${F}.dimensions.slots.height`,
        unit: 'm',
        min: 1.8,
        max: 2.8,
        step: 0.05,
      });
    }
    return slots;
  },
};

const DOOR_SYSTEMS: Record<string, ItemSystem[]> = {
  SLIDING: ['GLISANTE'],
  HINGED: [],
};

export const pieceWardrobeFlow: RoomFlow = {
  roomType: 'PIECE_WARDROBE',
  version: 1,
  steps: [
    {
      id: 'doorType',
      type: 'single-choice',
      titleKey: `${F}.doorType.title`,
      subtitleKey: `${F}.doorType.subtitle`,
      screenGroup: 'config',
      options: ['SLIDING', 'HINGED'].map((value) => ({
        value,
        labelKey: `${F}.doorType.options.${value}.label`,
        descriptionKey: `${F}.doorType.options.${value}.description`,
        icon: value === 'SLIDING' ? 'move-horizontal' : 'door-closed',
        info: {
          titleKey: `${F}.doorType.options.${value}.info.title`,
          bodyKey: `${F}.doorType.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.doorType.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.doorType.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.doorType.options.${value}.info.price`,
        },
      })),
    },
    {
      // lipsa raspuns = nu e pana in tavan (optional, ca insula la bucatarie)
      id: 'toCeiling',
      type: 'boolean',
      titleKey: `${F}.toCeiling.title`,
      subtitleKey: `${F}.toCeiling.subtitle`,
      optional: true,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.toCeiling.info.title`,
        bodyKey: `${F}.toCeiling.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.toCeiling.info.pros${i}`),
        consKeys: [1].map((i) => `${F}.toCeiling.info.cons${i}`),
        priceHintKey: `${F}.toCeiling.info.price`,
      },
      scoringWhenTrue: { category: 'WARDROBE_TO_CEILING', optionKey: 'YES' },
    },
    dimensionsStep,
    {
      id: 'interiorModules',
      type: 'multi-choice',
      titleKey: `${F}.interiorModules.title`,
      subtitleKey: `${F}.interiorModules.subtitle`,
      minSelected: 1,
      options: [
        { value: 'HANGING_RODS', icon: 'shirt' },
        { value: 'SHELVES', icon: 'rows-3' },
        { value: 'DRAWERS', icon: 'archive' },
        { value: 'SHOE_RACK', icon: 'footprints' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.interiorModules.options.${o.value}.label`,
        descriptionKey: `${F}.interiorModules.options.${o.value}.description`,
      })),
    },
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const doorType = answerString(answers, 'doorType', 'HINGED');
    const toCeiling = answers.toCeiling === true;
    const modules = Array.isArray(answers.interiorModules)
      ? (answers.interiorModules as string[])
      : [];
    return {
      lengthM: values.width ?? 0,
      widthM: STANDARD_CABINET_DEPTH,
      heightM: toCeiling
        ? (values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT)
        : (values.height ?? 2.4),
      items: [
        {
          name: toCeiling ? 'Dulap pana in tavan (tip dressing)' : 'Dulap',
          material: (answers.material as Material) ?? 'PAL',
          systems: DOOR_SYSTEMS[doorType] ?? [],
          description: modules.length > 0 ? `Interior: ${modules.join(', ')}` : undefined,
          quantity: 1,
        },
      ],
    };
  },
};
