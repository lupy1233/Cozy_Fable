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

// Spalatorie v2 (item 1, 2026-07-11) — aliniere la modelul bucatariei v2:
// - material + "Altul" (text liber) + sisteme de deschidere PER PIESA
//   (dulap electrocasnice / depozitare / corp cuva), nu un material comun;
// - blatul de lucru are doar material (fara sisteme — nu are fronturi);
// - fara ventilatie: MDF infoliat marcat "Recomandat" (badge educativ).
// v1 ramane FROZEN in laundry.ts.

const F = 'flows.LAUNDRY';

const PIECES: PieceWithMaterialDef[] = [
  {
    value: 'APPLIANCE_HOUSING',
    icon: 'washing-machine',
    itemName: 'Dulap incastrare electrocasnice',
    materialStepId: 'materialApplianceHousing',
    systemsStepId: 'systemsApplianceHousing',
  },
  {
    value: 'STORAGE',
    icon: 'archive',
    itemName: 'Dulapuri depozitare',
    materialStepId: 'materialStorage',
    systemsStepId: 'systemsStorage',
  },
  {
    value: 'COUNTERTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialCountertop',
    systemsStepId: 'systemsCountertop',
  },
  {
    value: 'SINK_UNIT',
    icon: 'droplets',
    itemName: 'Corp cuva tehnica',
    materialStepId: 'materialSinkUnit',
    systemsStepId: 'systemsSinkUnit',
  },
];

// blatul nu are fronturi → intrebarea lui de sisteme se elimina din flow
const NO_SYSTEMS_STEPS = new Set(['systemsCountertop']);

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

// MDF infoliat recomandat cand incaperea nu e ventilata (badge, nu restrictie)
const mdfRecommended: Condition = { questionId: 'ventilation', equals: 'NONE' };

export const laundryFlowV2: RoomFlow = {
  roomType: 'LAUNDRY',
  version: 2,
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
      options: pieceChoiceOptions(F, PIECES),
    },
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
    ...withRecommendedMaterial(
      pieceConfigSteps(F, PIECES).filter((s) => !NO_SYSTEMS_STEPS.has(s.id)),
      'MDF_INFOLIAT',
      mdfRecommended,
    ),
    {
      id: 'sketch',
      type: 'upload',
      titleKey: `${F}.sketch.title`,
      subtitleKey: `${F}.sketch.subtitle`,
      optional: true,
      maxFiles: 7,
    },
  ],
  deriveRoom: (answers) => ({
    lengthM: linearMeters(dimensionsStep, answers),
    widthM: STANDARD_CABINET_DEPTH,
    heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    items: buildPerPieceItems(answers, PIECES, 'Mobilier spalatorie'),
  }),
};
