import type { ExecutionContext } from '@nestjs/common';
import type { CompanyMemberRole } from '@prisma/client';
import type { RequestWithCompany } from '../company-context/company-context';
import { CompanyManagerGuard } from './company-manager.guard';

// E-admin-platform-58: garda foloseste matricea COMPANY_ROLE_PERMISSIONS (BILLING_MANAGE);
// rolurile permise raman exact cele de dinainte (OWNER/MANAGER), angajatii primesc 403.
function contextFor(role: CompanyMemberRole | undefined): ExecutionContext {
  const req: RequestWithCompany = {
    companyContext: role ? { companyId: 'c1', memberRole: role, status: 'APPROVED' } : undefined,
  };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('CompanyManagerGuard (BILLING_MANAGE)', () => {
  const guard = new CompanyManagerGuard();

  it.each<CompanyMemberRole>(['OWNER', 'MANAGER'])('%s → acces', (role) => {
    expect(guard.canActivate(contextFor(role))).toBe(true);
  });

  it.each<CompanyMemberRole | undefined>(['EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED', undefined])('%s → 403 FORBIDDEN', (role) => {
    expect(() => guard.canActivate(contextFor(role))).toThrow(
      expect.objectContaining({ status: 403, response: expect.objectContaining({ code: 'FORBIDDEN' }) }),
    );
  });
});
