import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type PlanFeatureKey } from '@marketplace/shared';
import type { RequestWithCompany } from '../../common/company-context/company-context';
import { EntitlementsService } from './entitlements.service';

export const PLAN_FEATURE_KEY = 'requiredPlanFeature';

// E-admin-platform-58: ruta cere o functie a planului activ (ex. unelte viitoare). Ruleaza DUPA
// CompanyApprovedGuard (si, optional, SubscriptionActiveGuard — refoloseste entitlements de pe context).
export const RequirePlanFeature = (key: PlanFeatureKey) => SetMetadata(PLAN_FEATURE_KEY, key);

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeatureKey | undefined>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;
    const req = context.switchToHttp().getRequest<RequestWithCompany>();
    const ctx = req.companyContext;
    if (!ctx) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Company context missing' });
    }
    ctx.entitlements ??= await this.entitlements.forCompany(ctx.companyId);
    if (!this.entitlements.has(ctx.entitlements, feature)) {
      throw new ForbiddenException({
        code: ERROR_CODES.PLAN_FEATURE_REQUIRED,
        message: 'Your plan does not include this feature',
        details: { feature },
      });
    }
    return true;
  }
}
