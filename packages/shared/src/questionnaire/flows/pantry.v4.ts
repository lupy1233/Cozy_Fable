import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { ceilingIfTall, informativeSlot, optionalHeightSlot, pieceWidthSlot } from './measure-sets';
import { buildFinishItems, pieceFinishSteps, type FinishOpts, type FinishPieceDef } from './piece-finish';

// Debara v4 (etapa 10, DESIGN §5.7; c5 / d3):
// - laturile (runA/B/C dupa wallsUsed) raman obligatorii, dar doar informative (nu mai dau marimea, E10-N14);
// - latimea rafturilor (OPEN_SHELVES / MIXED) si a dulapurilor (CLOSED_CABINETS / MIXED) da marimea;
// - inaltimea optionala doar la dulapuri; tavanul doar cu dulapuri.
// Restul identic cu v3 (aceleasi chei de material / deschidere). v3 ramane FROZEN in pantry.v3.ts.
// Pasii sunt construiti din nou aici: obiectele v3 nu se modifica.

const F = 'flows.PANTRY';
const V3 = `${F}.v3`;
const V = `${F}.v4`;

const WALL_RUNS: Record<string, string[]> = {
  ONE_WALL: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
};

const SHELVES_STYLES = ['OPEN_SHELVES', 'MIXED'];
const CABINETS_STYLES = ['CLOSED_CABINETS', 'MIXED'];

const PIECES: FinishPieceDef[] = [
  {
    value: 'SHELVES',
    icon: 'rows-3',
    itemName: 'Rafturi debara',
    materialStepId: 'materialShelves',
    materialSet: 'PANEL',
    fronts: 'NO',
    selectedIf: { questionId: 'storageStyle', in: SHELVES_STYLES },
    materialTitleKey: `${V3}.materialShelves.title`,
  },
  {
    value: 'CABINETS',
    icon: 'door-closed',
    itemName: 'Dulapuri debara',
    materialStepId: 'materialCabinets',
    systemsStepId: 'systemsCabinets',
    materialSet: 'BODY',
    fronts: 'YES',
    selectedIf: { questionId: 'storageStyle', in: CABINETS_STYLES },
    materialTitleKey: `${V3}.materialCabinets.title`,
  },
];

const OPTS: FinishOpts = { flowKey: F, common: false };

// piesele inalte (DESIGN tabelul 5.0): tavan + inaltime optionala
export const PANTRY_V4_TALL_PIECES = ['CABINETS'] as const;

// zonele alese (in ordinea pieselor), din storageStyle
function selectedZones(answers: AnswerMap): string[] {
  const style = typeof answers.storageStyle === 'string' ? answers.storageStyle : undefined;
  if (style === undefined) return [];
  const zones: string[] = [];
  if (SHELVES_STYLES.includes(style)) zones.push('SHELVES');
  if (CABINETS_STYLES.includes(style)) zones.push('CABINETS');
  return zones;
}

const ZONE_SLOTS: Record<string, () => DimensionSlot[]> = {
  SHELVES: () => [pieceWidthSlot('shelvesWidth', `${F}.dimensions.slots.shelvesWidth`, { min: 0.4, max: 5 })],
  CABINETS: () => [
    pieceWidthSlot('cabinetsWidth', `${F}.dimensions.slots.cabinetsWidth`, { min: 0.4, max: 5 }),
    optionalHeightSlot('cabinetsHeight', `${F}.dimensions.slots.cabinetsHeight`, { min: 1, max: 2.8 }, 2.2),
  ],
};

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  slots: (answers: AnswerMap) => {
    const walls = typeof answers.wallsUsed === 'string' ? answers.wallsUsed : 'ONE_WALL';
    const runs = WALL_RUNS[walls] ?? WALL_RUNS.ONE_WALL;
    const zones = selectedZones(answers);
    return [
      // laturile: obligatorii, informative (nu mai dau marimea)
      ...runs.map((id) => informativeSlot(id, `${F}.dimensions.slots.${id}`, { min: 0.5, max: 5 })),
      ...zones.flatMap((z) => ZONE_SLOTS[z]()),
      ...ceilingIfTall(zones, PANTRY_V4_TALL_PIECES),
    ];
  },
};

function numberOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

// Revizuire M3 (hotararea coordonatorului): marimea = min(suma latimilor, "peretele"), unde peretele e exact
// ce dadea marimea pe v3 (aici suma laturilor). Asa v4 nu costa niciodata mai mult decat v3.
// Validarea nu blocheaza. Fara nicio latime de zona (ciorna partiala) → peretele, ca pe v3.
function cappedPiecesLength(piecesM: number, wallM: number): number {
  if (piecesM <= 0) return wallM;
  if (wallM <= 0) return piecesM;
  return Math.min(piecesM, wallM);
}

export const pantryFlowV4: RoomFlow = {
  roomType: 'PANTRY',
  version: 4,
  steps: [
    {
      id: 'wallsUsed',
      type: 'single-choice',
      titleKey: `${F}.wallsUsed.title`,
      subtitleKey: `${F}.wallsUsed.subtitle`,
      info: {
        titleKey: `${F}.wallsUsed.info.title`,
        bodyKey: `${F}.wallsUsed.info.body`,
      },
      options: ['ONE_WALL', 'L_SHAPE', 'U_SHAPE'].map((value) => ({
        value,
        labelKey: `${F}.wallsUsed.options.${value}.label`,
        descriptionKey: `${F}.wallsUsed.options.${value}.description`,
        icon: value === 'ONE_WALL' ? 'minus' : value === 'L_SHAPE' ? 'corner-down-right' : 'square',
      })),
    },
    {
      id: 'storageStyle',
      type: 'single-choice',
      titleKey: `${F}.storageStyle.title`,
      subtitleKey: `${F}.storageStyle.subtitle`,
      options: ['OPEN_SHELVES', 'CLOSED_CABINETS', 'MIXED'].map((value) => ({
        value,
        labelKey: `${F}.storageStyle.options.${value}.label`,
        descriptionKey: `${F}.storageStyle.options.${value}.description`,
        icon:
          value === 'OPEN_SHELVES' ? 'rows-3' : value === 'CLOSED_CABINETS' ? 'door-closed' : 'columns-3',
        info: {
          titleKey: `${F}.storageStyle.options.${value}.info.title`,
          bodyKey: `${F}.storageStyle.options.${value}.info.body`,
          prosKeys: [1, 2].map((i) => `${F}.storageStyle.options.${value}.info.pros${i}`),
          consKeys: [1].map((i) => `${F}.storageStyle.options.${value}.info.cons${i}`),
          priceHintKey: `${F}.storageStyle.options.${value}.info.price`,
        },
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Rafturi debara');
    const values = dimensionValues(answers, 'dimensions');
    // "peretele" = suma laturilor folosite (exact ce dadea marimea pe v3)
    const walls = typeof answers.wallsUsed === 'string' ? answers.wallsUsed : 'ONE_WALL';
    const wallM = (WALL_RUNS[walls] ?? WALL_RUNS.ONE_WALL).reduce((acc, id) => acc + numberOr0(values[id]), 0);
    return {
      // marimea = latimea rafturilor + a dulapurilor, plafonata la suma laturilor (M3)
      lengthM: cappedPiecesLength(linearMeters(dimensionsStep, answers), wallM),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
