import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions, systemOptions } from './common';

// FROZEN v1 — NU MODIFICA. Cererile publicate pe versiunea 1 se valideaza si
// se rezuma permanent contra acestei definitii. Schimbari noi → kitchen.v2.ts+.
//
// Flow-ul flagship: bucatarie. Chei i18n relative sub 'flows.KITCHEN.*'.
// Layout-ul determina numarul de laturi (sloturi liniare); insula adauga
// doua sloturi proprii. Punctele optiunilor stau in project_sizing_config
// (categorii noi KITCHEN_LAYOUT / KITCHEN_ISLAND / KITCHEN_COUNTERTOP).

const F = 'flows.KITCHEN';

// laturile de plan per layout; L si PARALLEL au 2, U are 3
const LAYOUT_RUNS: Record<string, string[]> = {
  STRAIGHT: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
  PARALLEL: ['runA', 'runB'],
};

const LAYOUT_ICONS: Record<string, string> = {
  STRAIGHT: 'minus',
  L_SHAPE: 'corner-down-right',
  U_SHAPE: 'square',
  PARALLEL: 'equal',
};

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const layout = typeof answers.layout === 'string' ? answers.layout : 'STRAIGHT';
  const runs = LAYOUT_RUNS[layout] ?? LAYOUT_RUNS.STRAIGHT;

  const slots = runs.map((id) => linearSlot(id, `${F}.dimensions.slots.${id}`, { min: 1 }));
  slots.push(ceilingHeightSlot());
  if (answers.hasIsland === true) {
    slots.push(linearSlot('islandLength', `${F}.dimensions.slots.islandLength`, { min: 0.8, max: 4 }));
    slots.push({
      id: 'islandDepth',
      labelKey: `${F}.dimensions.slots.islandDepth`,
      unit: 'm',
      min: 0.6,
      max: 1.5,
      step: 0.05,
    });
  }
  return slots;
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: dimensionSlots,
};

// Zonele de corpuri → cate un item derivat (nume RO fara diacritice, doar fallback DB;
// UI-ul randeaza mereu din answers cu chei i18n).
const ZONE_ITEM_NAMES: Record<string, string> = {
  BASE_UNITS: 'Corpuri baza',
  WALL_UNITS: 'Corpuri suspendate',
  TALL_PANTRY: 'Coloane / camara',
  ISLAND_UNITS: 'Insula bucatarie',
};

