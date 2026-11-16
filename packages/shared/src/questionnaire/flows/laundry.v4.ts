import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow, SingleChoiceStep } from '../types';
import { finishDescription } from './finish-sets';
import {
  ceilingIfTall,
  informativeSlot,
  noteFor,
  optionalChoiceStep,
  optionalHeightSlot,
  pieceWidthSlot,
} from './measure-sets';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Spalatorie v4 (etapa 10, DESIGN §5.8; c9 + c5 / d3):
// - `applianceSetup` (din v3) si intrebarea noua `washerLoading` pe acelasi ecran `applianceScreen`;
//   "Incarcare de sus" ascunsa la aparate suprapuse (E10-N10);
// - aparatele si incarcarea ajung in descrierea piesei: pe "Dulap încastrare electrocasnice" daca e
//   bifat, altfel pe prima piesa (E10-N5);
// - dimensiuni: peretele ramane obligatoriu, dar doar informativ (E10-N14); latimea fiecarei piese
//   bifate da marimea; inaltimea optionala la dulapul de electrocasnice si la dulapurile de depozitare;
//   tavanul doar cand una din ele e bifata.
// Restul identic cu v3 (aceleasi chei de material / deschidere). v3 ramane FROZEN in laundry.v3.ts.
// Pasii sunt construiti din nou aici: obiectele v3 nu se modifica.

const F = 'flows.LAUNDRY';
const V3 = `${F}.v3`;
const V = `${F}.v4`;

const APPLIANCE_SCREEN = 'applianceScreen';
const HOUSING_ITEM_NAME = 'Dulap încastrare electrocasnice';

const PIECES: FinishPieceDef[] = [
  {
    value: 'APPLIANCE_HOUSING',
    icon: 'washing-machine',
    itemName: HOUSING_ITEM_NAME,
    materialStepId: 'materialApplianceHousing',
    systemsStepId: 'systemsApplianceHousing',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V3}.materialApplianceHousing.title`,
  },
  {
    value: 'STORAGE',
    icon: 'archive',
    itemName: 'Dulapuri depozitare',
    materialStepId: 'materialStorage',
    systemsStepId: 'systemsStorage',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V3}.materialStorage.title`,
  },
  {
    value: 'COUNTERTOP',
    icon: 'ruler',
    itemName: 'Blat de lucru',
    materialStepId: 'materialCountertop',
    materialSet: 'WORKTOP',
    fronts: 'NO',
    materialTitleKey: `${V3}.materialCountertop.title`,
  },
  {
    value: 'SINK_UNIT',
    icon: 'droplets',
    itemName: 'Corp cu cuvă',
    materialStepId: 'materialSinkUnit',
    systemsStepId: 'systemsSinkUnit',
    materialSet: 'BODY',
    fronts: 'YES',
    materialTitleKey: `${V3}.materialSinkUnit.title`,
  },
];

// ca in v3: MDF infoliat recomandat fara ventilatie, doar pe corpuri (nu pe blat)
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'MDF_INFOLIAT', cond: { questionId: 'ventilation', equals: 'NONE' } },
};

// piesele inalte (DESIGN tabelul 5.0): tavan + inaltime optionala
export const LAUNDRY_V4_TALL_PIECES = ['APPLIANCE_HOUSING', 'STORAGE'] as const;

// sloturile fiecarei piese, in ordinea pieselor: latimea, apoi inaltimea (la piesele inalte)
const PIECE_SLOTS: Record<string, (answers: AnswerMap) => DimensionSlot[]> = {
  APPLIANCE_HOUSING: (answers) => [
    pieceWidthSlot('applianceHousingWidth', `${F}.dimensions.slots.applianceHousingWidth`, { min: 0.6, max: 2 }),
    // tipic: coloana cu aparate suprapuse ~1,9 m; altfel un corp sub blat ~0,9 m
    optionalHeightSlot(
      'applianceHousingHeight',
      `${F}.dimensions.slots.applianceHousingHeight`,
      { min: 0.8, max: 2.4 },
      answers.applianceSetup === 'STACKED' ? 1.9 : 0.9,
    ),
  ],
  STORAGE: () => [
    pieceWidthSlot('storageWidth', `${F}.dimensions.slots.storageWidth`, { min: 0.3, max: 3 }),
    optionalHeightSlot('storageHeight', `${F}.dimensions.slots.storageHeight`, { min: 0.6, max: 2.6 }),
  ],
  COUNTERTOP: () => [pieceWidthSlot('countertopWidth', `${F}.dimensions.slots.countertopWidth`, { min: 0.6, max: 4 })],
  SINK_UNIT: () => [pieceWidthSlot('sinkUnitWidth', `${F}.dimensions.slots.sinkUnitWidth`, { min: 0.4, max: 1.2 })],
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
      // peretele: obligatoriu, informativ (nu mai da marimea)
      informativeSlot('runA', `${F}.dimensions.slots.runA`, { min: 0.8, max: 6 }),
      ...pieces.flatMap((p) => PIECE_SLOTS[p](answers)),
      ...ceilingIfTall(selected, LAUNDRY_V4_TALL_PIECES),
    ];
  },
};

