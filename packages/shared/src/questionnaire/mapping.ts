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

// d3 (PO d3-2): lungimea aproximativa data cu "Am deja un proiect" intra la ROOM_SIZE DOAR cand
// lungimea derivata din dimensiuni e 0. Lipsa / nevalida = 0 ("sub 2 m", ca inainte).
export const APPROX_LENGTH_MIN_M = 0.1;
export const APPROX_LENGTH_MAX_M = 50;
// coloana e NUMERIC(5,2): cel mult doua zecimale (aceeasi regula ca DTO-ul serverului)
export const APPROX_LENGTH_DECIMALS = 2;

export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export function roomSizeLengthM(derivedLengthM: number, approxLengthM?: number | null): number {
  if (derivedLengthM > 0) return derivedLengthM;
  return typeof approxLengthM === 'number' && Number.isFinite(approxLengthM) && approxLengthM > 0 ? approxLengthM : 0;
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

