import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { toLei } from './money';

// a3 (etapa 4): calculele tabelului de comparare a ofertelor, pure (testate separat).
// Cifrele vin de la server (totalWithVat, deliveryWorkingDays — contractul etapei 4);
// aici doar le aducem in lei cu cursul informativ al ofertei si alegem insignele.

// Ofertele "vii", care intra in insigne. Retrase, expirate, inlocuite si refuzate (DECLINED)
// raman in tabel cu starea lor, dar nu concureaza.
export const LIVE_QUOTE_STATUSES: readonly QuoteDto['status'][] = ['SENT', 'ACCEPTED'];

// m6 (revizuire): in insigne intra doar ofertele care mai pot fi alese — o oferta SENT cu
// valabilitatea trecuta (isExpired, inainte sa ruleze jobul de expirare) ramane fara insigna.
export function isLiveForBadges(
  quote: Pick<QuoteDto, 'status'>,
  v: Pick<QuoteVersionDto, 'isExpired'>,
): boolean {
  return LIVE_QUOTE_STATUSES.includes(quote.status) && !v.isExpired;
}

// m7 (revizuire): suma se poate aduce in lei doar in lei sau cu un curs pozitiv; altfel
// (eurRonRate lipsa, 0 sau negativ) nu afisam "0 lei" si oferta nu intra la "cel mai mic".
export function canConvertToLei(currency: QuoteVersionDto['currency'], eurRonRate: number | null | undefined): boolean {
  return currency === 'RON' || (typeof eurRonRate === 'number' && Number.isFinite(eurRonRate) && eurRonRate > 0);
}

// Totalul ofertei (mobilier + proiectare) cu TVA, in lei; null cand nu stim TVA-ul (oferta veche).
// totalWithVat vine de la server, in moneda variantei — aceeasi suma ca pe cardul ofertei.
export function totalWithVatLei(
  v: Pick<QuoteVersionDto, 'totalWithVat' | 'currency'>,
  eurRonRate: number | null | undefined,
): number | null {
  if (v.totalWithVat == null || !canConvertToLei(v.currency, eurRonRate)) return null;
  return toLei(v.totalWithVat, v.currency, eurRonRate ?? 0);
}

// Totalul scris in oferta, adus in lei (fara sa stim daca are TVA): pentru ofertele vechi
// e o margine de jos — totalul real cu TVA nu poate fi mai mic decat el. null fara curs.
export function rawTotalLei(
  v: Pick<QuoteVersionDto, 'total' | 'currency'>,
  eurRonRate: number | null | undefined,
): number | null {
  if (!canConvertToLei(v.currency, eurRonRate)) return null;
  return toLei(v.total, v.currency, eurRonRate ?? 0);
}

// m5 (revizuire): comparam pe suma exact cum se afiseaza (lei intregi, formatLei) — doua
// oferte care arata aceeasi suma sunt la egalitate, deci fara insigna
const shownLei = (n: number) => Math.round(n);

export interface LowestEntry {
  id: string;
  withVatLei: number | null;
  // null = suma nu se poate aduce in lei (fara curs): oferta nu intra la "cel mai mic"
  rawLei: number | null;
}

// "Cel mai mic" (regula prudenta, a3):
// - se compara doar totalurile in lei CU TVA cunoscute; minimul trebuie sa fie unic;
// - o oferta veche (TVA necunoscut) nu primeste insigna; ea nu blocheaza insigna celorlalte
//   doar daca se poate dovedi ca e mai scumpa: castigatorul trebuie sa fie STRICT sub totalul
//   ei scris (care e o margine de jos pentru totalul ei cu TVA). Altfel nicio insigna.
// - oferta fara curs (m7) nu intra deloc in comparatie;
// - comparam in lei intregi, ca pe ecran (m5);
// - e nevoie de cel putin doua oferte vii in comparatie.
export function pickLowest(all: LowestEntry[]): string | null {
  const entries = all.filter((e) => e.withVatLei != null || e.rawLei != null);
  if (entries.length < 2) return null;
  const known = entries.filter((e) => e.withVatLei != null);
  if (known.length === 0) return null;
  const min = Math.min(...known.map((e) => shownLei(e.withVatLei!)));
  const winners = known.filter((e) => shownLei(e.withVatLei!) === min);
  if (winners.length !== 1) return null;
  const provable = entries.every((e) => e.withVatLei != null || min < shownLei(e.rawLei!));
  return provable ? winners[0].id : null;
}

export interface FastestEntry {
  id: string;
  workingDays: number | null;
}

// "Cel mai rapid" pe termenul in zile lucratoare (deliveryWorkingDays): doar cand TOATE ofertele
// vii au termen structurat (un termen scris liber nu se poate compara) si minimul e unic.
export function pickFastest(entries: FastestEntry[]): string | null {
  if (entries.length < 2 || entries.some((e) => e.workingDays == null)) return null;
  const min = Math.min(...entries.map((e) => e.workingDays!));
  const winners = entries.filter((e) => e.workingDays === min);
  return winners.length === 1 ? winners[0].id : null;
}
