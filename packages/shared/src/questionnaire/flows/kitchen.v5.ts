import type { RequestItemInput } from '../../request.schemas';
import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type {
  AnswerMap,
  Condition,
  DimensionGroupStep,
  DimensionSlot,
  FirmRecommendation,
  QuestionStep,
  RoomFlow,
} from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { BODY_NOTE, FIRM_DECIDES, finishDescription, resolveMaterial, resolveOpening } from './finish-sets';
import { kitchenFlowV4 } from './kitchen.v4';
import { FIRM_DECIDES_NOTE_TEXT, noteFor, optionalChoiceStep } from './measure-sets';

// Bucatarie v5 (etapa 10, formularul v7 — DESIGN §5.0 / §5.1; PO c9-1, c9-3, c5):
// - + `wallCabinets` pe ecranul formei: "Fara corpuri suspendate" → piesa suspendatelor nu se mai
//   creeaza, iar intrebarile ei (material + deschidere) dispar de pe ecranul Fronturi;
//   "Nu stiu" pastreaza piesa (firma propune), cu nota pe ea;
// - + chiuveta (montaj + material) pe ecranul blatului; + frigiderul doar cu "Frigider" bifat,
//   pe ecranul electrocasnicelor; electrocasnicele, frigiderul si chiuveta ajung in descrierea
//   piesei "Corpuri de baza" (pasul 4 al planului, E10-N5);
// - dimensiuni: latura B / C de la 0,6 m (A ramane de la 1 m); tavanul ramane mereu (c5 pasul 3).
// Toate intrebarile noi sunt optionale, cu "Nu stiu — vreau recomandarea firmei", 0 puncte.
// v4 ramane FROZEN: pasii ei nu se modifica pe loc (aici se construiesc copii).

const F = 'flows.KITCHEN';
const V = `${F}.v5`;
const LAYOUT_SCREEN = 'layoutScreen';
const COUNTERTOP_SCREEN = 'countertopScreen';
const APPLIANCES_SCREEN = 'appliancesScreen';

export const NO_WALL_CABINETS = 'NO_WALL_CABINETS';
export const NO_WALL_CABINETS_NOTE = 'Fără corpuri suspendate';
export const WALL_CABINETS_FIRM_NOTE = `Corpuri suspendate: ${FIRM_DECIDES_NOTE_TEXT}`;

// textele pentru firma (RO, cu diacritice; termenii din docs/glosar.md)
export const APPLIANCE_TEXT: Readonly<Record<string, string>> = {
  OVEN: 'cuptor',
  HOB: 'plită',
  HOOD: 'hotă',
  DISHWASHER: 'mașină de spălat vase',
  FRIDGE: 'frigider',
  MICROWAVE: 'cuptor cu microunde',
};
export const FRIDGE_TEXT: Readonly<Record<string, string>> = {
  BUILT_IN: 'încorporabil',
  FREESTANDING: 'independent',
};
export const SINK_MATERIAL_TEXT: Readonly<Record<string, string>> = {
  STAINLESS: 'inox',
  COMPOSITE: 'compozit (granit)',
  CERAMIC: 'ceramică',
};
export const SINK_MOUNTING_TEXT: Readonly<Record<string, string>> = {
  INSET: 'încastrată în blat',
  UNDERMOUNT: 'montată sub blat',
};

const notNoWall: Condition = { not: { questionId: 'wallCabinets', equals: NO_WALL_CABINETS } };
const withNotNoWall = (visibleIf: Condition | undefined): Condition =>
  visibleIf ? { all: [visibleIf, notNoWall] } : notNoWall;

// ---------------------------------------------------------------- intrebarile noi
const wallCabinetsStep = optionalChoiceStep({
  id: 'wallCabinets',
  titleKey: `${V}.wallCabinets.title`,
  subtitleKey: `${V}.wallCabinets.subtitle`,
  screenGroup: LAYOUT_SCREEN,
  category: 'KITCHEN_WALL_CABINETS',
  keyPrefix: `${V}.wallCabinets`,
  options: [{ value: 'WALL_CABINETS' }, { value: NO_WALL_CABINETS }],
});

const sinkMountingStep = optionalChoiceStep({
  id: 'sinkMounting',
  titleKey: `${V}.sinkMounting.title`,
  subtitleKey: `${V}.sinkMounting.subtitle`,
  screenGroup: COUNTERTOP_SCREEN,
  category: 'KITCHEN_SINK_MOUNTING',
  keyPrefix: `${V}.sinkMounting`,
  options: [{ value: 'INSET' }, { value: 'UNDERMOUNT' }],
});

