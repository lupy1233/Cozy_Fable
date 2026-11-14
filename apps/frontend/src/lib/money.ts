// Sume in UI: mereu 2 zecimale fixe; unitatea vine din Common.money (lei in RO, RON in EN).
export const MONEY_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

// Suma fara unitate (folosita si la copiere in clipboard)
export function formatAmount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', MONEY_FORMAT).format(n);
}

// b11: bugetul cererii — lei intregi, acelasi format peste tot ("12.000 lei"; "12,000 lei" in EN).
// Unitatea e "lei" in ambele limbi (PO: nu "RON" la buget).
export function formatLei(n: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 0 }).format(n)} lei`;
}

// a3 (etapa 4): suma unei oferte in euro, intreaga, in formatul limbii ("3.900 EUR" / "3,900 EUR").
export function formatEur(n: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 0 }).format(n)} EUR`;
}

// a3: suma in moneda ei — lei ca la buget (formatLei), euro cu formatEur.
export function formatInCurrency(n: number, currency: 'RON' | 'EUR', locale: string): string {
  return currency === 'EUR' ? formatEur(n, locale) : formatLei(n, locale);
}

// a3: cursul informativ EUR → lei, cu pana la 4 zecimale ("4,9750" → "4,975").
export function formatRate(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 4 }).format(n);
}

// a3: conversia in lei cu cursul informativ al ofertei (QuoteDto.eurRonRate, setarea eur_ron_rate);
// aceeasi rotunjire la bani ca serverul (convertCurrency din backend).
export function toLei(amount: number, currency: 'RON' | 'EUR', eurRonRate: number): number {
  const ron = currency === 'EUR' ? amount * eurRonRate : amount;
  return Math.round(ron * 100) / 100;
}
