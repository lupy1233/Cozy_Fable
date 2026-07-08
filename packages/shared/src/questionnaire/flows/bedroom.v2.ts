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

// Dormitor v2 (uniformizare 2026-07, decizie PO):
// - detalii dedicate pentru dulap si pat; masuta de toaleta la piese;
//   noptierele una sau pereche; dimensiuni per piesa; upload schita.
// Feedback PO F4 (item 11):
// - "pana in tavan" ELIMINAT de la dulap (11.1);
// - dimensiune saltea: card "Dimensiuni custom" care deschide inputurile pe
//   acelasi ecran (11.2); depozitarea sub pat si patul tapitat au fiecare
//   intrebarea lor (fara 2-in-1); tapitarea = intrebare Da/Nu de sine
//   statatoare dupa depozitare (plasare aleasa de noi — PO nu a decis);
// - noptierele (una/pereche) intrebare separata (11.3);
// - material + sistem de deschidere per piesa, set bucatarie (11.4).
// v1 ramane FROZEN in bedroom.ts.

const F = 'flows.BEDROOM';

const PIECES: PieceWithMaterialDef[] = [
  { value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap dormitor', materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe' },
  { value: 'BED_FRAME', icon: 'bed-double', itemName: 'Cadru pat', materialStepId: 'materialBed', systemsStepId: 'systemsBed' },
  { value: 'NIGHTSTANDS', icon: 'lamp', itemName: 'Noptiere', materialStepId: 'materialNightstands', systemsStepId: 'systemsNightstands', quantity: 2 },
  { value: 'DRESSER', icon: 'archive', itemName: 'Comoda', materialStepId: 'materialDresser', systemsStepId: 'systemsDresser' },
  { value: 'TV_UNIT', icon: 'tv', itemName: 'Comoda TV', materialStepId: 'materialTvUnit', systemsStepId: 'systemsTvUnit' },
  { value: 'VANITY', icon: 'sparkles', itemName: 'Masuta toaleta', materialStepId: 'materialVanity', systemsStepId: 'systemsVanity' },
];

// latimea saltelei standard → nu cerem slot liber pentru pat
const BED_WIDTH: Record<string, number> = {
  S_90: 0.9,
  M_140: 1.4,
  Q_160: 1.6,
  K_180: 1.8,
};

const PIECE_WIDTH_SLOTS: Record<string, () => DimensionSlot> = {
  WARDROBE: () =>
    linearSlot('wardrobeWidth', `${F}.dimensions.slots.wardrobeWidth`, { min: 0.6, max: 6 }),
  DRESSER: () =>
    linearSlot('dresserWidth', `${F}.dimensions.slots.dresserWidth`, { min: 0.6, max: 2.5 }),
  TV_UNIT: () =>
    linearSlot('tvUnitWidth', `${F}.dimensions.slots.tvUnitWidth`, { min: 0.8, max: 4 }),
  VANITY: () =>
    linearSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.6, max: 1.8 }),
  NIGHTSTANDS: () =>
    linearSlot('nightstandWidth', `${F}.dimensions.slots.nightstandWidth`, { min: 0.35, max: 0.8 }),
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

// dimensiunile saltelei custom — pe acelasi ecran cu alegerea marimii (11.2)
const bedCustomStep: DimensionGroupStep = {
  id: 'bedCustomSize',
  type: 'dimension-group',
  titleKey: `${F}.bedCustomSize.title`,
  screenGroup: 'bedSize',
  visibleIf: { questionId: 'bedSize', equals: 'CUSTOM' },
  slots: () => [
    { id: 'bedCustomWidth', labelKey: `${F}.bedCustomSize.slots.bedCustomWidth`, unit: 'm', min: 0.7, max: 2.2, step: 0.05 },
    { id: 'bedCustomLength', labelKey: `${F}.bedCustomSize.slots.bedCustomLength`, unit: 'm', min: 1.6, max: 2.4, step: 0.05 },
  ],
};

