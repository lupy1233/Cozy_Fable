import { describe, expect, it } from 'vitest';
import { isLiveForBadges, pickFastest, pickLowest, rawTotalLei, totalWithVatLei } from './offer-compare';

describe('totalWithVatLei (a3)', () => {
  it('foloseste totalWithVat de la server; euro × curs', () => {
    expect(totalWithVatLei({ totalWithVat: 4719, currency: 'EUR' }, 4.97)).toBe(23453.43);
    expect(totalWithVatLei({ totalWithVat: 13310, currency: 'RON' }, 4.97)).toBe(13310);
  });
  it('oferta veche (fara TVA) → null; totalul scris ramane margine de jos', () => {
    expect(totalWithVatLei({ totalWithVat: null, currency: 'RON' }, 5)).toBeNull();
    expect(rawTotalLei({ total: 100, currency: 'EUR' }, 5)).toBe(500);
  });
});

describe('pickLowest (regula prudenta)', () => {
  it('minim unic intre totalurile cu TVA', () => {
    expect(pickLowest([{ id: 'a', withVatLei: 100, rawLei: 100 }, { id: 'b', withVatLei: 90, rawLei: 90 }])).toBe('b');
    expect(pickLowest([{ id: 'a', withVatLei: 90, rawLei: 90 }, { id: 'b', withVatLei: 90, rawLei: 90 }])).toBeNull();
    expect(pickLowest([{ id: 'a', withVatLei: 90, rawLei: 90 }])).toBeNull();
  });
  it('o oferta veche nu blocheaza insigna doar daca e sigur mai scumpa', () => {
    expect(pickLowest([{ id: 'old', withVatLei: null, rawLei: 95 }, { id: 'b', withVatLei: 90, rawLei: 90 }])).toBe('b');
    expect(pickLowest([{ id: 'old', withVatLei: null, rawLei: 90 }, { id: 'b', withVatLei: 90, rawLei: 90 }])).toBeNull();
    expect(pickLowest([{ id: 'old', withVatLei: null, rawLei: 80 }, { id: 'b', withVatLei: 90, rawLei: 90 }])).toBeNull();
    expect(pickLowest([{ id: 'o1', withVatLei: null, rawLei: 80 }, { id: 'o2', withVatLei: null, rawLei: 90 }])).toBeNull();
  });
});

describe('pickFastest', () => {
  it('pe zile lucratoare, doar cand toate sunt structurate si minimul e unic', () => {
    expect(pickFastest([{ id: 'a', workingDays: 30 }, { id: 'b', workingDays: 35 }])).toBe('a');
    expect(pickFastest([{ id: 'a', workingDays: 30 }, { id: 'b', workingDays: 30 }])).toBeNull();
    expect(pickFastest([{ id: 'a', workingDays: 30 }, { id: 'b', workingDays: null }])).toBeNull();
  });
});

describe('dupa revizuire (m5, m6, m7)', () => {
  it('m5: doua sume care se afiseaza la fel (18.500,40 si 18.500,10) sunt la egalitate', () => {
    expect(
      pickLowest([
        { id: 'a', withVatLei: 18500.4, rawLei: 18500.4 },
        { id: 'b', withVatLei: 18500.1, rawLei: 18500.1 },
      ]),
    ).toBeNull();
    expect(pickLowest([{ id: 'a', withVatLei: 18500.6, rawLei: 18500.6 }, { id: 'b', withVatLei: 18500.1, rawLei: 18500.1 }])).toBe('b');
  });
  it('m6: oferta SENT cu valabilitatea trecuta nu intra in insigne', () => {
    expect(isLiveForBadges({ status: 'SENT' }, { isExpired: true })).toBe(false);
    expect(isLiveForBadges({ status: 'SENT' }, { isExpired: false })).toBe(true);
    expect(isLiveForBadges({ status: 'ACCEPTED' }, { isExpired: false })).toBe(true);
    expect(isLiveForBadges({ status: 'DECLINED' }, { isExpired: false })).toBe(false);
  });
  it('m7: fara curs pozitiv, euro nu se aduce in lei, iar oferta nu intra la cel mai mic', () => {
    for (const rate of [0, -1, Number.NaN, undefined]) {
      expect(totalWithVatLei({ totalWithVat: 4719, currency: 'EUR' }, rate)).toBeNull();
      expect(rawTotalLei({ total: 3900, currency: 'EUR' }, rate)).toBeNull();
    }
    expect(totalWithVatLei({ totalWithVat: 18500, currency: 'RON' }, 0)).toBe(18500);
    // oferta in euro fara curs e scoasa din comparatie: ramane una singura → fara insigna
    expect(pickLowest([{ id: 'eur', withVatLei: null, rawLei: null }, { id: 'ron', withVatLei: 18500, rawLei: 18500 }])).toBeNull();
    expect(
      pickLowest([
        { id: 'eur', withVatLei: null, rawLei: null },
        { id: 'a', withVatLei: 18500, rawLei: 18500 },
        { id: 'b', withVatLei: 19000, rawLei: 19000 },
      ]),
    ).toBe('a');
  });
});
