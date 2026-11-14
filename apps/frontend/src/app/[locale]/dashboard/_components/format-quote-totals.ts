import { formatAmount } from '@/lib/money';

// h3 (etapa 9): valoarea ofertelor pe panoul firmei — totaluri separate pe moneda, fara curs:
// "17.000,00 lei + 3.900,00 EUR"; doar moneda folosita apare; fara oferte = "0,00 lei".
export function formatQuoteTotals(
  totals: { RON: number; EUR: number } | undefined,
  money: (n: number) => string,
  locale: string,
): string {
  const ron = totals?.RON ?? 0;
  const eur = totals?.EUR ?? 0;
  const parts: string[] = [];
  if (ron !== 0 || eur === 0) parts.push(money(ron));
  if (eur !== 0) parts.push(`${formatAmount(eur, locale)} EUR`);
  return parts.join(' + ');
}
