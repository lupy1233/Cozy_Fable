// Cititor unic de numere pentru campurile de dimensiuni (b1): accepta virgula
// si punctul ca separator zecimal ("1,6" = "1.6" = 1.6), taie spatiile si
// respinge textul cu doua separatoare, litere sau semne. Campurile type=number
// ale browserului aruncau virgula ("1,6" ajungea 16).

export type ParsedDecimal =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'number'; value: number };

// cifre cu cel mult un separator; "2," (in curs de tastare) si ",5" sunt valide
const DECIMAL_RE = /^(\d+([.,]\d*)?|[.,]\d+)$/;

export function parseDecimal(raw: string): ParsedDecimal {
  const text = raw.replace(/\s+/g, '');
  if (text === '') return { kind: 'empty' };
  if (!DECIMAL_RE.test(text)) return { kind: 'invalid' };
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid' };
}

// Afisare dupa limba ("1,6" in romana, "1.6" in engleza), fara grupare de mii
// (campul trebuie sa poata fi recitit de parseDecimal) si fara artefacte float.
export function formatDecimal(value: number, locale: string, maxFractionDigits = 4): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  }).format(value);
}
