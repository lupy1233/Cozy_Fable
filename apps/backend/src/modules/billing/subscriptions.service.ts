import { Injectable } from '@nestjs/common';
import { type SubscriptionDto } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { CreditsService } from './credits.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly credits: CreditsService,
  ) {}

  // 4.16 — la approve firma: trial Gold gratuit + bonus credite, daca trial_enabled.
  // Ruleaza in tranzactia approve (tx furnizat). Idempotent: nu dubleaza daca exista deja.
  async startTrialIfEnabled(companyId: string, tx: Tx): Promise<void> {
    const enabled = await this.settings.getBool('trial_enabled', true);
    if (!enabled) {
      await this.credits.ensureWallet(companyId, tx);
      return;
    }
    const existing = await tx.subscription.findFirst({ where: { companyId } });
    if (existing) return; // deja are abonament (re-approve)

    const planTier = await this.settings.getString('trial_plan', 'GOLD');
    const durationDays = await this.settings.getInt('trial_duration_days', 30);
    const bonusCredits = await this.settings.getInt('trial_bonus_credits', 10);

    const plan = await tx.subscriptionPlan.findUnique({
      where: { tier: planTier as 'SILVER' | 'GOLD' | 'PLATINUM' },
    });
    if (!plan) {
      // fara plan seed-uit nu putem porni trialul; asiguram macar portofelul
      await this.credits.ensureWallet(companyId, tx);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    await tx.subscription.create({
      data: {
        companyId,
        planId: plan.id,
        status: 'ACTIVE',
        isTrial: true,
        startedAt: now,
        expiresAt,
        trialEndsAt: expiresAt,
      },
    });
    await this.credits.ensureWallet(companyId, tx);
    if (bonusCredits > 0) {
      await this.credits.grant(companyId, bonusCredits, 'TRIAL_BONUS', tx);
    }
  }

  async getActive(companyId: string): Promise<SubscriptionDto | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    if (!sub) return null;
    return {
      id: sub.id,
      tier: sub.plan.tier,
      status: sub.status,
      isTrial: sub.isTrial,
      startedAt: sub.startedAt.toISOString(),
      expiresAt: sub.expiresAt.toISOString(),
      gatingDelayMinutes: sub.plan.marketplaceGatingDelayMin,
    };
  }
}
