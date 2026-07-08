import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { pieceChoiceOptions } from './pieces-flow';
import {
  buildPerPieceItems,
  pieceConfigSteps,
  selectedPieces,
  type PieceWithMaterialDef,
} from './per-piece';

// Birou (camera) v2 (uniformizare 2026-07, decizie PO):
// - rafturi de perete la piese; dimensiuni per piesa; upload schita.
// Feedback PO F4 (item 12): forma biroului include si U; intrebarea de canal
// de cabluri ELIMINATA; material + sistem de deschidere per piesa (set nou).
// v1 ramane FROZEN in office.ts.

const F = 'flows.OFFICE';

const PIECES: PieceWithMaterialDef[] = [
  { value: 'DESK', icon: 'monitor', itemName: 'Birou', materialStepId: 'materialDesk', systemsStepId: 'systemsDesk' },
  { value: 'BOOKSHELF', icon: 'library', itemName: 'Biblioteca', materialStepId: 'materialBookshelf', systemsStepId: 'systemsBookshelf' },
  { value: 'STORAGE', icon: 'archive', itemName: 'Dulap depozitare', materialStepId: 'materialStorage', systemsStepId: 'systemsStorage' },
  { value: 'WALL_SHELVES', icon: 'rows-3', itemName: 'Rafturi perete', materialStepId: 'materialShelves', systemsStepId: 'systemsShelves' },
];

const PIECE_WIDTH_SLOTS: Record<string, (answers: Record<string, unknown>) => DimensionSlot[]> = {
  DESK: (answers) => {
    const slots = [linearSlot('deskWidthA', `${F}.dimensions.slots.deskWidthA`, { min: 0.8, max: 3 })];
    if (answers.deskShape === 'L_SHAPE' || answers.deskShape === 'U_SHAPE') {
      slots.push(linearSlot('deskWidthB', `${F}.dimensions.slots.deskWidthB`, { min: 0.6, max: 2.5 }));
    }
    if (answers.deskShape === 'U_SHAPE') {
      slots.push(linearSlot('deskWidthC', `${F}.dimensions.slots.deskWidthC`, { min: 0.6, max: 2.5 }));
    }
    return slots;
  },
  BOOKSHELF: () => [
    linearSlot('bookshelfWidth', `${F}.dimensions.slots.bookshelfWidth`, { min: 0.4, max: 4 }),
  ],
  STORAGE: () => [
    linearSlot('storageWidth', `${F}.dimensions.slots.storageWidth`, { min: 0.5, max: 3 }),
  ],
  WALL_SHELVES: () => [
    linearSlot('shelvesTotal', `${F}.dimensions.slots.shelvesTotal`, { min: 0.4, max: 6 }),
  ],
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = selectedPieces(answers)
      .filter((p) => PIECE_WIDTH_SLOTS[p])
      .flatMap((p) => PIECE_WIDTH_SLOTS[p](answers));
    slots.push(ceilingHeightSlot());
    return slots;
  },
};

const DESK_SHAPE_ICONS: Record<string, string> = {
  STRAIGHT: 'minus',
  L_SHAPE: 'corner-down-right',
  U_SHAPE: 'square',
};

export const officeFlowV2: RoomFlow = {
  roomType: 'OFFICE',
  version: 2,
  steps: [
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      minSelected: 1,
      options: pieceChoiceOptions(F, PIECES),
    },
    {
      id: 'deskShape',
      type: 'single-choice',
      titleKey: `${F}.deskShape.title`,
      subtitleKey: `${F}.deskShape.subtitle`,
      icon: 'monitor',
      visibleIf: { questionId: 'piecesNeeded', in: ['DESK'] },
      options: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.deskShape.options.${value}.label`,
        descriptionKey: `${F}.deskShape.options.${value}.description`,
        icon: DESK_SHAPE_ICONS[value],
        info: {
          titleKey: `${F}.deskShape.options.${value}.info.title`,
          bodyKey: `${F}.deskShape.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.deskShape.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.deskShape.options.${value}.info.cons${i}`),
        },
      })),
    },
    dimensionsStep,
    ...pieceConfigSteps(F, PIECES),
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
    items: buildPerPieceItems(answers, PIECES, 'Mobilier birou'),
  }),
};
