import { Injectable } from '@nestjs/common';
import {
  PLAN_FEATURE_DEFAULTS,
  resolvePlanFeatures,
  type EntitlementsDto,
  type PlanFeatureKey,
  type PlanFeaturesDto,
} from '@marketplace/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

// E-admin-platform-58 — SINGURUL loc unde e scris predicatul "abonament activ" (4.8/4.16):
// status ACTIVE si neexpirat. Garda, SubscriptionsService, workerul de expirare si KPI-ul admin
// il folosesc pe acesta; orice regula noua (gratie, trial) se schimba doar aici.
export function activeSubscriptionWhere(now: Date = new Date()): Prisma.SubscriptionWhereInput {
  return { status: 'ACTIVE', expiresAt: { gt: now } };
}

export interface CompanyEntitlements {
  subscriptionId: string | null;
  planId: string | null;
  planCode: string | null;
  nameRo: string | null;
  nameEn: string | null;
  isFree: boolean;
  isTrial: boolean;
  expiresAt: Date | null;
  gatingDelayMinutes: number | null;
  features: PlanFeaturesDto;
}

type Db = PrismaService | Prisma.TransactionClient;

function defaultFeatures(): PlanFeaturesDto {
  return resolvePlanFeatures([]);
}

// Ce ii da firmei abonamentul activ (planul + functiile lui). Un singur query.
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async forCompany(companyId: string, db: Db = this.prisma): Promise<CompanyEntitlements> {
    const sub = await db.subscription.findFirst({
      where: { companyId, ...activeSubscriptionWhere() },
      include: { plan: { include: { features: true } } },
      orderBy: { expiresAt: 'desc' },
    });
    if (!sub) {
      return {
        subscriptionId: null,
        planId: null,
        planCode: null,
        nameRo: null,
        nameEn: null,
        isFree: false,
        isTrial: false,
        expiresAt: null,
        gatingDelayMinutes: null,
        features: defaultFeatures(),
      };
    }
    const { plan } = sub;
    return {
      subscriptionId: sub.id,
      planId: plan.id,
      planCode: plan.code,
      nameRo: plan.nameRo,
      nameEn: plan.nameEn,
      isFree: plan.priceRon === 0,
      isTrial: sub.isTrial,
      expiresAt: sub.expiresAt,
      gatingDelayMinutes: plan.marketplaceGatingDelayMin,
      features: resolvePlanFeatures(plan.features),
    };
  }

  has(e: CompanyEntitlements, key: PlanFeatureKey): boolean {
    return (e.features[key] ?? PLAN_FEATURE_DEFAULTS[key]).enabled;
  }

  toDto(e: CompanyEntitlements): EntitlementsDto {
    return {
      planId: e.planId,
      planCode: e.planCode,
      nameRo: e.nameRo,
      nameEn: e.nameEn,
      isFree: e.isFree,
      isTrial: e.isTrial,
      expiresAt: e.expiresAt?.toISOString() ?? null,
      gatingDelayMinutes: e.gatingDelayMinutes,
      features: e.features,
    };
  }
}
