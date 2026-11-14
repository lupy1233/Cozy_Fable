import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/lib/money';
import { formatQuoteTotals } from './format-quote-totals';

// h3 (etapa 9): valoarea ofertelor pe panou — „X lei + Y EUR”, fără conversie.

const moneyRo = (n: number) => `${formatAmount(n, 'ro')} lei`;

describe('formatQuoteTotals', () => {
  it('lei și euro separate', () => {
    expect(formatQuoteTotals({ RON: 17000, EUR: 3900 }, moneyRo, 'ro')).toBe('17.000,00 lei + 3.900,00 EUR');
  });
  it('doar lei / doar euro', () => {
    expect(formatQuoteTotals({ RON: 8500, EUR: 0 }, moneyRo, 'ro')).toBe('8.500,00 lei');
    expect(formatQuoteTotals({ RON: 0, EUR: 1200.5 }, moneyRo, 'ro')).toBe('1.200,50 EUR');
  });
  it('fără oferte (sau răspuns vechi fără câmp) → 0 lei', () => {
    expect(formatQuoteTotals({ RON: 0, EUR: 0 }, moneyRo, 'ro')).toBe('0,00 lei');
    expect(formatQuoteTotals(undefined, moneyRo, 'ro')).toBe('0,00 lei');
  });
  it('EN: separatorii limbii engleze', () => {
    expect(formatQuoteTotals({ RON: 0, EUR: 3900 }, (n) => `${formatAmount(n, 'en')} lei`, 'en')).toBe('3,900.00 EUR');
  });
});
