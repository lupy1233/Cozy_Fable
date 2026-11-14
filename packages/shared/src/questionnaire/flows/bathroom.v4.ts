import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, RoomFlow } from '../types';
import { FIRM_DECIDES, finishDescription } from './finish-sets';
import {
  ceilingIfTall,
  FIRM_DECIDES_NOTE_TEXT,
  optionalChoiceStep,
  optionalHeightSlot,
  pieceWidthSlot,
} from './measure-sets';
import {
  buildFinishItems,
  PIECE_ALL_GROUP,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Baie v4 (etapa 10, DESIGN §5.6; c9 + c5):
// - lavoarul: tipul (pe blat / incastrat / integrat) si cine il aduce, pe ecranul de detalii
//   `piece:VANITY_UNIT:details` (E10-N9); ambele optionale, cu "Nu stiu"; ajung in descrierea
//   "Corp lavoar";
// - dimensiuni: latimea fiecarei piese (obligatorie) + inaltimea optionala la dulapul cu oglinda
//   si la coloana; tavanul doar cand una din ele e bifata.
// Restul identic cu v3 (aceleasi chei de material / deschidere). v3 ramane FROZEN in bathroom.v3.ts.
// Pasii sunt construiti din nou aici: obiectele v3 nu se modifica.

const F = 'flows.BATHROOM';
const V3 = `${F}.v3`;
const V = `${F}.v4`;

const VANITY_ITEM_NAME = 'Corp lavoar';

const basinType = optionalChoiceStep({
  id: 'basinType',
  titleKey: `${V}.basinType.title`,
  subtitleKey: `${V}.basinType.subtitle`,
  category: 'BATHROOM_BASIN_TYPE',
  keyPrefix: `${V}.basinType`,
  options: [{ value: 'COUNTERTOP_BASIN' }, { value: 'INSET_BASIN' }, { value: 'INTEGRATED_BASIN' }],
});

const basinSupply = optionalChoiceStep({
  id: 'basinSupply',
  titleKey: `${V}.basinSupply.title`,
  subtitleKey: `${V}.basinSupply.subtitle`,
  category: 'BATHROOM_BASIN_SUPPLY',
  keyPrefix: `${V}.basinSupply`,
  options: [{ value: 'CLIENT' }, { value: 'FIRM' }],
});

const PIECES: FinishPieceDef[] = [
  {
    value: 'VANITY_UNIT',
    icon: 'droplets',
    itemName: VANITY_ITEM_NAME,
    materialStepId: 'materialVanity',
    systemsStepId: 'systemsVanity',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V3}.materialVanity.title`,
    systemsTitleKey: `${V3}.systemsVanity.title`,
    detailSteps: [basinType, basinSupply],
  },
  {
    value: 'MIRROR_CABINET',
    icon: 'square',
    itemName: 'Dulap oglindă',
    materialStepId: 'materialMirror',
    systemsStepId: 'systemsMirror',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V3}.materialMirror.title`,
    systemsTitleKey: `${V3}.systemsMirror.title`,
  },
  {
    value: 'TALL_STORAGE',
    icon: 'rows-3',
    itemName: 'Coloană baie',
    materialStepId: 'materialTall',
    systemsStepId: 'systemsTall',
    materialSet: 'BODY',
    integralMdf: true,
    fronts: 'YES',
    materialTitleKey: `${V3}.materialTall.title`,
    systemsTitleKey: `${V3}.systemsTall.title`,
  },
];

// MDF infoliat recomandat cand baia nu e ventilata (badge, nu restrictie) — ca in v3
const OPTS: FinishOpts = {
  flowKey: F,
  common: true,
  recommended: { material: 'MDF_INFOLIAT', cond: { questionId: 'ventilation', equals: 'NONE' } },
};

// piesele inalte (DESIGN tabelul 5.0): tavan + inaltime optionala
export const BATHROOM_V4_TALL_PIECES = ['MIRROR_CABINET', 'TALL_STORAGE'] as const;

// sloturile fiecarei piese, in ordinea pieselor: latimea, apoi inaltimea (la piesele inalte)
const PIECE_SLOTS: Record<string, () => DimensionSlot[]> = {
  VANITY_UNIT: () => [pieceWidthSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.4, max: 3 })],
  MIRROR_CABINET: () => [
    pieceWidthSlot('mirrorWidth', `${F}.dimensions.slots.mirrorWidth`, { min: 0.3, max: 2 }),
    optionalHeightSlot('mirrorHeight', `${F}.dimensions.slots.mirrorHeight`, { min: 0.4, max: 1.2 }, 0.7),
  ],
  TALL_STORAGE: () => [
    pieceWidthSlot('tallStorageWidth', `${F}.dimensions.slots.tallStorageWidth`, { min: 0.3, max: 1.5 }),
    optionalHeightSlot('tallStorageHeight', `${F}.dimensions.slots.tallStorageHeight`, { min: 1.2, max: 2.4 }, 1.8),
  ],
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
    // ordinea pieselor din lista (DESIGN §5.0), nu ordinea bifarii (v3 folosea ordinea bifarii)
    const pieces = PIECES.map((p) => p.value).filter((v) => selected.includes(v));
    return [...pieces.flatMap((p) => PIECE_SLOTS[p]()), ...ceilingIfTall(selected, BATHROOM_V4_TALL_PIECES)];
  },
};

