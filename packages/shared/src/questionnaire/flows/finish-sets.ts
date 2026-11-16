import { ITEM_SYSTEMS, type ItemSystem, type Material } from '../../enums';
import type { ChoiceOption } from '../types';
import { materialOptions, systemOptions } from './common';

// Etapa 6 (c1, c2, c3, c6, c7): seturile noi de material si lista unica de deschidere.
// common.ts NU se atinge (il importa fluxurile inghetate); de aici se refolosesc doar
// materialOptions / systemOptions, ca sa pastram cheile de info existente.
// Valorile speciale de mai jos sunt string-uri in RASPUNSURI, nu valori de enum:
// derivarea (resolveMaterial / resolveOpening) le transforma in Material / ItemSystem existente.

export const FIRM_DECIDES = 'FIRM_DECIDES' as const;
export const NO_FRONTS = 'NO_FRONTS' as const;
export const PISTONS = 'PISTONS' as const;
export const MDF_INTEGRAL = 'MDF_INTEGRAL' as const;

export type MaterialSetKind = 'BODY' | 'PANEL' | 'WOOD' | 'MIRROR' | 'WORKTOP';
export type OpeningSetKind = 'GENERAL' | 'KITCHEN_BASE' | 'KITCHEN_WALL' | 'KITCHEN_ISLAND';

// CP-30 / N15: un singur material implicit in versiunile noi (apare doar in previzualizarea
// ciornelor — la publicare pasul de material e obligatoriu)
export const DEFAULT_MATERIAL_WHEN_MISSING: Material = 'ALTUL';

// limita requestItemSchema.description
export const ITEM_DESCRIPTION_MAX = 2000;

// Textele adaugate in descrierea piesei, pentru firma (RO, fara coduri interne).
export const BODY_NOTE = 'Corp: PAL standard';
export const INTEGRAL_MDF_NOTE = 'Corp și fronturi din MDF';
export const FIRM_MATERIAL_NOTE = 'Material: clientul vrea recomandarea firmei';
export const FIRM_OPENING_NOTE = 'Deschidere: clientul vrea recomandarea firmei';
export const NO_FRONTS_NOTE = 'Fără uși sau sertare';
export const PISTONS_NOTE = 'Uși rabatabile pe pistoane (în sus sau în jos)';
export const FRAME_BY_FIRM_NOTE = 'Cadru: îl alege firma';
export const FRAME_NOTES: Readonly<Record<string, string>> = {
  MIRROR_FRAMELESS: 'Ramă: fără ramă',
  MIRROR_FRAME_WOOD: 'Ramă: lemn',
  MIRROR_FRAME_MDF: 'Ramă: MDF vopsit',
  MIRROR_FRAME_METAL: 'Ramă: metal',
  FIRM_DECIDES: 'Ramă: clientul vrea recomandarea firmei',
};
export const WORKTOP_NOTES: Readonly<Record<string, string>> = {
  WORKTOP_PAL_POSTFORMED: 'Blat: PAL postformat',
  WORKTOP_HPL: 'Blat: HPL',
  WORKTOP_HPL_COMPACT: 'Blat: HPL compact',
  WORKTOP_QUARTZ: 'Blat: cuarț',
  WORKTOP_SOLID_WOOD: 'Blat: lemn masiv',
  FIRM_DECIDES: 'Blat: clientul vrea recomandarea firmei',
};

export const MIRROR_OPTION_VALUES = ['MIRROR_FRAMELESS', 'MIRROR_FRAME_WOOD', 'MIRROR_FRAME_MDF', 'MIRROR_FRAME_METAL'] as const;
export const WORKTOP_OPTION_VALUES = [
  'WORKTOP_PAL_POSTFORMED',
  'WORKTOP_HPL',
  'WORKTOP_HPL_COMPACT',
  'WORKTOP_QUARTZ',
  'WORKTOP_SOLID_WOOD',
] as const;
export const WOOD_OPTION_VALUES = ['LEMN_MASIV', 'MDF_FURNIR', 'PAL'] as const;

