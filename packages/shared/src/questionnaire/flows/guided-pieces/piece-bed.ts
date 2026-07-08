import type { Material } from '../../../enums';
import type { RoomFlow } from '../../types';
import { answerString, pieceMaterialStep, pieceSketchStep } from './builder';

// Piesa ghidata: Pat / rama pat. Fara slot de dimensiuni libere — dimensiunile
// standard de saltea sunt un single-choice educativ. Chei i18n sub 'flows.PIECE_BED.*'.

const F = 'flows.PIECE_BED';

// latimea saltelei standard → metri liniari derivati
const BED_WIDTH: Record<string, number> = {
  S_90: 0.9,
  M_140: 1.4,
  Q_160: 1.6,
  K_180: 1.8,
};

const STORAGE_LABEL: Record<string, string> = {
  LIFT_UP: 'lada cu mecanism rabatabil',
  DRAWERS: 'sertare laterale',
};

export const pieceBedFlow: RoomFlow = {
  roomType: 'PIECE_BED',
  version: 1,
  steps: [
    {
      id: 'bedSize',
      type: 'single-choice',
      titleKey: `${F}.bedSize.title`,
      subtitleKey: `${F}.bedSize.subtitle`,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.bedSize.info.title`,
        bodyKey: `${F}.bedSize.info.body`,
      },
      options: ['S_90', 'M_140', 'Q_160', 'K_180'].map((value) => ({
        value,
        labelKey: `${F}.bedSize.options.${value}.label`,
        descriptionKey: `${F}.bedSize.options.${value}.description`,
        icon: value === 'S_90' ? 'bed-single' : 'bed-double',
      })),
    },
    {
      // lipsa raspuns = pat netapitat
      id: 'upholstered',
      type: 'boolean',
      titleKey: `${F}.upholstered.title`,
      optional: true,
      screenGroup: 'config',
      info: {
        titleKey: `${F}.upholstered.info.title`,
        bodyKey: `${F}.upholstered.info.body`,
      },
    },
    {
      id: 'storage',
      type: 'single-choice',
      titleKey: `${F}.storage.title`,
      subtitleKey: `${F}.storage.subtitle`,
      options: [
        { value: 'NONE', icon: 'minus' },
        { value: 'LIFT_UP', icon: 'arrow-up-from-line', scoring: { category: 'BED_STORAGE', optionKey: 'LIFT_UP' } },
        { value: 'DRAWERS', icon: 'archive', scoring: { category: 'BED_STORAGE', optionKey: 'DRAWERS' } },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.storage.options.${o.value}.label`,
        descriptionKey: `${F}.storage.options.${o.value}.description`,
        info: {
          titleKey: `${F}.storage.options.${o.value}.info.title`,
          bodyKey: `${F}.storage.options.${o.value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.storage.options.${o.value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.storage.options.${o.value}.info.cons${i}`),
          priceHintKey: `${F}.storage.options.${o.value}.info.price`,
        },
      })),
    },
    pieceMaterialStep(F),
    pieceSketchStep(F),
  ],
  deriveRoom: (answers) => {
    const size = answerString(answers, 'bedSize', 'Q_160');
    const storage = answerString(answers, 'storage', 'NONE');
    const upholstered = answers.upholstered === true;
    const details: string[] = [`saltea ${size.replace(/^[A-Z]_/, '')}x200`];
    if (STORAGE_LABEL[storage]) details.push(STORAGE_LABEL[storage]);
    return {
      lengthM: BED_WIDTH[size] ?? 1.6,
      // adancimea piesei = lungimea patului
      widthM: 2.0,
      heightM: 1.0,
      items: [
        {
          name: upholstered ? 'Pat tapitat' : 'Pat',
          material: (answers.material as Material) ?? 'PAL',
          systems: [],
          description: details.join(', '),
          quantity: 1,
        },
      ],
    };
  },
};
