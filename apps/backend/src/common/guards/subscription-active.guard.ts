import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { EntitlementsService } from '../../modules/entitlements/entitlements.service';
import type { RequestWithCompany } from '../company-context/company-context';

// 4.8 — eligibilitate claim cere abonament activ. h2 (2026-11-13): se pune DOAR pe preluarea
// noua (si pe lista/detaliul marketplace-ului); lucrul pe preluarile existente nu o cere. Ruleaza DUPA CompanyApprovedGuard
// (citeste companyContext) si ataseaza gatingDelayMinutes din planul abonamentului (4.10).
// E-admin-platform-58: abonamentul + planul vin din EntitlementsService (predicatul unic
// activeSubscriptionWhere); planul trebuie sa includa si MARKETPLACE_ACCESS.
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementsService) {}

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

    const e = await this.entitlements.forCompany(ctx.companyId);
    if (!e.subscriptionId) {
      // h2: refuzul spune si ce abonament a expirat si cand (null = n-a avut niciodata)
      const lastExpired = await this.entitlements.lastExpired(ctx.companyId);
      throw new ForbiddenException({
        code: ERROR_CODES.SUBSCRIPTION_INACTIVE,
        message: 'No active subscription',
        details: { lastExpired },
      });
    }
    // abonament activ, dar planul nu include marketplace-ul (ex. plan gratuit fara acces)
    if (!this.entitlements.has(e, 'MARKETPLACE_ACCESS')) {
      throw new ForbiddenException({
        code: ERROR_CODES.PLAN_FEATURE_REQUIRED,
        message: 'Your plan does not include marketplace access',
        details: { feature: 'MARKETPLACE_ACCESS' },
      });
    }

    ctx.subscriptionId = e.subscriptionId;
    ctx.gatingDelayMinutes = e.gatingDelayMinutes ?? 0;
    ctx.entitlements = e;
    return true;
  }
}
