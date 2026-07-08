import type { Material } from '../../../enums';
import { dimensionValues } from '../../mapping';
import type { DimensionGroupStep, DimensionSlot, RoomFlow } from '../../types';
import { linearSlot } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Masa (dining / cafea / consola). Chei i18n sub 'flows.PIECE_TABLE.*'.

const F = 'flows.PIECE_TABLE';

// lungimi tipice per tip de masa
const LENGTH_RANGE: Record<string, { min: number; max: number }> = {
  DINING: { min: 1.2, max: 3 },
  COFFEE: { min: 0.5, max: 1.5 },
  CONSOLE: { min: 0.6, max: 2 },
};

const TABLE_HEIGHT: Record<string, number> = {
  DINING: 0.75,
  COFFEE: 0.45,
  CONSOLE: 0.8,
};

const ITEM_NAME: Record<string, string> = {
  DINING: 'Masa dining',
  COFFEE: 'Masuta cafea',
  CONSOLE: 'Consola',
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    if (answers.shape === 'ROUND') {
      return [linearSlot('diameter', `${F}.dimensions.slots.diameter`, { min: 0.7, max: 1.8 })];
    }
    const type = typeof answers.tableType === 'string' ? answers.tableType : 'DINING';
    const range = LENGTH_RANGE[type] ?? LENGTH_RANGE.DINING;
    const width: DimensionSlot = {
      id: 'width',
      labelKey: `${F}.dimensions.slots.width`,
      unit: 'm',
      min: 0.4,
      max: 1.2,
      step: 0.05,
    };
    return [linearSlot('length', `${F}.dimensions.slots.length`, range), width];
  },
};

export const pieceTableFlow: RoomFlow = {
  roomType: 'PIECE_TABLE',
  version: 1,
  steps: [
    {
      id: 'tableType',
      type: 'single-choice',
      titleKey: `${F}.tableType.title`,
      subtitleKey: `${F}.tableType.subtitle`,
      options: [
        { value: 'DINING', icon: 'utensils' },
        { value: 'COFFEE', icon: 'coffee' },
        { value: 'CONSOLE', icon: 'panel-top' },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.tableType.options.${o.value}.label`,
        descriptionKey: `${F}.tableType.options.${o.value}.description`,
      })),
    },
    {
      id: 'shape',
      type: 'single-choice',
      titleKey: `${F}.shape.title`,
      subtitleKey: `${F}.shape.subtitle`,
      screenGroup: 'shape',
      options: [
        { value: 'RECTANGULAR', icon: 'rectangle-horizontal' },
        { value: 'ROUND', icon: 'circle' },
        {
          value: 'EXTENDABLE',
          icon: 'unfold-horizontal',
          visibleIf: { questionId: 'tableType', equals: 'DINING' },
          scoring: { category: 'TABLE_EXTENDABLE', optionKey: 'YES' },
        },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.shape.options.${o.value}.label`,
        descriptionKey: `${F}.shape.options.${o.value}.description`,
        info: {
          titleKey: `${F}.shape.options.${o.value}.info.title`,
          bodyKey: `${F}.shape.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.shape.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.shape.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.shape.options.${o.value}.info.price`,
        },
      })),
    },
    {
      id: 'seats',
      type: 'single-choice',
      titleKey: `${F}.seats.title`,
      visibleIf: { questionId: 'tableType', equals: 'DINING' },
      screenGroup: 'shape',
      info: {
        titleKey: `${F}.seats.info.title`,
        bodyKey: `${F}.seats.info.body`,
      },
      options: ['FOUR', 'SIX', 'EIGHT_PLUS'].map((value) => ({
        value,
        labelKey: `${F}.seats.options.${value}.label`,
      })),
    },
    dimensionsStep,
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const type = answerString(answers, 'tableType', 'DINING');
    const isRound = answers.shape === 'ROUND';
    const details: string[] = [];
    if (answers.shape === 'EXTENDABLE') details.push('extensibila');
    if (isRound) details.push('rotunda');
    if (typeof answers.seats === 'string') details.push(`${answers.seats} locuri`);
    return {
      lengthM: isRound ? (values.diameter ?? 0) : (values.length ?? 0),
      widthM: isRound ? (values.diameter ?? 1) : (values.width ?? 0.8),
      heightM: TABLE_HEIGHT[type] ?? 0.75,
      items: [
        {
          name: ITEM_NAME[type] ?? 'Masa',
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          description: details.length > 0 ? details.join(', ') : undefined,
          quantity: 1,
        },
      ],
    };
  },
};
