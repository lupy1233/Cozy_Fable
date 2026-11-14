import { WORKING_DAYS_PER_WEEK } from '@marketplace/shared';
import type { OfferFieldKey, QuoteCurrency, QuoteDeliveryTermUnit, QuoteVatMode } from '@prisma/client';
import { buildAmounts } from '../billing/vat';
import type { OfferFieldsDto } from './dto/quote.dto';

// Conversie informativa RON↔EUR (D-v6-12). Suma contractuala ramane in moneda firmei;
// clientul vede ambele valori prin cursul fix configurabil (eur_ron_rate).
export function convertCurrency(
  amount: number,
  currency: QuoteCurrency,
  eurRonRate: number,
): { ron: number; eur: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (currency === 'EUR') {
    return { eur: round2(amount), ron: round2(amount * eurRonRate) };
  }
  return { ron: round2(amount), eur: round2(eurRonRate > 0 ? amount / eurRonRate : 0) };
}

// Campurile de oferta atinse de un DTO → field_key-uri pentru verificarea matricei (4.13).
// designFee e protejat sub autoritatea pretului (PRICE).
// a3/g0-11 (2026-11-13), fara chei noi: TVA, bifele transport/montaj, moneda, tariful si
// continutul proiectarii → PRICE (schimba ce plateste clientul); termenul structurat →
// DELIVERY_TERM; garantia in luni → WARRANTY. Termenul si garantia sunt acum obligatorii, deci
// orice varianta noua cere si DELIVERY_TERM + WARRANTY (ca PRICE + DESCRIPTION pana acum).
// Revizuire etapa 4 (interfata M1): la o varianta NOUA (revise / extra / reoffer) formularul e
// precompletat din varianta precedenta, deci retrimiterea aceleiasi valori nu e o editare —
// DELIVERY_DATE / DELIVERY_TERM / WARRANTY se socotesc atinse doar daca valoarea difera de
// `previous`. PRICE si DESCRIPTION raman mereu cerute (ca inainte). La v1 (`previous` lipsa)
// regula e cea veche.
export interface PreviousOfferFields {
  deliveryDate: Date | null;
  deliveryTermValue: number | null;
  deliveryTermUnit: QuoteDeliveryTermUnit | null;
  warrantyMonths: number | null;
}

export function touchedFieldKeys(dto: OfferFieldsDto, previous?: PreviousOfferFields): OfferFieldKey[] {
  const keys: OfferFieldKey[] = ['PRICE', 'DESCRIPTION']; // mereu prezente
  if (dto.designFee !== undefined && dto.designFee !== null) keys.push('PRICE');
  const sendsTerm = !!dto.deliveryTerm || dto.deliveryTermValue != null || dto.deliveryTermUnit != null;
  const sameTerm =
    !!previous &&
    !dto.deliveryTerm &&
    dto.deliveryTermValue === previous.deliveryTermValue &&
    dto.deliveryTermUnit === previous.deliveryTermUnit;
  if (sendsTerm && !sameTerm) keys.push('DELIVERY_TERM');
  const previousDate = previous?.deliveryDate ? previous.deliveryDate.toISOString().slice(0, 10) : null;
  if (dto.deliveryDate && !(previous && dto.deliveryDate === previousDate)) keys.push('DELIVERY_DATE');
  const sendsWarranty = !!dto.warranty || dto.warrantyMonths != null;
  const sameWarranty = !!previous && !dto.warranty && dto.warrantyMonths === previous.warrantyMonths;
  if (sendsWarranty && !sameWarranty) keys.push('WARRANTY');
  return [...new Set(keys)];
}

// Romana: 1 → singular; 0 / 2..19 (si ...01..19) → plural; restul (20+) → "de" + plural.
function roCount(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return rest === 0 || rest >= 20 ? `${n} de ${many}` : `${n} ${many}`;
}

// a3: textul generat de server din termenul structurat (ramane lizibil pentru cod vechi, PDF,
// e-mailuri). Texte in romana: coloana e un singur text, ca la ofertele vechi.
export function deliveryTermText(value: number, unit: QuoteDeliveryTermUnit): string {
  return unit === 'WEEKS'
    ? roCount(value, 'săptămână', 'săptămâni')
    : roCount(value, 'zi lucrătoare', 'zile lucrătoare');
}

export function warrantyText(months: number): string {
  return roCount(months, 'lună', 'luni');
}

// a3: termenul adus la zile lucratoare (WEEKS × 5); null pe variantele vechi.
export function deliveryWorkingDays(
  value: number | null | undefined,
  unit: QuoteDeliveryTermUnit | null | undefined,
): number | null {
  if (value == null || !unit) return null;
  return unit === 'WEEKS' ? value * WORKING_DAYS_PER_WEEK : value;
}

// a3: suma cu TVA in moneda variantei. VAT_INCLUDED / NOT_VAT_PAYER → suma ca atare;
// VAT_EXCLUDED → suma + TVA (rotunjire half-up la 2 zecimale, pe Decimal, ca la facturi);
// vatMode lipsa (varianta veche) → null (tabelul arata "—", nu un calcul gresit).
export function amountWithVat(amount: number, vatMode: QuoteVatMode | null | undefined, vatRatePercent: number): number | null {
  if (!vatMode) return null;
  if (vatMode !== 'VAT_EXCLUDED') return Math.round(amount * 100) / 100;
  return Number(buildAmounts(amount, vatRatePercent).total);
}
