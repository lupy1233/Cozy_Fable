import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, Condition, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions, systemOptions } from './common';

// Bucatarie v2 (overhaul 2026-07):
// - PARALLEL (galley) eliminat; insula devine add-on pe acelasi ecran cu layout-ul
//   (screenGroup) — exclusivitatea formelor e garantata de single-choice.
// - cabinetZones eliminat: intrebari separate per zona (baza / suspendate / insula)
//   pentru material front si sistem de deschidere.
// - extraPieces si notes eliminate; pasul final devine upload schita/proiect.
// - layout NU mai afiseaza pret mediu (nu influenteaza direct pretul).
// Punctajul per zona curge prin items-urile derivate (MATERIAL/SYSTEM per item).

const F = 'flows.KITCHEN';

const LAYOUT_RUNS: Record<string, string[]> = {
  STRAIGHT: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
};

const LAYOUT_ICONS: Record<string, string> = {
  STRAIGHT: 'minus',
  L_SHAPE: 'corner-down-right',
  U_SHAPE: 'square',
};

const ifIsland: Condition = { questionId: 'hasIsland', equals: true };

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

export const kitchenFlowV2: RoomFlow = {
  roomType: 'KITCHEN',
  version: 2,
  steps: [
    {
      id: 'layout',
      type: 'single-choice',
      titleKey: `${F}.layout.title`,
      subtitleKey: `${F}.layout.subtitle`,
      screenGroup: 'layoutScreen',
      options: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.layout.options.${value}.label`,
        descriptionKey: `${F}.layout.options.${value}.description`,
        icon: LAYOUT_ICONS[value],
        // fara priceHintKey: layout-ul nu afiseaza pret mediu (decizie PO)
        info: {
          titleKey: `${F}.layout.options.${value}.info.title`,
          bodyKey: `${F}.layout.options.${value}.info.body`,
          prosKeys: [1, 2, 3].map((i) => `${F}.layout.options.${value}.info.pros${i}`),
          consKeys: [1, 2].map((i) => `${F}.layout.options.${value}.info.cons${i}`),
        },
        scoring: { category: 'KITCHEN_LAYOUT', optionKey: value },
      })),
    },
    {
      id: 'hasIsland',
      type: 'boolean',
      titleKey: `${F}.hasIsland.title`,
      subtitleKey: `${F}.hasIsland.subtitle`,
      screenGroup: 'layoutScreen',
      // comutator add-on: lipsa raspunsului = fara insula (nu blocheaza ecranul)
      optional: true,
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
      id: 'frontMaterialBase',
      type: 'single-choice',
      titleKey: `${F}.frontMaterialBase.title`,
      subtitleKey: `${F}.frontMaterialBase.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'frontMaterialWall',
      type: 'single-choice',
      titleKey: `${F}.frontMaterialWall.title`,
      subtitleKey: `${F}.frontMaterialWall.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'frontMaterialIsland',
      type: 'single-choice',
      titleKey: `${F}.frontMaterialIsland.title`,
      subtitleKey: `${F}.frontMaterialIsland.subtitle`,
      visibleIf: ifIsland,
      options: materialOptions(),
    },
    {
      id: 'openingSystemsBase',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsBase.title`,
      subtitleKey: `${F}.openingSystemsBase.subtitle`,
      minSelected: 1,
      options: systemOptions(),
    },
    {
      id: 'openingSystemsWall',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsWall.title`,
      subtitleKey: `${F}.openingSystemsWall.subtitle`,
      minSelected: 1,
      options: systemOptions(),
    },
    {
      id: 'openingSystemsIsland',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsIsland.title`,
      subtitleKey: `${F}.openingSystemsIsland.subtitle`,
      visibleIf: ifIsland,
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
      id: 'sketch',
      type: 'upload',
      titleKey: `${F}.sketch.title`,
      subtitleKey: `${F}.sketch.subtitle`,
      optional: true,
      maxFiles: 3,
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

    const material = (id: string): Material => (answers[id] as Material) ?? 'PAL';
    const systems = (id: string): ItemSystem[] =>
      Array.isArray(answers[id]) ? (answers[id] as ItemSystem[]) : [];

    // un item per zona, cu materialul si sistemele proprii → scoring per zona
    const items: RequestItemInput[] = [
      {
        name: 'Corpuri baza',
        material: material('frontMaterialBase'),
        systems: systems('openingSystemsBase'),
        quantity: 1,
      },
      {
        name: 'Corpuri suspendate',
        material: material('frontMaterialWall'),
        systems: systems('openingSystemsWall'),
        quantity: 1,
      },
    ];
    if (answers.hasIsland === true) {
      items.push({
        name: 'Insula bucatarie',
        material: material('frontMaterialIsland'),
        systems: systems('openingSystemsIsland'),
        quantity: 1,
      });
    }

    return { lengthM, widthM, heightM, items };
  },
};
