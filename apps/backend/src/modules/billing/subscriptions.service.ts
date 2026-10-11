import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  resolvePlanFeatures,
  type AdminSubscriptionItemDto,
  type SubscriptionDetailDto,
  type SubscriptionPlanDto,
} from '@marketplace/shared';
import { Prisma, type Subscription } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { CreditsService } from './credits.service';
import { activeSubscriptionWhere } from '../entitlements/entitlements.service';
import { VAT_RATE_DEFAULT, VAT_RATE_SETTING, priceWithVat } from './vat';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysLeftOf(expiresAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS));
}

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
    const enabled = await this.settings.getBool('trial_enabled', SETTING_DEFAULTS.trial_enabled);
    if (!enabled) {
      await this.credits.ensureWallet(companyId, tx);
      return;
    }
    const existing = await tx.subscription.findFirst({ where: { companyId } });
    if (existing) return; // deja are abonament (re-approve)

    // E-admin-platform-58: trial_plan = codul planului (validat la salvare in Admin)
    const planCode = await this.settings.getString('trial_plan', SETTING_DEFAULTS.trial_plan);
    const durationDays = await this.settings.getInt('trial_duration_days', SETTING_DEFAULTS.trial_duration_days);
    const bonusCredits = await this.settings.getInt('trial_bonus_credits', SETTING_DEFAULTS.trial_bonus_credits);

    const plan = await tx.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (!plan) {
      // fara plan seed-uit nu putem porni trialul; asiguram macar portofelul
      await this.credits.ensureWallet(companyId, tx);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * DAY_MS);
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

  // Acordare / PRELUNGIRE (decizie L0-D): daca firma are un abonament ACTIV neexpirat,
  // se prelungeste ACELASI rand: expiresAt = max(expiresAt, now) + days, planul cumparat
  // se aplica imediat, isTrial devine false (zilele ramase NU se pierd). Altfel rand nou.
  // Nu emite credite — apelantul decide (confirm: creditele planului; admin grant: optional).
  async grantOrExtend(companyId: string, planId: string, days: number, tx: Tx): Promise<Subscription> {
    const now = new Date();
    const active = await tx.subscription.findFirst({
      where: { companyId, ...activeSubscriptionWhere(now) },
      orderBy: { expiresAt: 'desc' },
    });
    if (active) {
      const base = active.expiresAt.getTime() > now.getTime() ? active.expiresAt : now;
      return tx.subscription.update({
        where: { id: active.id },
        data: { planId, isTrial: false, expiresAt: new Date(base.getTime() + days * DAY_MS) },
      });
    }
    return tx.subscription.create({
      data: {
        companyId,
        planId,
        status: 'ACTIVE',
        isTrial: false,
        startedAt: now,
        expiresAt: new Date(now.getTime() + days * DAY_MS),
      },
    });
  }

  async getActive(companyId: string): Promise<SubscriptionDetailDto | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { companyId, ...activeSubscriptionWhere() },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    if (!sub) return null;
    return {
      id: sub.id,
      planId: sub.planId,
      tier: sub.plan.code,
      status: sub.status,
      isTrial: sub.isTrial,
      startedAt: sub.startedAt.toISOString(),
      expiresAt: sub.expiresAt.toISOString(),
      daysLeft: daysLeftOf(sub.expiresAt),
      gatingDelayMinutes: sub.plan.marketplaceGatingDelayMin,
    };
  }

  // Planurile active, vizibile firmei (pret fara TVA; TVA-ul se adauga la comanda).
  // E-admin-platform-58: + TVA/total calculate ca pe comanda (buildAmounts), nume, functii, isFree.
  async listPlans(): Promise<SubscriptionPlanDto[]> {
    const [rows, vatRate] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        include: { features: true },
        orderBy: { priceRon: 'asc' },
      }),
      this.settings.getNumber(VAT_RATE_SETTING, VAT_RATE_DEFAULT),
    ]);
    return rows.map((p) => ({
      id: p.id,
      tier: p.code,
      nameRo: p.nameRo,
      nameEn: p.nameEn,
      priceRon: p.priceRon,
      isFree: p.priceRon === 0,
      ...priceWithVat(p.priceRon, vatRate),
      includedCredits: p.includedCredits,
      gatingDelayMinutes: p.marketplaceGatingDelayMin,
      features: resolvePlanFeatures(p.features),
    }));
  }

  // ADMIN — acordare/prelungire manuala, fara comanda si fara factura (vanzare asistata,
  // compensatii). Auditat in controller (@Audit SUBSCRIPTION_GRANTED).
  async adminGrant(input: {
    companyId: string;
    planId: string;
    days: number;
    includeCredits: boolean;
  }): Promise<AdminSubscriptionItemDto> {
    const [company, plan] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: input.companyId } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
    ]);
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
    if (!plan) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    }
    const sub = await runTx(this.prisma, 'write', async (tx) => {
      const row = await this.grantOrExtend(input.companyId, input.planId, input.days, tx);
      if (input.includeCredits && plan.includedCredits > 0) {
        await this.credits.grant(input.companyId, plan.includedCredits, 'SUBSCRIPTION_CREDITS', tx);
      }
      return row;
    });
    return this.toAdminDto({ ...sub, plan, company });
  }

  async adminList(companyId?: string): Promise<AdminSubscriptionItemDto[]> {
    const rows = await this.prisma.subscription.findMany({
      where: companyId ? { companyId } : undefined,
      include: { plan: true, company: true },
      orderBy: { expiresAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.toAdminDto(r));
  }

  private toAdminDto(
    s: Subscription & { plan: { code: string }; company: { name: string } },
  ): AdminSubscriptionItemDto {
    const now = new Date();
    return {
      id: s.id,
      companyId: s.companyId,
      companyName: s.company.name,
      planId: s.planId,
      tier: s.plan.code,
      status: s.status,
      isTrial: s.isTrial,
      startedAt: s.startedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      daysLeft: daysLeftOf(s.expiresAt, now),
      isCurrent: s.status === 'ACTIVE' && s.expiresAt.getTime() > now.getTime(),
    };
  }
}
