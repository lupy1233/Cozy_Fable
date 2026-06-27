import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { CreditsService } from './credits.service';
import { SubscriptionsService } from './subscriptions.service';

// Endpoints firma: portofel credite + abonament activ.
@Controller('billing')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class BillingController {
  constructor(
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get('wallet')
  wallet(@CurrentCompany() ctx: CompanyContext) {
    return this.credits.getWallet(ctx.companyId);
  }

  @Get('subscription')
  subscription(@CurrentCompany() ctx: CompanyContext) {
    return this.subscriptions.getActive(ctx.companyId);
  }
}
