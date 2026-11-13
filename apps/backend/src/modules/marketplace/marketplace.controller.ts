import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { MarketplaceService } from './marketplace.service';

// Marketplace pentru firme APPROVED cu abonament activ. Gating delay vine din plan (4.10);
// a1 (PO 2026-11-13): 0 pe toate planurile, mecanismul ramane pentru setarea din Admin.
@Controller('marketplace')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard, SubscriptionActiveGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('requests')
  list(@CurrentCompany() ctx: CompanyContext) {
    return this.marketplace.list(ctx.companyId, ctx.gatingDelayMinutes ?? 0);
  }

  // a5: utilizatorul curent → regula "o preluare fara oferta de persoana" in dialogul de preluare
  @Get('requests/:id')
  detail(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.marketplace.detail(ctx.companyId, ctx.gatingDelayMinutes ?? 0, id, user.sub);
  }
}
