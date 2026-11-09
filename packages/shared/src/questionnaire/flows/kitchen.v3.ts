import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { BooleanStep, Condition, DimensionGroupStep, QuestionStep, RoomFlow } from '../types';
import { kitchenFlowV2 } from './kitchen.v2';

// Bucatarie v3 (Laws of UX, decizie PO 2026-11-08): 11 ecrane → 6 sectiuni fixe.
// 1 Forma (+ insula) · 2 Dimensiuni · 3 Fronturi · 4 Blat · 5 Electrocasnice · 6 Schita.
// - Fronturi = UN ecran: materialul, bifa "materiale diferite pe zone" si
//   sistemele de deschidere pentru toate zonele (screenGroup 'fronts').
// - Implicit acelasi material peste tot: frontMaterialWall/Island apar doar cu
//   separateFrontMaterials = true; deriveRoom copiaza materialul de baza.
// - Aceleasi id-uri de intrebare si aceleasi categorii de scor ca v2 → formula
//   costului in credite nu se schimba (itemii au aceleasi materiale/sisteme).
// - Insula nu mai adauga ecrane, deci progresul nu mai sare inapoi.
// v2 ramane FROZEN (cererile publicate/drafturile vechi se valideaza contra ei).

const F = 'flows.KITCHEN';
const FRONTS = 'fronts';

const ifIsland: Condition = { questionId: 'hasIsland', equals: true };
const ifSeparate: Condition = { questionId: 'separateFrontMaterials', equals: true };

const v2 = (id: string): QuestionStep => {
  const step = kitchenFlowV2.steps.find((s) => s.id === id);
  if (!step) throw new Error(`kitchen v2 step lipsa: ${id}`);
  return step;
};

// pasii v2 refolositi cu alt ecran / alta vizibilitate (copii, v2 ramane neatins)
const onFronts = (id: string, extra: Partial<QuestionStep> = {}): QuestionStep =>
  ({ ...v2(id), screenGroup: FRONTS, ...extra }) as QuestionStep;

const separateFrontMaterials: BooleanStep = {
  id: 'separateFrontMaterials',
  type: 'boolean',
  titleKey: `${F}.separateFrontMaterials.title`,
  subtitleKey: `${F}.separateFrontMaterials.subtitle`,
  cardLabelKey: `${F}.separateFrontMaterials.cardLabel`,
  screenGroup: FRONTS,
  toggleStyle: 'checkbox',
  // lipsa raspuns = acelasi material peste tot
  optional: true,
};

const dimensionsStep = v2('dimensions') as DimensionGroupStep;

export const kitchenFlowV3: RoomFlow = {
  roomType: 'KITCHEN',
  version: 3,
  steps: [
    v2('layout'),
    v2('hasIsland'),
    dimensionsStep,
    onFronts('frontMaterialBase', {
      titleKey: `${F}.v3.frontMaterial.title`,
      subtitleKey: `${F}.v3.frontMaterial.subtitle`,
    }),
    onFronts('frontMaterialBaseOther'),
    separateFrontMaterials,
    onFronts('frontMaterialWall', { visibleIf: ifSeparate }),
    onFronts('frontMaterialWallOther', {
      visibleIf: { all: [ifSeparate, { questionId: 'frontMaterialWall', equals: 'ALTUL' }] },
    }),
    onFronts('frontMaterialIsland', { visibleIf: { all: [ifIsland, ifSeparate] } }),
    onFronts('frontMaterialIslandOther', {
      visibleIf: { all: [ifIsland, ifSeparate, { questionId: 'frontMaterialIsland', equals: 'ALTUL' }] },
    }),
    onFronts('openingSystemsBase'),
    onFronts('openingSystemsWall'),
    onFronts('openingSystemsIsland'),
    v2('countertop'),
    v2('appliances'),
    v2('sketch'),
  ],
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const lengthM = linearMeters(dimensionsStep, answers);
    const heightM = values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;
    const widthM =
      answers.hasIsland === true && typeof values.islandDepth === 'number'
        ? values.islandDepth
        : STANDARD_CABINET_DEPTH;

    const separate = answers.separateFrontMaterials === true;
    // fara "materiale diferite", suspendatele si insula iau materialul de baza
    const materialId = (id: string) => (separate ? id : 'frontMaterialBase');
    const material = (id: string): Material => (answers[materialId(id)] as Material) ?? 'PAL';
    const systems = (id: string): ItemSystem[] =>
      Array.isArray(answers[id]) ? (answers[id] as ItemSystem[]) : [];
    const otherDesc = (id: string): string | undefined => {
      const text = answers[`${materialId(id)}Other`];
      return material(id) === 'ALTUL' && typeof text === 'string' && text.trim()
        ? `Material dorit: ${text.trim()}`
        : undefined;
    };

    const items: RequestItemInput[] = [
      {
        name: 'Corpuri baza',
        material: material('frontMaterialBase'),
        systems: systems('openingSystemsBase'),
        description: otherDesc('frontMaterialBase'),
        quantity: 1,
      },
      {
        name: 'Corpuri suspendate',
        material: material('frontMaterialWall'),
        systems: systems('openingSystemsWall'),
        description: otherDesc('frontMaterialWall'),
        quantity: 1,
      },
    ];
    if (answers.hasIsland === true) {
      items.push({
        name: 'Insula bucatarie',
        material: material('frontMaterialIsland'),
        systems: systems('openingSystemsIsland'),
        description: otherDesc('frontMaterialIsland'),
        quantity: 1,
      });
    }

    return { lengthM, widthM, heightM, items };
  },
};
