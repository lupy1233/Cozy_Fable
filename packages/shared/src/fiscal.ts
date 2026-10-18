// E-admin-platform-4 — validari fiscale pentru datele furnizorului (platforma) de pe facturi.
// CUI: algoritmul cifrei de control RO (cheia 753217532). IBAN: ISO 13616 mod-97.

export const SELLER_FIELDS = ['name', 'cui', 'regCom', 'address', 'iban'] as const;
export type SellerField = (typeof SELLER_FIELDS)[number];

export const SELLER_PROBLEM_REASONS = ['MISSING', 'PLACEHOLDER', 'INVALID'] as const;
export type SellerProblemReason = (typeof SELLER_PROBLEM_REASONS)[number];

const CUI_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2] as const;

// Forma canonica pentru verificare: fara spatii, majuscule, fara prefixul optional 'RO'.
export function normalizeCui(value: string): string {
  const compact = (value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return compact.startsWith('RO') ? compact.slice(2) : compact;
}

export function isValidRoCui(value: string): boolean {
  const body = normalizeCui(value);
  if (!/^\d{2,10}$/.test(body)) return false;
  const control = Number(body[body.length - 1]);
  const digits = body.slice(0, -1).padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * CUI_KEY[i];
  let c = (sum * 10) % 11;
  if (c === 10) c = 0;
  return c === control;
}

export function normalizeIban(value: string): string {
  return (value ?? '').toUpperCase().replace(/\s+/g, '');
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('RO') && iban.length !== 24) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    // A=10 ... Z=35; cifrele raman ca atare
    const chunk = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const d of chunk) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