// Cum se salveaza fiecare valoare speciala de material (enum-uri existente — N4, tabelele 2.2).
const SPECIAL_MATERIAL: Readonly<Record<string, Material>> = {
  [MDF_INTEGRAL]: 'MDF',
  MIRROR_FRAMELESS: 'ALTUL',
  MIRROR_FRAME_WOOD: 'LEMN_MASIV',
  MIRROR_FRAME_MDF: 'MDF_VOPSIT',
  MIRROR_FRAME_METAL: 'ALTUL',
  WORKTOP_PAL_POSTFORMED: 'PAL',
  WORKTOP_HPL: 'ALTUL',
  WORKTOP_HPL_COMPACT: 'ALTUL',
  WORKTOP_QUARTZ: 'ALTUL',
  WORKTOP_SOLID_WOOD: 'LEMN_MASIV',
};

const BODY_MATERIALS: readonly Material[] = ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV'];

const K = 'common.finish';

// Subtitlul materialului de fronturi. Cu "Integral din MDF" pe ecran (baie, balcon, lavoar)
// nu mai afirma ca "corpul se face din PAL standard" (revizuire m4).
export const FRONT_MATERIAL_SUBTITLE_KEY = `${K}.frontMaterial.subtitle`;
export const FRONT_MATERIAL_INTEGRAL_SUBTITLE_KEY = `${K}.frontMaterial.subtitleIntegral`;
export function frontMaterialSubtitleKey(integralMdf = false): string {
  return integralMdf ? FRONT_MATERIAL_INTEGRAL_SUBTITLE_KEY : FRONT_MATERIAL_SUBTITLE_KEY;
}

export function firmDecidesOption(exclusive = false): ChoiceOption {
  return {
    value: FIRM_DECIDES,
    labelKey: `${K}.firmDecides.label`,
    descriptionKey: `${K}.firmDecides.description`,
    icon: 'circle-question-mark',
    ...(exclusive ? { exclusive: true } : {}),
  };
}

function integralMdfOption(): ChoiceOption {
  return {
    value: MDF_INTEGRAL,
    labelKey: `${K}.integralMdf.label`,
    descriptionKey: `${K}.integralMdf.description`,
    icon: 'panel-top',
    info: { titleKey: `${K}.integralMdf.info.title`, bodyKey: `${K}.integralMdf.info.body` },
  };
}

const MIRROR_ICON: Record<string, string> = {
  MIRROR_FRAMELESS: 'scan',
  MIRROR_FRAME_WOOD: 'frame',
  MIRROR_FRAME_MDF: 'paintbrush',
  MIRROR_FRAME_METAL: 'square',
};
const WORKTOP_ICON: Record<string, string> = {
  WORKTOP_PAL_POSTFORMED: 'layers',
  WORKTOP_HPL: 'rectangle-horizontal',
  WORKTOP_HPL_COMPACT: 'droplets',
  WORKTOP_QUARTZ: 'gem',
  WORKTOP_SOLID_WOOD: 'tree-pine',
};

// Optiunile unui set de material (tabelele DESIGN 2.2). Pretul pe metru liniar apare doar
// la BODY / PANEL (cheile existente common.materials.*, cu priceHintKey); WOOD / MIRROR /
// WORKTOP nu au priceHintKey → interfata nu arata pret. integralMdf doar la BODY.
export function materialSetOptions(kind: MaterialSetKind, opts: { integralMdf?: boolean } = {}): ChoiceOption[] {
  switch (kind) {
    case 'BODY':
    case 'PANEL':
      return [
        ...materialOptions(BODY_MATERIALS),
        ...(kind === 'BODY' && opts.integralMdf ? [integralMdfOption()] : []),
        ...materialOptions(['ALTUL']),
        firmDecidesOption(),
      ];
    case 'WOOD':
      return [
        // info = cheile existente common.materials.<id>.info.*, FARA priceHintKey (c1-3)
        ...materialOptions(WOOD_OPTION_VALUES).map((o) => ({
          ...o,
          labelKey: `${K}.wood.${o.value}.label`,
          descriptionKey: `${K}.wood.${o.value}.description`,
          info: o.info && {
            titleKey: o.info.titleKey,
            bodyKey: o.info.bodyKey,
            prosKeys: o.info.prosKeys,
            consKeys: o.info.consKeys,
          },
        })),
        firmDecidesOption(),
      ];
    case 'MIRROR':
      return [
        ...MIRROR_OPTION_VALUES.map((value) => ({
          value,
          labelKey: `${K}.mirror.${value}.label`,
          descriptionKey: `${K}.mirror.${value}.description`,
          icon: MIRROR_ICON[value],
        })),
        firmDecidesOption(),
      ];
    case 'WORKTOP':
      return [
        ...WORKTOP_OPTION_VALUES.map((value) => ({
          value,
          labelKey: `${K}.worktop.${value}.label`,
          descriptionKey: `${K}.worktop.${value}.description`,
          icon: WORKTOP_ICON[value],
          info: { titleKey: `${K}.worktop.${value}.info.title`, bodyKey: `${K}.worktop.${value}.info.body` },
        })),
        firmDecidesOption(),
      ];
  }
}

