import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { CreditsService } from './credits.service';
import { CreditHistoryService } from './credit-history.service';
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
    private readonly history: CreditHistoryService,
    private readonly subscriptions: SubscriptionsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('wallet')
  wallet(@CurrentCompany() ctx: CompanyContext) {
    return this.credits.getWallet(ctx.companyId);
  }

  // h3 (etapa 9): istoricul miscarilor de credite — aceleasi roluri ca soldul, doar firma proprie,
  // doar citire. ?cursor=<id ultima miscare>&limit=<1..50>
  @Get('credit-history')
  creditHistory(
    @CurrentCompany() ctx: CompanyContext,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.history.list(ctx.companyId, { cursor, limit });
  }

  @Get('subscription')
  subscription(@CurrentCompany() ctx: CompanyContext) {
    return this.subscriptions.getActive(ctx.companyId);
  }

  // E-admin-platform-58: planul activ + functiile lui (toata echipa; GET = fara scrieri, merge si pe standby)
  @Get('entitlements')
  // h2: fara abonament activ intoarce si ultimul abonament + data expirarii (mesajul comun)
  async entitlementsForCompany(@CurrentCompany() ctx: CompanyContext): Promise<EntitlementsDto> {
    const e = await this.entitlements.forCompany(ctx.companyId);
    const lastExpired = e.subscriptionId ? null : await this.entitlements.lastExpired(ctx.companyId);
    return this.entitlements.toDto(e, lastExpired);
  }
}
