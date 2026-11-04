import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { CreditsService } from './credits.service';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type { EntitlementsDto } from '@marketplace/shared';

// Endpoints firma: portofel credite + abonament activ.
@Controller('billing')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class BillingController {
  constructor(
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('wallet')
  wallet(@CurrentCompany() ctx: CompanyContext) {
    return this.credits.getWallet(ctx.companyId);
  }

  @Get('subscription')
  subscription(@CurrentCompany() ctx: CompanyContext) {
    return this.subscriptions.getActive(ctx.companyId);
  }

  // E-admin-platform-58: planul activ + functiile lui (toata echipa; GET = fara scrieri, merge si pe standby)
  @Get('entitlements')
  async entitlementsForCompany(@CurrentCompany() ctx: CompanyContext): Promise<EntitlementsDto> {
    return this.entitlements.toDto(await this.entitlements.forCompany(ctx.companyId));
  }
}
