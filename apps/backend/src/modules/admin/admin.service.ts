import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CLAIM_CONTACT_REVEAL_POLICIES,
  CLAIM_COST_SETTING_KEYS,
  ERROR_CODES,
  MARKETPLACE_DISTANCE_DISPLAY_MODES,
  PLAN_CODE_RE,
  PLAN_FEATURE_KEYS,
  resolvePlanFeatures,
  PRE_CLAIM_CONTACT_TEXT_POLICIES,
  SETTING_COMPANY_LOCATION_CHANGES_PER_DAY,
  SETTING_COMPANY_LOCATIONS_MAX,
  SETTING_MARKETPLACE_DISTANCE_DISPLAY,
  SETTING_PRE_CLAIM_CONTACT_TEXT_POLICY,
  type AdminCreditPackageDto,
  type AdminKpiDto,
  type AdminPlanDto,
  type AdminThresholdDto,
  type CreatePlanInput,
  type AdminMailTestResultDto,
  type AdminUserItemDto,
  type AuditLogPageDto,
  type JobDto,
  type PenaltyRuleDto,
  type SettingDto,
  type UpdatePenaltyRuleInput,
  type UpdatePlanInput,
  type UpdateThresholdInput,
  type UpsertCreditPackageInput,
  isValidIban,
  isValidRoCui,
  normalizeIban,
} from '@marketplace/shared';
import { Language, Prisma, type UserRole } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { activeSubscriptionWhere } from '../entitlements/entitlements.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { MailService } from '../../infra/mail/mail.service';
import { supportLineHtml } from '../../infra/mail/mail-footer';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { TokenService } from '../auth/token.service';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_NOTIFICATIONS,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_DELIVERY_AUTOCOMPLETE,
  QUEUE_RECONCILIATION,
  QUEUE_SUBSCRIPTION_EXPIRY,
  QUEUE_WITHDRAWAL_REMINDER,
  QUEUE_UPLOADS,
  QUEUE_DOMAIN_EVENTS,
  QUEUE_OFFER_EXPIRY_SETTLEMENT,
  QUEUE_PROJECT_DEADLINES,
} from '../../infra/queues/queues.module';
import {
  SETTING_CLAIM_CONTACT_REVEAL_POLICY,
  SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER,
  SETTING_COMPLETED_CLAIM_CONTACT_RETENTION_DAYS,
  SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_DAYS,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_ENABLED,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_OUTCOME,
} from '../claims/claims.constants';
import {
  SETTING_LEGAL_CONTACT_EMAIL,
  SETTING_LEGAL_IDENTITY_PUBLISHED,
  SETTING_LEGAL_REACCEPT_EXISTING_USERS,
} from '../legal/legal.constants';
import { SETTING_BANK_TRANSFER_EXPIRY_DAYS, SETTING_BANK_TRANSFER_REMINDER_DAYS } from '../billing/bank-transfer.constants';

