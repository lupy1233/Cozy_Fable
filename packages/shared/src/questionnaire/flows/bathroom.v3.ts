import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Baie v3 (etapa 6, DESIGN §5.6):
// - fiecare piesa are material (setul BODY + "Integral din MDF") si deschidere NOUA
//   (systemsVanity / systemsMirror / systemsTall), pe acelasi ecran `piece:<VALUE>`;
// - intrebarea comuna "acelasi material si aceeasi deschidere" pe ecranul pieselor;
// - fara ventilatie: MDF infoliat "Recomandat" pe materialul pieselor si pe materialAll.
// v2 ramane FROZEN in bathroom.v2.ts.

const F = 'flows.BATHROOM';
const V = `${F}.v3`;

const PIECES: FinishPieceDef[] = [
  {
    value: 'VANITY_UNIT',
    icon: 'droplets',
    itemName: 'Corp lavoar',
    materialStepId: 'materialVanity',
    systemsStepId: 'systemsVanity',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V}.materialVanity.title`,
    systemsTitleKey: `${V}.systemsVanity.title`,
  },
  {
    value: 'MIRROR_CABINET',
    icon: 'square',
    itemName: 'Dulap oglindă',
    materialStepId: 'materialMirror',
    systemsStepId: 'systemsMirror',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V}.materialMirror.title`,
    systemsTitleKey: `${V}.systemsMirror.title`,
  },
  {
    value: 'TALL_STORAGE',
    icon: 'rows-3',
    itemName: 'Coloană baie',
    materialStepId: 'materialTall',
    systemsStepId: 'systemsTall',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V}.materialTall.title`,
    systemsTitleKey: `${V}.systemsTall.title`,
  },
];

// MDF infoliat recomandat cand baia nu e ventilata (badge, nu restrictie)
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'MDF_INFOLIAT', cond: { questionId: 'ventilation', equals: 'NONE' } },
};

// slotul de latime al fiecarei piese (intra in metri liniari) — ca in v2
const PIECE_WIDTH_SLOTS: Record<string, () => DimensionSlot> = {
  VANITY_UNIT: () => linearSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.4, max: 3 }),
  MIRROR_CABINET: () =>
    linearSlot('mirrorWidth', `${F}.dimensions.slots.mirrorWidth`, { min: 0.3, max: 2 }),
  TALL_STORAGE: () =>
    linearSlot('tallStorageWidth', `${F}.dimensions.slots.tallStorageWidth`, { min: 0.3, max: 1.5 }),
};

function selectedPieces(answers: AnswerMap): string[] {
  return Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = selectedPieces(answers)
      .filter((p) => PIECE_WIDTH_SLOTS[p])
      .map((p) => PIECE_WIDTH_SLOTS[p]());
    slots.push(ceilingHeightSlot());
    return slots;
  },
};

export const bathroomFlowV3: RoomFlow = {
  roomType: 'BATHROOM',
  version: 3,
  steps: [
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier baie');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
