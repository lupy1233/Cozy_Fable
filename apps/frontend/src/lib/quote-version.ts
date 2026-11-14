import type { QuoteChangeRequestHistoryDto, QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { formatAmount } from '@/lib/money';

// E-client-1: selectia versiunii de oferta, comuna cardului de oferta, dialogului de
// acceptare si cardului "Acordul vostru".

// Ultima versiune trimisa (singura care se poate accepta).
export function latestVersion(quote: Pick<QuoteDto, 'versions'>): QuoteVersionDto | undefined {
  if (quote.versions.length === 0) return undefined;
  return quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);
}

// Versiunea de afisat: cea acceptata de client daca exista, altfel ultima
// (ofertele acceptate inainte de migrare au acceptedVersionId = null).
export function displayedVersion(
  quote: Pick<QuoteDto, 'versions' | 'acceptedVersionId'>,
): QuoteVersionDto | undefined {
  const accepted = quote.acceptedVersionId
    ? quote.versions.find((v) => v.id === quote.acceptedVersionId)
    : undefined;
  return accepted ?? latestVersion(quote);
}

// ===== a3 / a4 (etapa 4): variantele, cererile de modificare si rubricile structurate =====

// Varianta are termenul structurat (oferta trimisa dupa etapa 4)? Altfel se afiseaza textul liber.
export const hasStructuredTerm = (v: QuoteVersionDto): boolean =>
  v.deliveryTermValue != null && v.deliveryTermUnit != null;

// Cererile de modificare cerute pe o varianta. Serverul trimite istoricul complet pe oferta
// (changeRequests, cu requestedOnVersion / answeredByVersion); o imagine veche a serverului
// (blue/green) trimite doar cererea curenta a variantei (changeRequest) — atunci cadem pe ea.
export function versionChangeRequests(
  quote: Pick<QuoteDto, 'changeRequests'>,
  v: QuoteVersionDto,
): QuoteChangeRequestHistoryDto[] {
  if (quote.changeRequests && quote.changeRequests.length > 0) {
    return quote.changeRequests.filter((c) => c.requestedOnVersion === v.version);
  }
  return v.changeRequest ? [{ ...v.changeRequest, requestedOnVersion: v.version, answeredByVersion: null }] : [];
}

// Oferta inca deschisa (se mai poate accepta, refuza, cere modificari sau prelungi).
// EXPIRED ramane deschisa: firma o poate prelungi sau reoferta, iar clientul poate cere prelungirea.
export const isOpenQuote = (quote: Pick<QuoteDto, 'status'>): boolean =>
  quote.status === 'SENT' || quote.status === 'EXPIRED';

// Diferenta sub care o cerere inchisa de server odata cu refuzul ofertei e socotita "inchisa la refuz"
const CLOSED_WITH_DECLINE_MS = 5_000;

// m1 (revizuire etapa 4): cererea de modificare n-a mai primit raspuns pentru ca oferta s-a inchis —
// ramasa PENDING pe o oferta inchisa, sau trecuta de server in REJECTED chiar la refuzul clientului
// (nu e un refuz al firmei).
export function changeClosedByOffer(
  change: Pick<QuoteChangeRequestHistoryDto, 'status' | 'respondedAt'>,
  quote: Pick<QuoteDto, 'status' | 'declinedAt'>,
): boolean {
  if (change.status === 'PENDING') return !isOpenQuote(quote);
  if (change.status === 'REJECTED' && quote.status === 'DECLINED' && change.respondedAt && quote.declinedAt) {
    return Math.abs(Date.parse(change.respondedAt) - Date.parse(quote.declinedAt)) <= CLOSED_WITH_DECLINE_MS;
  }
  return false;
}

// Varianta care a raspuns cererii: din server (answeredByVersion) sau, pentru o cerere
// indeplinita fara camp (randuri vechi), prima varianta de dupa cea pe care s-a cerut.
export function answeredBy(change: QuoteChangeRequestHistoryDto, versions: Pick<QuoteVersionDto, 'version'>[]): number | null {
  if (change.answeredByVersion != null) return change.answeredByVersion;
  if (change.status !== 'FULFILLED') return null;
  const next = versions
    .map((v) => v.version)
    .filter((n) => n > change.requestedOnVersion)
    .sort((a, b) => a - b)[0];
  return next ?? null;
}

// Ce s-a schimbat de la o varianta la urmatoarea (pentru istoricul de pe card).
export type VersionChanges = {
  total: boolean;
  currency: boolean;
  delivery: boolean;
  warranty: boolean;
  vat: boolean;
  includes: boolean;
  design: boolean;
  description: boolean;
};

// Textul afisat, normalizat pentru comparare: litere mici, fara diacritice, fara "de" din
// pluralul romanesc ("24 de luni" = "24 luni"), spatii comprimate.
export function normalizeTermText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bde\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cum se afiseaza termenul (cu data) si garantia unei variante — dat de apelant (textele sunt i18n).
export type TermDisplay = {
  delivery: (v: QuoteVersionDto) => string;
  warranty: (v: QuoteVersionDto) => string | null;
};

const hasStructuredWarranty = (v: QuoteVersionDto) => v.warrantyMonths != null;

export function versionChanges(a: QuoteVersionDto, b: QuoteVersionDto, display?: TermDisplay): VersionChanges {
  const same = <T>(x: T | null | undefined, y: T | null | undefined) => (x ?? null) === (y ?? null);
  // m3: o varianta veche (text liber) si una noua (rubrici) se compara pe textul afisat
  const textSame = (x: string | null, y: string | null) => normalizeTermText(x) === normalizeTermText(y);
  const deliveryMixed = hasStructuredTerm(a) !== hasStructuredTerm(b);
  const warrantyMixed = hasStructuredWarranty(a) !== hasStructuredWarranty(b);
  return {
    total: a.total !== b.total || a.currency !== b.currency,
    currency: a.currency !== b.currency,
    delivery:
      deliveryMixed && display
        ? !textSame(display.delivery(a), display.delivery(b))
        : !(
            same(a.deliveryTermValue, b.deliveryTermValue) &&
            same(a.deliveryTermUnit, b.deliveryTermUnit) &&
            same(a.deliveryTerm, b.deliveryTerm) &&
            same(a.deliveryDate, b.deliveryDate)
          ),
    warranty:
      warrantyMixed && display
        ? !textSame(display.warranty(a), display.warranty(b))
        : !(same(a.warrantyMonths, b.warrantyMonths) && same(a.warranty, b.warranty)),
    vat: !same(a.vatMode, b.vatMode),
    includes: !(same(a.includesTransport, b.includesTransport) && same(a.includesAssembly, b.includesAssembly)),
    design: !(same(a.designFee, b.designFee) && same(a.designIncludes, b.designIncludes)),
    description: (a.description ?? '').trim() !== (b.description ?? '').trim(),
  };
}

// Suma unei oferte in moneda variantei, cu bani: "11.500,00 lei" / "11,500.00 lei" / "2.300,00 EUR".
// Ca la etapa 3, moneda romaneasca se scrie "lei" in ambele limbi.
export function formatQuoteMoney(n: number, currency: QuoteVersionDto['currency'], locale: string): string {
  return `${formatAmount(n, locale)} ${currency === 'EUR' ? 'EUR' : 'lei'}`;
}
