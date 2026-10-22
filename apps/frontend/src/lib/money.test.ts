import { describe, expect, it } from 'vitest';
import { formatAmount } from './money';

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
