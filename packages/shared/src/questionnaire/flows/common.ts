import type { ItemSystem, Material } from '../../enums';
import type { ChoiceOption, DimensionSlot, TextStep } from '../types';

// Optiuni si sloturi partajate intre flow-uri. Cheile i18n stau sub
// 'Configurator.common.*' ca sa nu se dubleze continutul editorial per camera.
// Materialele si sistemele folosesc enum-urile VERBATIM (docs/04) si NU au
// scoring ref explicit: puncteaza prin items-urile derivate (MATERIAL/SYSTEM),
// exact ca in SizingService — un ref aici ar dubla punctajul.

// Seturi oferite (decizie PO 2026-07-08). Cele legacy raman default-ul
// flow-urilor neatinse inca (migreaza in sprintul F4); kitchen v2 primeste
// explicit setul nou. MDF simplu / BUTON_PRESIUNE nu se mai ofera la nou.
export const OFFERED_MATERIALS: readonly Material[] = [
  'PAL',
  'MDF_INFOLIAT',
  'MDF_VOPSIT',
  'MDF_FURNIR',
  'LEMN_MASIV',
  'ALTUL',
];
const LEGACY_MATERIALS: readonly Material[] = ['PAL', 'MDF', 'LEMN_MASIV'];

export const KITCHEN_SYSTEMS_BASE: readonly ItemSystem[] = ['MANER', 'PUSH', 'GOLA'];
export const KITCHEN_SYSTEMS_WALL: readonly ItemSystem[] = ['MANER', 'PUSH', 'GOLA', 'AVENTOS'];
// Setul general pentru mobilier de camera (feedback PO F4): maner clasic,
// push si glisant. Gola/Aventos raman specifice bucatariei.
export const GENERAL_SYSTEMS: readonly ItemSystem[] = ['MANER', 'PUSH', 'GLISANTE'];
const LEGACY_SYSTEMS: readonly ItemSystem[] = ['PUSH', 'GLISANTE', 'BUTON_PRESIUNE'];

const materialIcon: Record<string, string> = {
  PAL: 'layers',
  MDF: 'panel-top',
  MDF_INFOLIAT: 'panel-top',
  MDF_VOPSIT: 'paintbrush',
  MDF_FURNIR: 'layers-2',
  LEMN_MASIV: 'tree-pine',
  ALTUL: 'pencil',
};

export function materialOptions(values: readonly Material[] = LEGACY_MATERIALS): ChoiceOption[] {
  return values.map((m) => ({
    value: m,
    labelKey: `common.materials.${m}.label`,
    descriptionKey: `common.materials.${m}.description`,
    icon: materialIcon[m],
    // ALTUL nu e un material concret: fara card educativ pros/cons
    info:
      m === 'ALTUL'
        ? undefined
        : {
            titleKey: `common.materials.${m}.info.title`,
            bodyKey: `common.materials.${m}.info.body`,
            prosKeys: [1, 2, 3].map((i) => `common.materials.${m}.info.pros${i}`),
            consKeys: [1, 2].map((i) => `common.materials.${m}.info.cons${i}`),
            priceHintKey: `common.materials.${m}.info.price`,
          },
  }));
}

// Step conditional "alt material": text liber pe acelasi ecran cu intrebarea
// de material, vizibil doar cand s-a ales ALTUL. Textul intra in description-ul
// itemului derivat. Chei i18n comune (common.otherMaterial.*).
export function otherMaterialStep(materialStepId: string, screenGroup: string): TextStep {
  return {
    id: `${materialStepId}Other`,
    type: 'text',
    maxLength: 120,
    titleKey: 'common.otherMaterial.title',
    subtitleKey: 'common.otherMaterial.subtitle',
    screenGroup,
    visibleIf: { questionId: materialStepId, equals: 'ALTUL' },
  };
}

const systemIcon: Record<string, string> = {
  PUSH: 'hand',
  GLISANTE: 'move-horizontal',
  BUTON_PRESIUNE: 'circle-dot',
  MANER: 'grip-horizontal',
  GOLA: 'rectangle-horizontal',
  AVENTOS: 'arrow-up-from-line',
};

export function systemOptions(values: readonly ItemSystem[] = LEGACY_SYSTEMS): ChoiceOption[] {
  return values.map((s) => ({
    value: s,
    labelKey: `common.systems.${s}.label`,
    descriptionKey: `common.systems.${s}.description`,
    icon: systemIcon[s],
    info: {
      titleKey: `common.systems.${s}.info.title`,
      bodyKey: `common.systems.${s}.info.body`,
      prosKeys: [1, 2].map((i) => `common.systems.${s}.info.pros${i}`),
      consKeys: [1, 2].map((i) => `common.systems.${s}.info.cons${i}`),
      priceHintKey: `common.systems.${s}.info.price`,
    },
  }));
}

// d1 (etapa 3): textele generate pentru firma folosesc cuvintele din chestionar (aceleasi
// etichete pe care le vede clientul in ro.json), niciodata codurile interne.
const INTERIOR_MODULE_TEXT: Record<string, string> = {
  HANGING_RODS: 'bare de agățat',
  SHELVES: 'rafturi',
  DRAWERS: 'sertare',
  SHOE_RACK: 'suport de pantofi',
  ACCESSORIES: 'accesorii',
  LED_LIGHTING: 'iluminare LED',
};

// un cod necunoscut nu ajunge niciodata brut la firma
function humanizeCode(code: string): string {
  return code.toLowerCase().replace(/_/g, ' ');
}

export function interiorModulesText(modules: readonly string[]): string {
  return modules.map((m) => INTERIOR_MODULE_TEXT[m] ?? humanizeCode(m)).join(', ');
}

const TV_SETUP_TEXT: Record<string, string> = {
  TV_ON_WALL: 'TV pe perete',
  TV_ON_UNIT: 'TV pe comodă',
  UNDECIDED: 'TV: nedecis',
};

export function tvSetupText(setup: string): string {
  return TV_SETUP_TEXT[setup] ?? `TV: ${humanizeCode(setup)}`;
}

const SEATS_TEXT: Record<string, string> = {
  FOUR: '4 locuri',
  SIX: '6 locuri',
  EIGHT_PLUS: '8+ locuri',
};

export function seatsText(seats: string): string {
  return SEATS_TEXT[seats] ?? `${humanizeCode(seats)} locuri`;
}

// dimensiuni pentru firma: "90 × 200" (semnul inmultirii, nu litera x)
export function dimsText(...values: (number | string)[]): string {
  return values.join(' × ');
}

export function ceilingHeightSlot(): DimensionSlot {
  return {
    id: 'ceilingHeight',
    labelKey: 'common.slots.ceilingHeight',
    unit: 'm',
    min: 2,
    max: 4,
    step: 0.05,
  };
}

// Slot liniar (front de mobilier / latura de plan) — intra in metri liniari.
export function linearSlot(
  id: string,
  labelKey: string,
  opts?: { min?: number; max?: number },
): DimensionSlot {
  return {
    id,
    labelKey,
    unit: 'm',
    min: opts?.min ?? 0.5,
    max: opts?.max ?? 10,
    step: 0.1,
    countsTowardLinear: true,
  };
}
