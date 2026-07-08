import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { ChoiceOption, Condition, DimensionGroupStep, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Flow balcon (v1, nou 2026-07): calificare inchis/deschis (educativ — PAL/MDF
// doar la balcon inchis) → piese → dimensiuni (lungime + adancime libera) →
// material (lemn masiv recomandat daca e deschis) → schita.
// Chei i18n sub 'flows.BALCONY.*'.

const F = 'flows.BALCONY';

const PIECES: PieceDef[] = [
  { value: 'STORAGE_BENCH', icon: 'armchair', itemName: 'Banca cu depozitare' },
  { value: 'TALL_CABINET', icon: 'door-closed', itemName: 'Dulap balcon' },
  { value: 'WORKTOP', icon: 'ruler', itemName: 'Blat de lucru' },
  { value: 'SHELVES', icon: 'rows-3', itemName: 'Rafturi balcon' },
];

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

function balconyMaterialOptions(): ChoiceOption[] {
  return materialOptions().map((o) =>
    o.value === 'LEMN_MASIV' ? { ...o, recommendedIf: woodRecommended } : o,
  );
}

export const balconyFlow: RoomFlow = {
  roomType: 'BALCONY',
  version: 1,
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
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      options: balconyMaterialOptions(),
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
    // adancimea mobilierului nu poate depasi adancimea libera a balconului
    const depth = Math.min(values.balconyDepth ?? STANDARD_CABINET_DEPTH, STANDARD_CABINET_DEPTH);
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: depth,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: buildPiecesItems(answers, PIECES, 'Mobilier balcon'),
    };
  },
};
