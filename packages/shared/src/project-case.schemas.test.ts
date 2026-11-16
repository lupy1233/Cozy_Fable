import { describe, expect, it } from 'vitest';
import {
  WARRANTY_MIN_MONTHS,
  addMonthsUtc,
  openWarrantyCaseSchema,
  parseWarrantyMonths,
  warrantyWindowMonths,
} from './project-case.schemas';

// e2-2: fereastra de raportare dupa finalizare = garantia din oferta, minimum 24 de luni.
describe('parseWarrantyMonths', () => {
  it.each([
    ['24 luni', 24],
    ['36 de luni', 36],
    ['2 ani', 24],
    ['5 ani', 60],
    ['1 an', 12],
    ['doi ani', 24],
    ['trei ani', 36],
    ['o lună', 1],
    ['5 years', 60],
    ['18 months', 18],
    ['1,5 ani', 18],
    ['Garanție: 24 luni corp, 5 ani feronerie', 60],
  ])('%s → %i luni', (text, months) => {
    expect(parseWarrantyMonths(text)).toBe(months);
  });

  it.each([null, undefined, '', 'garanție standard', '24', 'anual', 'conform legii'])(
    'fara durata citibila (%s) → null',
    (text) => {
      expect(parseWarrantyMonths(text as string | null | undefined)).toBeNull();
    },
  );
});

describe('warrantyWindowMonths', () => {
  it('garantie mai scurta decat minimul sau necitibila → 24 de luni', () => {
    expect(warrantyWindowMonths('12 luni')).toBe(WARRANTY_MIN_MONTHS);
    expect(warrantyWindowMonths(null)).toBe(WARRANTY_MIN_MONTHS);
    expect(warrantyWindowMonths('garanție standard')).toBe(WARRANTY_MIN_MONTHS);
  });
  it('garantie mai lunga → durata din oferta', () => {
    expect(warrantyWindowMonths('5 ani')).toBe(60);
  });
});

describe('addMonthsUtc', () => {
  it('adauga luni calendaristice si limiteaza ziua la sfarsitul lunii', () => {
    expect(addMonthsUtc(new Date('2026-11-13T10:00:00Z'), 24).toISOString()).toBe('2028-11-13T10:00:00.000Z');
    expect(addMonthsUtc(new Date('2026-01-31T08:00:00Z'), 1).toISOString()).toBe('2026-02-28T08:00:00.000Z');
    expect(addMonthsUtc(new Date('2027-12-31T08:00:00Z'), 2).toISOString()).toBe('2028-02-29T08:00:00.000Z');
  });
});

describe('openWarrantyCaseSchema', () => {
  it('nota e obligatorie', () => {
    expect(openWarrantyCaseSchema.safeParse({ note: '   ' }).success).toBe(false);
    expect(openWarrantyCaseSchema.safeParse({ note: 'Ușa s-a lăsat' }).success).toBe(true);
  });
});