export const bedroomFlowV2: RoomFlow = {
  roomType: 'BEDROOM',
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
      // fara "pana in tavan" (11.1) — doar tipul usilor
      id: 'wardrobeDoorType',
      type: 'single-choice',
      titleKey: `${F}.wardrobeDoorType.title`,
      subtitleKey: `${F}.wardrobeDoorType.subtitle`,
      icon: 'door-closed',
      visibleIf: { questionId: 'piecesNeeded', in: ['WARDROBE'] },
      options: ['SLIDING', 'HINGED'].map((value) => ({
        value,
        labelKey: `${F}.wardrobeDoorType.options.${value}.label`,
        descriptionKey: `${F}.wardrobeDoorType.options.${value}.description`,
        icon: value === 'SLIDING' ? 'move-horizontal' : 'door-closed',
        info: {
          titleKey: `${F}.wardrobeDoorType.options.${value}.info.title`,
          bodyKey: `${F}.wardrobeDoorType.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.wardrobeDoorType.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.wardrobeDoorType.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.wardrobeDoorType.options.${value}.info.price`,
        },
      })),
    },
    {
      id: 'bedSize',
      type: 'single-choice',
      titleKey: `${F}.bedSize.title`,
      subtitleKey: `${F}.bedSize.subtitle`,
      icon: 'bed-double',
      visibleIf: { questionId: 'piecesNeeded', in: ['BED_FRAME'] },
      screenGroup: 'bedSize',
      info: {
        titleKey: `${F}.bedSize.info.title`,
        bodyKey: `${F}.bedSize.info.body`,
      },
      options: [
        ...['S_90', 'M_140', 'Q_160', 'K_180'].map((value) => ({
          value,
          labelKey: `${F}.bedSize.options.${value}.label`,
          descriptionKey: `${F}.bedSize.options.${value}.description`,
          icon: value === 'S_90' ? 'bed-single' : 'bed-double',
        })),
        // card "dimensiuni custom": selectarea deschide inputurile de mai jos (11.2)
        {
          value: 'CUSTOM',
          labelKey: `${F}.bedSize.options.CUSTOM.label`,
          descriptionKey: `${F}.bedSize.options.CUSTOM.description`,
          icon: 'ruler',
        },
      ],
    },
    bedCustomStep,
    {
      // intrebare de sine statatoare (11.2 — fara 2-in-1)
      id: 'bedStorage',
      type: 'single-choice',
      titleKey: `${F}.bedStorage.title`,
      icon: 'bed-double',
      visibleIf: { questionId: 'piecesNeeded', in: ['BED_FRAME'] },
      options: [
        { value: 'NONE', icon: 'minus' },
        {
          value: 'LIFT_UP',
          icon: 'arrow-up-from-line',
          scoring: { category: 'BED_STORAGE', optionKey: 'LIFT_UP' },
        },
        {
          value: 'DRAWERS',
          icon: 'archive',
          scoring: { category: 'BED_STORAGE', optionKey: 'DRAWERS' },
        },
      ].map((o) => ({
        ...o,
        labelKey: `${F}.bedStorage.options.${o.value}.label`,
        info: {
          titleKey: `${F}.bedStorage.options.${o.value}.info.title`,
          bodyKey: `${F}.bedStorage.options.${o.value}.info.body`,
          priceHintKey: `${F}.bedStorage.options.${o.value}.info.price`,
        },
      })),
    },
    {
      // intrebare Da/Nu de sine statatoare — plasare aleasa de noi (PO nu a decis)
      id: 'bedUpholstered',
      type: 'boolean',
      titleKey: `${F}.bedUpholstered.title`,
      icon: 'bed-double',
      visibleIf: { questionId: 'piecesNeeded', in: ['BED_FRAME'] },
      info: {
        titleKey: `${F}.bedUpholstered.info.title`,
        bodyKey: `${F}.bedUpholstered.info.body`,
      },
    },
    {
      // intrebare separata (11.3)
      id: 'nightstandsCount',
      type: 'single-choice',
      titleKey: `${F}.nightstandsCount.title`,
      icon: 'lamp',
      visibleIf: { questionId: 'piecesNeeded', in: ['NIGHTSTANDS'] },
      info: {
        titleKey: `${F}.nightstandsCount.info.title`,
        bodyKey: `${F}.nightstandsCount.info.body`,
      },
      options: ['ONE', 'TWO'].map((value) => ({
        value,
        labelKey: `${F}.nightstandsCount.options.${value}.label`,
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
  deriveRoom: (answers) => {
    const items = buildPerPieceItems(answers, PIECES, 'Mobilier dormitor');
    const bedSize = typeof answers.bedSize === 'string' ? answers.bedSize : undefined;
    const custom = dimensionValues(answers, 'bedCustomSize');
    for (const item of items) {
      if (item.name === 'Cadru pat') {
        const details: string[] = [];
        if (bedSize === 'CUSTOM' && custom.bedCustomWidth && custom.bedCustomLength) {
          details.push(
            `saltea custom ${Math.round(custom.bedCustomWidth * 100)}x${Math.round(custom.bedCustomLength * 100)} cm`,
          );
        } else if (bedSize) {
          details.push(`saltea ${bedSize.replace(/^[A-Z]_/, '')}x200`);
        }
        if (answers.bedStorage === 'LIFT_UP') details.push('lada rabatabila');
        if (answers.bedStorage === 'DRAWERS') details.push('sertare laterale');
        if (answers.bedUpholstered === true) {
          item.name = 'Pat tapitat';
        }
        if (details.length > 0) {
          item.description = item.description
            ? `${item.description}; ${details.join(', ')}`
            : details.join(', ');
        }
      }
      if (item.name === 'Noptiere' && answers.nightstandsCount === 'ONE') {
        item.quantity = 1;
      }
    }
    // latimea patului intra in metri liniari desi nu are slot liber
    const bedLinear =
      bedSize === 'CUSTOM'
        ? (custom.bedCustomWidth ?? 0)
        : bedSize
          ? (BED_WIDTH[bedSize] ?? 0)
          : 0;
    return {
      lengthM: linearMeters(dimensionsStep, answers) + bedLinear,
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
