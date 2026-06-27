import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { FulfillmentService } from './fulfillment.service';
import { CreateReviewDto, ResolveDisputeDto } from './dto/fulfillment.dto';

// Firma castigatoare marcheaza livrarea (4.18).
@Controller('company/requests')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class CompanyDeliveryController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post(':id/deliver')
  deliver(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.markDelivered(ctx, id);
  }
}

// Clientul confirma livrarea + lasa review (4.18).
@Controller('requests')
@Roles(UserRole.CLIENT)
export class ClientFulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post(':id/confirm-delivery')
  confirm(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.confirmDelivery(user.sub, id);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.fulfillment.createReview(user.sub, id, dto);
  }

  @Get(':id/review')
  getReview(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.getReviewForClient(user.sub, id);
  }
}

// Admin: dispute (4.18/4.19) — decizia e auditata (3.9).
@Controller('admin/disputes')
@Roles(UserRole.ADMIN)
export class AdminDisputesController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get()
  list() {
    return this.fulfillment.listDisputes();
  }

  @Post(':id/resolve')
  @Audit('DISPUTE_RESOLVED', 'review_dispute')
  @UseInterceptors(AuditInterceptor)
  resolve(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.fulfillment.resolveDispute(user.sub, id, dto);
  }
}
