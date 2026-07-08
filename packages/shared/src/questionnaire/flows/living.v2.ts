import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { DimensionGroupStep, DimensionSlot, RoomFlow, TextStep } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { pieceChoiceOptions } from './pieces-flow';
import {
  buildPerPieceItems,
  pieceConfigSteps,
  selectedPieces,
  type PieceWithMaterialDef,
} from './per-piece';

// Living v2 (uniformizare 2026-07, decizie PO):
// - dimensiuni per piesa selectata (nu un singur perete);
// - stil TV cu scoring TV_MEDIA_WALL; iluminare LED optionala; upload schita.
// Feedback PO F4 (item 10): piesa libera "Altceva" cu text pe acelasi ecran;
// zona TV = suspendata / pe pardoseala / ansamblu cu dulapuri stanga-dreapta;
// material + sistem de deschidere PER PIESA (ecran propriu per piesa, cu
// iconul piesei), cu setul de materiale de la bucatarie.
// v1 ramane FROZEN in living.ts.

const F = 'flows.LIVING';

const PIECES: PieceWithMaterialDef[] = [
  { value: 'TV_UNIT', icon: 'tv', itemName: 'Comoda TV', materialStepId: 'materialTvUnit', systemsStepId: 'systemsTvUnit' },
  { value: 'BOOKSHELF', icon: 'library', itemName: 'Biblioteca', materialStepId: 'materialBookshelf', systemsStepId: 'systemsBookshelf' },
  { value: 'DISPLAY_CABINET', icon: 'gallery-vertical-end', itemName: 'Vitrina', materialStepId: 'materialDisplay', systemsStepId: 'systemsDisplay' },
  { value: 'COFFEE_TABLE', icon: 'table', itemName: 'Masuta cafea', materialStepId: 'materialCoffeeTable', systemsStepId: 'systemsCoffeeTable' },
  { value: 'WALL_SHELVES', icon: 'rows-3', itemName: 'Rafturi suspendate', materialStepId: 'materialShelves', systemsStepId: 'systemsShelves' },
  // piesa libera (item 10.1): numele vine din textul clientului la derive
  { value: 'OTHER', icon: 'plus', itemName: 'Alta piesa living', materialStepId: 'materialOtherPiece', systemsStepId: 'systemsOtherPiece' },
];

// textul piesei libere — pe acelasi ecran cu lista de piese
const piecesOtherStep: TextStep = {
  id: 'piecesOtherText',
  type: 'text',
  maxLength: 120,
  titleKey: `${F}.piecesOtherText.title`,
  subtitleKey: `${F}.piecesOtherText.subtitle`,
  screenGroup: 'pieces',
  visibleIf: { questionId: 'piecesNeeded', in: ['OTHER'] },
};

const PIECE_WIDTH_SLOTS: Record<string, () => DimensionSlot> = {
  TV_UNIT: () => linearSlot('tvUnitWidth', `${F}.dimensions.slots.tvUnitWidth`, { min: 1, max: 5 }),
  BOOKSHELF: () =>
    linearSlot('bookshelfWidth', `${F}.dimensions.slots.bookshelfWidth`, { min: 0.4, max: 4 }),
  DISPLAY_CABINET: () =>
    linearSlot('displayWidth', `${F}.dimensions.slots.displayWidth`, { min: 0.4, max: 2.5 }),
  COFFEE_TABLE: () =>
    linearSlot('coffeeTableLength', `${F}.dimensions.slots.coffeeTableLength`, { min: 0.5, max: 1.5 }),
  WALL_SHELVES: () =>
    linearSlot('shelvesTotal', `${F}.dimensions.slots.shelvesTotal`, { min: 0.4, max: 6 }),
  OTHER: () => linearSlot('otherWidth', `${F}.dimensions.slots.otherWidth`, { min: 0.3, max: 6 }),
};

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

// numele comodei TV dupa stilul zonei TV (item 10.2)
const TV_ITEM_NAME: Record<string, string> = {
  FLOATING: 'Comoda TV suspendata',
  ON_FLOOR: 'Comoda TV',
  COMPLEX_UNIT: 'Ansamblu TV cu dulapuri',
};

export const livingFlowV2: RoomFlow = {
  roomType: 'LIVING',
  version: 2,
  steps: [
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      screenGroup: 'pieces',
      minSelected: 1,
      options: pieceChoiceOptions(F, PIECES),
    },
    piecesOtherStep,
    {
      id: 'tvStyle',
      type: 'single-choice',
      titleKey: `${F}.tvStyle.title`,
      subtitleKey: `${F}.tvStyle.subtitle`,
      visibleIf: { questionId: 'piecesNeeded', in: ['TV_UNIT'] },
      options: [
        { value: 'FLOATING', icon: 'align-end-horizontal' },
        { value: 'ON_FLOOR', icon: 'tv' },
        {
          value: 'COMPLEX_UNIT',
          icon: 'gallery-vertical-end',
          scoring: { category: 'TV_MEDIA_WALL', optionKey: 'YES' },
        },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.tvStyle.options.${o.value}.label`,
        descriptionKey: `${F}.tvStyle.options.${o.value}.description`,
        info: {
          titleKey: `${F}.tvStyle.options.${o.value}.info.title`,
          bodyKey: `${F}.tvStyle.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.tvStyle.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.tvStyle.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.tvStyle.options.${o.value}.info.price`,
        },
      })),
    },
    dimensionsStep,
    ...pieceConfigSteps(F, PIECES),
    {
      // lipsa raspuns = fara iluminare LED
      id: 'ledLighting',
      type: 'boolean',
      titleKey: `${F}.ledLighting.title`,
      subtitleKey: `${F}.ledLighting.subtitle`,
      optional: true,
      info: {
        titleKey: `${F}.ledLighting.info.title`,
        bodyKey: `${F}.ledLighting.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.ledLighting.info.pros${i}`),
        consKeys: [1].map((i) => `${F}.ledLighting.info.cons${i}`),
        priceHintKey: `${F}.ledLighting.info.price`,
      },
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
    const items = buildPerPieceItems(answers, PIECES, 'Mobilier living');
    const tvStyle = typeof answers.tvStyle === 'string' ? answers.tvStyle : undefined;
    const otherName =
      typeof answers.piecesOtherText === 'string' && answers.piecesOtherText.trim()
        ? answers.piecesOtherText.trim()
        : undefined;
    for (const item of items) {
      if (item.name === 'Comoda TV' && tvStyle && TV_ITEM_NAME[tvStyle]) {
        item.name = TV_ITEM_NAME[tvStyle];
      }
      if (item.name === 'Alta piesa living' && otherName) {
        item.name = otherName;
      }
      if (
        answers.ledLighting === true &&
        (item.name === TV_ITEM_NAME.FLOATING ||
          item.name === TV_ITEM_NAME.ON_FLOOR ||
          item.name === TV_ITEM_NAME.COMPLEX_UNIT)
      ) {
        item.description = item.description
          ? `${item.description}; Cu iluminare LED`
          : 'Cu iluminare LED';
      }
    }
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
