import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { DimensionGroupStep, QuestionStep, RoomFlow } from '../types';
import { officeFlowV2 } from './office.v2';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Birou (camera) v3 (etapa 6 — c2, c14):
// - material + deschidere pe un ecran pe piesa, seturile noi, "decide firma";
// - biroul si biblioteca pot fi "Fara usi sau sertare"; rafturile de perete fara deschidere;
// - intrebarea comuna pentru corpurile cu fronturi.
// Forma biroului, dimensiunile si schita sunt luate din v2 (inghetat), neschimbate.

const F = 'flows.OFFICE';
const V = `${F}.v3`;

function fromV2<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = officeFlowV2.steps.find((x) => x.id === id);
  if (!s) throw new Error(`office.v3: pasul ${id} lipseste din v2`);
  return s as T;
}

const DEFS: FinishPieceDef[] = [
  {
    value: 'DESK', icon: 'monitor', itemName: 'Birou',
    materialStepId: 'materialDesk', systemsStepId: 'systemsDesk', materialTitleKey: `${V}.materialDesk.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
  {
    value: 'BOOKSHELF', icon: 'library', itemName: 'Bibliotecă',
    materialStepId: 'materialBookshelf', systemsStepId: 'systemsBookshelf', materialTitleKey: `${V}.materialBookshelf.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
  {
    value: 'STORAGE', icon: 'archive', itemName: 'Dulap depozitare',
    materialStepId: 'materialStorage', systemsStepId: 'systemsStorage', materialTitleKey: `${V}.materialStorage.title`,
    materialSet: 'BODY', fronts: 'YES',
  },
  {
    value: 'WALL_SHELVES', icon: 'rows-3', itemName: 'Rafturi perete',
    materialStepId: 'materialShelves', materialTitleKey: `${V}.materialShelves.title`,
    materialSet: 'PANEL', fronts: 'NO',
  },
];

const OPTS: FinishOpts = { flowKey: F, common: true };

const dimensionsStep = fromV2<DimensionGroupStep>('dimensions');

export const officeFlowV3: RoomFlow = {
  roomType: 'OFFICE',
  version: 3,
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
    sameFinishStep(OPTS, DEFS),
    fromV2('deskShape'),
    dimensionsStep,
    ...pieceFinishSteps(OPTS, DEFS),
    fromV2('sketch'),
  ],
  deriveRoom: (answers) => {
    const result = buildFinishItems(answers, DEFS, 'Mobilier birou');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: result.items,
      firmRecommendations: result.firmRecommendations,
    };
  },
};