const sinkMaterialStep = optionalChoiceStep({
  id: 'sinkMaterial',
  titleKey: `${V}.sinkMaterial.title`,
  subtitleKey: `${V}.sinkMaterial.subtitle`,
  screenGroup: COUNTERTOP_SCREEN,
  category: 'KITCHEN_SINK_MATERIAL',
  keyPrefix: `${V}.sinkMaterial`,
  options: [{ value: 'STAINLESS' }, { value: 'COMPOSITE' }, { value: 'CERAMIC' }],
});

const fridgeTypeStep = optionalChoiceStep({
  id: 'fridgeType',
  titleKey: `${V}.fridgeType.title`,
  subtitleKey: `${V}.fridgeType.subtitle`,
  screenGroup: APPLIANCES_SCREEN,
  visibleIf: { questionId: 'appliances', in: ['FRIDGE'] },
  category: 'KITCHEN_FRIDGE',
  keyPrefix: `${V}.fridgeType`,
  options: [{ value: 'BUILT_IN' }, { value: 'FREESTANDING' }],
});

// ---------------------------------------------------------------- dimensiuni (c5)
const LAYOUT_RUNS: Record<string, string[]> = {
  STRAIGHT: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
};
// latura A ramane de la 1 m; B / C de la 0,6 m (un colt scurt e normal la L / U)
const RUN_MIN: Record<string, number> = { runA: 1, runB: 0.6, runC: 0.6 };

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const layout = typeof answers.layout === 'string' ? answers.layout : 'STRAIGHT';
  const runs = LAYOUT_RUNS[layout] ?? LAYOUT_RUNS.STRAIGHT;
  const slots = runs.map((id) => linearSlot(id, `${F}.dimensions.slots.${id}`, { min: RUN_MIN[id] ?? 1 }));
  slots.push(ceilingHeightSlot());
  if (answers.hasIsland === true) {
    slots.push(linearSlot('islandLength', `${F}.dimensions.slots.islandLength`, { min: 0.8, max: 4 }));
    slots.push({
      id: 'islandDepth',
      labelKey: `${F}.dimensions.slots.islandDepth`,
      unit: 'm',
      min: 0.6,
      max: 1.5,
      step: 0.05,
    });
  }
  return slots;
}

const v4Dimensions = (): DimensionGroupStep => {
  const s = kitchenFlowV4.steps.find((x) => x.id === 'dimensions');
  if (!s || s.type !== 'dimension-group') throw new Error('kitchen v4 step lipsa: dimensions');
  return s;
};

// aceleasi chei (titlu / subtitlu) ca v4: textul ramane adevarat; doar limitele se schimba
const dimensionsStep: DimensionGroupStep = { ...v4Dimensions(), slots: dimensionSlots };

// ---------------------------------------------------------------- pasii (copii ale v4)
const WALL_STEPS = new Set(['frontMaterialWall', 'frontMaterialWallOther', 'openingSystemsWall']);

const steps: QuestionStep[] = kitchenFlowV4.steps.flatMap((step): QuestionStep[] => {
  if (step.id === 'hasIsland') return [step, wallCabinetsStep];
  if (step.id === 'dimensions') return [dimensionsStep];
  if (WALL_STEPS.has(step.id)) return [{ ...step, visibleIf: withNotNoWall(step.visibleIf) } as QuestionStep];
  if (step.id === 'countertop') {
    return [{ ...step, screenGroup: COUNTERTOP_SCREEN } as QuestionStep, sinkMountingStep, sinkMaterialStep];
  }
  if (step.id === 'appliances') return [{ ...step, screenGroup: APPLIANCES_SCREEN } as QuestionStep, fridgeTypeStep];
  return [step];
});

