import type { Condition, DimensionSlot, MultiChoiceStep, SingleChoiceStep } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { FIRM_DECIDES, firmDecidesOption } from './finish-sets';

// Etapa 10 (c5 / c9, DESIGN §4.1 / §4.5): constructorii comuni ai versiunilor noi ale camerelor.
// Fluxurile vechi nu ii folosesc → pasii lor raman identici.
// Reguli (PO c5-1, c5-2, c5-3):
// - latimea fiecarei piese e obligatorie si da marimea (countsTowardLinear);
// - inaltimea se cere doar la piesele inalte, optional, cu o valoare tipica ca indiciu;
// - tavanul se cere doar cand exista o piesa inalta (regula holului, generalizata);
// - peretele / balconul raman obligatorii, dar doar informative (nu mai dau marimea).

// Nimic in interfata: rezumatul regulilor de mai sus, pentru teste si documentare.
export const TALL_PIECE_SUBTITLE_NOTE =
  'Latimea fiecarei piese e obligatorie si da marimea; inaltimea doar la piesele inalte, optionala; tavanul doar cand exista o piesa inalta.';

export interface SlotRange {
  min: number;
  max: number;
}

// Latimea unei piese: obligatorie, intra in metri liniari (= linearSlot, pas 0,1 m).
export function pieceWidthSlot(id: string, labelKey: string, range: SlotRange): DimensionSlot {
  return linearSlot(id, labelKey, { min: range.min, max: range.max });
}

// Inaltimea unei piese inalte: optionala (poate ramane goala), pas 0,05 m, fara countsTowardLinear.
// typicalM = indiciul "de obicei …" (nu se salveaza, nu intra in calcul).
export function optionalHeightSlot(id: string, labelKey: string, range: SlotRange, typicalM?: number): DimensionSlot {
  return {
    id,
    labelKey,
    unit: 'm',
    min: range.min,
    max: range.max,
    step: 0.05,
    optional: true,
    ...(typicalM !== undefined ? { typicalM } : {}),
  };
}

// Perete / balcon: OBLIGATORIU, dar FARA countsTowardLinear (nu mai da marimea), pas 0,1 m.
export function informativeSlot(id: string, labelKey: string, range: SlotRange): DimensionSlot {
  return { id, labelKey, unit: 'm', min: range.min, max: range.max, step: 0.1 };
}

// [tavanul] daca vreuna din piesele bifate e inalta, altfel [].
export function ceilingIfTall(selected: readonly string[], tall: readonly string[]): DimensionSlot[] {
  return selected.some((v) => tall.includes(v)) ? [ceilingHeightSlot()] : [];
}

// Nota pentru firma cand clientul a ales "Nu stiu — vreau recomandarea firmei" (stilul FIRM_MATERIAL_NOTE).
export const FIRM_DECIDES_NOTE_TEXT = 'clientul vrea recomandarea firmei';

export interface OptionalChoiceDef {
  id: string;
  titleKey: string;
  subtitleKey?: string;
  screenGroup?: string;
  visibleIf?: Condition;
  icon?: string;
  // categoria de scor (randuri noi, 0 puncte); fiecare optiune puncteaza `category:<VALUE>`
  category: string;
  // FARA FIRM_DECIDES: se adauga automat la final
  options: { value: string; icon?: string; visibleIf?: Condition }[];
  // `flows.<ROOM>.v<N>.<id>` → `${keyPrefix}.options.<VALUE>.{label,description}`
  keyPrefix: string;
  // multi-choice (FIRM_DECIDES exclusiv)
  multi?: boolean;
  // abatere fata de proiect (E10-N15, holul): eticheta proprie pentru "Nu stiu"; lipsa = cheia comuna
  firmDecidesLabelKey?: string;
}

// Intrebarea noua de tip alegere: optionala, cu "Nu stiu — vreau recomandarea firmei" ca ultima optiune.
export function optionalChoiceStep(def: OptionalChoiceDef & { multi: true }): MultiChoiceStep;
export function optionalChoiceStep(def: OptionalChoiceDef & { multi?: false }): SingleChoiceStep;
export function optionalChoiceStep(def: OptionalChoiceDef): SingleChoiceStep | MultiChoiceStep;
export function optionalChoiceStep(def: OptionalChoiceDef): SingleChoiceStep | MultiChoiceStep {
  const multi = def.multi === true;
  const firm = firmDecidesOption(multi);
  const options = [
    ...def.options.map((o) => ({
      value: o.value,
      labelKey: `${def.keyPrefix}.options.${o.value}.label`,
      descriptionKey: `${def.keyPrefix}.options.${o.value}.description`,
      ...(o.icon !== undefined ? { icon: o.icon } : {}),
      ...(o.visibleIf !== undefined ? { visibleIf: o.visibleIf } : {}),
      scoring: { category: def.category, optionKey: o.value },
    })),
    {
      ...firm,
      ...(def.firmDecidesLabelKey !== undefined ? { labelKey: def.firmDecidesLabelKey } : {}),
      scoring: { category: def.category, optionKey: FIRM_DECIDES },
    },
  ];
  const base = {
    id: def.id,
    titleKey: def.titleKey,
    ...(def.subtitleKey !== undefined ? { subtitleKey: def.subtitleKey } : {}),
    ...(def.screenGroup !== undefined ? { screenGroup: def.screenGroup } : {}),
    ...(def.visibleIf !== undefined ? { visibleIf: def.visibleIf } : {}),
    ...(def.icon !== undefined ? { icon: def.icon } : {}),
    optional: true,
    options,
  };
  return multi ? { ...base, type: 'multi-choice' } : { ...base, type: 'single-choice' };
}

// "Chiuvetă: montată sub blat"; FIRM_DECIDES → "Chiuvetă: clientul vrea recomandarea firmei"; lipsa → undefined.
// O valoare fara text (nu ar trebui sa existe) devine text citibil, nu codul brut.
export function noteFor(
  label: string,
  value: string | undefined,
  texts: Readonly<Record<string, string>>,
): string | undefined {
  if (value === undefined) return undefined;
  if (value === FIRM_DECIDES) return `${label}: ${FIRM_DECIDES_NOTE_TEXT}`;
  return `${label}: ${texts[value] ?? value.toLowerCase().replace(/_/g, ' ')}`;
}
