import { describe, expect, it } from 'vitest';
import { COMPANY_PERMISSIONS, COMPANY_ROLE_PERMISSIONS, can } from './company-permissions';
import { COMPANY_MEMBER_ROLES } from './enums';

// Matricea e o copie a verificarilor din backend — orice schimbare aici e o schimbare de permisiuni.
describe('company permissions (E-admin-platform-58)', () => {
  it('pins the role → permission matrix', () => {
    expect(COMPANY_ROLE_PERMISSIONS).toEqual({
      OWNER: ['BILLING_MANAGE', 'MEMBERS_MANAGE', 'COMPANY_PROFILE_EDIT', 'CLAIMS_ASSIGN', 'CLAIMS_CREATE'],
      MANAGER: ['BILLING_MANAGE', 'MEMBERS_MANAGE', 'COMPANY_PROFILE_EDIT', 'CLAIMS_ASSIGN', 'CLAIMS_CREATE'],
      EMPLOYEE_TRUSTED: ['CLAIMS_CREATE'],
      EMPLOYEE_MANAGED: [],
    });
  });

  it('covers every company role', () => {
    expect(Object.keys(COMPANY_ROLE_PERMISSIONS).sort()).toEqual([...COMPANY_MEMBER_ROLES].sort());
  });

  it.each(COMPANY_PERMISSIONS.filter((p) => p !== 'CLAIMS_CREATE'))('can(%s): only OWNER and MANAGER', (permission) => {
    expect(can('OWNER', permission)).toBe(true);
    expect(can('MANAGER', permission)).toBe(true);
    expect(can('EMPLOYEE_TRUSTED', permission)).toBe(false);
    expect(can('EMPLOYEE_MANAGED', permission)).toBe(false);
  });

  // a5 (PO 2026-11-13): angajatul cu acces complet preia (mereu pentru el), cel cu rol limitat nu
  it('can(CLAIMS_CREATE): everyone except EMPLOYEE_MANAGED', () => {
    expect(can('OWNER', 'CLAIMS_CREATE')).toBe(true);
    expect(can('MANAGER', 'CLAIMS_CREATE')).toBe(true);
    expect(can('EMPLOYEE_TRUSTED', 'CLAIMS_CREATE')).toBe(true);
    expect(can('EMPLOYEE_MANAGED', 'CLAIMS_CREATE')).toBe(false);
  });

  it('no role → no permission', () => {
    expect(can(null, 'BILLING_MANAGE')).toBe(false);
    expect(can(undefined, 'CLAIMS_ASSIGN')).toBe(false);
  });
});
