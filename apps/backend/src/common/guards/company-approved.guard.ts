import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import type { AccessTokenPayload } from '../../modules/auth/auth.constants';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { RequestWithCompany } from '../company-context/company-context';

// 4.6/4.8 — doar firme APPROVED vad cereri / dau claim. Rezolva apartenenta
// userului si ataseaza companyContext pe request pentru guard-urile/serviciile urmatoare.
@Injectable()
export class CompanyApprovedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: AccessTokenPayload } & RequestWithCompany>();
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not authenticated' });
    }

    const member = await this.prisma.companyMember.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User is not a member of any company',
      });
    }

    const company = await this.prisma.company.findFirst({
      where: { id: member.companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
    // Pasul 5 (audit 2026-08-23, F2): suspendarea EXPIRA — dupa suspendedUntil firma nu mai
    // e blocata (inainte SUSPENDED era fundatura permanenta). Randul e curatat de sweep-ul
    // de reconciliere / admin unsuspend; guard-ul doar nu o mai blocheaza intre timp.
    const suspensionExpired =
      company.status === 'SUSPENDED' &&
      company.suspendedUntil !== null &&
      company.suspendedUntil.getTime() <= Date.now();
    if (company.status === 'SUSPENDED' && !suspensionExpired) {
      throw new ForbiddenException({
        code: ERROR_CODES.COMPANY_SUSPENDED,
        message: 'Company is suspended',
      });
    }
    if (company.status !== 'APPROVED' && !suspensionExpired) {
      throw new ForbiddenException({
        code: ERROR_CODES.COMPANY_NOT_APPROVED,
        message: 'Company is not approved',
      });
    }

    req.companyContext = {
      companyId: company.id,
      memberRole: member.role,
      status: suspensionExpired ? 'APPROVED' : company.status,
    };
    return true;
  }
}
