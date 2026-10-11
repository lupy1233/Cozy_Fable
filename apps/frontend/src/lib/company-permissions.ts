import { can, type CompanyDto, type CompanyPermission } from '@marketplace/shared';

// E-admin-platform-58: permisiunile vin din CompanyDto.permissions (calculate in backend din
// matricea COMPANY_ROLE_PERMISSIONS). Fallback pe matricea din shared cand raspunsul nu are
// campul (slot blue/green vechi) — acelasi rezultat pentru rolurile de azi.
export function companyCan(
  company: Pick<CompanyDto, 'myRole'> & { permissions?: CompanyPermission[] } | null | undefined,
  permission: CompanyPermission,
): boolean {
  if (!company) return false;
  if (Array.isArray(company.permissions)) return company.permissions.includes(permission);
  return can(company.myRole, permission);
}
