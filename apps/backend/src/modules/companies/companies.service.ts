import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { safeErrorSummary } from '../../common/logging/safe-error';
import {
  COMPANY_ROLE_PERMISSIONS,
  ERROR_CODES,
  SETTING_COMPANY_LOCATION_CHANGES_PER_DAY,
  can,
  type CompanyPermission,
  SETTING_COMPANY_LOCATIONS_MAX,
  sortDashboardActions,
} from '@marketplace/shared';
import type {
  AdminCompanyListItemDto,
  CompanyDashboardStatsDto,
  CompanySetupDto,
  CompanySetupStepDto,
  DashboardActionItemDto,
  CompanyDto,
  CompanyRiskFlag,
  PartnerDto,
} from '@marketplace/shared';
import type { Company, CompanyMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx, runTxBatch } from '../../infra/prisma/tx';
import { OutboxService } from '../outbox/outbox.service';
import { randomUUID } from 'node:crypto';
import { activeMembershipWhere } from '../../common/company-context/active-membership';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { REQUEST_SETTLED_STATUSES, SLA_GRACE_MS, SLA_WARNING_BEFORE_MS } from '../claims/claims.constants';
import {
  defaultOfferFieldPermissions,
  effectiveOfferFieldPermissions,
  MEMBER_ADDED_EMAIL_DEDUP_MS,
  MIN_REVIEWS_THRESHOLD,
  REAPPLY_BLOCK_MONTHS,
} from './companies.constants';
import { demoCompanyWhere } from './demo-companies';
import { auditSafeReason, type UnsuspendCompanyDto } from './dto/unsuspend-company.dto';
import { cancelActiveCompanyPenalties, lockCompanyRow, type CancelledPenalty } from '../penalties/penalties.service';
import { GeoService } from '../geo/geo.service';
import { MAX_PORTFOLIO_ITEMS, PortfolioImagesService } from '../uploads/portfolio-images.service';
import type { PresignInput } from '../uploads/uploads.service';
import type {
  ChangeMemberRoleDto,
  CompanyLocationDto,
  InviteMemberDto,
  OnboardCompanyDto,
  PortfolioItemDto,
  RejectCompanyDto,
  UpdateCompanyDto,
  UpdateOfferPermissionsDto,
} from './dto/company.dto';

// h1 (revizuire M1): cel mult atatea geocodari esuate pe firma intr-o ora, apoi refuz fara
// apel la serviciul extern (Nominatim public: 1 cerere / s, blocheaza IP-ul care incalca)
export const COMPANY_GEOCODE_FAILURES_PER_HOUR = 10;
const COMPANY_GEOCODE_FAILURE_WINDOW_MS = 60 * 60 * 1000;
const companiesLogger = new Logger('CompaniesService');

// h1 (revizuire m6): raspunsul la adaugarea / modificarea locatiei
export type LocationWriteResult = CompanyDto & { geocodePrecision?: 'CITY' };

export interface QuoteTotalsRow {
  currency: string | null;
  quotes: number;
  total: number;
}

// h3 (etapa 9): numarul ofertelor + totalurile pe moneda (RON / EUR), fara conversie.
// O moneda necunoscuta (nu exista azi) se numara, dar nu intra in niciun total.
export function quoteTotalsByCurrency(rows: QuoteTotalsRow[]): {
  quotesSent: number;
  quotesTotals: { RON: number; EUR: number };
} {
  const quotesTotals = { RON: 0, EUR: 0 };
  let quotesSent = 0;
  for (const r of rows) {
    quotesSent += Number(r.quotes) || 0;
    const total = Number(r.total) || 0;
    if (r.currency === 'RON' || r.currency === 'EUR') quotesTotals[r.currency] += total;
  }
  quotesTotals.RON = Math.round(quotesTotals.RON * 100) / 100;
  quotesTotals.EUR = Math.round(quotesTotals.EUR * 100) / 100;
  return { quotesSent, quotesTotals };
}

export interface CompanySetupFacts {
  portfolioItems: number;
  locations: number;
  // membri activi, inclusiv cel care se uita
  members: number;
  billingEmail: string | null;
}

