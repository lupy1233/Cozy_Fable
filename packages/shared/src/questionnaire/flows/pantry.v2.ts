import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, Condition, DimensionGroupStep, RoomFlow } from '../types';
import {
  ceilingHeightSlot,
  GENERAL_SYSTEMS,
  linearSlot,
  materialOptions,
  OFFERED_MATERIALS,
  otherMaterialStep,
  systemOptions,
} from './common';

// Debara v2 (item 1, 2026-07-11) — aliniere la modelul bucatariei v2:
// - materiale: setul nou OFFERED (PAL / variante MDF / lemn masiv / Altul cu
//   text liber pe acelasi ecran), in loc de setul legacy;
// - material per zona (rafturi deschise vs dulapuri inchise), nu unul comun;
// - sisteme de deschidere intrebate DOAR pentru dulapurile cu fronturi.
// v1 ramane FROZEN in pantry.ts.

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

const ifShelves: Condition = { questionId: 'storageStyle', in: ['OPEN_SHELVES', 'MIXED'] };
const ifCabinets: Condition = { questionId: 'storageStyle', in: ['CLOSED_CABINETS', 'MIXED'] };

export const pantryFlowV2: RoomFlow = {
  roomType: 'PANTRY',
  version: 2,
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
    // ecranul rafturilor: material + "Altul" (fara sisteme — fronturi nu exista)
    {
      id: 'materialShelves',
      type: 'single-choice',
      titleKey: `${F}.materialShelves.title`,
      icon: 'rows-3',
      visibleIf: ifShelves,
      screenGroup: 'piece:SHELVES',
      options: materialOptions(OFFERED_MATERIALS),
    },
    {
      ...otherMaterialStep('materialShelves', 'piece:SHELVES'),
      visibleIf: { all: [ifShelves, { questionId: 'materialShelves', equals: 'ALTUL' }] },
    },
    // ecranul dulapurilor: material + "Altul" + sisteme de deschidere
    {
      id: 'materialCabinets',
      type: 'single-choice',
      titleKey: `${F}.materialCabinets.title`,
      icon: 'door-closed',
      visibleIf: ifCabinets,
      screenGroup: 'piece:CABINETS',
      options: materialOptions(OFFERED_MATERIALS),
    },
    {
      ...otherMaterialStep('materialCabinets', 'piece:CABINETS'),
      visibleIf: { all: [ifCabinets, { questionId: 'materialCabinets', equals: 'ALTUL' }] },
    },
    {
      id: 'systemsCabinets',
      type: 'multi-choice',
      titleKey: 'common.pieceSystems.title',
      subtitleKey: 'common.pieceSystems.subtitle',
      visibleIf: ifCabinets,
      screenGroup: 'piece:CABINETS',
      minSelected: 1,
      options: systemOptions(GENERAL_SYSTEMS),
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
    const style = typeof answers.storageStyle === 'string' ? answers.storageStyle : 'OPEN_SHELVES';
    const material = (id: string): Material => (answers[id] as Material) ?? 'PAL';
    const otherDesc = (id: string): string | undefined => {
      const text = answers[`${id}Other`];
      return material(id) === 'ALTUL' && typeof text === 'string' && text.trim()
        ? `Material dorit: ${text.trim()}`
        : undefined;
    };

    const items: RequestItemInput[] = [];
    if (style === 'OPEN_SHELVES' || style === 'MIXED') {
      items.push({
        name: 'Rafturi debara',
        material: material('materialShelves'),
        systems: [],
        description: otherDesc('materialShelves'),
        quantity: 1,
      });
    }
    if (style === 'CLOSED_CABINETS' || style === 'MIXED') {
      items.push({
        name: 'Dulapuri debara',
        material: material('materialCabinets'),
        systems: Array.isArray(answers.systemsCabinets)
          ? (answers.systemsCabinets as ItemSystem[])
          : [],
        description: otherDesc('materialCabinets'),
        quantity: 1,
      });
    }
    if (items.length === 0) {
      items.push({ name: 'Rafturi debara', material: 'PAL', systems: [], quantity: 1 });
    }

    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
