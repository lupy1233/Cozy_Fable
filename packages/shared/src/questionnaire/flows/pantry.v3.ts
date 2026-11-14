import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { buildFinishItems, pieceFinishSteps, type FinishOpts, type FinishPieceDef } from './piece-finish';

// Debara v3 (etapa 6, DESIGN §5.7):
// - doua zone alese din storageStyle (selectedIf): rafturi deschise (PANEL, fara deschidere)
//   si dulapuri inchise (BODY, cu deschidere);
// - materialul si deschiderea dulapurilor pe ACELASI ecran `piece:CABINETS`
//   (in v2 deschiderea era pe `piece:CABINETS:systems`);
// - fara intrebarea comuna (N17).
// v2 ramane FROZEN in pantry.v2.ts.

const F = 'flows.PANTRY';
const V = `${F}.v3`;

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

const PIECES: FinishPieceDef[] = [
  {
    value: 'SHELVES',
    icon: 'rows-3',
    itemName: 'Rafturi debara',
    materialStepId: 'materialShelves',
    materialSet: 'PANEL',
    fronts: 'NO',
    selectedIf: { questionId: 'storageStyle', in: ['OPEN_SHELVES', 'MIXED'] },
    materialTitleKey: `${V}.materialShelves.title`,
  },
  {
    value: 'CABINETS',
    icon: 'door-closed',
    itemName: 'Dulapuri debara',
    materialStepId: 'materialCabinets',
    systemsStepId: 'systemsCabinets',
    materialSet: 'BODY',
    fronts: 'YES',
    selectedIf: { questionId: 'storageStyle', in: ['CLOSED_CABINETS', 'MIXED'] },
    materialTitleKey: `${V}.materialCabinets.title`,
  },
];

const OPTS: FinishOpts = { flowKey: F, common: false };

export const pantryFlowV3: RoomFlow = {
  roomType: 'PANTRY',
  version: 3,
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
    ...pieceFinishSteps(OPTS, PIECES),
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Rafturi debara');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