// Textele notei pentru firma. Descrierea pieselor pleaca in romana (deriveRoom); varianta EN e
// referinta pentru documente / traducere (aceeasi forma), testata la fel.
type NoteLocale = 'ro' | 'en';
const BASIN_TEXTS: Record<
  NoteLocale,
  {
    label: string;
    type: Readonly<Record<string, string>>;
    supply: Readonly<Record<string, string>>;
    typeByFirm: string; // tipul "Nu stiu", cine il aduce stiut
    supplyByFirm: (type: string) => string; // tipul stiut, cine il aduce "Nu stiu"
    allByFirm: string; // ambele "Nu stiu" (sau una "Nu stiu" si cealalta fara raspuns)
  }
> = {
  ro: {
    label: 'Lavoar',
    type: { COUNTERTOP_BASIN: 'pe blat', INSET_BASIN: 'încastrat în blat', INTEGRATED_BASIN: 'integrat în blat' },
    supply: { CLIENT: 'adus de client', FIRM: 'adus de firmă' },
    typeByFirm: 'tipul îl recomandă firma',
    supplyByFirm: (type) => `${type} (cine îl aduce: recomandă firma)`,
    allByFirm: FIRM_DECIDES_NOTE_TEXT,
  },
  en: {
    label: 'Basin',
    type: { COUNTERTOP_BASIN: 'countertop', INSET_BASIN: 'inset into the top', INTEGRATED_BASIN: 'integrated into the top' },
    supply: { CLIENT: 'supplied by the client', FIRM: 'supplied by the company' },
    typeByFirm: 'the company recommends the type',
    supplyByFirm: (type) => `${type} (who supplies it: the company recommends)`,
    allByFirm: "the client wants the company's recommendation",
  },
};
export const BASIN_TYPE_TEXT = BASIN_TEXTS.ro.type;
export const BASIN_SUPPLY_TEXT = BASIN_TEXTS.ro.supply;

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// O singura nota, fara "; " in interior (in descriere "; " desparte notele) — revizuirea m2:
// "Lavoar: încastrat în blat, adus de client" · "Lavoar: pe blat" · "Lavoar: adus de firmă" ·
// "Lavoar: încastrat în blat (cine îl aduce: recomandă firma)" · "Lavoar: tipul îl recomandă firma, adus de client" ·
// ambele "Nu stiu" (sau "Nu stiu" + fara raspuns) → "Lavoar: clientul vrea recomandarea firmei"; nimic → undefined.
export function basinNote(answers: AnswerMap, locale: NoteLocale = 'ro'): string | undefined {
  const t = BASIN_TEXTS[locale];
  const type = str(answers.basinType);
  const supply = str(answers.basinSupply);
  if (type === undefined && supply === undefined) return undefined;
  const typeText = type !== undefined && type !== FIRM_DECIDES ? (t.type[type] ?? type.toLowerCase().replace(/_/g, ' ')) : undefined;
  const supplyText =
    supply !== undefined && supply !== FIRM_DECIDES ? (t.supply[supply] ?? supply.toLowerCase().replace(/_/g, ' ')) : undefined;
  let body: string;
  if (typeText !== undefined && supplyText !== undefined) body = `${typeText}, ${supplyText}`;
  else if (typeText !== undefined) body = supply === FIRM_DECIDES ? t.supplyByFirm(typeText) : typeText;
  else if (supplyText !== undefined) body = type === FIRM_DECIDES ? `${t.typeByFirm}, ${supplyText}` : supplyText;
  else body = t.allByFirm;
  return `${t.label}: ${body}`;
}

// Revizuirea m7: cu "acelasi material pentru toate piesele" = Da, ecranul comun `piece:ALL` trebuie sa vina
// INAINTEA intrebarilor despre lavoar. Constructorul comun pune `piece:ALL` la final; aici il mutam primul in
// lista ecranelor de finisaj (fara sa atingem piece-finish.ts). La "Nu" ecranul comun e ascuns, deci ordinea
// pieselor ramane: lavoar → detaliile lavoarului → dulap cu oglinda → coloana.
function finishStepsCommonFirst() {
  const steps = pieceFinishSteps(OPTS, PIECES);
  return [...steps.filter((s) => s.screenGroup === PIECE_ALL_GROUP), ...steps.filter((s) => s.screenGroup !== PIECE_ALL_GROUP)];
}

export const bathroomFlowV4: RoomFlow = {
  roomType: 'BATHROOM',
  version: 4,
  steps: [
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
    ...finishStepsCommonFirst(),
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
    const { items, firmRecommendations } = buildFinishItems(answers, PIECES, 'Mobilier baie');
    const note = basinNote(answers);
    if (note) {
      const vanity = items.find((it) => it.name === VANITY_ITEM_NAME);
      if (vanity) {
        const description = finishDescription([vanity.description, note]);
        if (description) vanity.description = description;
      }
    }
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items,
      firmRecommendations,
    };
  },
};
