// Sume in UI: mereu 2 zecimale fixe; unitatea vine din Common.money (lei in RO, RON in EN).
export const MONEY_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

// Suma fara unitate (folosita si la copiere in clipboard)
export function formatAmount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', MONEY_FORMAT).format(n);
}
