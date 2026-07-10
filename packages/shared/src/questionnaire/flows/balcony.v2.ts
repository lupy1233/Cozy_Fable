import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { Condition, DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { pieceChoiceOptions } from './pieces-flow';
import {
  buildPerPieceItems,
  pieceConfigSteps,
  withRecommendedMaterial,
  type PieceWithMaterialDef,
} from './per-piece';

// Balcon v2 (item 1, 2026-07-11) — aliniere la modelul bucatariei v2:
// - material + "Altul" (text liber) + sisteme de deschidere PER PIESA
//   (banca cu depozitare / dulap), nu un material comun pe camera;
// - blatul si rafturile deschise au doar material (fara sisteme);
// - balcon deschis: lemn masiv (tratat) marcat "Recomandat" (badge educativ).
// v1 ramane FROZEN in balcony.ts.

const F = 'flows.BALCONY';

const PIECES: PieceWithMaterialDef[] = [
  {
    value: 'STORAGE_BENCH',
    icon: 'armchair',
    itemName: 'Banca cu depozitare',
    materialStepId: 'materialStorageBench',
    systemsStepId: 'systemsStorageBench',
  },
  {
    value: 'TALL_CABINET',
    icon: 'door-closed',
    itemName: 'Dulap balcon',
    materialStepId: 'materialTallCabinet',
    systemsStepId: 'systemsTallCabinet',
  },
  {
    value: 'WORKTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialWorktop',
    systemsStepId: 'systemsWorktop',
  },
  {
    value: 'SHELVES',
    icon: 'rows-3',
    itemName: 'Rafturi balcon',
    materialStepId: 'materialShelves',
    systemsStepId: 'systemsShelves',
  },
];

// blatul si rafturile deschise nu au fronturi → fara intrebare de sisteme
const NO_SYSTEMS_STEPS = new Set(['systemsWorktop', 'systemsShelves']);

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('balconyLength', `${F}.dimensions.slots.balconyLength`, { min: 0.8, max: 8 }),
    {
      id: 'balconyDepth',
      labelKey: `${F}.dimensions.slots.balconyDepth`,
      unit: 'm',
      min: 0.4,
      max: 2.5,
      step: 0.05,
    },
    ceilingHeightSlot(),
  ],
};

// lemn masiv (tratat) recomandat cand balconul e deschis (badge, nu restrictie)
const woodRecommended: Condition = { questionId: 'enclosed', equals: 'OPEN' };

export const balconyFlowV2: RoomFlow = {
  roomType: 'BALCONY',
  version: 2,
  steps: [
    {
      id: 'enclosed',
      type: 'single-choice',
      titleKey: `${F}.enclosed.title`,
      subtitleKey: `${F}.enclosed.subtitle`,
      info: {
        titleKey: `${F}.enclosed.info.title`,
        bodyKey: `${F}.enclosed.info.body`,
      },
      options: ['ENCLOSED', 'OPEN'].map((value) => ({
        value,
        labelKey: `${F}.enclosed.options.${value}.label`,
        descriptionKey: `${F}.enclosed.options.${value}.description`,
        icon: value === 'ENCLOSED' ? 'app-window' : 'wind',
        info: {
          titleKey: `${F}.enclosed.options.${value}.info.title`,
          bodyKey: `${F}.enclosed.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.enclosed.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.enclosed.options.${value}.info.cons${i}`),
        },
      })),
    },
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      minSelected: 1,
      options: pieceChoiceOptions(F, PIECES),
    },
    dimensionsStep,
    ...withRecommendedMaterial(
      pieceConfigSteps(F, PIECES).filter((s) => !NO_SYSTEMS_STEPS.has(s.id)),
      'LEMN_MASIV',
      woodRecommended,
    ),
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
    // adancimea mobilierului nu poate depasi adancimea libera a balconului
    const depth = Math.min(values.balconyDepth ?? STANDARD_CABINET_DEPTH, STANDARD_CABINET_DEPTH);
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: depth,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: buildPerPieceItems(answers, PIECES, 'Mobilier balcon'),
    };
  },
};
