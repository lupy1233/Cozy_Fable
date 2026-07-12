import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { Condition, DimensionGroupStep, DimensionSlot, RoomFlow, TextStep } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { pieceChoiceOptions } from './pieces-flow';
import {
  buildPerPieceItems,
  pieceConfigSteps,
  selectedPieces,
  type PieceWithMaterialDef,
} from './per-piece';

// Living v3 (feedback PO 2026-07-13, docs/12 S3):
// - dimensiuni per piesa cu LATIME si INALTIME (PO vrea inaltimea fiecarei
//   piese, nu doar a camerei); tavanul ramane pentru context;
// - iluminarea LED se alege PER CORP (ledPieces, multi-choice cu optiunile
//   piesele eligibile selectate), nu o singura intrebare pe camera;
// - restul identic cu v2 (piese, stil TV, material + deschidere per piesa).
// v2 ramane FROZEN in living.v2.ts.

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

// corpurile la care iluminarea LED are sens (masuta si piesa libera nu intra)
const LED_PIECES = ['TV_UNIT', 'BOOKSHELF', 'DISPLAY_CABINET', 'WALL_SHELVES'] as const;

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

function heightSlot(id: string, opts: { min: number; max: number }): DimensionSlot {
  return {
    id,
    labelKey: `${F}.dimensions.slots.${id}`,
    unit: 'm',
    min: opts.min,
    max: opts.max,
    step: 0.05,
  };
}

// latime + inaltime per piesa selectata (inaltimea NU intra in metri liniari)
const PIECE_DIMENSION_SLOTS: Record<string, () => DimensionSlot[]> = {
  TV_UNIT: () => [
    linearSlot('tvUnitWidth', `${F}.dimensions.slots.tvUnitWidth`, { min: 1, max: 5 }),
    heightSlot('tvUnitHeight', { min: 0.2, max: 2.8 }),
  ],
  BOOKSHELF: () => [
    linearSlot('bookshelfWidth', `${F}.dimensions.slots.bookshelfWidth`, { min: 0.4, max: 4 }),
    heightSlot('bookshelfHeight', { min: 0.6, max: 3 }),
  ],
  DISPLAY_CABINET: () => [
    linearSlot('displayWidth', `${F}.dimensions.slots.displayWidth`, { min: 0.4, max: 2.5 }),
    heightSlot('displayHeight', { min: 0.8, max: 2.8 }),
  ],
  COFFEE_TABLE: () => [
    linearSlot('coffeeTableLength', `${F}.dimensions.slots.coffeeTableLength`, { min: 0.5, max: 1.5 }),
    heightSlot('coffeeTableHeight', { min: 0.25, max: 0.6 }),
  ],
  WALL_SHELVES: () => [
    linearSlot('shelvesTotal', `${F}.dimensions.slots.shelvesTotal`, { min: 0.4, max: 6 }),
    heightSlot('shelvesHeight', { min: 0.2, max: 2.5 }),
  ],
  OTHER: () => [
    linearSlot('otherWidth', `${F}.dimensions.slots.otherWidth`, { min: 0.3, max: 6 }),
    heightSlot('otherHeight', { min: 0.2, max: 3 }),
  ],
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = selectedPieces(answers)
      .filter((p) => PIECE_DIMENSION_SLOTS[p])
      .flatMap((p) => PIECE_DIMENSION_SLOTS[p]());
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

const ifAnyLedPiece: Condition = { questionId: 'piecesNeeded', in: [...LED_PIECES] };

export const livingFlowV3: RoomFlow = {
  roomType: 'LIVING',
  version: 3,
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
      // LED per corp: bifezi corpurile care primesc banda LED; lipsa
      // raspuns / lista goala = fara LED (feedback PO 2026-07-13)
      id: 'ledPieces',
      type: 'multi-choice',
      titleKey: `${F}.ledPieces.title`,
      subtitleKey: `${F}.ledPieces.subtitle`,
      icon: 'lightbulb',
      optional: true,
      visibleIf: ifAnyLedPiece,
      info: {
        titleKey: `${F}.ledPieces.info.title`,
        bodyKey: `${F}.ledPieces.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.ledPieces.info.pros${i}`),
        consKeys: [1].map((i) => `${F}.ledPieces.info.cons${i}`),
        priceHintKey: `${F}.ledPieces.info.price`,
      },
      options: LED_PIECES.map((value) => {
        const def = PIECES.find((p) => p.value === value);
        return {
          value,
          labelKey: `${F}.piecesNeeded.options.${value}.label`,
          icon: def?.icon,
          // doar corpurile selectate la piese apar ca optiuni
          visibleIf: { questionId: 'piecesNeeded', in: [value] } as Condition,
        };
      }),
    },
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
    const items = buildPerPieceItems(answers, PIECES, 'Mobilier living');
    const selected = selectedPieces(answers);
    const selectedDefs = PIECES.filter((d) => selected.includes(d.value));
    const led = Array.isArray(answers.ledPieces) ? (answers.ledPieces as string[]) : [];
    // items pastreaza ordinea defs-urilor selectate → anotarea LED merge pe index
    if (items.length === selectedDefs.length) {
      items.forEach((item, i) => {
        if (led.includes(selectedDefs[i].value)) {
          item.description = item.description
            ? `${item.description}; Cu iluminare LED`
            : 'Cu iluminare LED';
        }
      });
    }
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
    }
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
