import type { CompanyMemberRole } from './enums';

// E-admin-platform-58 — matricea rol → permisiuni in firma. Copiaza EXACT verificarile existente
// din backend (nicio permisiune schimbata):
// - BILLING_MANAGE: CompanyManagerGuard (cumparari, comenzi, facturi) + billingEmail in CompanyDto
// - MEMBERS_MANAGE: CompaniesService.requireManager la addMember/changeMemberRole/removeMember
//   (regulile suplimentare despre OWNER raman in service)
// - COMPANY_PROFILE_EDIT: CompaniesService.requireManager la profil/locatii/portofoliu
// - CLAIMS_ASSIGN: ClaimsService.assign (reatribuire preluare)
export const COMPANY_PERMISSIONS = ['BILLING_MANAGE', 'MEMBERS_MANAGE', 'COMPANY_PROFILE_EDIT', 'CLAIMS_ASSIGN'] as const;
export type CompanyPermission = (typeof COMPANY_PERMISSIONS)[number];

const LEADERSHIP: readonly CompanyPermission[] = Object.freeze([...COMPANY_PERMISSIONS]);

export const COMPANY_ROLE_PERMISSIONS: Readonly<Record<CompanyMemberRole, readonly CompanyPermission[]>> =
  Object.freeze({
    OWNER: LEADERSHIP,
    MANAGER: LEADERSHIP,
    EMPLOYEE_TRUSTED: Object.freeze([]),
    EMPLOYEE_MANAGED: Object.freeze([]),
  });

export function can(role: CompanyMemberRole | null | undefined, permission: CompanyPermission): boolean {
  if (!role) return false;
  return COMPANY_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
