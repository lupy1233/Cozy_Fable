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

// h1 (revizuire M1): adaugari de colegi pe ora, per utilizator (fiecare trimite clopotel + e-mail)
export const ADD_MEMBER_LIMIT_PER_HOUR = 10;
// h1 (revizuire M1c): acelasi coleg readaugat in aceeasi firma in acest interval nu mai primeste e-mail
export const MEMBER_ADDED_EMAIL_DEDUP_MS = 24 * 3600 * 1000;
// m7: lungimea maxima a matricei trimise (4 roluri × 5 campuri)
export const OFFER_PERMISSIONS_MAX_ENTRIES = 4 * OFFER_FIELDS.length;

export type OfferFieldPermissionRow = { role: CompanyMemberRole; fieldKey: OfferFieldKey; canEdit: boolean };

// h1-2 (PO 2026-11-13): proprietarul (rolul OWNER din company_members) are mereu toate
// drepturile, indiferent de randuri. Firma fara NICIUN rand primeste matricea de la inscriere.
// O firma cu randuri ramane pe randurile ei (rand lipsa pentru un rol ≠ OWNER = nu are voie).
export function effectiveOfferFieldPermissions(rows: OfferFieldPermissionRow[]): OfferFieldPermissionRow[] {
  const base = rows.length > 0 ? rows : defaultOfferFieldPermissions();
  return [
    ...OFFER_FIELDS.map((fieldKey) => ({ role: 'OWNER' as CompanyMemberRole, fieldKey, canEdit: true })),
    ...base
      .filter((r) => r.role !== 'OWNER')
      .map((r) => ({ role: r.role, fieldKey: r.fieldKey, canEdit: r.canEdit })),
  ];
}

// Campurile pe care un rol le poate edita; `companyHasRows` = firma are macar un rand (orice rol).
export function editableOfferFields(
  role: CompanyMemberRole,
  roleRows: { fieldKey: OfferFieldKey; canEdit: boolean }[],
  companyHasRows: boolean,
): Set<OfferFieldKey> {
  if (role === 'OWNER') return new Set(OFFER_FIELDS);
  const rows = companyHasRows ? roleRows : defaultOfferFieldPermissions().filter((r) => r.role === role);
  return new Set(rows.filter((r) => r.canEdit).map((r) => r.fieldKey));
}
