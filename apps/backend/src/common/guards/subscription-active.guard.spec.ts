import type { ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { EntitlementsService } from '../../modules/entitlements/entitlements.service';
import { freezeClock, restoreClock } from '../../test/clock';
import type { CompanyContext, RequestWithCompany } from '../company-context/company-context';
import { SubscriptionActiveGuard } from './subscription-active.guard';

// E-admin-platform-14 — caracterizare SubscriptionActiveGuard (4.8/4.10): claim-ul cere abonament
// ACTIV neexpirat; garda ataseaza subscriptionId si intarzierea de gating din plan pe context.
// E-admin-platform-58: abonamentul vine prin EntitlementsService; planul trebuie sa includa
// MARKETPLACE_ACCESS (altfel 403 PLAN_FEATURE_REQUIRED).

const NOW = '2026-09-01T10:00:00Z';

function setup(companyContext: CompanyContext | undefined, subscription: unknown) {
  const findFirst = jest.fn().mockResolvedValue(subscription);
  const prisma = { subscription: { findFirst } } as unknown as PrismaService;
  const guard = new SubscriptionActiveGuard(new EntitlementsService(prisma));
  const req: RequestWithCompany = { companyContext };
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { guard, findFirst, req, context };
}

const plan = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  code: 'GOLD',
  nameRo: null,
  nameEn: null,
  priceRon: 399,
  marketplaceGatingDelayMin: 30,
  features: [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }],
  ...over,
});

describe('SubscriptionActiveGuard (E-admin-platform-14 + 58)', () => {
  let now: Date;
  beforeEach(() => {
    now = freezeClock(NOW);
  });
  afterEach(() => restoreClock());

  const ctx = (): CompanyContext => ({ companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' });

  it('fara companyContext → 403 FORBIDDEN (CompanyApprovedGuard trebuie sa ruleze inainte)', async () => {
    const { guard, context, findFirst } = setup(undefined, null);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('fara abonament activ → 403 SUBSCRIPTION_INACTIVE', async () => {
    const { guard, context } = setup(ctx(), null);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'SUBSCRIPTION_INACTIVE' },
    });
  });

  it('abonament activ pe un plan fara MARKETPLACE_ACCESS → 403 PLAN_FEATURE_REQUIRED', async () => {
    const { guard, context, req } = setup(ctx(), {
      id: 'sub1',
      isTrial: false,
      expiresAt: new Date('2026-09-02T10:00:00Z'),
      plan: plan({ code: 'TEST_FREE', priceRon: 0, features: [] }),
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'PLAN_FEATURE_REQUIRED', details: { feature: 'MARKETPLACE_ACCESS' } },
    });
    expect(req.companyContext?.subscriptionId).toBeUndefined();
  });

  it('abonament activ → true + subscriptionId, gatingDelayMinutes si entitlements pe context', async () => {
    const { guard, context, req, findFirst } = setup(ctx(), {
      id: 'sub1',
      isTrial: false,
      expiresAt: new Date('2026-09-20T10:00:00Z'),
      plan: plan(),
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.companyContext).toMatchObject({
      subscriptionId: 'sub1',
      gatingDelayMinutes: 30,
      entitlements: { planCode: 'GOLD', features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } } },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c1', status: 'ACTIVE', expiresAt: { gt: now } },
      include: { plan: { include: { features: true } } },
      orderBy: { expiresAt: 'desc' },
    });
  });
});
