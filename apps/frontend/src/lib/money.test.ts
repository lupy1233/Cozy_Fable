import { describe, expect, it } from 'vitest';
import { formatAmount, formatEur, formatInCurrency, formatLei, formatRate, toLei } from './money';

describe('a3: sume in moneda ofertei si conversia in lei', () => {
  it('euro intregi in formatul limbii', () => {
    expect(formatEur(3900, 'ro')).toBe('3.900 EUR');
    expect(formatEur(3900, 'en')).toBe('3,900 EUR');
    expect(formatInCurrency(18500, 'RON', 'ro')).toBe('18.500 lei');
    expect(formatInCurrency(3900, 'EUR', 'ro')).toBe('3.900 EUR');
  });
  it('cursul cu virgula in romana', () => {
    expect(formatRate(4.975, 'ro')).toBe('4,975');
    expect(formatRate(4.975, 'en')).toBe('4.975');
  });
  it('toLei: euro × curs, rotunjit la bani; leii raman', () => {
    expect(toLei(4719, 'EUR', 4.97)).toBe(23453.43);
    expect(toLei(18500, 'RON', 4.97)).toBe(18500);
  });
});

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
