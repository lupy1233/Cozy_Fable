import { describe, expect, it } from 'vitest';
import { formatAmount, formatLei } from './money';

describe('formatLei (b11)', () => {
  it('RO: lei intregi cu punct la mii', () => {
    expect(formatLei(12000, 'ro')).toBe('12.000 lei');
    expect(formatLei(5000, 'ro')).toBe('5.000 lei');
  });
  it('EN: virgula la mii, tot "lei"', () => {
    expect(formatLei(12000, 'en')).toBe('12,000 lei');
  });
});

describe('formatAmount', () => {
  it('RO: 2 zecimale fixe', () => {
    expect(formatAmount(121, 'ro')).toBe('121,00');
  });
  it('RO: separator de mii', () => {
    expect(formatAmount(1234.5, 'ro')).toBe('1.234,50');
  });
  it('EN: punct zecimal si virgula la mii', () => {
    expect(formatAmount(1234.5, 'en')).toBe('1,234.50');
  });
});
