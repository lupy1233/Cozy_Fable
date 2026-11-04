import type { CompanyMemberRole, CompanyStatus } from '@prisma/client';
import type { CompanyEntitlements } from '../../modules/entitlements/entitlements.service';

// Context firma rezolvat de CompanyApprovedGuard si atasat pe request,
// reutilizat de SubscriptionActiveGuard si de servicii (evita lookup dublu).
export interface CompanyContext {
  companyId: string;
  memberRole: CompanyMemberRole;
  status: CompanyStatus;
  // setat de SubscriptionActiveGuard
  subscriptionId?: string;
  gatingDelayMinutes?: number;
  // E-admin-platform-58: planul activ + functiile lui (SubscriptionActiveGuard / PlanFeatureGuard)
  entitlements?: CompanyEntitlements;
}

// Augmentare request Express cu contextul firmei.
export interface RequestWithCompany {
  companyContext?: CompanyContext;
}
