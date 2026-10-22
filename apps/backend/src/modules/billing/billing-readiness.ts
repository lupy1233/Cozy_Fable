import type { SellerField } from '@marketplace/shared';

// E-admin-platform-4 — cheile system_settings ale furnizorului (platforma) de pe facturi.
export const SELLER_SETTING_KEYS: Record<SellerField, string> = {
  name: 'seller_name',
  cui: 'seller_cui',
  regCom: 'seller_reg_com',
  address: 'seller_address',
  iban: 'seller_iban',
};

// valorile istorice din seed.ts - nu pot ajunge pe o factura
export const SELLER_SEED_PLACEHOLDERS: Record<SellerField, string> = {
  name: 'Marketplace Mobilier SRL',
  cui: 'RO12345678',
  regCom: 'J40/1234/2020',
  address: 'Str. Exemplu nr. 1, Bucuresti, Romania',
  iban: 'RO49AAAA1B31007593840000',
};

export type SellerSnapshot = Record<SellerField, string>;
