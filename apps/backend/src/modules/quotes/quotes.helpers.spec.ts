import { amountWithVat, deliveryTermText, deliveryWorkingDays, touchedFieldKeys, warrantyText } from './quotes.helpers';

// a3 (2026-11-13) — textul generat din rubrici, termenul in zile lucratoare, pretul cu TVA,
// cheile matricei de permisiuni pentru campurile noi.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

describe('deliveryTermText / warrantyText (romana, cu "de" de la 20)', () => {
  it.each([
    [1, 'WEEKS', '1 săptămână'],
    [6, 'WEEKS', '6 săptămâni'],
    [20, 'WEEKS', '20 de săptămâni'],
    [1, 'WORKING_DAYS', '1 zi lucrătoare'],
    [30, 'WORKING_DAYS', '30 de zile lucrătoare'],
    [104, 'WORKING_DAYS', '104 zile lucrătoare'],
  ] as const)('%i %s → %s', (n, unit, text) => {
    expect(deliveryTermText(n, unit)).toBe(text);
  });

  it.each([
    [1, '1 lună'],
    [12, '12 luni'],
    [24, '24 de luni'],
  ])('%i luni → %s', (n, text) => {
    expect(warrantyText(n)).toBe(text);
  });
});

describe('deliveryWorkingDays', () => {
  it('6 saptamani = 30 zile lucratoare = 30 zile lucratoare (comparabile)', () => {
    expect(deliveryWorkingDays(6, 'WEEKS')).toBe(30);
    expect(deliveryWorkingDays(30, 'WORKING_DAYS')).toBe(30);
  });
  it('varianta veche (fara rubrici) → null', () => {
    expect(deliveryWorkingDays(null, null)).toBeNull();
    expect(deliveryWorkingDays(6, null)).toBeNull();
  });
});

describe('amountWithVat', () => {
  it('VAT_EXCLUDED → suma + cota (half-up, 2 zecimale)', () => {
    expect(amountWithVat(3900, 'VAT_EXCLUDED', 21)).toBe(4719);
    expect(amountWithVat(0.05, 'VAT_EXCLUDED', 21)).toBe(0.06);
  });
  it('VAT_INCLUDED / NOT_VAT_PAYER → suma ca atare', () => {
    expect(amountWithVat(18500, 'VAT_INCLUDED', 21)).toBe(18500);
    expect(amountWithVat(18500, 'NOT_VAT_PAYER', 21)).toBe(18500);
  });
  it('fara rubrica (varianta veche) → null, nu un calcul gresit', () => {
    expect(amountWithVat(18500, null, 21)).toBeNull();
  });
});

describe('touchedFieldKeys — campurile noi sub cheile existente (fara chei noi)', () => {
  it('termenul structurat → DELIVERY_TERM, garantia in luni → WARRANTY, TVA/bife/moneda → PRICE', () => {
    const keys = touchedFieldKeys({
      price: 1, description: 'x', vatMode: 'VAT_INCLUDED', deliveryTermValue: 6, deliveryTermUnit: 'WEEKS',
      warrantyMonths: 24, includesTransport: true, includesAssembly: false, currency: 'EUR',
    } as Any);
    expect(keys.sort()).toEqual(['DELIVERY_TERM', 'DESCRIPTION', 'PRICE', 'WARRANTY']);
  });
});
