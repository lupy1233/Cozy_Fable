import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompaniesService } from './companies.service';
import {
  ChangeMemberRoleDto,
  CompanyLocationDto,
  InviteMemberDto,
  OnboardCompanyDto,
  PortfolioItemDto,
  UpdateCompanyDto,
  UpdateOfferPermissionsDto,
} from './dto/company.dto';

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

  @Patch('me')
  updateProfile(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateCompanyDto) {
    return this.companies.updateProfile(user.sub, dto);
  }

  // Locatii
  @Post('me/locations')
  addLocation(@CurrentUser() user: AccessTokenPayload, @Body() dto: CompanyLocationDto) {
    return this.companies.addLocation(user.sub, dto);
  }

  @Put('me/locations/:id')
  updateLocation(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: CompanyLocationDto,
  ) {
    return this.companies.updateLocation(user.sub, id, dto);
  }

  @Delete('me/locations/:id')
  deleteLocation(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.companies.deleteLocation(user.sub, id);
  }

  // Echipa
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
  deletePortfolioItem(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.companies.deletePortfolioItem(user.sub, id);
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