export const kitchenFlow: RoomFlow = {
  roomType: 'KITCHEN',
  version: 1,
  steps: [
    {
      id: 'layout',
      type: 'single-choice',
      titleKey: `${F}.layout.title`,
      subtitleKey: `${F}.layout.subtitle`,
      options: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE', 'PARALLEL'].map((value) => ({
        value,
        labelKey: `${F}.layout.options.${value}.label`,
        descriptionKey: `${F}.layout.options.${value}.description`,
        icon: LAYOUT_ICONS[value],
        info: {
          titleKey: `${F}.layout.options.${value}.info.title`,
          bodyKey: `${F}.layout.options.${value}.info.body`,
          prosKeys: [1, 2, 3].map((i) => `${F}.layout.options.${value}.info.pros${i}`),
          consKeys: [1, 2].map((i) => `${F}.layout.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.layout.options.${value}.info.price`,
        },
        scoring: { category: 'KITCHEN_LAYOUT', optionKey: value },
      })),
    },
    {
      id: 'hasIsland',
      type: 'boolean',
      titleKey: `${F}.hasIsland.title`,
      subtitleKey: `${F}.hasIsland.subtitle`,
      info: {
        titleKey: `${F}.hasIsland.info.title`,
        bodyKey: `${F}.hasIsland.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.hasIsland.info.pros${i}`),
        consKeys: [1, 2].map((i) => `${F}.hasIsland.info.cons${i}`),
        priceHintKey: `${F}.hasIsland.info.price`,
      },
      scoringWhenTrue: { category: 'KITCHEN_ISLAND', optionKey: 'YES' },
    },
    dimensionsStep,
    {
      id: 'cabinetZones',
      type: 'multi-choice',
      titleKey: `${F}.cabinetZones.title`,
      subtitleKey: `${F}.cabinetZones.subtitle`,
      minSelected: 1,
      options: [
        { value: 'BASE_UNITS', icon: 'archive' },
        { value: 'WALL_UNITS', icon: 'gallery-vertical-end' },
        { value: 'TALL_PANTRY', icon: 'door-closed' },
        { value: 'ISLAND_UNITS', icon: 'table-2' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.cabinetZones.options.${o.value}.label`,
        descriptionKey: `${F}.cabinetZones.options.${o.value}.description`,
        ...(o.value === 'ISLAND_UNITS'
          ? { visibleIf: { questionId: 'hasIsland', equals: true as const } }
          : {}),
      })),
    },
    {
      id: 'frontMaterial',
      type: 'single-choice',
      titleKey: `${F}.frontMaterial.title`,
      subtitleKey: `${F}.frontMaterial.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'openingSystems',
      type: 'multi-choice',
      titleKey: `${F}.openingSystems.title`,
      subtitleKey: `${F}.openingSystems.subtitle`,
      minSelected: 1,
      options: systemOptions(),
    },
    {
      id: 'countertop',
      type: 'single-choice',
      titleKey: `${F}.countertop.title`,
      subtitleKey: `${F}.countertop.subtitle`,
      options: ['LAMINATE', 'QUARTZ', 'GRANITE', 'WOOD'].map((value) => ({
        value,
        labelKey: `${F}.countertop.options.${value}.label`,
        descriptionKey: `${F}.countertop.options.${value}.description`,
        info: {
          titleKey: `${F}.countertop.options.${value}.info.title`,
          bodyKey: `${F}.countertop.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.countertop.options.${value}.info.pros${i}`),
          consKeys: [1, 2].map((i) => `${F}.countertop.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.countertop.options.${value}.info.price`,
        },
        scoring: { category: 'KITCHEN_COUNTERTOP', optionKey: value },
      })),
    },
    {
      id: 'appliances',
      type: 'multi-choice',
      titleKey: `${F}.appliances.title`,
      subtitleKey: `${F}.appliances.subtitle`,
      optional: true,
      options: [
        { value: 'OVEN', icon: 'microwave' },
        { value: 'HOB', icon: 'flame' },
        { value: 'HOOD', icon: 'wind' },
        { value: 'DISHWASHER', icon: 'waves' },
        { value: 'FRIDGE', icon: 'refrigerator' },
        { value: 'MICROWAVE', icon: 'zap' },
      ].map((o) => ({ ...o, labelKey: `${F}.appliances.options.${o.value}.label` })),
    },
    {
      id: 'extraPieces',
      type: 'pieces',
      titleKey: `${F}.extraPieces.title`,
      subtitleKey: `${F}.extraPieces.subtitle`,
      optional: true,
      minPieces: 0,
      maxPieces: 10,
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
    const lengthM = linearMeters(dimensionsStep, answers);
    const heightM = values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;
    const widthM =
      answers.hasIsland === true && typeof values.islandDepth === 'number'
        ? values.islandDepth
        : STANDARD_CABINET_DEPTH;

    const material = (answers.frontMaterial as Material) ?? 'PAL';
    const systems = Array.isArray(answers.openingSystems)
      ? (answers.openingSystems as ItemSystem[])
      : [];
    const zones = Array.isArray(answers.cabinetZones) ? (answers.cabinetZones as string[]) : [];

    const items: RequestItemInput[] = zones.map((zone) => ({
      name: ZONE_ITEM_NAMES[zone] ?? zone,
      material,
      systems,
      quantity: 1,
    }));
    if (Array.isArray(answers.extraPieces)) {
      items.push(...(answers.extraPieces as RequestItemInput[]));
    }
    // garantie: request_rooms cere minim un item (requestRoomSchema.items min 1)
    if (items.length === 0) {
      items.push({ name: 'Mobilier bucatarie', material, systems, quantity: 1 });
    }

    return { lengthM, widthM, heightM, items };
  },
};
