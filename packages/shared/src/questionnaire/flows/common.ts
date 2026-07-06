import { ITEM_SYSTEMS, MATERIALS } from '../../enums';
import type { ChoiceOption, DimensionSlot } from '../types';

// Optiuni si sloturi partajate intre flow-uri. Cheile i18n stau sub
// 'Configurator.common.*' ca sa nu se dubleze continutul editorial per camera.
// Materialele si sistemele folosesc enum-urile VERBATIM (docs/04) si NU au
// scoring ref explicit: puncteaza prin items-urile derivate (MATERIAL/SYSTEM),
// exact ca in SizingService — un ref aici ar dubla punctajul.

const materialIcon: Record<string, string> = {
  PAL: 'layers',
  MDF: 'panel-top',
  LEMN_MASIV: 'tree-pine',
};

export function materialOptions(): ChoiceOption[] {
  return MATERIALS.map((m) => ({
    value: m,
    labelKey: `common.materials.${m}.label`,
    descriptionKey: `common.materials.${m}.description`,
    icon: materialIcon[m],
    info: {
      titleKey: `common.materials.${m}.info.title`,
      bodyKey: `common.materials.${m}.info.body`,
      prosKeys: [1, 2, 3].map((i) => `common.materials.${m}.info.pros${i}`),
      consKeys: [1, 2].map((i) => `common.materials.${m}.info.cons${i}`),
      priceHintKey: `common.materials.${m}.info.price`,
    },
  }));
}

const systemIcon: Record<string, string> = {
  PUSH: 'hand',
  GLISANTE: 'move-horizontal',
  BUTON_PRESIUNE: 'circle-dot',
};

export function systemOptions(): ChoiceOption[] {
  return ITEM_SYSTEMS.map((s) => ({
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
