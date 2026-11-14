import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters } from '../mapping';
import type { DimensionGroupStep, QuestionStep, RoomFlow, SingleChoiceStep } from '../types';
import { hallwayFlow } from './hallway';
import {
  buildFinishItems,
  pieceFinishSteps,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Hol v2 (etapa 6 — c2, c3, c14):
// - material + deschidere pe un ecran pe piesa, seturile noi, "decide firma";
// - dulapul de hol: tipul usilor (NOU, aceeasi regula ca la dormitor — c3);
// - cuierul (placi) si oglinda (setul ramei) fara intrebare de deschidere;
// - banca: "Fara usi sau sertare";
// - intrebarea comuna pentru corpurile cu fronturi.
// Dimensiunile si schita sunt luate din v1 (inghetat), neschimbate.

const F = 'flows.HALLWAY';
const V = `${F}.v2`;

function fromV1<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = hallwayFlow.steps.find((x) => x.id === id);
  if (!s) throw new Error(`hallway.v2: pasul ${id} lipseste din v1`);
  return s as T;
}

// textul copiat din dormitor, chei proprii in flows.HALLWAY (N20)
const wardrobeDoorTypeStep: SingleChoiceStep = {
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
};

const DEFS: FinishPieceDef[] = [
  {
    value: 'SHOE_CABINET', icon: 'footprints', itemName: 'Pantofar',
    materialStepId: 'materialShoeCabinet', systemsStepId: 'systemsShoeCabinet', materialTitleKey: `${V}.materialShoeCabinet.title`,
    materialSet: 'BODY', fronts: 'YES',
  },
  {
    value: 'COAT_UNIT', icon: 'shirt', itemName: 'Cuier cu panou',
    materialStepId: 'materialCoatUnit', materialTitleKey: `${V}.materialCoatUnit.title`,
    materialSet: 'PANEL', fronts: 'NO',
  },
  {
    value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap de hol',
    materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe', materialTitleKey: `${V}.materialWardrobe.title`,
    materialSet: 'BODY', fronts: 'YES',
    leadSteps: [wardrobeDoorTypeStep],
    frontsIf: { questionId: 'wardrobeDoorType', equals: 'HINGED' },
    fixedSystems: (a) => (a.wardrobeDoorType === 'SLIDING' ? ['GLISANTE'] : null),
  },
  {
    value: 'BENCH', icon: 'armchair', itemName: 'Băncuță hol',
    materialStepId: 'materialBench', systemsStepId: 'systemsBench', materialTitleKey: `${V}.materialBench.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
  {
    value: 'MIRROR', icon: 'square', itemName: 'Oglindă cu poliță',
    materialStepId: 'materialMirror', materialTitleKey: `${V}.materialMirror.title`,
    materialSet: 'MIRROR', fronts: 'NO',
  },
];

const OPTS: FinishOpts = { flowKey: F, common: true };

const dimensionsStep = fromV1<DimensionGroupStep>('dimensions');

export const hallwayFlowV2: RoomFlow = {
  roomType: 'HALLWAY',
  version: 2,
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
    dimensionsStep,
    ...pieceFinishSteps(OPTS, DEFS),
    fromV1('sketch'),
  ],
  deriveRoom: (answers) => {
    const result = buildFinishItems(answers, DEFS, 'Mobilier hol');
    return {
      lengthM: linearMeters(dimensionsStep, answers),
      // adancime standard de corp hol (ca v1)
      widthM: 0.5,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: result.items,
      firmRecommendations: result.firmRecommendations,
    };
  },
};
