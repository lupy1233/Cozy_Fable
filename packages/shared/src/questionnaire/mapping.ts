import type { ItemQuantityBucket, RoomSizeBucket } from '../enums';
import type { AnswerMap, DimensionGroupStep, QuestionStep } from './types';

// Helpere de derivare partajate de flow-uri. Constantele si bucket-urile
// reproduc semantica existenta din SizingService (sursa: docs/sprint-0 §7).

// Adancimea standard a unui corp de mobilier — folosita ca widthM cand
// raspunsurile nu contin o adancime explicita.
export const STANDARD_CABINET_DEPTH = 0.6;

// Inaltime tavan implicita defensiva (validarea garanteaza slotul la publish).
export const DEFAULT_CEILING_HEIGHT = 2.6;

// Bucket ROOM_SIZE pe metri liniari — identic cu SizingService.roomSizeOption.
export function roomSizeBucket(linearM: number): RoomSizeBucket {
  if (linearM < 2) return 'UNDER_2M';
  if (linearM <= 4) return 'FROM_2_TO_4M';
  return 'OVER_4M';
}

// Bucket ITEM_QUANTITY pe totalul cantitatilor — identic cu SizingService.itemQuantityOption.
export function itemQuantityBucket(totalQty: number): ItemQuantityBucket {
  if (totalQty <= 1) return 'QTY_1';
  if (totalQty <= 3) return 'QTY_2_3';
  return 'QTY_4_PLUS';
}

// Valorile de dimensiuni raspunse la un step dimension-group.
export function dimensionValues(answers: AnswerMap, stepId: string): Record<string, number> {
  const answer = answers[stepId];
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return answer as Record<string, number>;
  }
  return {};
}

// Suma metrilor liniari: sloturile curente cu countsTowardLinear care au valoare.
export function linearMeters(step: DimensionGroupStep, answers: AnswerMap): number {
  const values = dimensionValues(answers, step.id);
  return step
    .slots(answers)
    .filter((s) => s.countsTowardLinear && typeof values[s.id] === 'number')
    .reduce((acc, s) => acc + values[s.id], 0);
}

// Gaseste step-ul dimension-group al unui flow (conventie: un singur step de dims).
export function findDimensionStep(steps: QuestionStep[]): DimensionGroupStep | undefined {
  return steps.find((s): s is DimensionGroupStep => s.type === 'dimension-group');
}
