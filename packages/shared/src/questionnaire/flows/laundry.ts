import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { ChoiceOption, Condition, DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Flow spalatorie/camera tehnica (v1, nou 2026-07): asezarea electrocasnicelor →
// piese → ventilatie (educativ, ca la baie v2) → dimensiuni → material (MDF
// recomandat fara ventilatie) → schita. Chei i18n sub 'flows.LAUNDRY.*'.

const F = 'flows.LAUNDRY';

const PIECES: PieceDef[] = [
  { value: 'APPLIANCE_HOUSING', icon: 'washing-machine', itemName: 'Dulap incastrare electrocasnice' },
  { value: 'STORAGE', icon: 'archive', itemName: 'Dulapuri depozitare' },
  { value: 'COUNTERTOP', icon: 'ruler', itemName: 'Blat de lucru' },
  { value: 'SINK_UNIT', icon: 'droplets', itemName: 'Corp cuva tehnica' },
];

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

// MDF recomandat cand incaperea nu e ventilata (badge, nu restrictie)
const mdfRecommended: Condition = { questionId: 'ventilation', equals: 'NONE' };

function laundryMaterialOptions(): ChoiceOption[] {
  return materialOptions().map((o) =>
    o.value === 'MDF' ? { ...o, recommendedIf: mdfRecommended } : o,
  );
}

export const laundryFlow: RoomFlow = {
  roomType: 'LAUNDRY',
  version: 1,
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
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      options: laundryMaterialOptions(),
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
  deriveRoom: (answers) => ({
    lengthM: linearMeters(dimensionsStep, answers),
    widthM: STANDARD_CABINET_DEPTH,
    heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    // material comun pe camera (answers.material) + fara sisteme daca nu se cer
    items: buildPiecesItems(answers, PIECES, 'Mobilier spalatorie'),
  }),
};
