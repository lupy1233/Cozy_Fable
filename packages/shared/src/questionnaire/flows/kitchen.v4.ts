import type { RequestItemInput } from '../../request.schemas';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { DimensionGroupStep, FirmRecommendation, QuestionStep, RoomFlow } from '../types';
import {
  BODY_NOTE,
  FIRM_DECIDES,
  finishDescription,
  kitchenCountertopOptionsV4,
  materialSetOptions,
  openingOptions,
  resolveMaterial,
  resolveOpening,
  type OpeningSetKind,
} from './finish-sets';
import { kitchenFlowV3 } from './kitchen.v3';

// Bucatarie v4 (etapa 6, DESIGN §5.1 — c1, c2, c6, c7):
// - aceiasi pasi, aceleasi id-uri si aceeasi ordine ca v3 (ecranul "Fronturi" ramane;
//   impartirea pe zone din interfata merge pe id-uri);
// - materialul fronturilor = setul BODY (+ "Nu stiu — vreau recomandarea firmei");
//   corpul se face din PAL standard (nota pe piesa);
// - deschiderea: listele unice pe zone (Gola la toate, Aventos si pistoanele DOAR la
//   suspendate — N8), "decide firma" exclusiva;
// - blatul: optiunile v2 + "decide firma" (rand de scor nou KITCHEN_COUNTERTOP:FIRM_DECIDES, 0 p).
// - fara intrebarea comuna: bifa "materiale diferite pe zone" exista deja (implicit acelasi material).
// v3 ramane FROZEN.

const F = 'flows.KITCHEN';
const FRONT_SUBTITLE = 'common.finish.frontMaterial.subtitle';

const v3 = (id: string): QuestionStep => {
  const step = kitchenFlowV3.steps.find((s) => s.id === id);
  if (!step) throw new Error(`kitchen v3 step lipsa: ${id}`);
  return step;
};

const MATERIAL_STEPS: Record<string, Partial<QuestionStep>> = {
  frontMaterialBase: { titleKey: `${F}.v4.frontMaterial.title`, subtitleKey: FRONT_SUBTITLE },
  frontMaterialWall: { subtitleKey: FRONT_SUBTITLE },
  frontMaterialIsland: { subtitleKey: FRONT_SUBTITLE },
};

const OPENING_KIND: Record<string, OpeningSetKind> = {
  openingSystemsBase: 'KITCHEN_BASE',
  openingSystemsWall: 'KITCHEN_WALL',
  openingSystemsIsland: 'KITCHEN_ISLAND',
};

// copii ale pasilor v3 (v3 ramane neatins); doar optiunile / textele se schimba
const steps: QuestionStep[] = kitchenFlowV3.steps.map((step) => {
  if (step.id in MATERIAL_STEPS) {
    return { ...step, ...MATERIAL_STEPS[step.id], options: materialSetOptions('BODY') } as QuestionStep;
  }
  if (step.id in OPENING_KIND) {
    return { ...step, options: openingOptions(OPENING_KIND[step.id]) } as QuestionStep;
  }
  if (step.id === 'countertop') {
    return { ...step, options: kitchenCountertopOptionsV4() } as QuestionStep;
  }
  return step;
});

const dimensionsStep = v3('dimensions') as DimensionGroupStep;

interface Zone {
  name: string;
  materialStepId: string;
  systemsStepId: string;
  pistons: boolean;
}

const ZONES: Zone[] = [
  { name: 'Corpuri de bază', materialStepId: 'frontMaterialBase', systemsStepId: 'openingSystemsBase', pistons: false },
  { name: 'Corpuri suspendate', materialStepId: 'frontMaterialWall', systemsStepId: 'openingSystemsWall', pistons: true },
  { name: 'Insulă', materialStepId: 'frontMaterialIsland', systemsStepId: 'openingSystemsIsland', pistons: false },
];

export const kitchenFlowV4: RoomFlow = {
  roomType: 'KITCHEN',
  version: 4,
  steps,
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const lengthM = linearMeters(dimensionsStep, answers);
    const heightM = values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;
    const widthM =
      answers.hasIsland === true && typeof values.islandDepth === 'number'
        ? values.islandDepth
        : STANDARD_CABINET_DEPTH;

    const separate = answers.separateFrontMaterials === true;
    const items: RequestItemInput[] = [];
    const firmRecommendations: FirmRecommendation[] = [];

    for (const zone of ZONES) {
      if (zone.materialStepId === 'frontMaterialIsland' && answers.hasIsland !== true) continue;
      // fara "materiale diferite", suspendatele si insula iau materialul de baza (ca v3)
      const materialId = separate ? zone.materialStepId : 'frontMaterialBase';
      const raw = answers[materialId];
      const value = typeof raw === 'string' ? raw : undefined;
      const other = answers[`${materialId}Other`];
      const m = resolveMaterial(value, 'BODY', typeof other === 'string' ? other : undefined);
      const sys = answers[zone.systemsStepId];
      const o = resolveOpening(Array.isArray(sys) ? (sys as string[]) : undefined, { pistons: zone.pistons });
      // corpul din PAL standard, cu exceptia "decide firma" (firma alege tot)
      const bodyNote = value !== undefined && value !== FIRM_DECIDES ? BODY_NOTE : undefined;
      const description = finishDescription([bodyNote, ...m.notes, ...o.notes]);
      const item: RequestItemInput = { name: zone.name, material: m.material, systems: o.systems, quantity: 1 };
      if (description) item.description = description;
      items.push(item);
      if (m.firmDecides || o.firmDecides) {
        firmRecommendations.push({ itemName: zone.name, material: m.firmDecides, opening: o.firmDecides });
      }
    }

    return { lengthM, widthM, heightM, items, firmRecommendations };
  },
};
