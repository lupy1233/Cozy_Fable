import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type {
  AnswerMap,
  ChoiceOption,
  DimensionGroupStep,
  DimensionSlot,
  QuestionStep,
  RoomFlow,
  SingleChoiceStep,
} from '../types';
import { bedroomFlowV2 } from './bedroom.v2';
import { bedroomFlowV3 } from './bedroom.v3';
import { interiorModulesText } from './common';
import { FIRM_DECIDES, finishDescription } from './finish-sets';
import {
  ceilingIfTall,
  FIRM_DECIDES_NOTE_TEXT,
  noteFor,
  optionalChoiceStep,
  optionalHeightSlot,
  pieceWidthSlot,
} from './measure-sets';
import { buildFinishItems, pieceFinishSteps, renameItem, type FinishOpts, type FinishPieceDef } from './piece-finish';
import { selectedPieces } from './per-piece';

// Dormitor v4 (etapa 10 — c9 + c5, DESIGN §5.5 / tabelul 5.0):
// - saltea 120 × 200 (D_120) + intrebarea separata de lungime 200 / 190 (E10-N6, fara puncte);
// - stofa patului tapitat pe ecran propriu (E10-N7);
// - interiorul dulapului pe ecranul `piece:WARDROBE:details`, aceleasi module ca dressingul (E10-N8);
// - dimensiuni: latimea fiecarei piese obligatorie, inaltimea dulapului optionala (tipic 2,4 m),
//   tavanul doar cand e bifat dulapul. Doar cu pat (fara alta piesa cu latime) pasul nu apare.
// Restul pasilor sunt obiectele v2 / v3 (inghetate), refolosite nemodificate.

const F = 'flows.BEDROOM';
const V3 = `${F}.v3`;
const V = `${F}.v4`;

function fromV2<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = bedroomFlowV2.steps.find((x) => x.id === id);
  if (!s) throw new Error(`bedroom.v4: pasul ${id} lipseste din v2`);
  return s as T;
}

function fromV3<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = bedroomFlowV3.steps.find((x) => x.id === id);
  if (!s) throw new Error(`bedroom.v4: pasul ${id} lipseste din v3`);
  return s as T;
}

// aceleasi valori si icoane ca `interiorModules` din dressing (v3 / v4)
const WARDROBE_INTERIOR_OPTIONS = [
  { value: 'HANGING_RODS', icon: 'shirt' },
  { value: 'SHELVES', icon: 'rows-3' },
  { value: 'DRAWERS', icon: 'archive' },
  { value: 'SHOE_RACK', icon: 'footprints' },
  { value: 'ACCESSORIES', icon: 'grip' },
  { value: 'LED_LIGHTING', icon: 'lightbulb' },
];

const wardrobeInteriorStep = optionalChoiceStep({
  id: 'wardrobeInterior',
  titleKey: `${V}.wardrobeInterior.title`,
  subtitleKey: `${V}.wardrobeInterior.subtitle`,
  icon: 'door-closed',
  category: 'WARDROBE_INTERIOR',
  keyPrefix: `${V}.wardrobeInterior`,
  options: WARDROBE_INTERIOR_OPTIONS,
  multi: true,
});

