import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminKpiDto,
  type AuditLogPageDto,
  type JobDto,
  type PenaltyRuleDto,
  type SettingDto,
  type UpdatePenaltyRuleInput,
  type UpdatePlanInput,
  type UpdateThresholdInput,
  type UpsertCreditPackageInput,
} from '@marketplace/shared';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_NOTIFICATIONS,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';

@Injectable()
export class AdminService {
  private readonly queues: Record<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) requestExpiration: Queue,
    @InjectQueue(QUEUE_CLAIM_ASSIGN) claimAssign: Queue,
    @InjectQueue(QUEUE_SLA_BREACH) slaBreach: Queue,
    @InjectQueue(QUEUE_QUOTE_VALIDITY) quoteValidity: Queue,
    @InjectQueue(QUEUE_CONSULTATION_EXPIRY) consultationExpiry: Queue,
    @InjectQueue(QUEUE_WITHDRAWAL_REMINDER) withdrawalReminder: Queue,
  ) {
    this.queues = {
      [QUEUE_NOTIFICATIONS]: notifications,
      [QUEUE_REQUEST_EXPIRATION]: requestExpiration,
      [QUEUE_CLAIM_ASSIGN]: claimAssign,
      [QUEUE_SLA_BREACH]: slaBreach,
      [QUEUE_QUOTE_VALIDITY]: quoteValidity,
      [QUEUE_CONSULTATION_EXPIRY]: consultationExpiry,
      [QUEUE_WITHDRAWAL_REMINDER]: withdrawalReminder,
    };
  }

  // ===== KPI (4.19) =====
  async getKpi(): Promise<AdminKpiDto> {
    const [companies, requests, activeClaims, openDisputes, pendingPayments, activeSubs, wallets, revenue, auditEntries] =
      await Promise.all([
        this.prisma.company.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.request.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        this.prisma.claimSlot.count({ where: { status: { in: ['ACTIVE', 'OFFER_SENT'] } } }),
        this.prisma.reviewDispute.count({ where: { status: 'OPEN' } }),
        this.prisma.mockBillingOrder.count({ where: { status: 'PENDING' } }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
        this.prisma.companyCreditWallet.aggregate({ _sum: { balance: true, reserved: true } }),
        this.prisma.mockBillingOrder.aggregate({ where: { status: 'CONFIRMED' }, _sum: { totalRon: true } }),
        this.prisma.auditLog.count(),
      ]);
    const toMap = (rows: { status: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    return {
      companiesByStatus: toMap(companies as never),
      requestsByStatus: toMap(requests as never),
      activeClaims,
      openDisputes,
      pendingPayments,
      activeSubscriptions: activeSubs,
      totalCreditsBalance: wallets._sum.balance ?? 0,
      totalCreditsReserved: wallets._sum.reserved ?? 0,
      revenueRon: Number(revenue._sum.totalRon ?? 0),
      auditEntries,
    };
  }

  // ===== Audit viewer (3.9) =====
  async getAuditLogs(
    page: number,
    pageSize: number,
    filters: { action?: string; entityType?: string; userId?: string },
  ): Promise<AuditLogPageDto> {
    const where = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
    };
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((a) => ({
        id: a.id,
        userId: a.userId,
        role: a.role,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      page: Math.max(page, 1),
      pageSize: take,
    };
  }

  // ===== Settings (4.19) =====
  async getSettings(): Promise<SettingDto[]> {
    const rows = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    return rows.map((s) => ({ key: s.key, value: s.value }));
  }

  async updateSetting(key: string, value: string, updatedBy: string): Promise<SettingDto> {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.SETTING_KEY_UNKNOWN, message: 'Unknown setting' });
    }
    const updated = await this.prisma.systemSetting.update({ where: { key }, data: { value, updatedBy } });
    return { key: updated.key, value: updated.value };
  }

  // ===== penalty_rules (4.12) =====
  async getPenaltyRules(): Promise<PenaltyRuleDto[]> {
    const rows = await this.prisma.penaltyRule.findMany({ orderBy: { ruleKey: 'asc' } });
    return rows.map((r) => ({ id: r.id, ruleKey: r.ruleKey, points: r.points, isActive: r.isActive }));
  }

  async updatePenaltyRule(id: string, dto: UpdatePenaltyRuleInput): Promise<PenaltyRuleDto> {
    const rule = await this.prisma.penaltyRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rule not found' });
    const updated = await this.prisma.penaltyRule.update({
      where: { id },
      data: { points: dto.points ?? undefined, isActive: dto.isActive ?? undefined },
    });
    return { id: updated.id, ruleKey: updated.ruleKey, points: updated.points, isActive: updated.isActive };
  }

  // ===== credit_packages / plans / thresholds =====
  async getCreditPackages() {
    const rows = await this.prisma.creditPackage.findMany({ orderBy: { credits: 'asc' } });
    return rows.map((p) => ({ id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive }));
  }

  async createCreditPackage(dto: UpsertCreditPackageInput) {
    const p = await this.prisma.creditPackage.create({
      data: { credits: dto.credits, priceRon: dto.priceRon, isActive: dto.isActive ?? true },
    });
    return { id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive };
  }

  async updateCreditPackage(id: string, dto: Partial<UpsertCreditPackageInput>) {
    const exists = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Package not found' });
    const p = await this.prisma.creditPackage.update({
      where: { id },
      data: { credits: dto.credits, priceRon: dto.priceRon, isActive: dto.isActive },
    });
    return { id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive };
  }

  async getPlans() {
    const rows = await this.prisma.subscriptionPlan.findMany({ orderBy: { priceRon: 'asc' } });
    return rows.map((p) => ({
      id: p.id, tier: p.tier, priceRon: p.priceRon, includedCredits: p.includedCredits,
      marketplaceGatingDelayMin: p.marketplaceGatingDelayMin, isActive: p.isActive,
    }));
  }

  async updatePlan(id: string, dto: UpdatePlanInput) {
    const exists = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    const p = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        priceRon: dto.priceRon, includedCredits: dto.includedCredits,
        marketplaceGatingDelayMin: dto.marketplaceGatingDelayMin, isActive: dto.isActive,
      },
    });
    return {
      id: p.id, tier: p.tier, priceRon: p.priceRon, includedCredits: p.includedCredits,
      marketplaceGatingDelayMin: p.marketplaceGatingDelayMin, isActive: p.isActive,
    };
  }

  async getThresholds() {
    const rows = await this.prisma.projectSizeThreshold.findMany();
    return rows.map((t) => ({ id: t.id, size: t.size, minScore: t.minScore, maxScore: t.maxScore, creditCost: t.creditCost }));
  }

  async updateThreshold(id: string, dto: UpdateThresholdInput) {
    const exists = await this.prisma.projectSizeThreshold.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Threshold not found' });
    const t = await this.prisma.projectSizeThreshold.update({
      where: { id },
      data: { minScore: dto.minScore, maxScore: dto.maxScore, creditCost: dto.creditCost },
    });
    return { id: t.id, size: t.size, minScore: t.minScore, maxScore: t.maxScore, creditCost: t.creditCost };
  }

  // ===== Jobs (3.11) =====
  async getFailedJobs(): Promise<JobDto[]> {
    const out: JobDto[] = [];
    for (const [name, queue] of Object.entries(this.queues)) {
      const failed = await queue.getFailed(0, 50);
      for (const j of failed) {
        out.push({
          id: String(j.id),
          queue: name,
          name: j.name,
          failedReason: j.failedReason ?? null,
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp ? new Date(j.timestamp).toISOString() : null,
        });
      }
    }
    return out;
  }

  async retryJob(queueName: string, jobId: string): Promise<{ ok: true }> {
    const queue = this.queues[queueName];
    if (!queue) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Queue not found' });
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Job not found' });
    await job.retry();
    return { ok: true };
  }
}
