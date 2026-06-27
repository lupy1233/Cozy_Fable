import type { CompanyMemberRole, CompanyStatus } from '@prisma/client';

// Context firma rezolvat de CompanyApprovedGuard si atasat pe request,
// reutilizat de SubscriptionActiveGuard si de servicii (evita lookup dublu).
export interface CompanyContext {
  companyId: string;
  memberRole: CompanyMemberRole;
  status: CompanyStatus;
  // setat de SubscriptionActiveGuard
  subscriptionId?: string;
  gatingDelayMinutes?: number;
}

// Augmentare request Express cu contextul firmei.
export interface RequestWithCompany {
  companyContext?: CompanyContext;
}
