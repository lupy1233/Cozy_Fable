import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { UserThrottlerGuard } from '../../common/throttler/client-ip-throttler.guard';
import { ADD_MEMBER_LIMIT_PER_HOUR } from './companies.constants';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CompaniesService } from './companies.service';
import {
  ChangeMemberRoleDto,
  CompanyLocationDto,
  InviteMemberDto,
  OnboardCompanyDto,
  PortfolioItemDto,
  SetPortfolioImageDto,
  UpdateCompanyDto,
  UpdateOfferPermissionsDto,
} from './dto/company.dto';
import { PresignAttachmentDto } from '../requests/dto/request.dto';

// Rute firma — doar COMPANY_USER (autorizarea fina pe rol in firma e in service)
@Controller('companies')
@Roles(UserRole.COMPANY_USER)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  // Lista publica de parteneri (landing /partners): @Public sare peste auth,
  // @Roles() gol suprascrie rolul de la nivel de clasa (getAllAndOverride).
  @Public()
  @Roles()
  @Get('partners')
  partners() {
    return this.companies.listPartners();
  }

  @Post()
  onboard(@CurrentUser() user: AccessTokenPayload, @Body() dto: OnboardCompanyDto) {
    return this.companies.onboard(user.sub, user.email, dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: AccessTokenPayload) {
    return this.companies.getMyCompany(user.sub);
  }

  @Get('me/dashboard-stats')
  dashboardStats(@CurrentUser() user: AccessTokenPayload) {
    return this.companies.dashboardStats(user.sub);
  }

  // E-company-19: profilul fiscal (isVatPayer) ajunge pe facturi → schimbarea e auditata
  // (snapshot doar id/status/isVatPayer; numele si adresa sunt text liber, raman afara).
  @Patch('me')
  @Audit('COMPANY_PROFILE_UPDATED', 'company')
  @UseInterceptors(AuditInterceptor)
  updateProfile(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateCompanyDto) {
    return this.companies.updateProfile(user.sub, dto);
  }

  // Locatii — E-client-9: auditate (entityId = id-ul firmei din CompanyDto; snapshot doar
  // id-uri + raze) si numarate pentru plafonul de schimbari pe 24h.
  // h1 (revizuire M1): fara lat/lng serverul geocodeaza (serviciu extern, 1 cerere / s) →
  // limita proprie pe ruta, pe langa plafonul de schimbari si cel de geocodari esuate
  @Post('me/locations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Audit('COMPANY_LOCATION_CREATED', 'company_location')
  @UseInterceptors(AuditInterceptor)
  addLocation(@CurrentUser() user: AccessTokenPayload, @Body() dto: CompanyLocationDto) {
    return this.companies.addLocation(user.sub, dto);
  }

  @Put('me/locations/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Audit('COMPANY_LOCATION_UPDATED', 'company_location')
  @UseInterceptors(AuditInterceptor)
  updateLocation(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompanyLocationDto,
  ) {
    return this.companies.updateLocation(user.sub, id, dto);
  }

  @Delete('me/locations/:id')
  @Audit('COMPANY_LOCATION_DELETED', 'company_location')
  @UseInterceptors(AuditInterceptor)
  deleteLocation(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.deleteLocation(user.sub, id);
  }

  // Echipa
  // h1 (revizuire M1): adaugarea trimite clopotel + e-mail colegului → 10 pe ora per utilizator
  // (UserThrottlerGuard ruleaza dupa JwtAuthGuard global; guard-ul global aplica si limita per IP)
  @Throttle({ default: { limit: ADD_MEMBER_LIMIT_PER_HOUR, ttl: 3_600_000 } })
  @UseGuards(UserThrottlerGuard)
  @Post('me/members')
  addMember(@CurrentUser() user: AccessTokenPayload, @Body() dto: InviteMemberDto) {
    return this.companies.addMember(user.sub, dto);
  }

  @Patch('me/members/:id')
  changeMemberRole(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.companies.changeMemberRole(user.sub, id, dto);
  }

  @Delete('me/members/:id')
  removeMember(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.companies.removeMember(user.sub, id);
  }

  // Portofoliu
  @Post('me/portfolio')
  addPortfolioItem(@CurrentUser() user: AccessTokenPayload, @Body() dto: PortfolioItemDto) {
    return this.companies.addPortfolioItem(user.sub, dto);
  }

  @Delete('me/portfolio/:id')
  deletePortfolioItem(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.deletePortfolioItem(user.sub, id);
  }

  // h1 (etapa 11): poza lucrarii — presign → PUT direct in storage → confirm (invarianta 3.4).
  // Rolul (OWNER/MANAGER) si spatiul firmei proprii se verifica in service.
  // h1 (revizuire M2): 30 / minut, ca rutele vecine de incarcare (cerere, chat, oferta, inspiratie)
  @Post('me/portfolio/images')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  presignPortfolioImage(@CurrentUser() user: AccessTokenPayload, @Body() dto: PresignAttachmentDto) {
    return this.companies.presignPortfolioImage(user.sub, {
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  @Post('me/portfolio/images/:attachmentId/confirm')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirmPortfolioImage(
    @CurrentUser() user: AccessTokenPayload,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.companies.confirmPortfolioImage(user.sub, attachmentId);
  }

  @Put('me/portfolio/:id/image')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  setPortfolioImage(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPortfolioImageDto,
  ) {
    return this.companies.setPortfolioImage(user.sub, id, dto.attachmentId);
  }

  // Matrice permisiuni campuri oferta (doar OWNER, enforce in service)
  @Put('me/offer-permissions')
  updateOfferPermissions(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateOfferPermissionsDto,
  ) {
    return this.companies.updateOfferPermissions(user.sub, dto);
  }
}
