import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CompanyContext, RequestWithCompany } from '../../common/company-context/company-context';
import type { CompanyEntitlements, EntitlementsService } from './entitlements.service';
import { PLAN_FEATURE_KEY, PlanFeatureGuard } from './plan-feature.guard';

// E-admin-platform-58 — @RequirePlanFeature(key) + PlanFeatureGuard (pentru functiile viitoare).

const entitlements = (enabled: boolean): CompanyEntitlements => ({
  subscriptionId: 'sub1',
  planId: 'p1',
  planCode: 'GOLD',
  nameRo: null,
  nameEn: null,
  isFree: false,
  isTrial: false,
  expiresAt: new Date('2026-10-01T00:00:00Z'),
  gatingDelayMinutes: 30,
  features: { MARKETPLACE_ACCESS: { enabled, limit: null } },
});

function setup(feature: string | undefined, ctx: CompanyContext | undefined, loaded: CompanyEntitlements) {
  const handler = () => undefined;
  if (feature) Reflect.defineMetadata(PLAN_FEATURE_KEY, feature, handler);
  const forCompany = jest.fn().mockResolvedValue(loaded);
  const service = { forCompany, has: (e: CompanyEntitlements, k: 'MARKETPLACE_ACCESS') => e.features[k].enabled } as unknown as EntitlementsService;
  const guard = new PlanFeatureGuard(new Reflector(), service);
  const req: RequestWithCompany = { companyContext: ctx };
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard, context, forCompany, req };
}

const ctx = (): CompanyContext => ({ companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' });

describe('PlanFeatureGuard (E-admin-platform-58)', () => {
  it('ruta fara @RequirePlanFeature → trece fara query', async () => {
    const { guard, context, forCompany } = setup(undefined, ctx(), entitlements(false));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(forCompany).not.toHaveBeenCalled();
  });

  it('functie dezactivata → 403 PLAN_FEATURE_REQUIRED cu details.feature', async () => {
    const { guard, context } = setup('MARKETPLACE_ACCESS', ctx(), entitlements(false));
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'PLAN_FEATURE_REQUIRED', details: { feature: 'MARKETPLACE_ACCESS' } },
    });
  });

  it('functie activa → trece si pastreaza entitlements pe context', async () => {
    const { guard, context, req } = setup('MARKETPLACE_ACCESS', ctx(), entitlements(true));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.companyContext?.entitlements?.planCode).toBe('GOLD');
  });

  it('refoloseste entitlements deja puse de SubscriptionActiveGuard', async () => {
    const c = { ...ctx(), entitlements: entitlements(true) };
    const { guard, context, forCompany } = setup('MARKETPLACE_ACCESS', c, entitlements(false));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(forCompany).not.toHaveBeenCalled();
  });

  it('fara companyContext → 403 FORBIDDEN', async () => {
    const { guard, context } = setup('MARKETPLACE_ACCESS', undefined, entitlements(true));
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
  });
});
