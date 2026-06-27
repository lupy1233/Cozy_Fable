import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type CompanyPenaltyStatusDto } from '@marketplace/shared';
import { Prisma, type PenaltyScope } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';

type Tx = Prisma.TransactionClient;

// 4.12 / Î4 — fereastra rolling 180 zile; fiecare eveniment expira individual.
const PENALTY_WINDOW_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

// Fallback puncte daca penalty_rules nu e seed-uit (seed: SLA_MISS=3, MASS_SLA_MISS=3, VOLUNTARY_WITHDRAWAL=2).
const FALLBACK_POINTS: Record<string, number> = {
  SLA_MISS: 3,
  MASS_SLA_MISS: 3,
  VOLUNTARY_WITHDRAWAL: 2,
};

export interface ApplyPenaltyInput {
  companyId: string;
  ruleKey: string;
  scope?: PenaltyScope; // MVP: doar COMPANY (blocul pe angajat e descopat)
  userId?: string | null;
  claimSlotId?: string | null;
  reason?: string;
}

@Injectable()
export class PenaltiesService {
  private readonly logger = new Logger(PenaltiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // Aplica o penalizare si (pentru scope COMPANY) verifica pragul de suspendare.
  async applyPenalty(input: ApplyPenaltyInput, tx?: Tx): Promise<void> {
    const db = tx ?? this.prisma;
    const scope = input.scope ?? 'COMPANY';
    const points = await this.pointsFor(input.ruleKey, db);
    if (points <= 0) return;
    const now = new Date();
    await db.penaltyEvent.create({
      data: {
        scope,
        companyId: input.companyId,
        userId: input.userId ?? null,
        claimSlotId: input.claimSlotId ?? null,
        ruleKey: input.ruleKey,
        points,
        reason: input.reason ?? null,
        appliedAt: now,
        expiresAt: new Date(now.getTime() + PENALTY_WINDOW_DAYS * DAY_MS),
      },
    });
    if (scope === 'COMPANY') {
      await this.enforceCompanyThreshold(input.companyId, db);
    }
  }

  private async pointsFor(ruleKey: string, db: Tx | PrismaService): Promise<number> {
    const rule = await db.penaltyRule.findUnique({ where: { ruleKey } });
    if (rule) return rule.isActive ? rule.points : 0;
    return FALLBACK_POINTS[ruleKey] ?? 0;
  }

  // Prag firma (4.12): SUM(puncte COMPANY active) >= 12 → SUSPENDED N luni.
  private async enforceCompanyThreshold(companyId: string, db: Tx | PrismaService): Promise<void> {
    const threshold = await this.settings.getInt('company_penalty_threshold', 12);
    const months = await this.settings.getInt('company_suspension_months', 6);
    const active = await this.activePoints(companyId, db);
    if (active < threshold) return;
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company || company.status === 'SUSPENDED') return;
    const now = new Date();
    const until = new Date(now);
    until.setMonth(until.getMonth() + months);
    await db.company.update({
      where: { id: companyId },
      data: { status: 'SUSPENDED', suspendedAt: now, suspendedUntil: until },
    });
    this.logger.warn(`company ${companyId} SUSPENDED until ${until.toISOString()} (${active} pts)`);
  }

  private async activePoints(companyId: string, db: Tx | PrismaService): Promise<number> {
    const agg = await db.penaltyEvent.aggregate({
      where: { companyId, scope: 'COMPANY', expiresAt: { gt: new Date() } },
      _sum: { points: true },
    });
    return agg._sum.points ?? 0;
  }

  async getStatusForUser(userId: string): Promise<CompanyPenaltyStatusDto> {
    const member = await this.prisma.companyMember.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'No company' });
    }
    return this.getCompanyStatus(member.companyId);
  }

  async getCompanyStatus(companyId: string): Promise<CompanyPenaltyStatusDto> {
    const threshold = await this.settings.getInt('company_penalty_threshold', 12);
    const events = await this.prisma.penaltyEvent.findMany({
      where: { companyId, scope: 'COMPANY', expiresAt: { gt: new Date() } },
      orderBy: { appliedAt: 'desc' },
    });
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    return {
      activePoints: events.reduce((s, e) => s + e.points, 0),
      threshold,
      suspended: company?.status === 'SUSPENDED',
      suspendedUntil: company?.suspendedUntil?.toISOString() ?? null,
      events: events.map((e) => ({
        id: e.id,
        ruleKey: e.ruleKey,
        points: e.points,
        reason: e.reason,
        appliedAt: e.appliedAt.toISOString(),
        expiresAt: e.expiresAt.toISOString(),
      })),
    };
  }
}
