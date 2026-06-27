import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import type {
  AdminCompanyListItemDto,
  CompanyDto,
  CompanyRiskFlag,
} from '@marketplace/shared';
import type { Company, CompanyMemberRole } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SubscriptionsService } from '../billing/subscriptions.service';
import {
  defaultOfferFieldPermissions,
  MIN_REVIEWS_THRESHOLD,
  REAPPLY_BLOCK_MONTHS,
} from './companies.constants';
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

// Roluri care pot administra firma (profil, locatii, echipa, portofoliu, matrice)
const MANAGEMENT_ROLES: CompanyMemberRole[] = ['OWNER', 'MANAGER'];

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
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
    const member = await this.prisma.companyMember.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User is not a member of any company',
      });
    }
    return member;
  }

  private async requireManager(userId: string) {
    const member = await this.requireMembership(userId);
    if (!MANAGEMENT_ROLES.includes(member.role)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only owner or manager can perform this action',
      });
    }
    return member;
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

    const companyId = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name.trim(),
          cui: normalizedCui,
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
        members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
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

    return {
      id: company.id,
      name: company.name,
      cui: company.cui,
      regComNumber: company.regComNumber,
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
        imageUrl: p.imageUrl,
        createdAt: p.createdAt.toISOString(),
      })),
      offerFieldPermissions: company.offerFieldPerms.map((p) => ({
        role: p.role,
        fieldKey: p.fieldKey,
        canEdit: p.canEdit,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateCompanyDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
    await this.prisma.company.update({
      where: { id: member.companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.addressText !== undefined && { addressText: dto.addressText.trim() }),
        ...(dto.county !== undefined && { county: dto.county.trim() }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    });
    return this.getMyCompany(userId);
  }

  // --- Locatii (D-v6-10) ---
  async addLocation(userId: string, dto: CompanyLocationDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
    await this.prisma.companyLocation.create({
      data: {
        companyId: member.companyId,
        addressText: dto.addressText.trim(),
        county: dto.county.trim(),
        city: dto.city.trim(),
        lat: dto.lat,
        lng: dto.lng,
        coverageRadiusKm: dto.coverageRadiusKm,
      },
    });
    return this.getMyCompany(userId);
  }

  async updateLocation(userId: string, locationId: string, dto: CompanyLocationDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
    const result = await this.prisma.companyLocation.updateMany({
      where: { id: locationId, companyId: member.companyId },
      data: {
        addressText: dto.addressText.trim(),
        county: dto.county.trim(),
        city: dto.city.trim(),
        lat: dto.lat,
        lng: dto.lng,
        coverageRadiusKm: dto.coverageRadiusKm,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    return this.getMyCompany(userId);
  }

  async deleteLocation(userId: string, locationId: string): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
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
    const member = await this.requireManager(userId);
    const invitee = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null, role: 'COMPANY_USER' },
    });
    if (!invitee) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
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
    await this.prisma.companyMember.create({
      data: { companyId: member.companyId, userId: invitee.id, role: dto.role },
    });
    return this.getMyCompany(userId);
  }

  async changeMemberRole(
    userId: string,
    memberId: string,
    dto: ChangeMemberRoleDto,
  ): Promise<CompanyDto> {
    const manager = await this.requireManager(userId);
    const target = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId: manager.companyId },
    });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Member not found' });
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
    const manager = await this.requireManager(userId);
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
  async addPortfolioItem(userId: string, dto: PortfolioItemDto): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
    await this.prisma.companyPortfolioItem.create({
      data: {
        companyId: member.companyId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
      },
    });
    return this.getMyCompany(userId);
  }

  async deletePortfolioItem(userId: string, itemId: string): Promise<CompanyDto> {
    const member = await this.requireManager(userId);
    const result = await this.prisma.companyPortfolioItem.deleteMany({
      where: { id: itemId, companyId: member.companyId },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Portfolio item not found' });
    }
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
    await this.prisma.$transaction(
      dto.permissions.map((p) =>
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
      ),
    );
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
        members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
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
    const updated = await this.prisma.$transaction(async (tx) => {
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
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.update({
        where: { id: companyId },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: dto.reason.trim() },
      });
      await tx.companyVerificationProfile.update({
        where: { companyId },
        data: { reviewedByUserId: adminUserId, reviewedAt: new Date(), decisionNote: dto.reason.trim() },
      });
      return c;
    });
    // Blocajul de 3 luni e enforce-uit la urmatorul onboard prin rejectedAt + CUI/email.
    return { id: updated.id, status: updated.status };
  }
}
