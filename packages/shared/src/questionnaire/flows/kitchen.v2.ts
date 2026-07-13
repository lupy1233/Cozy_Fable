import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, Condition, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import {
  ceilingHeightSlot,
  KITCHEN_SYSTEMS_BASE,
  KITCHEN_SYSTEMS_WALL,
  linearSlot,
  materialOptions,
  OFFERED_MATERIALS,
  otherMaterialStep,
  systemOptions,
} from './common';

// Bucatarie v2 (overhaul 2026-07):
// - PARALLEL (galley) eliminat; exclusivitatea formelor e garantata de single-choice.
// - cabinetZones eliminat: intrebari separate per zona (baza / suspendate / insula)
//   pentru material front si sistem de deschidere.
// - extraPieces si notes eliminate; pasul final devine upload schita/proiect.
// - layout NU mai afiseaza pret mediu (nu influenteaza direct pretul).
// Punctajul per zona curge prin items-urile derivate (MATERIAL/SYSTEM per item).
// Feedback PO 2026-07-08 (sprint F3):
// - materiale: setul nou (PAL / MDF infoliat / vopsit / furnir / lemn masiv) +
//   "Altul" cu text liber pe acelasi ecran (otherMaterialStep);
// - deschidere: jos/insula = maner/push/Gola, suspendate + Aventos;
// - blat: PAL / HPL / cuart / granit.
// Feedback PO 2026-07-13 (docs/12 S1, inlocuieste decizia F3 despre insula):
// - insula = toggle-card OPTIONAL pe ACELASI ecran cu formele (screenGroup
//   'layoutScreen'); forma ramane single-choice obligatoriu;
// - intrebarile grupate pe partea de mobilier: material baza → deschidere baza
//   → material suspendat → deschidere suspendat → material insula → deschidere
//   insula (id-uri neschimbate, doar ordinea ecranelor).

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
      // toggle-card langa formele de bucatarie (feedback PO 2026-07-13);
      // lipsa raspuns = fara insula (deriveRoom verifica === true)
      screenGroup: 'layoutScreen',
      icon: 'plus',
      optional: true,
      // U1 (feedback PO r4): cardul-bifa arata ca un card de forma, cu eticheta
      cardLabelKey: `${F}.hasIsland.cardLabel`,
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
      screenGroup: 'frontBase',
      options: materialOptions(OFFERED_MATERIALS),
    },
    otherMaterialStep('frontMaterialBase', 'frontBase'),
    {
      id: 'openingSystemsBase',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsBase.title`,
      subtitleKey: `${F}.openingSystemsBase.subtitle`,
      minSelected: 1,
      options: systemOptions(KITCHEN_SYSTEMS_BASE),
    },
    {
      id: 'frontMaterialWall',
      type: 'single-choice',
      titleKey: `${F}.frontMaterialWall.title`,
      subtitleKey: `${F}.frontMaterialWall.subtitle`,
      screenGroup: 'frontWall',
      options: materialOptions(OFFERED_MATERIALS),
    },
    otherMaterialStep('frontMaterialWall', 'frontWall'),
    {
      id: 'openingSystemsWall',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsWall.title`,
      subtitleKey: `${F}.openingSystemsWall.subtitle`,
      minSelected: 1,
      options: systemOptions(KITCHEN_SYSTEMS_WALL),
    },
    {
      id: 'frontMaterialIsland',
      type: 'single-choice',
      titleKey: `${F}.frontMaterialIsland.title`,
      subtitleKey: `${F}.frontMaterialIsland.subtitle`,
      visibleIf: ifIsland,
      screenGroup: 'frontIsland',
      options: materialOptions(OFFERED_MATERIALS),
    },
    otherMaterialStep('frontMaterialIsland', 'frontIsland'),
    {
      id: 'openingSystemsIsland',
      type: 'multi-choice',
      titleKey: `${F}.openingSystemsIsland.title`,
      subtitleKey: `${F}.openingSystemsIsland.subtitle`,
      visibleIf: ifIsland,
      minSelected: 1,
      options: systemOptions(KITCHEN_SYSTEMS_BASE),
    },
    {
      id: 'countertop',
      type: 'single-choice',
      titleKey: `${F}.countertop.title`,
      subtitleKey: `${F}.countertop.subtitle`,
      options: ['PAL', 'HPL', 'QUARTZ', 'GRANITE'].map((value) => ({
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
      maxFiles: 7,
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
    // materialul liber ("Altul"): textul clientului intra in description
    const otherDesc = (id: string): string | undefined => {
      const text = answers[`${id}Other`];
      return material(id) === 'ALTUL' && typeof text === 'string' && text.trim()
        ? `Material dorit: ${text.trim()}`
        : undefined;
    };

    // un item per zona, cu materialul si sistemele proprii → scoring per zona
    const items: RequestItemInput[] = [
      {
        name: 'Corpuri baza',
        material: material('frontMaterialBase'),
        systems: systems('openingSystemsBase'),
        description: otherDesc('frontMaterialBase'),
        quantity: 1,
      },
      {
        name: 'Corpuri suspendate',
        material: material('frontMaterialWall'),
        systems: systems('openingSystemsWall'),
        description: otherDesc('frontMaterialWall'),
        quantity: 1,
      },
    ];
    if (answers.hasIsland === true) {
      items.push({
        name: 'Insula bucatarie',
        material: material('frontMaterialIsland'),
        systems: systems('openingSystemsIsland'),
        description: otherDesc('frontMaterialIsland'),
        quantity: 1,
      });
    }

    return { lengthM, widthM, heightM, items };
  },
};
