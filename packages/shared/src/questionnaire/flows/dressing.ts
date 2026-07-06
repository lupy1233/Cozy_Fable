import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions } from './common';

// Flow dressing: layout → tip usi → dimensiuni (laturi dupa layout) →
// module interioare → material → notite. Chei i18n sub 'flows.DRESSING.*'.

const F = 'flows.DRESSING';

const LAYOUT_RUNS: Record<string, string[]> = {
  LINEAR: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
  WALK_IN: ['runA', 'runB'],
};

const LAYOUT_ICONS: Record<string, string> = {
  LINEAR: 'minus',
  L_SHAPE: 'corner-down-right',
  U_SHAPE: 'square',
  WALK_IN: 'door-open',
};

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const layout = typeof answers.layout === 'string' ? answers.layout : 'LINEAR';
  const runs = LAYOUT_RUNS[layout] ?? LAYOUT_RUNS.LINEAR;
  const slots = runs.map((id) => linearSlot(id, `${F}.dimensions.slots.${id}`, { min: 1 }));
  slots.push(ceilingHeightSlot());
  return slots;
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: dimensionSlots,
};

// SLIDING → GLISANTE (mapare direct pe enum); restul nu presupun un sistem anume.
const DOOR_SYSTEMS: Record<string, ItemSystem[]> = {
  SLIDING: ['GLISANTE'],
  HINGED: [],
  OPEN: [],
};

const DOOR_ICONS: Record<string, string> = {
  SLIDING: 'move-horizontal',
  HINGED: 'door-closed',
  OPEN: 'gallery-vertical',
};

export const dressingFlow: RoomFlow = {
  roomType: 'DRESSING',
  version: 1,
  steps: [
    {
      id: 'layout',
      type: 'single-choice',
      titleKey: `${F}.layout.title`,
      subtitleKey: `${F}.layout.subtitle`,
      options: ['LINEAR', 'L_SHAPE', 'U_SHAPE', 'WALK_IN'].map((value) => ({
        value,
        labelKey: `${F}.layout.options.${value}.label`,
        descriptionKey: `${F}.layout.options.${value}.description`,
        icon: LAYOUT_ICONS[value],
        info: {
          titleKey: `${F}.layout.options.${value}.info.title`,
          bodyKey: `${F}.layout.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.layout.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.layout.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.layout.options.${value}.info.price`,
        },
      })),
    },
    {
      id: 'doorType',
      type: 'single-choice',
      titleKey: `${F}.doorType.title`,
      subtitleKey: `${F}.doorType.subtitle`,
      options: ['SLIDING', 'HINGED', 'OPEN'].map((value) => ({
        value,
        labelKey: `${F}.doorType.options.${value}.label`,
        descriptionKey: `${F}.doorType.options.${value}.description`,
        icon: DOOR_ICONS[value],
        info: {
          titleKey: `${F}.doorType.options.${value}.info.title`,
          bodyKey: `${F}.doorType.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.doorType.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.doorType.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.doorType.options.${value}.info.price`,
        },
      })),
    },
    dimensionsStep,
    {
      id: 'interiorModules',
      type: 'multi-choice',
      titleKey: `${F}.interiorModules.title`,
      subtitleKey: `${F}.interiorModules.subtitle`,
      optional: true,
      options: [
        { value: 'HANGING_RODS', icon: 'shirt' },
        { value: 'DRAWERS', icon: 'archive' },
        { value: 'SHELVES', icon: 'rows-3' },
        { value: 'SHOE_RACK', icon: 'footprints' },
      ].map((o) => ({ ...o, labelKey: `${F}.interiorModules.options.${o.value}.label` })),
    },
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
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
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const material = (answers.material as Material) ?? 'PAL';
    const doorType = typeof answers.doorType === 'string' ? answers.doorType : 'HINGED';

    const items: RequestItemInput[] = [
      {
        name: 'Dressing',
        material,
        systems: DOOR_SYSTEMS[doorType] ?? [],
        quantity: 1,
      },
    ];

    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