// Blatul bucatariei v4 (c6-1): optiunile din kitchen v2 (identice, cu scoring KITCHEN_COUNTERTOP)
// + "decide firma" cu un rand de scor NOU KITCHEN_COUNTERTOP:FIRM_DECIDES (0 puncte, seed + migrare).
export function kitchenCountertopOptionsV4(): ChoiceOption[] {
  const F = 'flows.KITCHEN';
  return [
    ...['PAL', 'HPL', 'QUARTZ', 'GRANITE'].map((value) => ({
      value,
      labelKey: `${F}.countertop.options.${value}.label`,
      descriptionKey: `${F}.countertop.options.${value}.description`,
      info: {
        titleKey: `${F}.countertop.options.${value}.info.title`,
        bodyKey: `${F}.countertop.options.${value}.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.countertop.options.${value}.info.pros${i}`),
        consKeys: [1, 2].map((i) => `${F}.countertop.options.${value}.info.cons${i}`),
        priceHintKey: `${F}.countertop.options.${value}.info.price`,
      },
      scoring: { category: 'KITCHEN_COUNTERTOP', optionKey: value },
    })),
    { ...firmDecidesOption(), scoring: { category: 'KITCHEN_COUNTERTOP', optionKey: FIRM_DECIDES } },
  ];
}

const OPENING_SYSTEMS: Record<OpeningSetKind, readonly ItemSystem[]> = {
  GENERAL: ['MANER', 'PUSH'],
  KITCHEN_BASE: ['MANER', 'PUSH', 'GOLA'],
  KITCHEN_WALL: ['MANER', 'PUSH', 'GOLA', 'AVENTOS'],
  KITCHEN_ISLAND: ['MANER', 'PUSH', 'GOLA'],
};

// Lista unica de deschidere (tabelul DESIGN 2.3). Bife multiple; costul ia maximul.
// GLISANTE nu mai e deschidere (c3: devine tip de usi). PISTONS: mereu la KITCHEN_WALL,
// la GENERAL doar cu `pistons`. NO_FRONTS doar la GENERAL cu `noFronts`. NO_FRONTS si
// FIRM_DECIDES sunt exclusive.
export function openingOptions(
  kind: OpeningSetKind,
  opts: { pistons?: boolean; noFronts?: boolean } = {},
): ChoiceOption[] {
  const out: ChoiceOption[] = systemOptions(OPENING_SYSTEMS[kind]);
  if (kind === 'KITCHEN_WALL' || (kind === 'GENERAL' && opts.pistons)) {
    out.push({
      value: PISTONS,
      labelKey: `${K}.opening.PISTONS.label`,
      descriptionKey: `${K}.opening.PISTONS.description`,
      icon: 'arrow-up-from-line',
      info: { titleKey: `${K}.opening.PISTONS.info.title`, bodyKey: `${K}.opening.PISTONS.info.body` },
    });
  }
  if (kind === 'GENERAL' && opts.noFronts) {
    out.push({
      value: NO_FRONTS,
      labelKey: `${K}.opening.NO_FRONTS.label`,
      descriptionKey: `${K}.opening.NO_FRONTS.description`,
      icon: 'square-dashed',
      info: { titleKey: `${K}.opening.NO_FRONTS.info.title`, bodyKey: `${K}.opening.NO_FRONTS.info.body` },
      exclusive: true,
    });
  }
  out.push(firmDecidesOption(true));
  return out;
}

