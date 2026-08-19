import { Body, Controller, Get, HttpCode, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { CompanyStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CompaniesService } from './companies.service';
import { RejectCompanyDto } from './dto/company.dto';

// Filtru lista firme admin: status optional, validat cu IsEnum (L0-B).
export class AdminCompaniesQueryDto {
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

// Verificare firme — doar ADMIN (4.6 / 4.19). Deciziile sunt auditate (3.9).
@Controller('admin/companies')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminCompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  // ?status= validat cu IsEnum (L0-B): valoare necunoscuta → 400 VALIDATION_ERROR, nu 500.
  @Get()
  list(@Query() query: AdminCompaniesQueryDto) {
    return this.companies.adminList(query.status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.companies.adminGet(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Audit('COMPANY_APPROVED', 'company')
  approve(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.companies.adminApprove(id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Audit('COMPANY_REJECTED', 'company')
  reject(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: RejectCompanyDto,
  ) {
    return this.companies.adminReject(id, user.sub, dto);
  }
}
