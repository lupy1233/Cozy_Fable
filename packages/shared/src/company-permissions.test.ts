import { describe, expect, it } from 'vitest';
import { COMPANY_PERMISSIONS, COMPANY_ROLE_PERMISSIONS, can } from './company-permissions';
import { COMPANY_MEMBER_ROLES } from './enums';

// Matricea e o copie a verificarilor din backend — orice schimbare aici e o schimbare de permisiuni.
describe('company permissions (E-admin-platform-58)', () => {
  it('pins the role → permission matrix', () => {
    expect(COMPANY_ROLE_PERMISSIONS).toEqual({
      OWNER: ['BILLING_MANAGE', 'MEMBERS_MANAGE', 'COMPANY_PROFILE_EDIT', 'CLAIMS_ASSIGN'],
      MANAGER: ['BILLING_MANAGE', 'MEMBERS_MANAGE', 'COMPANY_PROFILE_EDIT', 'CLAIMS_ASSIGN'],
      EMPLOYEE_TRUSTED: [],
      EMPLOYEE_MANAGED: [],
    });
  });

  it('covers every company role', () => {
    expect(Object.keys(COMPANY_ROLE_PERMISSIONS).sort()).toEqual([...COMPANY_MEMBER_ROLES].sort());
  });

  it.each(COMPANY_PERMISSIONS)('can(%s): only OWNER and MANAGER', (permission) => {
    expect(can('OWNER', permission)).toBe(true);
    expect(can('MANAGER', permission)).toBe(true);
    expect(can('EMPLOYEE_TRUSTED', permission)).toBe(false);
    expect(can('EMPLOYEE_MANAGED', permission)).toBe(false);
  });

  it('no role → no permission', () => {
    expect(can(null, 'BILLING_MANAGE')).toBe(false);
    expect(can(undefined, 'CLAIMS_ASSIGN')).toBe(false);
  });
});
