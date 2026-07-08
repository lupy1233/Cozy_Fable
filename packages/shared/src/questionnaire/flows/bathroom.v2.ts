import type { Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import {
  DEFAULT_CEILING_HEIGHT,
  dimensionValues,
  linearMeters,
  STANDARD_CABINET_DEPTH,
} from '../mapping';
import type {
  AnswerMap,
  ChoiceOption,
  Condition,
  DimensionGroupStep,
  DimensionSlot,
  RoomFlow,
} from '../types';
import {
  ceilingHeightSlot,
  linearSlot,
  materialOptions,
  OFFERED_MATERIALS,
  otherMaterialStep,
} from './common';
import { pieceChoiceOptions, type PieceDef } from './pieces-flow';

// Baie v2 (overhaul 2026-07):
// - dimensiuni per piesa selectata (nu doar lavoarul);
// - intrebare noua de VENTILATIE inainte de materiale; fara ventilatie,
//   MDF primeste badge "Recomandat" (recommendedIf) — orice optiune ramane valida;
// - material separat per piesa (lavoar / dulap oglinda / coloana);
// - notes inlocuit cu upload schita/proiect.

const F = 'flows.BATHROOM';

const PIECES: PieceDef[] = [
  { value: 'VANITY_UNIT', icon: 'droplets', itemName: 'Corp lavoar' },
  { value: 'MIRROR_CABINET', icon: 'square', itemName: 'Dulap oglinda' },
  { value: 'TALL_STORAGE', icon: 'rows-3', itemName: 'Coloana baie' },
];

// slotul de latime al fiecarei piese (intra in metri liniari)
const PIECE_WIDTH_SLOTS: Record<string, () => DimensionSlot> = {
  VANITY_UNIT: () => linearSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.4, max: 3 }),
  MIRROR_CABINET: () =>
    linearSlot('mirrorWidth', `${F}.dimensions.slots.mirrorWidth`, { min: 0.3, max: 2 }),
  TALL_STORAGE: () =>
    linearSlot('tallStorageWidth', `${F}.dimensions.slots.tallStorageWidth`, { min: 0.3, max: 1.5 }),
};

// intrebarea de material a fiecarei piese
const PIECE_MATERIAL_STEP: Record<string, string> = {
  VANITY_UNIT: 'materialVanity',
  MIRROR_CABINET: 'materialMirror',
  TALL_STORAGE: 'materialTall',
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

// MDF infoliat recomandat cand baia nu e ventilata (badge, nu restrictie) —
// folia PVC rezista la umezeala; setul de materiale = cel de la bucatarie (item 13)
const mdfRecommended: Condition = { questionId: 'ventilation', equals: 'NONE' };

function bathMaterialOptions(): ChoiceOption[] {
  return materialOptions(OFFERED_MATERIALS).map((o) =>
    o.value === 'MDF_INFOLIAT' ? { ...o, recommendedIf: mdfRecommended } : o,
  );
}

function pieceMaterialSteps(pieceValue: string) {
  const id = PIECE_MATERIAL_STEP[pieceValue];
  const ifSelected: Condition = { questionId: 'piecesNeeded', in: [pieceValue] };
  return [
    {
      id,
      type: 'single-choice' as const,
      titleKey: `${F}.${id}.title`,
      subtitleKey: `${F}.${id}.subtitle`,
      visibleIf: ifSelected,
      screenGroup: `piece:${pieceValue}`,
      options: bathMaterialOptions(),
    },
    {
      ...otherMaterialStep(id, `piece:${pieceValue}`),
      visibleIf: { all: [ifSelected, { questionId: id, equals: 'ALTUL' }] } as Condition,
    },
  ];
}

export const bathroomFlowV2: RoomFlow = {
  roomType: 'BATHROOM',
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
    ...pieceMaterialSteps('VANITY_UNIT'),
    ...pieceMaterialSteps('MIRROR_CABINET'),
    ...pieceMaterialSteps('TALL_STORAGE'),
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
    const selected = selectedPieces(answers);
    const items: RequestItemInput[] = PIECES.filter((d) => selected.includes(d.value)).map((d) => {
      const materialId = PIECE_MATERIAL_STEP[d.value];
      const material = (answers[materialId] as Material) ?? 'PAL';
      const otherText = answers[`${materialId}Other`];
      return {
        name: d.itemName,
        material,
        systems: [],
        description:
          material === 'ALTUL' && typeof otherText === 'string' && otherText.trim()
            ? `Material dorit: ${otherText.trim()}`
            : undefined,
        quantity: d.quantity ?? 1,
      };
    });
    if (items.length === 0) {
      items.push({ name: 'Mobilier baie', material: 'PAL', systems: [], quantity: 1 });
    }
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
    };
  },
};
