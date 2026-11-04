import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES, can } from '@marketplace/shared';
import type { RequestWithCompany } from '../company-context/company-context';

// Pasul 6 (audit 2026-08-23): rutele cu bani (cumparare credite/abonament, comenzi, facturi)
// sunt doar pentru OWNER/MANAGER — inainte ORICE angajat (inclusiv EMPLOYEE_MANAGED) putea
// cumpara si vedea facturile firmei. Ruleaza DUPA CompanyApprovedGuard (companyContext setat).
// E-admin-platform-58: rolurile vin din matricea COMPANY_ROLE_PERMISSIONS (BILLING_MANAGE).
@Injectable()
export class CompanyManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithCompany>();
    const role = req.companyContext?.memberRole;
    if (!can(role, 'BILLING_MANAGE')) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the owner or a manager can manage billing',
      });
    }
    return true;
  }
}