// h1 (etapa 11): pasii "Pregateste-ti firma", doar din datele existente (fara stare noua).
// Angajatii nu pot face pasii → null. Obligatorii: portofoliu, locatie, e-mail de facturare.
// Optionale (nu intra in progres): echipa si — doar proprietarului, care singur le seteaza —
// permisiunile ofertei. Revizuire m1: permisiunile exista mereu (inscriere / matricea
// implicita), deci pasul e doar o legatura spre sectiune si nu se marcheaza niciodata „facut”.
export function companySetupSteps(role: CompanyMemberRole, f: CompanySetupFacts): CompanySetupDto | null {
  if (!can(role, 'COMPANY_PROFILE_EDIT')) return null;
  const steps: CompanySetupStepDto[] = [
    { key: 'PORTFOLIO', done: f.portfolioItems > 0, optional: false },
    { key: 'LOCATIONS', done: f.locations > 0, optional: false },
    { key: 'BILLING_EMAIL', done: !!f.billingEmail?.trim(), optional: false },
    { key: 'TEAM', done: f.members > 1, optional: true },
  ];
  if (role === 'OWNER') steps.push({ key: 'OFFER_PERMISSIONS', done: false, optional: true });
  const required = steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  return { steps, requiredDone, requiredTotal: required.length, complete: requiredDone === required.length };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly outbox: OutboxService,
    private readonly settings: SettingsService,
    // h1 (etapa 11): optionale ca specurile vechi (4 argumente) sa ramana neschimbate;
    // in aplicatie Nest le injecteaza mereu (GeoModule + UploadsModule in CompaniesModule)
    private readonly geo?: GeoService,
    private readonly portfolioImages?: PortfolioImagesService,
    // h1 (revizuire M1): contorul de geocodari esuate pe firma (Redis global, fail open)
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  private normalizeCui(cui: string): string {
    return cui.trim().toUpperCase().replace(/^RO/, '');
  }

  // Risk flags calculate automat (4.6). Reviews/rating nu exista inca (Sprint 8) → reviewCount=0.
  private computeRiskFlags(portfolioCount: number, reviewCount = 0): CompanyRiskFlag[] {
    const flags: CompanyRiskFlag[] = [];
    if (portfolioCount === 0) flags.push('NO_PORTFOLIO');
    if (reviewCount < MIN_REVIEWS_THRESHOLD) flags.push('INSUFFICIENT_REVIEWS');
    return flags;
  }

  // Membru curent + firma; arunca daca userul nu apartine unei firme
  private async requireMembership(userId: string) {
    const member = await this.prisma.companyMember.findUnique({ where: activeMembershipWhere(userId) });
    if (!member) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User is not a member of any company',
      });
    }
    return member;
  }

  // E-admin-platform-58: rolurile permise vin din matricea COMPANY_ROLE_PERMISSIONS (shared);
  // azi MEMBERS_MANAGE si COMPANY_PROFILE_EDIT = OWNER/MANAGER (identic cu MANAGEMENT_ROLES vechi)
  private async requireManager(userId: string, permission: CompanyPermission) {
    const member = await this.requireMembership(userId);
    if (!can(member.role, permission)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only owner or manager can perform this action',
      });
    }
    return member;
  }

  // Lista publica de parteneri pentru landing: firme APPROVED + cateva piese de
  // portofoliu. Ratingul Google e placeholder (integrare externa ulterioara).
  // k1: firmele demo (membri @demo.ro, regula din cleanup-demo) nu apar public.
  async listPartners(): Promise<PartnerDto[]> {
    const companies = await this.prisma.company.findMany({
      where: { status: 'APPROVED', deletedAt: null, NOT: demoCompanyWhere },
      select: {
        id: true,
        name: true,
        city: true,
        county: true,
        createdAt: true,
        portfolioItems: {
          select: { id: true, title: true, imageUrl: true },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    // h1: pozele incarcate → presigned GET (ca la inspiratie); altfel adresa veche
    const urls = await this.portfolioUrls(companies.flatMap((c) => c.portfolioItems.map((p) => p.id)));
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      county: c.county,
      memberSince: c.createdAt.toISOString(),
      rating: null,
      portfolio: c.portfolioItems.map((p) => ({ title: p.title, imageUrl: urls.get(p.id) ?? p.imageUrl })),
    }));
  }

  // Statistici agregate pentru dashboardul firmei (orice membru le poate vedea).
  async dashboardStats(userId: string): Promise<CompanyDashboardStatsDto> {
    const member = await this.requireMembership(userId);
    const companyId = member.companyId;
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * 86_400_000);
    const since30 = new Date(now.getTime() - 30 * 86_400_000);

    // E-admin-platform-44 — "De facut acum": OWNER/MANAGER vad preluarile neatribuite (doar ei
    // pot atribui) si toate termenele SLA apropiate; angajatii doar termenele lor.
    const isManager = can(member.role, 'CLAIMS_ASSIGN');
    const liveRequest = { deletedAt: null, status: { notIn: REQUEST_SETTLED_STATUSES } };
    const actionSelect = { id: true, requestId: true, request: { select: { title: true } } } as const;
    const [byStatusRaw, perMemberRaw, wallet, consumed7, consumed30, penalties, quoteAgg, unassigned, slaDue, setup] =
      await Promise.all([
        this.prisma.claimSlot.groupBy({
          by: ['status'],
          where: { companyId },
          _count: { _all: true },
        }),
        this.prisma.claimSlot.groupBy({
          by: ['assignedToUserId'],
          where: { companyId, status: { in: ['ACTIVE', 'OFFER_SENT'] } },
          _count: { _all: true },
        }),
        this.prisma.companyCreditWallet.findUnique({ where: { companyId } }),
        this.prisma.creditTransaction.aggregate({
          _sum: { amount: true },
          where: { companyId, type: 'CONSUME', createdAt: { gte: since7 } },
        }),
        this.prisma.creditTransaction.aggregate({
          _sum: { amount: true },
          where: { companyId, type: 'CONSUME', createdAt: { gte: since30 } },
        }),
        this.prisma.penaltyEvent.aggregate({
          _sum: { points: true },
          where: { companyId, scope: 'COMPANY', expiresAt: { gt: now } },
        }),
        // valoarea ofertelor = pretul ULTIMEI versiuni per quote (SENT/ACCEPTED). h3 (etapa 9,
        // decizia din plan): totaluri SEPARATE pe moneda versiunii, fara conversie ("X lei + Y EUR")
        this.prisma.$queryRaw<QuoteTotalsRow[]>`
          SELECT COALESCE(qv.currency, q.currency)::text AS currency,
                 COUNT(DISTINCT q.id)::int AS quotes,
                 COALESCE(SUM(qv.price), 0)::float AS total
          FROM quotes q
          JOIN quote_versions qv ON qv.quote_id = q.id
           AND qv.version = (SELECT MAX(v2.version) FROM quote_versions v2 WHERE v2.quote_id = q.id)
          WHERE q.company_id = ${companyId} AND q.status::text IN ('SENT', 'ACCEPTED')
          GROUP BY 1
        `,
        isManager
          ? this.prisma.claimSlot.findMany({
              where: { companyId, status: 'ACTIVE', assignedToUserId: null, request: liveRequest },
              orderBy: { assignDeadlineAt: 'asc' },
              take: 10,
              select: { ...actionSelect, assignDeadlineAt: true },
            })
          : Promise.resolve([]),
        this.prisma.claimSlot.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
            slaPausedAt: null,
            // include si preluarile aflate inca in perioada de gratie
            slaDeadlineAt: {
              gt: new Date(now.getTime() - SLA_GRACE_MS),
              lte: new Date(now.getTime() + SLA_WARNING_BEFORE_MS),
            },
            request: liveRequest,
            ...(isManager
              ? {}
              : { OR: [{ assignedToUserId: userId }, { assignedToUserId: null, claimedByUserId: userId }] }),
          },
          orderBy: { slaDeadlineAt: 'asc' },
          take: 10,
          select: { ...actionSelect, slaDeadlineAt: true },
        }),
        // h1 (etapa 11): pasii "Pregateste-ti firma"
        this.loadCompanySetup(member.role, companyId),
      ]);

    const actions: DashboardActionItemDto[] = [
      ...unassigned.map((c) => ({
        kind: 'UNASSIGNED_CLAIM' as const,
        requestId: c.requestId,
        claimSlotId: c.id,
        title: c.request.title ?? '',
        count: null,
        dueAt: c.assignDeadlineAt?.toISOString() ?? null,
      })),
      ...slaDue.map((c) => ({
        kind: 'SLA_DUE_SOON' as const,
        requestId: c.requestId,
        claimSlotId: c.id,
        title: c.request.title ?? '',
        count: null,
        dueAt: c.slaDeadlineAt?.toISOString() ?? null,
      })),
    ];

    const claimsByStatus: CompanyDashboardStatsDto['claimsByStatus'] = {};
    let claimsTotal = 0;
    for (const g of byStatusRaw) {
      claimsByStatus[g.status] = g._count._all;
      claimsTotal += g._count._all;
    }
    const claimsActive = (claimsByStatus.ACTIVE ?? 0) + (claimsByStatus.OFFER_SENT ?? 0);

    const memberIds = perMemberRaw
      .map((g) => g.assignedToUserId)
      .filter((id): id is string => id !== null);
    const users = memberIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name]));

    const balance = wallet?.balance ?? 0;
    const reserved = wallet?.reserved ?? 0;

    return {
      claimsTotal,
      claimsActive,
      claimsByStatus,
      perMember: perMemberRaw.map((g) => ({
        userId: g.assignedToUserId,
        name: g.assignedToUserId ? (nameOf.get(g.assignedToUserId) ?? null) : null,
        activeClaims: g._count._all,
      })),
      ...quoteTotalsByCurrency(quoteAgg),
      // 4.8: balance exclude deja rezervarile (RESERVE muta balance -> reserved); identic cu GET /billing/wallet
      wallet: { balance, reserved, available: balance },
      creditsConsumed7d: Math.abs(consumed7._sum.amount ?? 0),
      creditsConsumed30d: Math.abs(consumed30._sum.amount ?? 0),
      activePenaltyPoints: penalties._sum.points ?? 0,
      actions: sortDashboardActions(actions),
      setup,
    };
  }

  // h1 (etapa 11): faptele pentru pasii de pornire (o singura interogare cu numaratori);
  // angajatii nu pot face pasii → fara interogare.
  private async loadCompanySetup(role: CompanyMemberRole, companyId: string): Promise<CompanySetupDto | null> {
    if (!can(role, 'COMPANY_PROFILE_EDIT')) return null;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        billingEmail: true,
        _count: {
          select: {
            portfolioItems: true,
            locations: true,
            members: { where: { user: { deletedAt: null } } },
          },
        },
      },
    });
    if (!company) return null;
    return companySetupSteps(role, {
      portfolioItems: company._count.portfolioItems,
      locations: company._count.locations,
      members: company._count.members,
      billingEmail: company.billingEmail,
    });
  }

  // Onboarding: COMPANY_USER fara firma creeaza firma + devine OWNER (4.6/4.7).
  async onboard(userId: string, userEmail: string, dto: OnboardCompanyDto): Promise<CompanyDto> {
    const existingMembership = await this.prisma.companyMember.findUnique({ where: { userId } });
    if (existingMembership) {
      throw new ConflictException({
        code: ERROR_CODES.MEMBER_ALREADY_EXISTS,
        message: 'User already belongs to a company',
      });
    }

    const normalizedCui = this.normalizeCui(dto.cui);

    // CUI deja folosit de o firma activa (ne-REJECTED)
    const activeWithCui = await this.prisma.company.findFirst({
      where: { cui: normalizedCui, status: { not: 'REJECTED' }, deletedAt: null },
    });
    if (activeWithCui) {
      throw new ConflictException({
        code: ERROR_CODES.CUI_ALREADY_REGISTERED,
        message: 'A company with this CUI already exists',
      });
    }

    // Blocaj reaplicare 3 luni pe CUI SAU email owner dupa REJECTED (4.6)
    const blockCutoff = new Date();
    blockCutoff.setMonth(blockCutoff.getMonth() - REAPPLY_BLOCK_MONTHS);
    const recentReject = await this.prisma.company.findFirst({
      where: {
        status: 'REJECTED',
        rejectedAt: { gt: blockCutoff },
        OR: [{ cui: normalizedCui }, { members: { some: { user: { email: userEmail } } } }],
      },
    });
    if (recentReject) {
      throw new ForbiddenException({
        code: ERROR_CODES.COMPANY_REAPPLY_BLOCKED,
        message: 'Reapplication blocked for 3 months after rejection',
      });
    }

    const companyId = await runTx(this.prisma, 'write', async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name.trim(),
          cui: normalizedCui,
          // E-company-19: prefixul RO tastat = firma declarata platitoare de TVA (cui se salveaza fara prefix)
          isVatPayer: /^RO/i.test(dto.cui.trim()),
          regComNumber: dto.regComNumber.trim().toUpperCase(),
          addressText: dto.addressText.trim(),
          county: dto.county.trim(),
          city: dto.city.trim(),
          lat: dto.lat,
          lng: dto.lng,
        },
      });
      await tx.companyMember.create({
        data: { companyId: company.id, userId, role: 'OWNER' },
      });
      await tx.companyVerificationProfile.create({
        data: { companyId: company.id, riskFlags: this.computeRiskFlags(0) },
      });
      await tx.companyOfferFieldPermission.createMany({
        data: defaultOfferFieldPermissions().map((p) => ({ companyId: company.id, ...p })),
      });
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
      await this.outbox.record(tx, `company.submitted:${company.id}`, 'company.submitted', { companyId: company.id }, admins.map((a) => a.id));
      return company.id;
    });

    return this.getMyCompany(userId, companyId);
  }

  async getMyCompany(userId: string, knownCompanyId?: string): Promise<CompanyDto> {
    const member = knownCompanyId
      ? { companyId: knownCompanyId, role: 'OWNER' as CompanyMemberRole }
      : await this.requireMembership(userId);

    const company = await this.prisma.company.findFirst({
      where: { id: member.companyId, deletedAt: null },
      include: {
        members: { where: { user: { deletedAt: null } }, include: { user: true }, orderBy: { createdAt: 'asc' } },
        locations: { orderBy: { createdAt: 'asc' } },
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        offerFieldPerms: true,
      },
    });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }

    const myRole =
      company.members.find((m) => m.userId === userId)?.role ?? member.role;
    // h1: pozele incarcate in portofoliu → presigned GET; lucrarile vechi raman pe image_url
    const portfolioUrls = await this.portfolioUrls(company.portfolioItems.map((p) => p.id));

    return {
      id: company.id,
      name: company.name,
      cui: company.cui,
      regComNumber: company.regComNumber,
      isVatPayer: company.isVatPayer,
      // E-company-24: doar OWNER/MANAGER vad adresa de facturare
      billingEmail: can(myRole, 'BILLING_MANAGE') ? company.billingEmail : null,
      status: company.status,
      addressText: company.addressText,
      county: company.county,
      city: company.city,
      lat: company.lat,
      lng: company.lng,
      rejectedAt: company.rejectedAt?.toISOString() ?? null,
      rejectionReason: company.rejectionReason,
      suspendedUntil: company.suspendedUntil?.toISOString() ?? null,
      createdAt: company.createdAt.toISOString(),
      myRole,
      permissions: [...COMPANY_ROLE_PERMISSIONS[myRole]],
      members: company.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
      locations: company.locations.map((l) => ({
        id: l.id,
        addressText: l.addressText,
        county: l.county,
        city: l.city,
        lat: l.lat,
        lng: l.lng,
        coverageRadiusKm: l.coverageRadiusKm,
      })),
      portfolio: company.portfolioItems.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: portfolioUrls.get(p.id) ?? p.imageUrl,
        createdAt: p.createdAt.toISOString(),
      })),
      // h1-2: matricea efectiva (proprietarul mereu tot; fara randuri = matricea de la inscriere)
      offerFieldPermissions: effectiveOfferFieldPermissions(company.offerFieldPerms),
    };
  }

  async updateProfile(userId: string, dto: UpdateCompanyDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await this.prisma.company.update({
      where: { id: member.companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.addressText !== undefined && { addressText: dto.addressText.trim() }),
        ...(dto.county !== undefined && { county: dto.county.trim() }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.isVatPayer !== undefined && { isVatPayer: dto.isVatPayer }),
        // E-company-24: adresa de facturare normalizata; gol/null = stearsa
        ...(dto.billingEmail !== undefined && {
          billingEmail: dto.billingEmail ? dto.billingEmail.trim().toLowerCase() : null,
        }),
      },
    });
    return this.getMyCompany(userId);
  }

  // --- Locatii (D-v6-10) ---
  // E-client-9: plafon de schimbari pe 24h (rolling), numarate din audit_logs (randurile
  // COMPANY_LOCATION_* scrise de AuditInterceptor cu entityId = id-ul firmei). Frana contra
  // mutarii repetate a locatiilor pentru trilaterarea clientilor.
  // h1 (revizuire m7): `db` = tranzactia, cand verificarea se repeta sub lock-ul pe firma
  private async assertLocationChangeAllowed(
    companyId: string,
    db: Pick<Prisma.TransactionClient, 'auditLog'> = this.prisma,
  ): Promise<void> {
    const limit = await this.settings.getInt(
      SETTING_COMPANY_LOCATION_CHANGES_PER_DAY,
      SETTING_DEFAULTS.company_location_changes_per_day,
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.auditLog.count({
      where: { entityType: 'company_location', entityId: companyId, createdAt: { gte: since } },
    });
    if (recent >= limit) {
      throw new HttpException(
        { code: ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT, message: 'Too many location changes in the last 24 hours' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // h1 (etapa 11): coordonatele locatiei nu se mai scriu de mana. Fara lat/lng in cerere,
  // serverul geocodeaza adresa (invarianta 3.8, cache 90 de zile); la o modificare care nu
  // schimba adresa (doar raza), raman coordonatele salvate. Esec → GEOCODING_FAILED.
  private async resolveLocationCoords(
    companyId: string,
    dto: CompanyLocationDto,
    existing?: { addressText: string; county: string; city: string; lat: number; lng: number },
  ): Promise<{ lat: number; lng: number; precision?: 'ADDRESS' | 'CITY' }> {
    if (typeof dto.lat === 'number' && typeof dto.lng === 'number') return { lat: dto.lat, lng: dto.lng };
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (
      existing &&
      norm(existing.addressText) === norm(dto.addressText) &&
      norm(existing.city) === norm(dto.city) &&
      norm(existing.county) === norm(dto.county)
    ) {
      return { lat: existing.lat, lng: existing.lng };
    }
    if (!this.geo) {
      throw new HttpException({ code: ERROR_CODES.GEOCODING_FAILED, message: 'Geocoding failed' }, HttpStatus.BAD_GATEWAY);
    }
    // h1 (revizuire M1): dupa prea multe esecuri pe firma, nu mai chemam serviciul extern
    await this.assertGeocodeFailuresBelowLimit(companyId);
    try {
      const geo = await this.geo.geocode(dto.addressText.trim(), dto.city.trim(), dto.county.trim(), 'RO');
      return { lat: geo.lat, lng: geo.lng, precision: geo.precision };
    } catch (err) {
      const code = (err as { getResponse?: () => { code?: string } }).getResponse?.()?.code;
      if (code === ERROR_CODES.GEOCODING_FAILED) await this.recordGeocodeFailure(companyId);
      throw err;
    }
  }

  // h1 (revizuire M1): plafon propriu de geocodari esuate pe firma (fereastra de o ora), in
  // Redis ca blocarea la login; Redis cazut = fail open (raman @Throttle si cache-ul negativ).
  private geocodeFailKey(companyId: string): string {
    return `company-geo-fail:${companyId}`;
  }

  private async assertGeocodeFailuresBelowLimit(companyId: string): Promise<void> {
    if (!this.redis) return;
    let count: number;
    try {
      count = Number((await this.redis.get(this.geocodeFailKey(companyId))) ?? 0);
    } catch (error) {
      companiesLogger.warn(`contorul de geocodari esuate nu a putut fi citit (fail open): ${safeErrorSummary(error)}`);
      return;
    }
    if (count >= COMPANY_GEOCODE_FAILURES_PER_HOUR) {
      throw new HttpException(
        { code: ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT, message: 'Too many failed address lookups, try again later' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordGeocodeFailure(companyId: string): Promise<void> {
    if (!this.redis) return;
    const key = this.geocodeFailKey(companyId);
    try {
      // TTL-ul se pune o data (NX), INCR il pastreaza → fereastra fixa de o ora de la primul esec
      await this.redis.multi().set(key, '0', 'PX', COMPANY_GEOCODE_FAILURE_WINDOW_MS, 'NX').incr(key).exec();
    } catch (error) {
      companiesLogger.warn(`contorul de geocodari esuate nu a putut fi scris (fail open): ${safeErrorSummary(error)}`);
    }
  }

  // h1 (revizuire m6): raspunsul spune cand adresa exacta nu s-a gasit si s-a folosit centrul
  // orasului — interfata arata o nota neblocanta. Campul e in plus fata de CompanyDto.
  private withGeocodeNotice(company: CompanyDto, precision?: 'ADDRESS' | 'CITY'): LocationWriteResult {
    return precision === 'CITY' ? { ...company, geocodePrecision: 'CITY' } : company;
  }

  async addLocation(userId: string, dto: CompanyLocationDto): Promise<LocationWriteResult> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    // refuz rapid; se reverifica sub lock (m7)
    await this.assertLocationChangeAllowed(member.companyId);
    const max = await this.settings.getInt(SETTING_COMPANY_LOCATIONS_MAX, SETTING_DEFAULTS.company_locations_max);
    // geocodarea (pana la zeci de secunde) se face INAINTE de lock, ca tranzactia sa ramana scurta
    const coords = await this.resolveLocationCoords(member.companyId, dto);
    await runTx(this.prisma, 'write', async (tx) => {
      // lock per firma: doua adaugari simultane nu pot depasi plafonul
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`company_locations:${member.companyId}`}, 0))::text`;
      await this.assertLocationChangeAllowed(member.companyId, tx);
      const count = await tx.companyLocation.count({ where: { companyId: member.companyId } });
      if (count >= max) {
        throw new ConflictException({
          code: ERROR_CODES.COMPANY_LOCATION_LIMIT_REACHED,
          message: 'Company location limit reached',
          details: { max },
        });
      }
      await tx.companyLocation.create({
        data: {
          companyId: member.companyId,
          addressText: dto.addressText.trim(),
          county: dto.county.trim(),
          city: dto.city.trim(),
          lat: coords.lat,
          lng: coords.lng,
          coverageRadiusKm: dto.coverageRadiusKm,
        },
      });
    });
    return this.withGeocodeNotice(await this.getMyCompany(userId), coords.precision);
  }

  async updateLocation(userId: string, locationId: string, dto: CompanyLocationDto): Promise<LocationWriteResult> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await this.assertLocationChangeAllowed(member.companyId);
    // doar locatiile firmei proprii; alta firma = 404 (fara sa spunem ca exista)
    const existing = await this.prisma.companyLocation.findFirst({
      where: { id: locationId, companyId: member.companyId },
    });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    // geocodarea inainte de lock (m7); plafonul se reverifica sub lock, inainte de scriere
    const coords = await this.resolveLocationCoords(member.companyId, dto, existing);
    await runTx(this.prisma, 'write', async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`company_locations:${member.companyId}`}, 0))::text`;
      await this.assertLocationChangeAllowed(member.companyId, tx);
      const result = await tx.companyLocation.updateMany({
        where: { id: locationId, companyId: member.companyId },
        data: {
          addressText: dto.addressText.trim(),
          county: dto.county.trim(),
          city: dto.city.trim(),
          lat: coords.lat,
          lng: coords.lng,
          coverageRadiusKm: dto.coverageRadiusKm,
        },
      });
      if (result.count === 0) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
      }
    });
    return this.withGeocodeNotice(await this.getMyCompany(userId), coords.precision);
  }

  async deleteLocation(userId: string, locationId: string): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await this.assertLocationChangeAllowed(member.companyId);
    const result = await this.prisma.companyLocation.deleteMany({
      where: { id: locationId, companyId: member.companyId },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    return this.getMyCompany(userId);
  }

  // --- Echipa / membri (4.7) ---
  // Adauga un user existent (dupa email) la firma. Un user = o singura firma.
  async addMember(userId: string, dto: InviteMemberDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'MEMBERS_MANAGE');
    // Nota (pasul 6): rolul OWNER nu poate fi acordat aici — inviteMemberSchema din shared
    // nu il accepta; escaladarea era posibila DOAR prin changeMemberRole (garda de mai jos).
    // m8 (revizuire h1): un cont blocat nu se poate adauga — acelasi raspuns ca „nu are cont de firma”
    const invitee = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null, blockedAt: null, role: 'COMPANY_USER' },
    });
    if (!invitee) {
      // h1-1: acelasi raspuns pentru "nu exista", "e cont de client" si "e blocat" (nu dezvaluim mai mult)
      throw new NotFoundException({
        code: ERROR_CODES.MEMBER_NO_COMPANY_ACCOUNT,
        message: 'No company user with this email',
      });
    }
    const existing = await this.prisma.companyMember.findUnique({ where: { userId: invitee.id } });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.MEMBER_ALREADY_EXISTS,
        message: 'User already belongs to a company',
      });
    }
    // h1-1: colegul adaugat primeste clopotel + e-mail (company.member_added, prin outbox)
    try {
      await runTx(this.prisma, 'write', async (tx) => {
        const created = await tx.companyMember.create({
          data: { companyId: member.companyId, userId: invitee.id, role: dto.role },
        });
        // M1c (revizuire): readaugat in aceeasi firma in <24h → doar clopotel, fara al doilea e-mail.
        // Sursa = intentiile outbox (scrise sincron, in tranzactie), nu notificarile (scrise de worker).
        const recent = await tx.domainEventOutbox.count({
          where: {
            eventType: 'company.member_added',
            targetUserIds: { has: invitee.id },
            createdAt: { gte: new Date(Date.now() - MEMBER_ADDED_EMAIL_DEDUP_MS) },
            payload: { path: ['companyId'], equals: member.companyId },
          },
        });
        // companyName se completeaza din companyId la livrarea din outbox (ca la celelalte evenimente)
        await this.outbox.record(
          tx,
          `company.member_added:${created.id}`,
          'company.member_added',
          {
            companyId: member.companyId,
            memberUserId: invitee.id,
            role: dto.role,
            actorUserId: userId,
            ...(recent > 0 ? { emailSuppressed: true } : {}),
          },
          [invitee.id],
        );
      });
    } catch (e) {
      // m10: doua adaugari simultane ale aceluiasi om → unicitatea company_members.user_id
      if ((e as { code?: unknown } | null)?.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.MEMBER_ALREADY_EXISTS,
          message: 'User already belongs to a company',
        });
      }
      throw e;
    }
    return this.getMyCompany(userId);
  }

  async changeMemberRole(
    userId: string,
    memberId: string,
    dto: ChangeMemberRoleDto,
  ): Promise<CompanyDto> {
    const manager = await this.requireManager(userId, 'MEMBERS_MANAGE');
    const target = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId: manager.companyId },
    });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Member not found' });
    }
    // Pasul 6 (audit 2026-08-23, escaladare de privilegii): acordarea SAU retragerea rolului
    // OWNER se face doar de un OWNER — inainte un MANAGER se putea auto-promova OWNER si
    // apoi retrograda ownerul real (regula 4.13: matricea de permisiuni e doar-OWNER).
    if ((dto.role === 'OWNER' || target.role === 'OWNER') && manager.role !== 'OWNER') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only an owner can grant or revoke the owner role',
      });
    }
    // Nu lasa firma fara owner: ultimul OWNER nu poate fi retrogradat
    if (target.role === 'OWNER' && dto.role !== 'OWNER') {
      const ownerCount = await this.prisma.companyMember.count({
        where: { companyId: manager.companyId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: ERROR_CODES.LAST_OWNER_CANNOT_LEAVE,
          message: 'Cannot demote the last owner',
        });
      }
    }
    await this.prisma.companyMember.update({ where: { id: target.id }, data: { role: dto.role } });
    return this.getMyCompany(userId);
  }

  async removeMember(userId: string, memberId: string): Promise<CompanyDto> {
    const manager = await this.requireManager(userId, 'MEMBERS_MANAGE');
    const target = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId: manager.companyId },
    });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Member not found' });
    }
    if (target.role === 'OWNER') {
      const ownerCount = await this.prisma.companyMember.count({
        where: { companyId: manager.companyId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: ERROR_CODES.LAST_OWNER_CANNOT_LEAVE,
          message: 'Cannot remove the last owner',
        });
      }
    }
    await this.prisma.companyMember.delete({ where: { id: target.id } });
    return this.getMyCompany(userId);
  }

  // --- Portofoliu (4.6) ---
  // h1 (etapa 11): o singura poza pe lucrare, incarcata de firma prin legaturi presemnate
  // (PortfolioImagesService); cheia din storage sta pe randul attachments al lucrarii
  // (entity_type COMPANY_PORTFOLIO, entity_id = id-ul lucrarii) — fara coloana noua.
  private images(): PortfolioImagesService {
    if (!this.portfolioImages) throw new Error('PortfolioImagesService is not available');
    return this.portfolioImages;
  }

  private async portfolioUrls(itemIds: string[]): Promise<Map<string, string>> {
    if (itemIds.length === 0 || !this.portfolioImages) return new Map();
    return this.portfolioImages.urlsForItems(itemIds);
  }

  // h1 (revizuire m11): firmele SUSPENDED / REJECTED nu mai incarca poze noi; cele in asteptare
  // si cele aprobate pot (isi pregatesc portofoliul pentru verificare).
  private async assertCanUploadPortfolioImages(
    companyId: string,
    db: Pick<Prisma.TransactionClient, 'company'> = this.prisma,
  ): Promise<void> {
    const company = await db.company.findUnique({ where: { id: companyId }, select: { status: true } });
    if (company?.status === 'SUSPENDED') {
      throw new ForbiddenException({ code: ERROR_CODES.COMPANY_SUSPENDED, message: 'Suspended companies cannot upload portfolio images' });
    }
    if (company?.status === 'REJECTED') {
      throw new ForbiddenException({ code: ERROR_CODES.COMPANY_NOT_APPROVED, message: 'Rejected companies cannot upload portfolio images' });
    }
  }

  async presignPortfolioImage(userId: string, input: PresignInput) {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await this.assertCanUploadPortfolioImages(member.companyId);
    return this.images().presign(member.companyId, input);
  }

  async confirmPortfolioImage(userId: string, attachmentId: string) {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await this.assertCanUploadPortfolioImages(member.companyId);
    return this.images().confirm(member.companyId, attachmentId);
  }

  async addPortfolioItem(userId: string, dto: PortfolioItemDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    await runTx(this.prisma, 'write', async (tx) => {
      // M2: plafonul de lucrari, sub blocarea randului firmei (doua adaugari simultane nu-l depasesc)
      await tx.$executeRaw`SELECT id FROM companies WHERE id = ${member.companyId} FOR UPDATE`;
      const count = await tx.companyPortfolioItem.count({ where: { companyId: member.companyId } });
      if (count >= MAX_PORTFOLIO_ITEMS) {
        throw new ConflictException({
          code: ERROR_CODES.COMPANY_PORTFOLIO_LIMIT_REACHED,
          message: 'Portfolio item limit reached',
          details: { max: MAX_PORTFOLIO_ITEMS },
        });
      }
      if (dto.attachmentId) await this.assertCanUploadPortfolioImages(member.companyId, tx);
      const item = await tx.companyPortfolioItem.create({
        data: {
          companyId: member.companyId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
        },
      });
      // poza trebuie sa fie o incarcare SAFE din spatiul firmei; altfel nu se creeaza nici lucrarea
      if (dto.attachmentId) await this.images().attachInTx(tx, member.companyId, item.id, dto.attachmentId);
    });
    return this.getMyCompany(userId);
  }

  // Inlocuieste poza lucrarii; fisierul vechi se sterge din storage dupa commit.
  async setPortfolioImage(userId: string, itemId: string, attachmentId: string): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    const removedKeys = await runTx(this.prisma, 'write', async (tx) => {
      const item = await tx.companyPortfolioItem.findFirst({ where: { id: itemId, companyId: member.companyId } });
      if (!item) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Portfolio item not found' });
      await this.assertCanUploadPortfolioImages(member.companyId, tx);
      const keys = await this.images().attachInTx(tx, member.companyId, item.id, attachmentId);
      // adresa veche scrisa de om nu mai e folosita odata ce lucrarea are o poza incarcata
      if (item.imageUrl) await tx.companyPortfolioItem.update({ where: { id: item.id }, data: { imageUrl: null } });
      return keys;
    });
    await this.images().deleteObjects(removedKeys);
    return this.getMyCompany(userId);
  }

  async deletePortfolioItem(userId: string, itemId: string): Promise<CompanyDto> {
    const member = await this.requireManager(userId, 'COMPANY_PROFILE_EDIT');
    const removedKeys = await runTx(this.prisma, 'write', async (tx) => {
      const result = await tx.companyPortfolioItem.deleteMany({
        where: { id: itemId, companyId: member.companyId },
      });
      if (result.count === 0) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Portfolio item not found' });
      }
      if (!this.portfolioImages) return [];
      const keys = await this.portfolioImages.keysForItems([itemId], tx);
      await this.portfolioImages.deleteRowsForItems([itemId], tx);
      return keys;
    });
    // fara fisiere orfane: poza lucrarii sterse dispare si din storage
    if (this.portfolioImages) await this.portfolioImages.deleteObjects(removedKeys);
    return this.getMyCompany(userId);
  }

  // --- Matrice permisiuni campuri oferta (Î5) — doar OWNER ajusteaza (4.13) ---
  async updateOfferPermissions(userId: string, dto: UpdateOfferPermissionsDto): Promise<CompanyDto> {
    const member = await this.requireMembership(userId);
    if (member.role !== 'OWNER') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only owner can adjust offer field permissions',
      });
    }
    // h1-2: drepturile proprietarului nu se schimba (are mereu tot) → randurile OWNER se ignora
    const changes = dto.permissions.filter((p) => p.role !== 'OWNER');
    // Firma fara niciun rand era pe matricea de la inscriere: o scriem intai, ca o salvare
    // partiala sa nu transforme rolurile netrimise in "nu are voie".
    const hasRows = (await this.prisma.companyOfferFieldPermission.count({ where: { companyId: member.companyId } })) > 0;
    const seed = hasRows
      ? []
      : [
          this.prisma.companyOfferFieldPermission.createMany({
            data: defaultOfferFieldPermissions().map((p) => ({ companyId: member.companyId, ...p })),
            skipDuplicates: true,
          }),
        ];
    await runTxBatch(this.prisma, [...seed, ...changes.map((p) =>
      this.prisma.companyOfferFieldPermission.upsert({
        where: {
          companyId_role_fieldKey: {
            companyId: member.companyId,
            role: p.role,
            fieldKey: p.fieldKey,
          },
        },
        create: {
          companyId: member.companyId,
          role: p.role,
          fieldKey: p.fieldKey,
          canEdit: p.canEdit,
        },
        update: { canEdit: p.canEdit },
      }),
    )]);
    return this.getMyCompany(userId);
  }

  // --- Admin (4.6 / 4.19) ---
  async adminList(status?: Company['status']): Promise<AdminCompanyListItemDto[]> {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, locations: true, portfolioItems: true } },
      },
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      cui: c.cui,
      status: c.status,
      city: c.city,
      county: c.county,
      createdAt: c.createdAt.toISOString(),
      riskFlags: this.computeRiskFlags(c._count.portfolioItems),
      memberCount: c._count.members,
      locationCount: c._count.locations,
      portfolioCount: c._count.portfolioItems,
    }));
  }

  async adminGet(companyId: string): Promise<CompanyDto & { riskFlags: CompanyRiskFlag[] }> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        members: { where: { user: { deletedAt: null } }, include: { user: true }, orderBy: { createdAt: 'asc' } },
        locations: { orderBy: { createdAt: 'asc' } },
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        offerFieldPerms: true,
      },
    });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
    const owner = company.members.find((m) => m.role === 'OWNER');
    const base = await this.getMyCompany(owner?.userId ?? company.members[0]?.userId ?? '', company.id);
    return { ...base, riskFlags: this.computeRiskFlags(company.portfolioItems.length) };
  }

  async adminApprove(companyId: string, adminUserId: string): Promise<{ id: string; status: Company['status'] }> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
    const portfolioCount = await this.prisma.companyPortfolioItem.count({ where: { companyId } });
    const updated = await runTx(this.prisma, 'write', async (tx) => {
      const c = await tx.company.update({
        where: { id: companyId },
        data: { status: 'APPROVED', rejectedAt: null, rejectionReason: null },
      });
      await tx.companyVerificationProfile.update({
        where: { companyId },
        data: {
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
          riskFlags: this.computeRiskFlags(portfolioCount),
        },
      });
      // 4.16 — trial Gold + bonus credite la approve (idempotent, in aceeasi tranzactie).
      await this.subscriptions.startTrialIfEnabled(companyId, tx);
      const members = await tx.companyMember.findMany({ where: { companyId }, select: { userId: true } });
      await this.outbox.record(tx, `company.approved:${companyId}:${randomUUID()}`, 'company.approved', { companyId }, members.map((m) => m.userId));
      return c;
    });
    return { id: updated.id, status: updated.status };
  }

  async adminReject(
    companyId: string,
    adminUserId: string,
    dto: RejectCompanyDto,
  ): Promise<{ id: string; status: Company['status'] }> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
    const updated = await runTx(this.prisma, 'write', async (tx) => {
      const c = await tx.company.update({
        where: { id: companyId },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: dto.reason.trim() },
      });
      await tx.companyVerificationProfile.update({
        where: { companyId },
        data: { reviewedByUserId: adminUserId, reviewedAt: new Date(), decisionNote: dto.reason.trim() },
      });
      const members = await tx.companyMember.findMany({ where: { companyId }, select: { userId: true } });
      await this.outbox.record(tx, `company.rejected:${companyId}:${randomUUID()}`, 'company.rejected', { companyId }, members.map((m) => m.userId));
      return c;
    });
    // Blocajul de 3 luni e enforce-uit la urmatorul onboard prin rejectedAt + CUI/email.
    return { id: updated.id, status: updated.status };
  }

  // Pasul 5 (audit 2026-08-23, F2): ridicarea suspendarii de catre admin — inainte nu exista
  // NICIO cale (nici automata, nici manuala); singura "portita" era adminApprove nedocumentat.
  // Etapa 12 (k2): cere motiv (DTO) si anuleaza punctele active (raspuns PO k2-1: firma o ia de
  // la zero) in ACEEASI tranzactie cu schimbarea starii. Raspunsul e si instantaneul de audit:
  // penaltyPoints / count / items (id, ruleKey, points) = ce s-a anulat; unsuspendReason = motivul
  // curatat de date de contact. Cine si cand le pune interceptorul de audit.
  async adminUnsuspend(
    companyId: string,
    dto: UnsuspendCompanyDto,
  ): Promise<{
    id: string;
    status: Company['status'];
    penaltyPoints: number;
    count: number;
    items: CancelledPenalty[];
    unsuspendReason: string;
  }> {
    const unsuspendReason = auditSafeReason(dto.reason);
    return runTx(this.prisma, 'write', async (tx) => {
      // aceeasi blocare ca applyPenalty (revizuire m3); UPDATE-ul de mai jos scrie pe randul blocat
      await lockCompanyRow(tx, companyId);
      const res = await tx.company.updateMany({
        where: { id: companyId, status: 'SUSPENDED', deletedAt: null },
        data: { status: 'APPROVED', suspendedAt: null, suspendedUntil: null },
      });
      if (res.count === 0) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not suspended' });
      }
      const cancelled = await cancelActiveCompanyPenalties(tx, companyId);
      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
      const members = await tx.companyMember.findMany({
        where: { companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `company.unsuspended:${companyId}:${randomUUID()}`, 'company.unsuspended', { companyId }, members.map((m) => m.userId));
      return {
        id: company.id,
        status: company.status,
        penaltyPoints: cancelled.reduce((sum, e) => sum + e.points, 0),
        count: cancelled.length,
        items: cancelled,
        unsuspendReason,
      };
    });
  }
}