// definitiile v3, cu ecranul de detalii al dulapului
const DEFS: FinishPieceDef[] = [
  {
    value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap dormitor',
    materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe', materialTitleKey: `${V3}.materialWardrobe.title`,
    materialSet: 'BODY', fronts: 'YES',
    leadSteps: [fromV2('wardrobeDoorType')],
    frontsIf: { questionId: 'wardrobeDoorType', equals: 'HINGED' },
    fixedSystems: (a) => (a.wardrobeDoorType === 'SLIDING' ? ['GLISANTE'] : null),
    detailSteps: [wardrobeInteriorStep],
  },
  {
    value: 'BED_FRAME', icon: 'bed-double', itemName: 'Cadru pat',
    materialStepId: 'materialBed', systemsStepId: 'systemsBed', materialTitleKey: `${V3}.materialBed.title`,
    materialSet: 'WOOD', fronts: 'YES',
    leadSteps: [fromV2('bedStorage')],
    frontsIf: { questionId: 'bedStorage', equals: 'DRAWERS' },
  },
  {
    value: 'NIGHTSTANDS', icon: 'lamp', itemName: 'Noptiere', quantity: 2,
    materialStepId: 'materialNightstands', systemsStepId: 'systemsNightstands', materialTitleKey: `${V3}.materialNightstands.title`,
    materialSet: 'BODY', fronts: 'YES',
    leadSteps: [fromV2('nightstandsCount')],
  },
  {
    value: 'DRESSER', icon: 'archive', itemName: 'Comodă',
    materialStepId: 'materialDresser', systemsStepId: 'systemsDresser', materialTitleKey: `${V3}.materialDresser.title`,
    materialSet: 'BODY', fronts: 'YES',
  },
  {
    value: 'TV_UNIT', icon: 'tv', itemName: 'Comodă TV',
    materialStepId: 'materialTvUnit', systemsStepId: 'systemsTvUnit', materialTitleKey: `${V3}.materialTvUnit.title`,
    materialSet: 'BODY', fronts: 'YES', pistons: true,
  },
  {
    value: 'VANITY', icon: 'sparkles', itemName: 'Măsuță toaletă',
    materialStepId: 'materialVanity', systemsStepId: 'systemsVanity', materialTitleKey: `${V3}.materialVanity.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
];

const OPTS: FinishOpts = { flowKey: F, common: true };

// marimile standard de saltea (latimea intra in metri liniari)
const STANDARD_BED_SIZES = ['S_90', 'D_120', 'M_140', 'Q_160', 'K_180'];
const BED_WIDTH: Record<string, number> = { S_90: 0.9, D_120: 1.2, M_140: 1.4, Q_160: 1.6, K_180: 1.8 };
const BED_LENGTH_CM: Record<string, number> = { L_200: 200, L_190: 190 };

const bedSizeV2 = fromV2<SingleChoiceStep>('bedSize');
const d120Option: ChoiceOption = {
  value: 'D_120',
  labelKey: `${V}.bedSize.options.D_120.label`,
  descriptionKey: `${V}.bedSize.options.D_120.description`,
  icon: 'bed-double',
};
// copie a pasului v2 cu 120 × 200 intre 90 si 140 (obiectul v2 ramane neatins)
const bedSizeStep: SingleChoiceStep = {
  ...bedSizeV2,
  // textul de ajutor pomeneste si 120 × 200 si lungimea de 190 (cheie noua; v2 / v3 raman cu cea veche)
  info: { titleKey: `${F}.bedSize.info.title`, bodyKey: `${V}.bedSize.info.body` },
  options: bedSizeV2.options.flatMap((o) => (o.value === 'M_140' ? [d120Option, o] : [o])),
};

// lungimea saltelei (E10-N6): doar la o marime standard; fara puncte (marimile saltelei nu au scor)
const bedLengthBase = optionalChoiceStep({
  id: 'bedLength',
  titleKey: `${V}.bedLength.title`,
  subtitleKey: `${V}.bedLength.subtitle`,
  screenGroup: 'bedSize',
  icon: 'ruler',
  visibleIf: {
    all: [
      { questionId: 'piecesNeeded', in: ['BED_FRAME'] },
      { questionId: 'bedSize', in: STANDARD_BED_SIZES },
    ],
  },
  category: 'BED_LENGTH',
  keyPrefix: `${V}.bedLength`,
  options: [{ value: 'L_200' }, { value: 'L_190' }],
});
const bedLengthStep: SingleChoiceStep = {
  ...bedLengthBase,
  options: bedLengthBase.options.map((o) => {
    const copy: ChoiceOption = { ...o };
    delete copy.scoring;
    return copy;
  }),
};

// stofa patului tapitat (E10-N7): ecran propriu, dupa ecranul saltelei
const bedFabricStep = optionalChoiceStep({
  id: 'bedFabric',
  titleKey: `${V}.bedFabric.title`,
  subtitleKey: `${V}.bedFabric.subtitle`,
  screenGroup: 'bedFabric',
  icon: 'bed-double',
  visibleIf: {
    all: [
      { questionId: 'piecesNeeded', in: ['BED_FRAME'] },
      { questionId: 'bedUpholstered', equals: true },
    ],
  },
  category: 'BED_FABRIC',
  keyPrefix: `${V}.bedFabric`,
  options: [{ value: 'WOVEN' }, { value: 'BOUCLE' }, { value: 'VELVET' }],
});

const FABRIC_TEXT: Record<string, string> = { WOVEN: 'țesătură', BOUCLE: 'bouclé', VELVET: 'catifea' };

// latimea fiecarei piese (intervalele v2) + inaltimea optionala a dulapului, langa latimea lui
const PIECE_SLOTS: Record<string, () => DimensionSlot[]> = {
  WARDROBE: () => [
    pieceWidthSlot('wardrobeWidth', `${F}.dimensions.slots.wardrobeWidth`, { min: 0.6, max: 6 }),
    optionalHeightSlot('wardrobeHeight', `${F}.dimensions.slots.wardrobeHeight`, { min: 1.8, max: 3.2 }, 2.4),
  ],
  DRESSER: () => [pieceWidthSlot('dresserWidth', `${F}.dimensions.slots.dresserWidth`, { min: 0.6, max: 2.5 })],
  TV_UNIT: () => [pieceWidthSlot('tvUnitWidth', `${F}.dimensions.slots.tvUnitWidth`, { min: 0.8, max: 4 })],
  VANITY: () => [pieceWidthSlot('vanityWidth', `${F}.dimensions.slots.vanityWidth`, { min: 0.6, max: 1.8 })],
  NIGHTSTANDS: () => [
    pieceWidthSlot('nightstandWidth', `${F}.dimensions.slots.nightstandWidth`, { min: 0.35, max: 0.8 }),
  ],
};
const TALL_PIECES = ['WARDROBE'];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  // patul nu are slot (latimea vine din saltea): doar cu pat, pasul nu apare (nici tavanul)
  visibleIf: { questionId: 'piecesNeeded', in: Object.keys(PIECE_SLOTS) },
  slots: (answers) => {
    const selected = selectedPieces(answers);
    return [
      ...selected.filter((p) => PIECE_SLOTS[p]).flatMap((p) => PIECE_SLOTS[p]()),
      ...ceilingIfTall(selected, TALL_PIECES),
    ];
  },
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// "saltea 120 × 200" / "saltea 140 × 190" / "saltea 140, lungimea o recomandă firma"
function mattressText(bedSize: string, bedLength: string | undefined): string {
  const width = bedSize.replace(/^[A-Z]_/, '');
  if (bedLength === FIRM_DECIDES) return `saltea ${width}, lungimea o recomandă firma`;
  return `saltea ${width} × ${BED_LENGTH_CM[bedLength ?? ''] ?? 200}`;
}

function wardrobeInteriorNote(answers: AnswerMap): string | undefined {
  const modules = Array.isArray(answers.wardrobeInterior)
    ? (answers.wardrobeInterior as unknown[]).filter((m): m is string => typeof m === 'string')
    : [];
  if (modules.length === 0) return undefined;
  if (modules.includes(FIRM_DECIDES)) return `Interior dulap: ${FIRM_DECIDES_NOTE_TEXT}`;
  return `Interior dulap: ${interiorModulesText(modules)}`;
}

export const bedroomFlowV4: RoomFlow = {
  roomType: 'BEDROOM',
  version: 4,
  steps: [
    fromV3('piecesNeeded'),
    fromV3('sameFinishAll'),
    // ecranul saltelei: marime + lungime / dimensiuni custom (se exclud) + tapitare = max 3
    bedSizeStep,
    bedLengthStep,
    fromV3('bedCustomSize'),
    fromV3('bedUpholstered'),
    bedFabricStep,
    dimensionsStep,
    ...pieceFinishSteps(OPTS, DEFS),
    fromV3('sketch'),
  ],
  deriveRoom: (answers) => {
    const result = buildFinishItems(answers, DEFS, 'Mobilier dormitor');
    const bedSize = str(answers.bedSize);
    const custom = dimensionValues(answers, 'bedCustomSize');
    const upholstered = answers.bedUpholstered === true;
    for (const item of result.items) {
      if (item.name === 'Cadru pat') {
        const details: string[] = [];
        if (bedSize === 'CUSTOM' && custom.bedCustomWidth && custom.bedCustomLength) {
          details.push(
            // ca la patul 3D ("altă mărime"); v2 / v3 raman cu "saltea custom …"
            `saltea ${Math.round(custom.bedCustomWidth * 100)} × ${Math.round(custom.bedCustomLength * 100)} cm (altă mărime)`,
          );
        } else if (bedSize && bedSize !== 'CUSTOM') {
          details.push(mattressText(bedSize, str(answers.bedLength)));
        }
        if (answers.bedStorage === 'LIFT_UP') details.push('ladă rabatabilă');
        if (answers.bedStorage === 'DRAWERS') details.push('sertare laterale');
        const description = finishDescription([
          item.description,
          details.length > 0 ? details.join(', ') : undefined,
          upholstered ? noteFor('Stofă', str(answers.bedFabric), FABRIC_TEXT) : undefined,
        ]);
        if (description) item.description = description;
      }
      if (item.name === 'Dulap dormitor') {
        const description = finishDescription([item.description, wardrobeInteriorNote(answers)]);
        if (description) item.description = description;
      }
      if (item.name === 'Noptiere' && answers.nightstandsCount === 'ONE') {
        item.quantity = 1;
      }
    }
    if (upholstered) renameItem(result, 'Cadru pat', 'Pat tapițat');

    const bedLinear =
      bedSize === 'CUSTOM' ? (custom.bedCustomWidth ?? 0) : bedSize ? (BED_WIDTH[bedSize] ?? 0) : 0;
    return {
      lengthM: linearMeters(dimensionsStep, answers) + bedLinear,
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: result.items,
      firmRecommendations: result.firmRecommendations,
    };
  },
};
