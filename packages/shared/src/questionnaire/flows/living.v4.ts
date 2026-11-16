import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { DimensionGroupStep, QuestionStep, RoomFlow } from '../types';
import { finishDescription } from './finish-sets';
import { livingFlowV3 } from './living.v3';
import {
  buildFinishItems,
  pieceFinishSteps,
  renameItem,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Living v4 (etapa 6 — c1, c2, c14):
// - material + deschidere pe un ecran pe piesa, seturile noi, "decide firma";
// - comoda TV: si "Rabatabila, pe pistoane"; biblioteca si piesa libera pot fi "Fara usi
//   sau sertare"; masuta cu setul de lemn, rafturile suspendate cu setul de placi, fara deschidere;
// - intrebarea comuna pentru corpurile cu fronturi, pe ecranul listei de piese.
// Textul piesei libere, stilul TV, dimensiunile, LED-ul si schita sunt luate din v3 (inghetat).

const F = 'flows.LIVING';
const V = `${F}.v4`;

function fromV3<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = livingFlowV3.steps.find((x) => x.id === id);
  if (!s) throw new Error(`living.v4: pasul ${id} lipseste din v3`);
  return s as T;
}

const DEFS: FinishPieceDef[] = [
  {
    value: 'TV_UNIT', icon: 'tv', itemName: 'Comodă TV',
    materialStepId: 'materialTvUnit', systemsStepId: 'systemsTvUnit', materialTitleKey: `${V}.materialTvUnit.title`,
    materialSet: 'BODY', fronts: 'YES', pistons: true,
  },
  {
    value: 'BOOKSHELF', icon: 'library', itemName: 'Bibliotecă',
    materialStepId: 'materialBookshelf', systemsStepId: 'systemsBookshelf', materialTitleKey: `${V}.materialBookshelf.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
  {
    value: 'DISPLAY_CABINET', icon: 'gallery-vertical-end', itemName: 'Vitrină',
    materialStepId: 'materialDisplay', systemsStepId: 'systemsDisplay', materialTitleKey: `${V}.materialDisplay.title`,
    materialSet: 'BODY', fronts: 'YES',
  },
  {
    value: 'COFFEE_TABLE', icon: 'table', itemName: 'Măsuță cafea',
    materialStepId: 'materialCoffeeTable', materialTitleKey: `${V}.materialCoffeeTable.title`,
    materialSet: 'WOOD', fronts: 'NO',
  },
  {
    value: 'WALL_SHELVES', icon: 'rows-3', itemName: 'Rafturi suspendate',
    materialStepId: 'materialShelves', materialTitleKey: `${V}.materialShelves.title`,
    materialSet: 'PANEL', fronts: 'NO',
  },
  // piesa libera: numele vine din textul clientului la derivare
  {
    value: 'OTHER', icon: 'plus', itemName: 'Altă piesă living',
    materialStepId: 'materialOtherPiece', systemsStepId: 'systemsOtherPiece', materialTitleKey: `${V}.materialOtherPiece.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
];

const OPTS: FinishOpts = { flowKey: F, common: true };

// numele comodei TV dupa stilul zonei TV (ca v3)
const TV_ITEM_NAME: Record<string, string> = {
  FLOATING: 'Comodă TV suspendată',
  ON_FLOOR: 'Comodă TV',
  COMPLEX_UNIT: 'Ansamblu TV cu dulapuri',
};

const dimensionsStep = fromV3<DimensionGroupStep>('dimensions');

export const livingFlowV4: RoomFlow = {
  roomType: 'LIVING',
  version: 4,
  steps: [
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      screenGroup: 'pieces',
      minSelected: 1,
      options: pieceChoiceOptions(F, DEFS),
    },
    fromV3('piecesOtherText'),
    sameFinishStep(OPTS, DEFS),
    fromV3('tvStyle'),
    dimensionsStep,
    ...pieceFinishSteps(OPTS, DEFS),
    fromV3('ledPieces'),
    fromV3('sketch'),
  ],
  deriveRoom: (answers) => {
    const result = buildFinishItems(answers, DEFS, 'Mobilier living');
    const selected = Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
    const selectedDefs = DEFS.filter((d) => selected.includes(d.value));
    const led = Array.isArray(answers.ledPieces) ? (answers.ledPieces as string[]) : [];
    // items pastreaza ordinea defs-urilor selectate → anotarea LED merge pe index
    if (result.items.length === selectedDefs.length) {
      result.items.forEach((item, i) => {
        if (led.includes(selectedDefs[i].value)) {
          const description = finishDescription([item.description, 'Cu iluminare LED']);
          if (description) item.description = description;
        }
      });
    }
    const tvStyle = typeof answers.tvStyle === 'string' ? answers.tvStyle : undefined;
    if (tvStyle && TV_ITEM_NAME[tvStyle] && TV_ITEM_NAME[tvStyle] !== 'Comodă TV') {
      renameItem(result, 'Comodă TV', TV_ITEM_NAME[tvStyle]);
    }
    const otherName =
      typeof answers.piecesOtherText === 'string' && answers.piecesOtherText.trim()
        ? answers.piecesOtherText.trim()
        : undefined;
    if (otherName) renameItem(result, 'Altă piesă living', otherName);
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: result.items,
      firmRecommendations: result.firmRecommendations,
    };
  },
};
