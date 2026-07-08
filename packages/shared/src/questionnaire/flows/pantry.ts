import type { Material } from '../../enums';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { RequestItemInput } from '../../request.schemas';
import type { AnswerMap, DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions } from './common';

// Flow debara (v1, nou 2026-07): pereti folositi → stil depozitare → dimensiuni →
// material → schita. Spatiu utilitar — flow scurt. Chei i18n sub 'flows.PANTRY.*'.

const F = 'flows.PANTRY';

const WALL_RUNS: Record<string, string[]> = {
  ONE_WALL: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers: AnswerMap) => {
    const walls = typeof answers.wallsUsed === 'string' ? answers.wallsUsed : 'ONE_WALL';
    const runs = WALL_RUNS[walls] ?? WALL_RUNS.ONE_WALL;
    const slots = runs.map((id) =>
      linearSlot(id, `${F}.dimensions.slots.${id}`, { min: 0.5, max: 5 }),
    );
    slots.push(ceilingHeightSlot());
    return slots;
  },
};

// stil depozitare → items derivate
const STYLE_ITEMS: Record<string, string[]> = {
  OPEN_SHELVES: ['Rafturi debara'],
  CLOSED_CABINETS: ['Dulapuri debara'],
  MIXED: ['Rafturi debara', 'Dulapuri debara'],
};

export const pantryFlow: RoomFlow = {
  roomType: 'PANTRY',
  version: 1,
  steps: [
    {
      id: 'wallsUsed',
      type: 'single-choice',
      titleKey: `${F}.wallsUsed.title`,
      subtitleKey: `${F}.wallsUsed.subtitle`,
      info: {
        titleKey: `${F}.wallsUsed.info.title`,
        bodyKey: `${F}.wallsUsed.info.body`,
      },
      options: ['ONE_WALL', 'L_SHAPE', 'U_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.wallsUsed.options.${value}.label`,
        descriptionKey: `${F}.wallsUsed.options.${value}.description`,
        icon: value === 'ONE_WALL' ? 'minus' : value === 'L_SHAPE' ? 'corner-down-right' : 'square',
      })),
    },
    {
      id: 'storageStyle',
      type: 'single-choice',
      titleKey: `${F}.storageStyle.title`,
      subtitleKey: `${F}.storageStyle.subtitle`,
      options: ['OPEN_SHELVES', 'CLOSED_CABINETS', 'MIXED'].map((value) => ({
        value,
        labelKey: `${F}.storageStyle.options.${value}.label`,
        descriptionKey: `${F}.storageStyle.options.${value}.description`,
        icon:
          value === 'OPEN_SHELVES' ? 'rows-3' : value === 'CLOSED_CABINETS' ? 'door-closed' : 'columns-3',
        info: {
          titleKey: `${F}.storageStyle.options.${value}.info.title`,
          bodyKey: `${F}.storageStyle.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.storageStyle.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.storageStyle.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.storageStyle.options.${value}.info.price`,
        },
      })),
    },
    dimensionsStep,
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'sketch',
      type: 'upload',
      titleKey: `${F}.sketch.title`,
      subtitleKey: `${F}.sketch.subtitle`,
      optional: true,
      maxFiles: 3,
    },
  ],
  deriveRoom: (answers) => {
    const material = (answers.material as Material) ?? 'PAL';
    const style = typeof answers.storageStyle === 'string' ? answers.storageStyle : 'OPEN_SHELVES';
    const items: RequestItemInput[] = (STYLE_ITEMS[style] ?? STYLE_ITEMS.OPEN_SHELVES).map(
      (name) => ({ name, material, systems: [], quantity: 1 }),
    );
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
