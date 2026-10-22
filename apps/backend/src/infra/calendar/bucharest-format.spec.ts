import { formatBucharestDate, formatDateOnly } from './bucharest-format';

// E-company-19 — datele de pe documente (factura, oferta PDF, emailuri) in Europe/Bucharest,
// indiferent de fusul serverului (invarianta 3.3).
describe('formatBucharestDate / formatDateOnly', () => {
  it('23:30 UTC iarna = ziua urmatoare in Bucuresti (UTC+2)', () => {
    expect(formatBucharestDate(new Date('2026-03-01T23:30:00Z'))).toBe('02.03.2026');
  });

  it('ora de vara (UTC+3): 21:30 UTC = ziua urmatoare', () => {
    expect(formatBucharestDate('2026-07-31T21:30:00Z')).toBe('01.08.2026');
  });

  it('EN foloseste formatul en-GB', () => {
    expect(formatBucharestDate('2026-03-01T23:30:00Z', 'en')).toBe('02/03/2026');
  });

  it('coloana @db.Date YYYY-MM-DD nu se deplaseaza', () => {
    expect(formatDateOnly('2026-03-02')).toBe('02.03.2026');
    expect(formatDateOnly('2026-03-02', 'en')).toBe('02/03/2026');
  });

  it('valori invalide / nule → sir gol', () => {
    expect(formatBucharestDate(null)).toBe('');
    expect(formatBucharestDate(undefined)).toBe('');
    expect(formatBucharestDate('not-a-date')).toBe('');
    expect(formatDateOnly(null)).toBe('');
    expect(formatDateOnly('2026-03-02T10:00:00Z')).toBe('');
  });
});