export interface ResolvedMaterial {
  material: Material;
  notes: string[];
  firmDecides: boolean;
}

const MATERIAL_VALUES = new Set<string>(['PAL', 'MDF', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL']);

// Raspunsul unui pas de material → Material + note pentru firma. Lipsa → ALTUL fara note.
// Nota "Corp: PAL standard" NU se pune aici (o pune constructorul, doar la BODY cu fronturi).
export function resolveMaterial(value: string | undefined, kind: MaterialSetKind, otherText?: string): ResolvedMaterial {
  if (value === undefined) return { material: DEFAULT_MATERIAL_WHEN_MISSING, notes: [], firmDecides: false };
  if (value === FIRM_DECIDES) {
    const note = kind === 'MIRROR' ? FRAME_NOTES[FIRM_DECIDES] : kind === 'WORKTOP' ? WORKTOP_NOTES[FIRM_DECIDES] : FIRM_MATERIAL_NOTE;
    return { material: 'ALTUL', notes: [note], firmDecides: true };
  }
  if (value === MDF_INTEGRAL) return { material: 'MDF', notes: [INTEGRAL_MDF_NOTE], firmDecides: false };
  const special = SPECIAL_MATERIAL[value];
  if (special) {
    const note = FRAME_NOTES[value] ?? WORKTOP_NOTES[value];
    return { material: special, notes: note ? [note] : [], firmDecides: false };
  }
  if (value === 'ALTUL') {
    const text = typeof otherText === 'string' ? otherText.trim() : '';
    return { material: 'ALTUL', notes: text ? [`Material dorit: ${text}`] : [], firmDecides: false };
  }
  if (MATERIAL_VALUES.has(value)) return { material: value as Material, notes: [], firmDecides: false };
  return { material: DEFAULT_MATERIAL_WHEN_MISSING, notes: [], firmDecides: false };
}

export interface ResolvedOpening {
  systems: ItemSystem[];
  notes: string[];
  firmDecides: boolean;
}

const SYSTEM_VALUES = new Set<string>(ITEM_SYSTEMS);

// Raspunsul unui pas de deschidere → ItemSystem[] (fara dubluri) + note. PISTONS → AVENTOS
// + nota doar cu `pistons`; NO_FRONTS / FIRM_DECIDES → [] + nota (exclusive). Lipsa → [].
export function resolveOpening(values: readonly string[] | undefined, opts: { pistons?: boolean } = {}): ResolvedOpening {
  const list = Array.isArray(values) ? values : [];
  if (list.includes(FIRM_DECIDES)) return { systems: [], notes: [FIRM_OPENING_NOTE], firmDecides: true };
  if (list.includes(NO_FRONTS)) return { systems: [], notes: [NO_FRONTS_NOTE], firmDecides: false };
  const systems: ItemSystem[] = [];
  const notes: string[] = [];
  for (const v of list) {
    if (v === PISTONS) {
      if (!opts.pistons) continue;
      if (!systems.includes('AVENTOS')) systems.push('AVENTOS');
      if (!notes.includes(PISTONS_NOTE)) notes.push(PISTONS_NOTE);
    } else if (SYSTEM_VALUES.has(v) && !systems.includes(v as ItemSystem)) {
      systems.push(v as ItemSystem);
    }
  }
  return { systems, notes, firmDecides: false };
}

// Descrierea finala a piesei: parti nevide unite cu "; ", taiata la limita schemei.
export function finishDescription(parts: readonly (string | undefined | null)[]): string | undefined {
  const text = parts.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean).join('; ');
  return text ? text.slice(0, ITEM_DESCRIPTION_MAX) : undefined;
}
