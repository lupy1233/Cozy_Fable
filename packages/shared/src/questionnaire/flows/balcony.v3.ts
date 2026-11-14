import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Balcon v3 (etapa 6, DESIGN §5.9, c6):
// - banca cu lada (poate fi fara usi) si dulapul: material BODY + "Integral din MDF" +
//   deschidere pe acelasi ecran, cu intrebarea comuna pe ecranul pieselor;
// - blatul: setul de blaturi (WORKTOP); rafturile: setul de placi (PANEL); fara deschidere
//   (systemsWorktop / systemsShelves nu mai exista);
// - balcon deschis: lemn masiv "Recomandat" pe BODY / PANEL (nu pe blat).
// v2 ramane FROZEN in balcony.v2.ts.

const F = 'flows.BALCONY';
const V = `${F}.v3`;

const PIECES: FinishPieceDef[] = [
  {
    value: 'STORAGE_BENCH',
    icon: 'armchair',
    itemName: 'Bancă cu ladă',
    materialStepId: 'materialStorageBench',
    systemsStepId: 'systemsStorageBench',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'MAYBE',
    materialTitleKey: `${V}.materialStorageBench.title`,
  },
  {
    value: 'TALL_CABINET',
    icon: 'door-closed',
    itemName: 'Dulap balcon',
    materialStepId: 'materialTallCabinet',
    systemsStepId: 'systemsTallCabinet',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V}.materialTallCabinet.title`,
  },
  {
    value: 'WORKTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialWorktop',
    materialSet: 'WORKTOP',
    fronts: 'NO',
    materialTitleKey: `${V}.materialWorktop.title`,
  },
  {
    value: 'SHELVES',
    icon: 'rows-3',
    itemName: 'Rafturi balcon',
    materialStepId: 'materialShelves',
    materialSet: 'PANEL',
    fronts: 'NO',
    materialTitleKey: `${V}.materialShelves.title`,
  },
];

// lemn masiv (tratat) recomandat cand balconul e deschis (badge, nu restrictie)
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'LEMN_MASIV', cond: { questionId: 'enclosed', equals: 'OPEN' } },
};

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

export const balconyFlowV3: RoomFlow = {
  roomType: 'BALCONY',
  version: 3,
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
      screenGroup: 'pieces',
      options: pieceChoiceOptions(F, PIECES),
    },
    sameFinishStep(OPTS, PIECES),
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
    const values = dimensionValues(answers, 'dimensions');
    // adancimea mobilierului nu poate depasi adancimea libera a balconului
    const depth = Math.min(values.balconyDepth ?? STANDARD_CABINET_DEPTH, STANDARD_CABINET_DEPTH);
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier balcon');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: depth,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
