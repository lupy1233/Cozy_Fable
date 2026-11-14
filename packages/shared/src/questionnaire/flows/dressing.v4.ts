import type { ItemSystem } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import { dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type {
  Condition,
  DimensionGroupStep,
  FirmRecommendation,
  MultiChoiceStep,
  QuestionStep,
  RoomFlow,
} from '../types';
import { interiorModulesText } from './common';
import { dressingFlowV3 } from './dressing.v3';
import {
  BODY_NOTE,
  FIRM_DECIDES,
  finishDescription,
  materialSetOptions,
  openingOptions,
  resolveMaterial,
  resolveOpening,
} from './finish-sets';

// Dressing v4 (etapa 6, DESIGN §5.2 — c2, c3, c7):
// - doorType neschimbat (SLIDING / HINGED / OPEN);
// - material = setul BODY (+ "decide firma"), titlu nou;
// - + openingSystems (lista GENERAL, fara "Fara usi sau sertare") pe ecranul materialului,
//   DOAR la usi batante. Glisante → GLISANTE fara intrebare; fara usi → [] (N9).
// v3 ramane FROZEN.

const F = 'flows.DRESSING';
const MATERIAL_SCREEN = 'materialScreen';

const ifHinged: Condition = { questionId: 'doorType', equals: 'HINGED' };

const v3 = (id: string): QuestionStep => {
  const step = dressingFlowV3.steps.find((s) => s.id === id);
  if (!step) throw new Error(`dressing v3 step lipsa: ${id}`);
  return step;
};

const openingSystemsStep: MultiChoiceStep = {
  id: 'openingSystems',
  type: 'multi-choice',
  titleKey: `${F}.v4.openingSystems.title`,
  subtitleKey: 'common.finish.opening.subtitle',
  screenGroup: MATERIAL_SCREEN,
  visibleIf: ifHinged,
  minSelected: 1,
  options: openingOptions('GENERAL'),
};

const dimensionsStep = v3('dimensions') as DimensionGroupStep;

export const dressingFlowV4: RoomFlow = {
  roomType: 'DRESSING',
  version: 4,
  steps: [
    v3('layout'),
    dimensionsStep,
    v3('doorType'),
    v3('interiorModules'),
    {
      ...v3('material'),
      titleKey: `${F}.v4.material.title`,
      subtitleKey: `${F}.v4.material.subtitle`,
      options: materialSetOptions('BODY'),
    } as QuestionStep,
    v3('materialOther'),
    openingSystemsStep,
    v3('sketch'),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const doorType = typeof answers.doorType === 'string' ? answers.doorType : 'HINGED';
    const modules = Array.isArray(answers.interiorModules) ? (answers.interiorModules as string[]) : [];
    const materialValue = typeof answers.material === 'string' ? answers.material : undefined;
    const m = resolveMaterial(
      materialValue,
      'BODY',
      typeof answers.materialOther === 'string' ? answers.materialOther : undefined,
    );

    let systems: ItemSystem[] = [];
    let openingNotes: string[] = [];
    let firmOpening = false;
    if (doorType === 'SLIDING') {
      systems = ['GLISANTE'];
    } else if (doorType === 'HINGED') {
      const o = resolveOpening(Array.isArray(answers.openingSystems) ? (answers.openingSystems as string[]) : undefined);
      systems = o.systems;
      openingNotes = o.notes;
      firmOpening = o.firmDecides;
    }

    const furnishings = modules.filter((mod) => mod !== 'LED_LIGHTING');
    const hasDoors = doorType === 'SLIDING' || doorType === 'HINGED';
    const bodyNote = hasDoors && materialValue !== undefined && materialValue !== FIRM_DECIDES ? BODY_NOTE : undefined;
    const description = finishDescription([
      furnishings.length > 0 ? `Interior: ${interiorModulesText(furnishings)}` : undefined,
      modules.includes('LED_LIGHTING') ? 'iluminare LED' : undefined,
      bodyNote,
      ...m.notes,
      ...openingNotes,
    ]);

    const item: RequestItemInput = { name: 'Dressing', material: m.material, systems, quantity: 1 };
    if (description) item.description = description;
    const firmRecommendations: FirmRecommendation[] =
      m.firmDecides || firmOpening ? [{ itemName: 'Dressing', material: m.firmDecides, opening: firmOpening }] : [];

    return {
      lengthM: linearMeters(dimensionsStep, answers),
      widthM: STANDARD_CABINET_DEPTH,
      heightM: values.wardrobeHeight ?? 2.4,
      items: [item],
      firmRecommendations,
    };
  },
};
