import { describe, expect, it } from 'vitest';
import {
  DIMENSION_DECIMALS,
  formatDimension,
  formatDimensionRange,
  formatDimensions,
  isDimensionUnit,
  toUnit,
} from './dimension-format';

const ro = { unit: 'cm' as const, locale: 'ro' };
const en = { unit: 'cm' as const, locale: 'en' };

describe('toUnit', () => {
  it('converteste din metri si rotunjeste la zecimalele unitatii', () => {
    expect(DIMENSION_DECIMALS).toEqual({ m: 3, cm: 1, mm: 0 });
    expect(toUnit(0.455, 'cm')).toBe(45.5);
    expect(toUnit(2.4, 'cm')).toBe(240);
    expect(toUnit(1.6, 'mm')).toBe(1600);
    expect(toUnit(1.23456, 'm')).toBe(1.235);
    expect(toUnit(0.30000000000000004, 'm')).toBe(0.3);
    expect(toUnit(0.30000000000000004, 'cm')).toBe(30);
    expect(Object.is(toUnit(-0.00001, 'cm'), 0)).toBe(true);
    expect(toUnit(Number.NaN, 'cm')).toBeNaN();
  });
});

describe('formatDimension', () => {
  it('virgula in romana, punct in engleza, fara zecimale inutile', () => {
    expect(formatDimension(0.455, ro)).toBe('45,5 cm');
    expect(formatDimension(0.455, en)).toBe('45.5 cm');
    expect(formatDimension(2.4, ro)).toBe('240 cm');
    expect(formatDimension(1.6, { unit: 'm', locale: 'ro' })).toBe('1,6 m');
    expect(formatDimension(1.6, { unit: 'mm', locale: 'ro' })).toBe('1600 mm');
    expect(formatDimension(0.30000000000000004, { unit: 'm', locale: 'en' })).toBe('0.3 m');
  });

  it('fara grupare de mii', () => {
    expect(formatDimension(12, { unit: 'mm', locale: 'ro' })).toBe('12000 mm');
    expect(formatDimension(12, { unit: 'mm', locale: 'en' })).toBe('12000 mm');
  });

  it('NaN / infinit → linie', () => {
    expect(formatDimension(Number.NaN, ro)).toBe('—');
    expect(formatDimension(Number.POSITIVE_INFINITY, ro)).toBe('—');
  });
});

describe('formatDimensions', () => {
  it('lista cu unitatea o singura data', () => {
    expect(formatDimensions([1.2, 0.8, 0.4], ro)).toBe('120 × 80 × 40 cm');
    expect(formatDimensions([1.2, 0.455], ro)).toBe('120 × 45,5 cm');
    expect(formatDimensions([1.6, 2], { unit: 'm', locale: 'en' })).toBe('1.6 × 2 m');
  });

  it('valori lipsa', () => {
    expect(formatDimensions([1.2, Number.NaN], ro)).toBe('120 × — cm');
    expect(formatDimensions([], ro)).toBe('—');
    expect(formatDimensions([Number.NaN], ro)).toBe('—');
  });
});

describe('formatDimensionRange', () => {
  it('interval cu linie de interval', () => {
    expect(formatDimensionRange(0.8, 6, ro)).toBe('80–600 cm');
    expect(formatDimensionRange(0.455, 1.2, en)).toBe('45.5–120 cm');
    expect(formatDimensionRange(0.8, 6, { unit: 'm', locale: 'ro' })).toBe('0,8–6 m');
    expect(formatDimensionRange(Number.NaN, 6, ro)).toBe('—');
  });
});

describe('isDimensionUnit', () => {
  it('accepta doar m / cm / mm', () => {
    expect(['m', 'cm', 'mm'].every(isDimensionUnit)).toBe(true);
    expect(isDimensionUnit('km')).toBe(false);
    expect(isDimensionUnit(null)).toBe(false);
  });
});
