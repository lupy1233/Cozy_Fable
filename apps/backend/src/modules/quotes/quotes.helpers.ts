import type { OfferFieldKey, QuoteCurrency } from '@prisma/client';
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
export function touchedFieldKeys(dto: OfferFieldsDto): OfferFieldKey[] {
  const keys: OfferFieldKey[] = ['PRICE', 'DESCRIPTION']; // mereu prezente
  if (dto.designFee !== undefined && dto.designFee !== null) keys.push('PRICE');
  if (dto.deliveryTerm) keys.push('DELIVERY_TERM');
  if (dto.deliveryDate) keys.push('DELIVERY_DATE');
  if (dto.warranty) keys.push('WARRANTY');
  return [...new Set(keys)];
}