// ---------------------------------------------------------------- notele pentru firma
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// "Chiuvetă: compozit (granit), montată sub blat"; ambele "Nu stiu" → nota comuna;
// doar una "Nu stiu" → cea data + cine alege cealalta
export function sinkNote(material: string | undefined, mounting: string | undefined): string | undefined {
  if (material === undefined && mounting === undefined) return undefined;
  const firmMaterial = material === FIRM_DECIDES;
  const firmMounting = mounting === FIRM_DECIDES;
  if ((firmMaterial || material === undefined) && (firmMounting || mounting === undefined)) {
    return `Chiuvetă: ${FIRM_DECIDES_NOTE_TEXT}`;
  }
  const parts: string[] = [];
  if (material !== undefined) {
    parts.push(firmMaterial ? 'materialul îl recomandă firma' : (SINK_MATERIAL_TEXT[material] ?? material));
  }
  if (mounting !== undefined) {
    parts.push(firmMounting ? 'montajul îl recomandă firma' : (SINK_MOUNTING_TEXT[mounting] ?? mounting));
  }
  return `Chiuvetă: ${parts.join(', ')}`;
}

function appliancesNote(appliances: readonly string[]): string | undefined {
  const known = appliances.filter((a) => APPLIANCE_TEXT[a] !== undefined);
  return known.length > 0 ? `Electrocasnice: ${known.map((a) => APPLIANCE_TEXT[a]).join(', ')}` : undefined;
}

interface Zone {
  name: string;
  materialStepId: string;
  systemsStepId: string;
  pistons: boolean;
}

const BASE_ZONE = 'Corpuri de bază';
const WALL_ZONE = 'Corpuri suspendate';

const ZONES: Zone[] = [
  { name: BASE_ZONE, materialStepId: 'frontMaterialBase', systemsStepId: 'openingSystemsBase', pistons: false },
  { name: WALL_ZONE, materialStepId: 'frontMaterialWall', systemsStepId: 'openingSystemsWall', pistons: true },
  { name: 'Insulă', materialStepId: 'frontMaterialIsland', systemsStepId: 'openingSystemsIsland', pistons: false },
];

export const kitchenFlowV5: RoomFlow = {
  roomType: 'KITCHEN',
  version: 5,
  steps,
  deriveRoom: (answers) => {
    const values = dimensionValues(answers, 'dimensions');
    const lengthM = linearMeters(dimensionsStep, answers);
    const heightM = values.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;
    const widthM =
      answers.hasIsland === true && typeof values.islandDepth === 'number'
        ? values.islandDepth
        : STANDARD_CABINET_DEPTH;

    const wallCabinets = str(answers.wallCabinets);
    const noWall = wallCabinets === NO_WALL_CABINETS;
    const appliances = Array.isArray(answers.appliances) ? (answers.appliances as string[]) : [];
    const fridgeType = appliances.includes('FRIDGE') ? str(answers.fridgeType) : undefined;

    // notele noi, dupa notele etapei 6 ale fiecarei piese
    const extraNotes: Record<string, (string | undefined)[]> = {
      [BASE_ZONE]: [
        appliancesNote(appliances),
        noteFor('Frigider', fridgeType, FRIDGE_TEXT),
        sinkNote(str(answers.sinkMaterial), str(answers.sinkMounting)),
        noWall ? NO_WALL_CABINETS_NOTE : undefined,
      ],
      [WALL_ZONE]: [wallCabinets === FIRM_DECIDES ? WALL_CABINETS_FIRM_NOTE : undefined],
    };

    const separate = answers.separateFrontMaterials === true;
    const items: RequestItemInput[] = [];
    const firmRecommendations: FirmRecommendation[] = [];

    for (const zone of ZONES) {
      if (zone.materialStepId === 'frontMaterialIsland' && answers.hasIsland !== true) continue;
      // "Fara corpuri suspendate": piesa nu se creeaza (nici recomandarea firmei pe ea)
      if (zone.name === WALL_ZONE && noWall) continue;
      // fara "materiale diferite", suspendatele si insula iau materialul de baza (ca v4)
      const materialId = separate ? zone.materialStepId : 'frontMaterialBase';
      const raw = answers[materialId];
      const value = typeof raw === 'string' ? raw : undefined;
      const other = answers[`${materialId}Other`];
      const m = resolveMaterial(value, 'BODY', typeof other === 'string' ? other : undefined);
      const sys = answers[zone.systemsStepId];
      const o = resolveOpening(Array.isArray(sys) ? (sys as string[]) : undefined, { pistons: zone.pistons });
      const bodyNote = value !== undefined && value !== FIRM_DECIDES ? BODY_NOTE : undefined;
      const description = finishDescription([bodyNote, ...m.notes, ...o.notes, ...(extraNotes[zone.name] ?? [])]);
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
