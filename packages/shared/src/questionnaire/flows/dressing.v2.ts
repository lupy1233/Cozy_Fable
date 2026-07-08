import type { ItemSystem, Material } from '../../enums';
import { dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { linearSlot, materialOptions, OFFERED_MATERIALS, otherMaterialStep } from './common';

// Dressing v2 (uniformizare 2026-07, decizie PO):
// - scoring pe layout (DRESSING_LAYOUT);
// - module interioare obligatorii (min 1) cu descrieri si info de pret;
// - intrebare noua de iluminare LED (educativa, optionala);
// - notes inlocuit cu upload schita (pattern v2).
// Feedback PO F4 (item 9): dimensiunile vin IMEDIAT dupa layout, cu schita
// parametrica (ca la bucatarie); intrebarea "pana in tavan" eliminata —
// cerem inaltimea DULAPULUI (slot H), nu a camerei; materiale = setul nou
// cu "Altul" text liber.
// v1 ramane FROZEN in dressing.ts.

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
  // inaltimea DULAPULUI, nu a camerei (feedback PO F4, item 9.3)
  slots.push({
    id: 'wardrobeHeight',
    labelKey: `${F}.dimensions.slots.wardrobeHeight`,
    unit: 'm',
    min: 1.8,
    max: 3.2,
    step: 0.05,
  });
  return slots;
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: dimensionSlots,
};

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

const MODULE_DEFS = [
  { value: 'HANGING_RODS', icon: 'shirt' },
  { value: 'SHELVES', icon: 'rows-3' },
  { value: 'DRAWERS', icon: 'archive' },
  { value: 'SHOE_RACK', icon: 'footprints' },
  { value: 'ACCESSORIES', icon: 'grip' },
];

export const dressingFlowV2: RoomFlow = {
  roomType: 'DRESSING',
  version: 2,
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
        scoring: { category: 'DRESSING_LAYOUT', optionKey: value },
      })),
    },
    // dimensiunile imediat dupa layout, cu schita parametrica (item 9.1)
    dimensionsStep,
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
        // fara usi = varianta fireasca pentru camerele walk-in
        ...(value === 'OPEN'
          ? { recommendedIf: { questionId: 'layout', equals: 'WALK_IN' } as const }
          : {}),
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
      id: 'interiorModules',
      type: 'multi-choice',
      titleKey: `${F}.interiorModules.title`,
      subtitleKey: `${F}.interiorModules.subtitle`,
      minSelected: 1,
      options: MODULE_DEFS.map((o) => ({
        ...o,
        labelKey: `${F}.interiorModules.options.${o.value}.label`,
        descriptionKey: `${F}.interiorModules.options.${o.value}.description`,
        info: {
          titleKey: `${F}.interiorModules.options.${o.value}.info.title`,
          bodyKey: `${F}.interiorModules.options.${o.value}.info.body`,
          priceHintKey: `${F}.interiorModules.options.${o.value}.info.price`,
        },
      })),
    },
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      screenGroup: 'materialScreen',
      options: materialOptions(OFFERED_MATERIALS),
    },
    otherMaterialStep('material', 'materialScreen'),
    {
      // lipsa raspuns = fara iluminare LED
      id: 'lighting',
      type: 'boolean',
      titleKey: `${F}.lighting.title`,
      subtitleKey: `${F}.lighting.subtitle`,
      optional: true,
      info: {
        titleKey: `${F}.lighting.info.title`,
        bodyKey: `${F}.lighting.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.lighting.info.pros${i}`),
        consKeys: [1].map((i) => `${F}.lighting.info.cons${i}`),
        priceHintKey: `${F}.lighting.info.price`,
      },
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
    const material = (answers.material as Material) ?? 'PAL';
    const doorType = typeof answers.doorType === 'string' ? answers.doorType : 'HINGED';
    const modules = Array.isArray(answers.interiorModules)
      ? (answers.interiorModules as string[])
      : [];
    const details: string[] = [];
    if (modules.length > 0) details.push(`Interior: ${modules.join(', ')}`);
    if (material === 'ALTUL' && typeof answers.materialOther === 'string' && answers.materialOther.trim()) {
      details.push(`Material dorit: ${answers.materialOther.trim()}`);
    }
    if (answers.lighting === true) details.push('iluminare LED');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      // inaltimea dulapului (slot H), nu a camerei
      heightM: values.wardrobeHeight ?? 2.4,
      items: [
        {
          name: 'Dressing',
          material,
          systems: DOOR_SYSTEMS[doorType] ?? [],
          description: details.length > 0 ? details.join('; ') : undefined,
          quantity: 1,
        },
      ],
    };
  },
};