const applianceSetupStep: SingleChoiceStep = {
  id: 'applianceSetup',
  type: 'single-choice',
  titleKey: `${F}.applianceSetup.title`,
  subtitleKey: `${F}.applianceSetup.subtitle`,
  screenGroup: APPLIANCE_SCREEN,
  options: ['WASHER_ONLY', 'STACKED', 'SIDE_BY_SIDE'].map((value) => ({
    value,
    labelKey: `${F}.applianceSetup.options.${value}.label`,
    descriptionKey: `${F}.applianceSetup.options.${value}.description`,
    icon: value === 'WASHER_ONLY' ? 'washing-machine' : value === 'STACKED' ? 'rows-2' : 'columns-2',
    info: {
      titleKey: `${F}.applianceSetup.options.${value}.info.title`,
      bodyKey: `${F}.applianceSetup.options.${value}.info.body`,
      prosKeys: [1, 2].map((i) => `${F}.applianceSetup.options.${value}.info.pros${i}`),
      consKeys: [1].map((i) => `${F}.applianceSetup.options.${value}.info.cons${i}`),
    },
  })),
};

const washerLoadingStep = optionalChoiceStep({
  id: 'washerLoading',
  titleKey: `${V}.washerLoading.title`,
  subtitleKey: `${V}.washerLoading.subtitle`,
  screenGroup: APPLIANCE_SCREEN,
  category: 'LAUNDRY_LOADING',
  keyPrefix: `${V}.washerLoading`,
  options: [
    { value: 'FRONT' },
    // nu se poate suprapune un uscator pe o masina cu incarcare de sus (E10-N10)
    { value: 'TOP', visibleIf: { not: { questionId: 'applianceSetup', equals: 'STACKED' } } },
  ],
});

// Textele pentru firma (RO, cu diacritice)
export const APPLIANCE_SETUP_TEXT: Readonly<Record<string, string>> = {
  WASHER_ONLY: 'doar mașină de spălat',
  STACKED: 'mașină de spălat și uscător suprapuse',
  SIDE_BY_SIDE: 'mașină de spălat și uscător alăturate',
};
export const WASHER_LOADING_TEXT: Readonly<Record<string, string>> = {
  FRONT: 'frontală',
  TOP: 'de sus',
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function numberOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

// Revizuire M3 (hotararea coordonatorului): marimea = min(suma latimilor pieselor, "peretele"), unde peretele
// e exact ce dadea marimea pe v3 (aici peretele principal runA). Asa v4 nu costa niciodata mai mult decat v3.
// Validarea nu blocheaza (piesele pot sta suprapuse sau pe alt perete).
// Fara nicio latime de piesa (ciorna partiala) → peretele, ca pe v3 (nu un 0 fara sens).
function cappedPiecesLength(piecesM: number, wallM: number): number {
  if (piecesM <= 0) return wallM;
  if (wallM <= 0) return piecesM;
  return Math.min(piecesM, wallM);
}

export const laundryFlowV4: RoomFlow = {
  roomType: 'LAUNDRY',
  version: 4,
  steps: [
    applianceSetupStep,
    washerLoadingStep,
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier spălătorie');
    // E10-N5: aparatele (si incarcarea) pe dulapul de electrocasnice, altfel pe prima piesa
    const target = items.find((it) => it.name === HOUSING_ITEM_NAME) ?? items[0];
    const description = finishDescription([
      target.description,
      noteFor('Aparate', str(answers.applianceSetup), APPLIANCE_SETUP_TEXT),
      noteFor('Încărcare', str(answers.washerLoading), WASHER_LOADING_TEXT),
    ]);
    if (description) target.description = description;
    const values = dimensionValues(answers, 'dimensions');
    return {
      // marimea = suma latimilor pieselor, plafonata la peretele principal (M3)
      lengthM: cappedPiecesLength(linearMeters(dimensionsStep, answers), numberOr0(values.runA)),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
