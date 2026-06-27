import type { CompanyMemberRole, OfferFieldKey } from '@prisma/client';

// Blocaj reaplicare dupa REJECTED: 3 luni pe CUI + email (4.6).
export const REAPPLY_BLOCK_MONTHS = 3;

// Risk flags (4.6). Reviews/rating nu exista inca (Sprint 8) → reviewCount tratat ca 0.
export const MIN_REVIEWS_THRESHOLD = 3;

// Matrice permisiuni campuri oferta — default seed la onboarding (4.13 / Î5):
// owner/manager pot orice; trusted poate orice mai putin PRICE; managed read-only.
const OFFER_FIELDS: OfferFieldKey[] = ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION'];

export function defaultOfferFieldPermissions(): { role: CompanyMemberRole; fieldKey: OfferFieldKey; canEdit: boolean }[] {
  const rows: { role: CompanyMemberRole; fieldKey: OfferFieldKey; canEdit: boolean }[] = [];
  for (const fieldKey of OFFER_FIELDS) {
    rows.push({ role: 'OWNER', fieldKey, canEdit: true });
    rows.push({ role: 'MANAGER', fieldKey, canEdit: true });
    rows.push({ role: 'EMPLOYEE_TRUSTED', fieldKey, canEdit: fieldKey !== 'PRICE' });
    rows.push({ role: 'EMPLOYEE_MANAGED', fieldKey, canEdit: false });
  }
  return rows;
}
