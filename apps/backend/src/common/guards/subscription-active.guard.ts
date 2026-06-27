import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { RequestWithCompany } from '../company-context/company-context';

// 4.8 — eligibilitate claim cere abonament activ. Ruleaza DUPA CompanyApprovedGuard
// (citeste companyContext) si ataseaza gatingDelayMinutes din planul abonamentului (4.10).
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithCompany>();
    const ctx = req.companyContext;
    if (!ctx) {
      // CompanyApprovedGuard trebuie sa ruleze inainte
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company context missing',
      });
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { companyId: ctx.companyId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    if (!sub) {
      throw new ForbiddenException({
        code: ERROR_CODES.SUBSCRIPTION_INACTIVE,
        message: 'No active subscription',
      });
    }

    ctx.subscriptionId = sub.id;
    ctx.gatingDelayMinutes = sub.plan.marketplaceGatingDelayMin;
    return true;
  }
}
