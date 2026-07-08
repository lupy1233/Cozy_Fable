import type { ItemSystem, Material } from '../../../enums';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, STANDARD_CABINET_DEPTH } from '../../mapping';
import type { DimensionGroupStep, RoomFlow } from '../../types';
import { ceilingHeightSlot, linearSlot } from '../common';
import { answerString, pieceMaterialWithSystems, pieceSketchStep } from './builder';

// Piesa ghidata: Comoda TV / perete media. Chei i18n sub 'flows.PIECE_TV_UNIT.*'.

const F = 'flows.PIECE_TV_UNIT';

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${F}.dimensions.subtitle`,
  slots: (answers) => {
    const slots = [linearSlot('width', `${F}.dimensions.slots.width`, { min: 1, max: 5 })];
    // peretele media urca pana in tavan — cerem inaltimea camerei
    if (answers.style === 'MEDIA_WALL') slots.push(ceilingHeightSlot());
    return slots;
  },
};

export const pieceTvUnitFlow: RoomFlow = {
  roomType: 'PIECE_TV_UNIT',
  version: 1,
  steps: [
    {
      id: 'style',
      type: 'single-choice',
      titleKey: `${F}.style.title`,
      subtitleKey: `${F}.style.subtitle`,
      screenGroup: 'config',
      options: [
        { value: 'LOW_UNIT', icon: 'tv' },
        { value: 'MEDIA_WALL', icon: 'gallery-vertical-end', scoring: { category: 'TV_MEDIA_WALL', optionKey: 'YES' } },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.style.options.${o.value}.label`,
        descriptionKey: `${F}.style.options.${o.value}.description`,
        info: {
          titleKey: `${F}.style.options.${o.value}.info.title`,
          bodyKey: `${F}.style.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.style.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.style.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.style.options.${o.value}.info.price`,
        },
      })),
    },
    {
      id: 'tvSetup',
      type: 'single-choice',
      titleKey: `${F}.tvSetup.title`,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.tvSetup.info.title`,
        bodyKey: `${F}.tvSetup.info.body`,
      },
      options: ['TV_ON_WALL', 'TV_ON_UNIT', 'UNDECIDED'].map((value) => ({
        value,
        labelKey: `${F}.tvSetup.options.${value}.label`,
      })),
    },
    dimensionsStep,
    ...pieceMaterialWithSystems(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const isMediaWall = answers.style === 'MEDIA_WALL';
    const systems = Array.isArray(answers.openingSystems)
      ? (answers.openingSystems as ItemSystem[])
      : [];
    return {
      lengthM: values.width ?? 0,
      widthM: STANDARD_CABINET_DEPTH,
      heightM: isMediaWall ? (values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT) : 0.6,
      items: [
        {
          name: isMediaWall ? 'Perete media TV' : 'Comoda TV',
          material: (answers.material as Material) ?? 'PAL',
          systems,
          description: `TV: ${answerString(answers, 'tvSetup', 'UNDECIDED')}`,
          quantity: 1,
        },
      ],
    };
  },
};
