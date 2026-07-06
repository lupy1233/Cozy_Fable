import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingHeightSlot, linearSlot, materialOptions, systemOptions } from './common';
import { buildPiecesItems, pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Flow birou: forma biroului apare doar daca DESK e selectat, iar sloturile
// de dimensiuni ale biroului depind de forma. Chei i18n sub 'flows.OFFICE.*'.

const F = 'flows.OFFICE';

const PIECES: PieceDef[] = [
  { value: 'DESK', icon: 'monitor', itemName: 'Birou' },
  { value: 'BOOKSHELF', icon: 'library', itemName: 'Biblioteca' },
  { value: 'STORAGE', icon: 'archive', itemName: 'Dulap depozitare' },
];

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const slots = [
    linearSlot('spaceWidth', `${F}.dimensions.slots.spaceWidth`, { min: 1 }),
    ceilingHeightSlot(),
  ];
  const selected = Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
  if (selected.includes('DESK')) {
    const deskSlot = (id: string): DimensionSlot => ({
      id,
      labelKey: `${F}.dimensions.slots.${id}`,
      unit: 'm',
      min: 0.8,
      max: 3,
      step: 0.1,
    });
    if (answers.deskShape === 'L_SHAPE') {
      slots.push(deskSlot('deskWidthA'), deskSlot('deskWidthB'));
    } else {
      slots.push(deskSlot('deskWidth'));
    }
  }
  return slots;
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: dimensionSlots,
};

export const officeFlow: RoomFlow = {
  roomType: 'OFFICE',
  version: 1,
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
      visibleIf: { questionId: 'piecesNeeded', in: ['DESK'] },
      options: ['STRAIGHT', 'L_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.deskShape.options.${value}.label`,
        descriptionKey: `${F}.deskShape.options.${value}.description`,
        icon: value === 'STRAIGHT' ? 'minus' : 'corner-down-right',
      })),
    },
    {
      id: 'material',
      type: 'single-choice',
      titleKey: `${F}.material.title`,
      subtitleKey: `${F}.material.subtitle`,
      options: materialOptions(),
    },
    {
      id: 'openingSystems',
      type: 'multi-choice',
      titleKey: `${F}.openingSystems.title`,
      subtitleKey: `${F}.openingSystems.subtitle`,
      optional: true,
      options: systemOptions(),
    },
    dimensionsStep,
    {
      id: 'notes',
      type: 'text',
      titleKey: `${F}.notes.title`,
      subtitleKey: `${F}.notes.subtitle`,
      optional: true,
      maxLength: 2000,
      multiline: true,
    },
  ],
  deriveRoom: (answers) => ({
    lengthM: linearMeters(dimensionsStep, answers),
    widthM: STANDARD_CABINET_DEPTH,
    heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    items: buildPiecesItems(answers, PIECES, 'Mobilier birou'),
  }),
};
