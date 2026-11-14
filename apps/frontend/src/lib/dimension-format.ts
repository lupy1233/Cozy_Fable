import { formatDecimal } from './decimal';

// Formatatorul unic al dimensiunilor (etapa 8, problema 41). Intrarea e mereu in
// METRI (asa se salveaza); iesirea = numar dupa limba aplicatiei (virgula in ro,
// punct in en, fara grupare de mii) + spatiu + unitate. Clientul vede unitatea
// aleasa de el; firma si 3D-ul vad mereu 'cm'.

export type DimensionUnit = 'm' | 'cm' | 'mm';

export const DIMENSION_UNITS: readonly DimensionUnit[] = ['m', 'cm', 'mm'];

// cate unitati intr-un metru
export const DIMENSION_UNIT_FACTOR: Record<DimensionUnit, number> = { m: 1, cm: 100, mm: 1000 };

// zecimalele afisate pe unitate = precizia campului din formular (useDecimalField: pana la
// 4 zecimale in unitatea aleasa), ca aceeasi valoare sa arate la fel in camp, in Fisa, in
// Sumar si la firma (m1, revizuirea etapei 8). Zerourile de la coada se taie ("45,5 cm",
// "45,55 cm", "120 cm"); o valoare in afara intervalului se vede exacta ("600,04 cm").
export const DIMENSION_DECIMALS: Record<DimensionUnit, number> = { m: 4, cm: 4, mm: 4 };

export interface DimensionFormatOptions {
  unit: DimensionUnit;
  locale: string;
}

const EMPTY = '—';

export function isDimensionUnit(value: unknown): value is DimensionUnit {
  return value === 'm' || value === 'cm' || value === 'mm';
}

// metri → unitate, rotunjit la DIMENSION_DECIMALS (fara artefacte float: 0.455 m → 45.5 cm)
export function toUnit(meters: number, unit: DimensionUnit): number {
  if (!Number.isFinite(meters)) return Number.NaN;
  const scale = 10 ** DIMENSION_DECIMALS[unit];
  const rounded = Math.round(meters * DIMENSION_UNIT_FACTOR[unit] * scale) / scale;
  // -0 → 0 (Intl ar scrie "-0")
  return rounded === 0 ? 0 : rounded;
}

function formatNumber(meters: number, o: DimensionFormatOptions): string {
  if (!Number.isFinite(meters)) return EMPTY;
  return formatDecimal(toUnit(meters, o.unit), o.locale, DIMENSION_DECIMALS[o.unit]);
}

// "45,5 cm" (ro) / "45.5 cm" (en); NaN / infinit → "—"
export function formatDimension(meters: number, o: DimensionFormatOptions): string {
  if (!Number.isFinite(meters)) return EMPTY;
  return `${formatNumber(meters, o)} ${o.unit}`;
}

// "120 × 80 × 40 cm" — unitatea o singura data, la final
export function formatDimensions(meters: number[], o: DimensionFormatOptions): string {
  if (meters.length === 0 || !meters.some((m) => Number.isFinite(m))) return EMPTY;
  return `${meters.map((m) => formatNumber(m, o)).join(' × ')} ${o.unit}`;
}

// "80–600 cm" (linie de interval, fara spatii)
export function formatDimensionRange(minM: number, maxM: number, o: DimensionFormatOptions): string {
  if (!Number.isFinite(minM) || !Number.isFinite(maxM)) return EMPTY;
  return `${formatNumber(minM, o)}–${formatNumber(maxM, o)} ${o.unit}`;
}
