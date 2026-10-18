import { Prisma } from '@prisma/client';

// E-admin-platform-58: extras din PaymentsService (aceeasi logica) ca listele de planuri/pachete
// sa afiseze exact sumele de pe comanda. TVA calculat pe baza (nu extras din total), rotunjire
// half-up la 2 zecimale, pe Decimal (niciodata float).
export function buildAmounts(baseRon: number, vatRate: number) {
  const base = new Prisma.Decimal(baseRon).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const vat = base.mul(vatRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { base, vat, total: base.add(vat) };
}

// Pretul fara TVA → campurile afisate in DTO (numere JS doar la iesire).
export function priceWithVat(baseRon: number, vatRate: number): { vatRate: number; vatRon: number; totalRon: number } {
  const a = buildAmounts(baseRon, vatRate);
  return { vatRate, vatRon: Number(a.vat), totalRon: Number(a.total) };
}

export const VAT_RATE_SETTING = 'vat_rate';
export const VAT_RATE_DEFAULT = 21;
