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

// Spalatorie v3 (etapa 6, DESIGN §5.8, c6):
// - dulapurile (electrocasnice / depozitare / corp cuva): material BODY + deschidere pe
//   acelasi ecran, cu intrebarea comuna pe ecranul pieselor;
// - blatul: setul de blaturi (WORKTOP), fara "Recomandat", fara deschidere
//   (systemsCountertop nu mai exista);
// - fara ventilatie: MDF infoliat "Recomandat" doar pe corpuri (BODY).
// v2 ramane FROZEN in laundry.v2.ts.

const F = 'flows.LAUNDRY';
const V = `${F}.v3`;

const PIECES: FinishPieceDef[] = [
  {
    value: 'APPLIANCE_HOUSING',
    icon: 'washing-machine',
    itemName: 'Dulap încastrare electrocasnice',
    materialStepId: 'materialApplianceHousing',
    systemsStepId: 'systemsApplianceHousing',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V}.materialApplianceHousing.title`,
  },
  {
    value: 'STORAGE',
    icon: 'archive',
    itemName: 'Dulapuri depozitare',
    materialStepId: 'materialStorage',
    systemsStepId: 'systemsStorage',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V}.materialStorage.title`,
  },
  {
    value: 'COUNTERTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialCountertop',
    materialSet: 'WORKTOP',
    fronts: 'NO',
    materialTitleKey: `${V}.materialCountertop.title`,
  },
  {
    value: 'SINK_UNIT',
    icon: 'droplets',
    itemName: 'Corp cu cuvă',
    materialStepId: 'materialSinkUnit',
    systemsStepId: 'systemsSinkUnit',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V}.materialSinkUnit.title`,
  },
];

// MDF infoliat recomandat cand incaperea nu e ventilata (badge, nu restrictie);
// constructorul il pune doar pe BODY / PANEL, deci nu si pe blat (c6)
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'MDF_INFOLIAT', cond: { questionId: 'ventilation', equals: 'NONE' } },
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: () => [
    linearSlot('runA', `${F}.dimensions.slots.runA`, { min: 0.8, max: 6 }),
    ceilingHeightSlot(),
  ],
};

export const laundryFlowV3: RoomFlow = {
  roomType: 'LAUNDRY',
  version: 3,
  steps: [
    {
      id: 'applianceSetup',
      type: 'single-choice',
      titleKey: `${F}.applianceSetup.title`,
      subtitleKey: `${F}.applianceSetup.subtitle`,
      options: ['WASHER_ONLY', 'STACKED', 'SIDE_BY_SIDE'].map((value) => ({
        value,
        labelKey: `${F}.applianceSetup.options.${value}.label`,
        descriptionKey: `${F}.applianceSetup.options.${value}.description`,
        icon:
          value === 'WASHER_ONLY'
            ? 'washing-machine'
            : value === 'STACKED'
              ? 'rows-2'
              : 'columns-2',
        info: {
          titleKey: `${F}.applianceSetup.options.${value}.info.title`,
          bodyKey: `${F}.applianceSetup.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.applianceSetup.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.applianceSetup.options.${value}.info.cons${i}`),
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
    {
      id: 'ventilation',
      type: 'single-choice',
      titleKey: `${F}.ventilation.title`,
      subtitleKey: `${F}.ventilation.subtitle`,
      info: {
        titleKey: `${F}.ventilation.info.title`,
        bodyKey: `${F}.ventilation.info.body`,
      },
      options: ['WINDOW', 'FAN', 'NONE'].map((value) => ({
        value,
        labelKey: `${F}.ventilation.options.${value}.label`,
        descriptionKey: `${F}.ventilation.options.${value}.description`,
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier spălătorie');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