// E-admin-platform-58: numele planului (optional) — gol/null = fara nume (se afiseaza codul)
function cleanPlanName(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

// Sprint 1 security-close: setarile noi care misca bani/notificari accepta doar valori
// cunoscute (altfel un typo ar lasa procesorul no-op sau ar programa joburi aberante).
const DAY_COUNT = /^(?:0|[1-9]\d{0,2})$/;
const SETTING_VALUE_RULES: Partial<Record<string, (value: string) => boolean>> = {
  [SETTING_EXPIRED_OFFER_AUTOCLOSE_ENABLED]: (v) => v === 'true' || v === 'false',
  [SETTING_EXPIRED_OFFER_AUTOCLOSE_OUTCOME]: (v) => v === 'REFUND' || v === 'CONSUME' || v === 'UNSET',
  [SETTING_EXPIRED_OFFER_AUTOCLOSE_DAYS]: (v) => DAY_COUNT.test(v) && Number(v) <= 365,
  [SETTING_DELIVERY_REMINDER_DAYS_BEFORE]: (v) => DAY_COUNT.test(v) && Number(v) <= 365,
  // E-admin-platform-10: varianta A a claim-ului dupa prima oferta (DECIZIE NECESARA PO)
  [SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER]: (v) => v === 'true' || v === 'false',
  // E-company-3: momentul dezvaluirii contactelor + pragul dupa livrare (DECIZIE NECESARA PO)
  [SETTING_CLAIM_CONTACT_REVEAL_POLICY]: (v) => (CLAIM_CONTACT_REVEAL_POLICIES as readonly string[]).includes(v),
  [SETTING_COMPLETED_CLAIM_CONTACT_RETENTION_DAYS]: (v) => /^(?:0|[1-9]\d{0,3})$/.test(v) && Number(v) <= 3650,
  // E-admin-platform-45: contacte in texte libere — MASK | BLOCK (DECIZIE NECESARA PO)
  [SETTING_PRE_CLAIM_CONTACT_TEXT_POLICY]: (v) => (PRE_CLAIM_CONTACT_TEXT_POLICIES as readonly string[]).includes(v),
  // E-client-9: distanta pre-claim, plafon locatii, schimbari/24h (DECIZIE NECESARA PO)
  [SETTING_MARKETPLACE_DISTANCE_DISPLAY]: (v) => (MARKETPLACE_DISTANCE_DISPLAY_MODES as readonly string[]).includes(v),
  [SETTING_COMPANY_LOCATIONS_MAX]: (v) => /^[1-9]\d{0,2}$/.test(v) && Number(v) <= 100,
  [SETTING_COMPANY_LOCATION_CHANGES_PER_DAY]: (v) => /^[1-9]\d{0,3}$/.test(v) && Number(v) <= 1000,
  // docs/03 4.8: maxim 3 firme; 0/text ar rupe claim-ul si contorul din UI
  max_claims_per_request: (v) => /^[1-9]\d*$/.test(v) && Number(v) <= 3,
  // E-admin-platform-2: identitatea juridica a operatorului (Termeni/Politica/footer)
  [SETTING_LEGAL_IDENTITY_PUBLISHED]: (v) => v === 'true' || v === 'false',
  [SETTING_LEGAL_CONTACT_EMAIL]: (v) => v === '' || (v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),
  // Hotfix 2026-10-04 (PO): re-acceptarea Termenilor pentru conturile existente (dupa avocat)
  [SETTING_LEGAL_REACCEPT_EXISTING_USERS]: (v) => v === 'true' || v === 'false',
  // E-admin-platform-4: calea generica nu mai poate salva un CUI/IBAN invalid (formularul
  // dedicat din Admin -> Setari -> Date fiscale face validarea completa + placeholdere).
  seller_cui: (v) => v === '' || isValidRoCui(v),
  seller_iban: (v) => v === '' || isValidIban(normalizeIban(v)),
  // E-company-21: costul preluarii; 0 = fara plafon; DECIZIE NECESARA PO (valorile min/max)
  [CLAIM_COST_SETTING_KEYS.creditValueRon]: (v) => /^[1-9]\d{0,6}$/.test(v) && Number(v) <= 1_000_000,
  [CLAIM_COST_SETTING_KEYS.min]: (v) => /^[1-9]\d{0,3}$/.test(v) && Number(v) <= 1000,
  [CLAIM_COST_SETTING_KEYS.max]: (v) => /^(?:0|[1-9]\d{0,3})$/.test(v) && Number(v) <= 1000,
  // E-company-24: comenzi prin transfer bancar — reminder / anulare automata; 0 = oprit (DECIZIE NECESARA PO)
  [SETTING_BANK_TRANSFER_REMINDER_DAYS]: (v) => DAY_COUNT.test(v) && Number(v) <= 365,
  [SETTING_BANK_TRANSFER_EXPIRY_DAYS]: (v) => DAY_COUNT.test(v) && Number(v) <= 365,
};

// escape minimal pentru valorile interpolate in HTML-ul emailurilor
const escHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly queues: Record<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly eventBus: EventBusService,
    @InjectQueue(QUEUE_NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) requestExpiration: Queue,
    @InjectQueue(QUEUE_CLAIM_ASSIGN) claimAssign: Queue,
    @InjectQueue(QUEUE_SLA_BREACH) slaBreach: Queue,
    @InjectQueue(QUEUE_QUOTE_VALIDITY) quoteValidity: Queue,
    @InjectQueue(QUEUE_CONSULTATION_EXPIRY) consultationExpiry: Queue,
    @InjectQueue(QUEUE_WITHDRAWAL_REMINDER) withdrawalReminder: Queue,
    @InjectQueue(QUEUE_SUBSCRIPTION_EXPIRY) subscriptionExpiry: Queue,
    @InjectQueue(QUEUE_DELIVERY_AUTOCOMPLETE) deliveryAutocomplete: Queue,
    @InjectQueue(QUEUE_RECONCILIATION) reconciliation: Queue,
    @InjectQueue(QUEUE_UPLOADS) uploads: Queue,
    @InjectQueue(QUEUE_DOMAIN_EVENTS) domainEvents: Queue,
    @InjectQueue(QUEUE_OFFER_EXPIRY_SETTLEMENT) offerExpirySettlement: Queue,
    @InjectQueue(QUEUE_PROJECT_DEADLINES) projectDeadlines: Queue,
  ) {
    this.queues = {
      [QUEUE_NOTIFICATIONS]: notifications,
      [QUEUE_REQUEST_EXPIRATION]: requestExpiration,
      [QUEUE_CLAIM_ASSIGN]: claimAssign,
      [QUEUE_SLA_BREACH]: slaBreach,
      [QUEUE_QUOTE_VALIDITY]: quoteValidity,
      [QUEUE_CONSULTATION_EXPIRY]: consultationExpiry,
      [QUEUE_WITHDRAWAL_REMINDER]: withdrawalReminder,
      [QUEUE_SUBSCRIPTION_EXPIRY]: subscriptionExpiry,
      [QUEUE_DELIVERY_AUTOCOMPLETE]: deliveryAutocomplete,
      [QUEUE_RECONCILIATION]: reconciliation,
      [QUEUE_UPLOADS]: uploads,
      [QUEUE_DOMAIN_EVENTS]: domainEvents,
      [QUEUE_OFFER_EXPIRY_SETTLEMENT]: offerExpirySettlement,
      [QUEUE_PROJECT_DEADLINES]: projectDeadlines,
    };
  }

  // ===== Utilizatori (pasul 6, D-L1-2 PO 2026-08-23) =====

  async listUsers(q?: string, role?: UserRole): Promise<AdminUserItemDto[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(role ? { role } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { companyMemberships: { include: { company: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((u) => this.toAdminUserDto(u));
  }

  // Blocare cont (D-L1-2): blocked_at + revocarea tuturor sesiunilor + email direct
  // (transactional — nu trece prin opt-out-ul de notificari). Idempotent.
  async blockUser(id: string): Promise<AdminUserItemDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { companyMemberships: { include: { company: { select: { name: true } } } } },
    });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found' });
    }
    if (user.role === 'ADMIN') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Admin accounts cannot be blocked',
      });
    }
    const res = await this.prisma.user.updateMany({
      where: { id, blockedAt: null },
      data: { blockedAt: new Date() },
    });
    if (res.count === 1) {
      await this.tokens.revokeAllForUser(id);
      this.eventBus.emitAuthExpired(id);
      await this.sendBlockedEmail(user.email, user.name, user.languagePreference);
    }
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { companyMemberships: { include: { company: { select: { name: true } } } } },
    });
    return this.toAdminUserDto(fresh);
  }

  async unblockUser(id: string): Promise<AdminUserItemDto> {
    const res = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: { blockedAt: null },
    });
    if (res.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found' });
    }
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { companyMemberships: { include: { company: { select: { name: true } } } } },
    });
    return this.toAdminUserDto(fresh);
  }

  private async sendBlockedEmail(email: string, name: string, lang: Language): Promise<void> {
    const ro = lang !== Language.EN;
    const support = this.mail.supportEmail ?? null;
    const subject = ro ? 'Contul tău Cozy Home a fost blocat' : 'Your Cozy Home account was blocked';
    const contact = support ? `<a href="mailto:${escHtml(support)}">${escHtml(support)}</a>` : '';
    const body = support
      ? ro
        ? `Contul tău Cozy Home a fost blocat de un administrator, iar sesiunile active au fost închise. Dacă crezi că este o eroare, răspunde la acest email sau scrie-ne la ${contact} și analizăm situația.`
        : `Your Cozy Home account was blocked by an administrator and your active sessions were closed. If you believe this is a mistake, reply to this email or write to us at ${contact} and we will review it.`
      : ro
        ? 'Contul tău Cozy Home a fost blocat de un administrator, iar sesiunile active au fost închise. Dacă crezi că este o eroare, răspunde la acest email și analizăm situația.'
        : 'Your Cozy Home account was blocked by an administrator and your active sessions were closed. If you believe this is a mistake, reply to this email and we will review it.';
    const html = `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>${ro ? 'Salut' : 'Hi'} ${escHtml(name)},</p>
        <p>${body}</p>
      </div>`;
    try {
      await this.mail.send(email, subject, html, { replyToSupport: true });
    } catch (e) {
      // best-effort: blocarea ramane valabila chiar daca emailul pica (fara adresa in log)
      this.logger.warn(`emailul de blocare a esuat: ${safeErrorSummary(e)}`);
    }
  }

  // Email de test doar catre adresa adminului care apasa butonul (fara destinatar
  // liber = nu poate fi folosit ca releu). Esecul SMTP NU arunca: adminul vede clasificarea.
  async sendTestEmail(adminUserId: string): Promise<AdminMailTestResultDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, name: true, languagePreference: true },
    });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found' });
    }
    const ro = user.languagePreference !== Language.EN;
    const support = this.mail.supportEmail ?? null;
    const subject = ro ? 'Email de test — Cozy Home' : 'Test email — Cozy Home';
    const html = `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>${ro ? 'Salut' : 'Hi'} ${escHtml(user.name)},</p>
        <p>${
          ro
            ? 'Acesta este un email de test trimis din consola de administrare Cozy Home. Dacă l-ai primit, livrarea emailurilor funcționează.'
            : 'This is a test email sent from the Cozy Home admin console. If you received it, email delivery works.'
        }</p>
        <hr style="border: none; border-top: 1px solid #e5ded4; margin: 28px 0 12px;" />
        ${supportLineHtml(ro ? 'ro' : 'en', support)}
      </div>`;
    const base = { to: user.email, from: this.mail.fromAddress, replyTo: support };
    try {
      await this.mail.send(user.email, subject, html, { replyToSupport: true });
      return { ok: true, ...base, error: null };
    } catch (e) {
      const summary = safeErrorSummary(e);
      this.logger.warn(`emailul de test a esuat: ${summary}`);
      return { ok: false, ...base, error: summary };
    }
  }

  private toAdminUserDto(u: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    emailVerifiedAt: Date | null;
    blockedAt: Date | null;
    createdAt: Date;
    companyMemberships: { company: { name: string } }[];
  }): AdminUserItemDto {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      companyName: u.companyMemberships[0]?.company.name ?? null,
      emailVerified: u.emailVerifiedAt !== null,
      blockedAt: u.blockedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  // ===== KPI (4.19) =====
  async getKpi(): Promise<AdminKpiDto> {
    const [companies, requests, activeClaims, openDisputes, pendingPayments, activeSubs, wallets, revenue, auditEntries, subsByPlan, plans] =
      await Promise.all([
        this.prisma.company.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.request.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        this.prisma.claimSlot.count({ where: { status: { in: ['ACTIVE', 'OFFER_SENT'] } } }),
        this.prisma.reviewDispute.count({ where: { status: 'OPEN' } }),
        this.prisma.mockBillingOrder.count({ where: { status: 'PENDING' } }),
        this.prisma.subscription.count({ where: activeSubscriptionWhere() }),
        this.prisma.companyCreditWallet.aggregate({ _sum: { balance: true, reserved: true } }),
        this.prisma.mockBillingOrder.aggregate({ where: { status: 'CONFIRMED' }, _sum: { totalRon: true } }),
        this.prisma.auditLog.count(),
        // E-admin-platform-58: abonamente active pe plan (randuri, ca activeSubscriptions)
        this.prisma.subscription.groupBy({ by: ['planId'], where: activeSubscriptionWhere(), _count: { _all: true } }),
        this.prisma.subscriptionPlan.findMany({ select: { id: true, code: true } }),
      ]);
    const codeById = new Map(plans.map((p) => [p.id, p.code]));
    const activeSubscriptionsByPlan = subsByPlan
      .map((r) => ({ code: codeById.get(r.planId) ?? r.planId, count: r._count._all }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    const toMap = (rows: { status: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    return {
      companiesByStatus: toMap(companies as never),
      requestsByStatus: toMap(requests as never),
      activeClaims,
      openDisputes,
      pendingPayments,
      activeSubscriptions: activeSubs,
      activeSubscriptionsByPlan,
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
    const rule = SETTING_VALUE_RULES[key];
    // E-admin-platform-58: trial_plan (cod de plan) se salveaza si el fara spatii
    const stored = rule || key === 'trial_plan' ? value.trim() : value;
    if (rule && !rule(stored)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid value for this setting' });
    }
    // E-admin-platform-58: trial_plan = codul unui plan ACTIV existent (planurile sunt date)
    if (key === 'trial_plan') {
      const plan = PLAN_CODE_RE.test(stored)
        ? await this.prisma.subscriptionPlan.findFirst({ where: { code: stored, isActive: true }, select: { id: true } })
        : null;
      if (!plan) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'trial_plan must be the code of an active plan',
          details: [{ field: 'trial_plan', reason: 'PLAN_NOT_FOUND' }],
        });
      }
    }
    // E-company-21: plafonul costului e 0 (fara plafon) sau >= minimul
    if (key === CLAIM_COST_SETTING_KEYS.min || key === CLAIM_COST_SETTING_KEYS.max) {
      const otherKey = key === CLAIM_COST_SETTING_KEYS.min ? CLAIM_COST_SETTING_KEYS.max : CLAIM_COST_SETTING_KEYS.min;
      const other = await this.prisma.systemSetting.findUnique({ where: { key: otherKey } });
      const min = Number(key === CLAIM_COST_SETTING_KEYS.min ? stored : (other?.value ?? '1'));
      const max = Number(key === CLAIM_COST_SETTING_KEYS.max ? stored : (other?.value ?? '0'));
      if (Number.isFinite(min) && Number.isFinite(max) && max > 0 && max < min) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'claim_cost_max must be 0 or >= claim_cost_min',
          details: [{ field: key, reason: 'CLAIM_COST_RANGE' }],
        });
      }
    }
    const updated = await this.prisma.systemSetting.update({ where: { key }, data: { value: stored, updatedBy } });
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
  async getCreditPackages(): Promise<AdminCreditPackageDto[]> {
    const rows = await this.prisma.creditPackage.findMany({ orderBy: { credits: 'asc' } });
    return rows.map((p) => ({ id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive }));
  }

  async createCreditPackage(dto: UpsertCreditPackageInput): Promise<AdminCreditPackageDto> {
    const p = await this.prisma.creditPackage.create({
      data: { credits: dto.credits, priceRon: dto.priceRon, isActive: dto.isActive ?? true },
    });
    return { id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive };
  }

  async updateCreditPackage(id: string, dto: Partial<UpsertCreditPackageInput>): Promise<AdminCreditPackageDto> {
    const exists = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Package not found' });
    const p = await this.prisma.creditPackage.update({
      where: { id },
      data: { credits: dto.credits, priceRon: dto.priceRon, isActive: dto.isActive },
    });
    return { id: p.id, credits: p.credits, priceRon: p.priceRon, isActive: p.isActive };
  }

  // E-admin-platform-58: planurile sunt date — cod unic (identitate, imuabil), nume RO/EN,
  // pret >= 0 (0 = gratuit, doar grant/trial), functii per plan (subscription_plan_features).
  async getPlans(): Promise<AdminPlanDto[]> {
    const rows = await this.prisma.subscriptionPlan.findMany({
      include: { features: true },
      orderBy: [{ priceRon: 'asc' }, { code: 'asc' }],
    });
    return rows.map((p) => this.toPlanDto(p));
  }

  async createPlan(dto: CreatePlanInput): Promise<AdminPlanDto> {
    try {
      const plan = await runTx(this.prisma, 'write', async (tx) => {
        const p = await tx.subscriptionPlan.create({
          data: {
            code: dto.code,
            nameRo: cleanPlanName(dto.nameRo),
            nameEn: cleanPlanName(dto.nameEn),
            priceRon: dto.priceRon,
            includedCredits: dto.includedCredits,
            marketplaceGatingDelayMin: dto.marketplaceGatingDelayMin,
            isActive: dto.isActive ?? true,
          },
        });
        await tx.subscriptionPlanFeature.createMany({
          data: [{ planId: p.id, featureKey: 'MARKETPLACE_ACCESS', enabled: dto.features.MARKETPLACE_ACCESS.enabled }],
        });
        return tx.subscriptionPlan.findUniqueOrThrow({ where: { id: p.id }, include: { features: true } });
      });
      return this.toPlanDto(plan);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.PLAN_CODE_TAKEN, message: 'Plan code already exists' });
      }
      throw e;
    }
  }

  async updatePlan(id: string, dto: UpdatePlanInput): Promise<AdminPlanDto> {
    const exists = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    const plan = await runTx(this.prisma, 'write', async (tx) => {
      await tx.subscriptionPlan.update({
        where: { id },
        data: {
          priceRon: dto.priceRon, includedCredits: dto.includedCredits,
          marketplaceGatingDelayMin: dto.marketplaceGatingDelayMin, isActive: dto.isActive,
          nameRo: dto.nameRo === undefined ? undefined : cleanPlanName(dto.nameRo),
          nameEn: dto.nameEn === undefined ? undefined : cleanPlanName(dto.nameEn),
        },
      });
      for (const key of PLAN_FEATURE_KEYS) {
        const f = dto.features?.[key];
        if (!f) continue;
        await tx.subscriptionPlanFeature.upsert({
          where: { planId_featureKey: { planId: id, featureKey: key } },
          update: { enabled: f.enabled, ...(f.limit !== undefined ? { limitValue: f.limit } : {}) },
          create: { planId: id, featureKey: key, enabled: f.enabled, limitValue: f.limit ?? null },
        });
      }
      return tx.subscriptionPlan.findUniqueOrThrow({ where: { id }, include: { features: true } });
    });
    return this.toPlanDto(plan);
  }

  private toPlanDto(p: Prisma.SubscriptionPlanGetPayload<{ include: { features: true } }>): AdminPlanDto {
    return {
      id: p.id,
      code: p.code,
      tier: p.code,
      nameRo: p.nameRo,
      nameEn: p.nameEn,
      priceRon: p.priceRon,
      includedCredits: p.includedCredits,
      marketplaceGatingDelayMin: p.marketplaceGatingDelayMin,
      isActive: p.isActive,
      isFree: p.priceRon === 0,
      features: resolvePlanFeatures(p.features),
    };
  }

  async getThresholds(): Promise<AdminThresholdDto[]> {
    const rows = await this.prisma.projectSizeThreshold.findMany();
    return rows.map((t) => ({ id: t.id, size: t.size, minScore: t.minScore, maxScore: t.maxScore }));
  }

  async updateThreshold(id: string, dto: UpdateThresholdInput): Promise<AdminThresholdDto> {
    const exists = await this.prisma.projectSizeThreshold.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Threshold not found' });
    const t = await this.prisma.projectSizeThreshold.update({
      where: { id },
      data: { minScore: dto.minScore, maxScore: dto.maxScore },
    });
    return { id: t.id, size: t.size, minScore: t.minScore, maxScore: t.maxScore };
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
