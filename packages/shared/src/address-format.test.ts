import { describe, expect, it } from 'vitest';
import { formatDisplayAddress } from './address-format';

describe('formatDisplayAddress (b12)', () => {
  it('Bucuresti / Bucuresti: orasul nu se repeta ca judet, iar Romania nu apare', () => {
    expect(
      formatDisplayAddress({ addressText: 'Strada Fabricii 5', city: 'București', county: 'București', country: 'RO' }),
    ).toBe('Strada Fabricii 5, București');
  });

  it('judetul cu prefix administrativ e acelasi cu orasul', () => {
    expect(formatDisplayAddress({ addressText: 'Str. X 1', city: 'București', county: 'Municipiul Bucuresti' })).toBe(
      'Str. X 1, București',
    );
  });

  it('orasul deja scris in adresa (segment intreg) nu se mai adauga', () => {
    expect(
      formatDisplayAddress({ addressText: 'Str. Mihai Viteazu 5, 077190 Voluntari', city: 'Voluntari', county: 'Ilfov' }),
    ).toBe('Str. Mihai Viteazu 5, 077190 Voluntari, Ilfov');
  });

  it('orasul ramane cand apare doar in numele strazii', () => {
    expect(formatDisplayAddress({ addressText: 'Strada Cluj 3', city: 'Cluj', county: 'Cluj' })).toBe('Strada Cluj 3, Cluj');
  });

  it('bloc / scara / apartament dupa strada; nu se repeta daca e deja in strada', () => {
    expect(
      formatDisplayAddress({ addressText: 'Str. Lalelelor 10', addressDetails: 'bl. A2, sc. 1, ap. 14', city: 'Cluj-Napoca', county: 'Cluj' }),
    ).toBe('Str. Lalelelor 10, bl. A2, sc. 1, ap. 14, Cluj-Napoca, Cluj');
    // deja in strada ca segmente intregi → nu se repeta
    expect(
      formatDisplayAddress({ addressText: 'Str. Lalelelor 10, bl. A2, ap. 14', addressDetails: 'bl. A2, ap. 14', city: 'Cluj-Napoca', county: 'Cluj' }),
    ).toBe('Str. Lalelelor 10, bl. A2, ap. 14, Cluj-Napoca, Cluj');
  });

  // M1 (revizuire): o bucata de text din strada nu ascunde apartamentul / blocul
  it('un detaliu scurt care apare doar ca bucata de text in strada ramane afisat', () => {
    expect(formatDisplayAddress({ addressText: 'Str. Lalelelor 14', addressDetails: '4', city: 'Cluj-Napoca', county: 'Cluj' })).toBe(
      'Str. Lalelelor 14, 4, Cluj-Napoca, Cluj',
    );
    expect(formatDisplayAddress({ addressText: 'Strada Lalelelor 14, 077190 Voluntari', addressDetails: '4', city: 'Voluntari', county: 'Ilfov' })).toBe(
      'Strada Lalelelor 14, 077190 Voluntari, 4, Ilfov',
    );
    expect(formatDisplayAddress({ addressText: 'Strada București 5', addressDetails: 'B', city: 'Ploiești', county: 'Prahova' })).toBe(
      'Strada București 5, B, Ploiești, Prahova',
    );
    // doar o parte e in strada → detaliul ramane intreg
    expect(formatDisplayAddress({ addressText: 'Str. X 1, bl. A2', addressDetails: 'bl. A2, ap. 4', city: 'Iași', county: 'Iași' })).toBe(
      'Str. X 1, bl. A2, bl. A2, ap. 4, Iași',
    );
  });

  it('tara straina apare, cu numele dat de interfata sau codul ISO', () => {
    const input = { addressText: 'Hauptstraße 1', city: 'München', county: 'Bayern', country: 'de' };
    expect(formatDisplayAddress(input, { countryName: (iso) => (iso === 'DE' ? 'Germania' : undefined) })).toBe(
      'Hauptstraße 1, München, Bayern, Germania',
    );
    expect(formatDisplayAddress(input)).toBe('Hauptstraße 1, München, Bayern, DE');
  });

  it('fara adresa exacta (firma inainte de preluare): doar orasul si judetul, fara dubluri', () => {
    expect(formatDisplayAddress({ addressText: '', addressDetails: '', city: 'București', county: 'București' })).toBe('București');
    expect(formatDisplayAddress({ city: 'Voluntari', county: 'Ilfov' })).toBe('Voluntari, Ilfov');
  });

  it('cerere veche fara campuri noi si spatii in plus', () => {
    expect(formatDisplayAddress({ addressText: '  Str.  X 1 ', city: ' Iași ', county: 'Iasi' })).toBe('Str. X 1, Iași');
    expect(formatDisplayAddress({})).toBe('');
  });
});
