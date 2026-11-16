import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { finishDescription } from './finish-sets';
import { ceilingIfTall, informativeSlot, optionalHeightSlot, pieceWidthSlot } from './measure-sets';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Balcon v4 (etapa 10, DESIGN §5.9; c5 / d3):
// - lungimea si adancimea balconului raman obligatorii, dar doar informative (nu mai dau marimea, E10-N14);
// - latimea fiecarei piese bifate da marimea (PO c5-3: un raft mic pe un balcon lung nu mai costa
//   cat un balcon mobilat);
// - inaltimea optionala doar la dulap; tavanul doar cand dulapul e bifat.
// Restul identic cu v3 (aceleasi chei de material / deschidere). v3 ramane FROZEN in balcony.v3.ts.
// Pasii sunt construiti din nou aici: obiectele v3 nu se modifica.

const F = 'flows.BALCONY';
const V3 = `${F}.v3`;
const V = `${F}.v4`;

const PIECES: FinishPieceDef[] = [
  {
    value: 'STORAGE_BENCH',
    icon: 'armchair',
    itemName: 'Bancă cu ladă',
    materialStepId: 'materialStorageBench',
    systemsStepId: 'systemsStorageBench',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'MAYBE',
    materialTitleKey: `${V3}.materialStorageBench.title`,
  },
  {
    value: 'TALL_CABINET',
    icon: 'door-closed',
    itemName: 'Dulap balcon',
    materialStepId: 'materialTallCabinet',
    systemsStepId: 'systemsTallCabinet',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V3}.materialTallCabinet.title`,
  },
  {
    value: 'WORKTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialWorktop',
    materialSet: 'WORKTOP',
    fronts: 'NO',
    materialTitleKey: `${V3}.materialWorktop.title`,
  },
  {
    value: 'SHELVES',
    icon: 'rows-3',
    itemName: 'Rafturi balcon',
    materialStepId: 'materialShelves',
    materialSet: 'PANEL',
    fronts: 'NO',
    materialTitleKey: `${V3}.materialShelves.title`,
  },
];

// ca in v3: lemn masiv (tratat) recomandat cand balconul e deschis
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'LEMN_MASIV', cond: { questionId: 'enclosed', equals: 'OPEN' } },
};

// etapa 12 (c13, PO c13-1): nota pentru firma pe fiecare piesa cand balconul e deschis
// (doar pe v4; versiunile vechi raman identice)
export const BALCONY_OPEN_NOTE = 'Balcon deschis — exterior';

// piesele inalte (DESIGN tabelul 5.0): tavan + inaltime optionala
export const BALCONY_V4_TALL_PIECES = ['TALL_CABINET'] as const;

// sloturile fiecarei piese, in ordinea pieselor: latimea, apoi inaltimea (la piesele inalte)
const PIECE_SLOTS: Record<string, () => DimensionSlot[]> = {
  STORAGE_BENCH: () => [pieceWidthSlot('storageBenchWidth', `${F}.dimensions.slots.storageBenchWidth`, { min: 0.6, max: 3 })],
  TALL_CABINET: () => [
    pieceWidthSlot('tallCabinetWidth', `${F}.dimensions.slots.tallCabinetWidth`, { min: 0.4, max: 2 }),
    optionalHeightSlot('tallCabinetHeight', `${F}.dimensions.slots.tallCabinetHeight`, { min: 1.2, max: 2.6 }, 2),
  ],
  WORKTOP: () => [pieceWidthSlot('worktopWidth', `${F}.dimensions.slots.worktopWidth`, { min: 0.6, max: 4 })],
  SHELVES: () => [pieceWidthSlot('shelvesWidth', `${F}.dimensions.slots.shelvesWidth`, { min: 0.4, max: 4 })],
};

function selectedPieces(answers: AnswerMap): string[] {
  return Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
}

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  slots: (answers) => {
    const selected = selectedPieces(answers);
    const pieces = PIECES.map((p) => p.value).filter((v) => selected.includes(v));
    return [
      // balconul: obligatoriu, informativ (nu mai da marimea)
      informativeSlot('balconyLength', `${F}.dimensions.slots.balconyLength`, { min: 0.8, max: 8 }),
      // adancimea pastreaza pasul de 5 cm din v3
      { ...informativeSlot('balconyDepth', `${F}.dimensions.slots.balconyDepth`, { min: 0.4, max: 2.5 }), step: 0.05 },
      ...pieces.flatMap((p) => PIECE_SLOTS[p]()),
      ...ceilingIfTall(selected, BALCONY_V4_TALL_PIECES),
    ];
  },
};

function numberOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

// Revizuire M3 (hotararea coordonatorului): marimea = min(suma latimilor pieselor, "peretele"), unde peretele
// e exact ce dadea marimea pe v3 (aici lungimea utila). Asa v4 nu costa niciodata mai mult decat v3, iar
// un raft mic pe un balcon lung costa mai putin. Validarea nu blocheaza (piesele pot sta suprapuse).
// Fara nicio latime de piesa (ciorna partiala) → peretele, ca pe v3 (nu un 0 fara sens).
function cappedPiecesLength(piecesM: number, wallM: number): number {
  if (piecesM <= 0) return wallM;
  if (wallM <= 0) return piecesM;
  return Math.min(piecesM, wallM);
}

export const balconyFlowV4: RoomFlow = {
  roomType: 'BALCONY',
  version: 4,
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
      screenGroup: 'pieces',
      options: pieceChoiceOptions(F, PIECES),
    },
    sameFinishStep(OPTS, PIECES),
    dimensionsStep,
    ...pieceFinishSteps(OPTS, PIECES),
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
    const values = dimensionValues(answers, 'dimensions');
    // ca in v3: adancimea mobilierului nu poate depasi adancimea libera a balconului
    const depth = Math.min(values.balconyDepth ?? STANDARD_CABINET_DEPTH, STANDARD_CABINET_DEPTH);
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier balcon');
    // etapa 12 (c13): la balcon deschis firma vede direct pe fiecare piesa ca e mobilier de exterior
    if (answers.enclosed === 'OPEN') {
      for (const item of items) {
        const description = finishDescription([BALCONY_OPEN_NOTE, item.description]);
        if (description) item.description = description;
      }
    }
    return {
      // marimea = suma latimilor pieselor, plafonata la lungimea utila a balconului (M3)
      lengthM: cappedPiecesLength(linearMeters(dimensionsStep, answers), numberOr0(values.balconyLength)),
      widthM: depth,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
