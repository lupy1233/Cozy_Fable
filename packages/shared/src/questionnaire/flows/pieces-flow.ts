import type { ItemSystem, Material } from '../../enums';
import type { RequestItemInput } from '../../request.schemas';
import type { AnswerMap, ChoiceOption } from '../types';

// Helper pentru flow-urile bazate pe "ce piese ai nevoie" (bedroom/living/office/bathroom).

export interface PieceDef {
  value: string;
  icon: string;
  // nume fallback DB, RO fara diacritice; UI randeaza din answers cu chei i18n
  itemName: string;
  quantity?: number;
}

export function pieceChoiceOptions(flowKey: string, defs: PieceDef[]): ChoiceOption[] {
  return defs.map((d) => ({
    value: d.value,
    labelKey: `${flowKey}.piecesNeeded.options.${d.value}.label`,
    descriptionKey: `${flowKey}.piecesNeeded.options.${d.value}.description`,
    icon: d.icon,
  }));
}

// Deriva items din piesele selectate + material + sisteme (raspunsuri comune).
export function buildPiecesItems(
  answers: AnswerMap,
  defs: PieceDef[],
  fallbackName: string,
): RequestItemInput[] {
  const material = (answers.material as Material) ?? 'PAL';
  const systems = Array.isArray(answers.openingSystems)
    ? (answers.openingSystems as ItemSystem[])
    : [];
  const selected = Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];

  const items: RequestItemInput[] = defs
    .filter((d) => selected.includes(d.value))
    .map((d) => ({
      name: d.itemName,
      material,
      systems,
      quantity: d.quantity ?? 1,
    }));

  // garantie: request_rooms cere minim un item
  if (items.length === 0) items.push({ name: fallbackName, material, systems, quantity: 1 });
  return items;
}
