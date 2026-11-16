import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExecutionStage, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { FulfillmentService } from './fulfillment.service';
import { CreateReviewDto, ResolveDisputeDto, UpdateExecutionStageDto } from './dto/fulfillment.dto';

// Firma castigatoare marcheaza livrarea (4.18).
@Controller('company/requests')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
@UseInterceptors(AuditInterceptor)
export class CompanyDeliveryController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post(':id/deliver')
  @Audit('DELIVERY_MARKED', 'request')
  deliver(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.markDelivered(ctx, id);
  }

  // e2 pasul 4: "Livrare confirmata" + recenzia primita pe fisa firmei castigatoare
  @Get(':id/completion')
  completion(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fulfillment.getCompletionForCompany(ctx, user.sub, id);
  }

  // e1-2 (PO 2026-11-13): etape informative bifate de firma castigatoare (idempotent)
  // review m3: limita de apeluri ca la rutele de scriere asemanatoare + audit (fara texte libere:
  // audit-snapshot pastreaza doar cheile declarate)
  @Put(':id/stages/:stage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Audit('EXECUTION_STAGE_UPDATED', 'request')
  setStage(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stage', new ParseEnumPipe(ExecutionStage)) stage: ExecutionStage,
    @Body() dto: UpdateExecutionStageDto,
  ) {
    return this.fulfillment.setExecutionStage(ctx, user.sub, id, stage, dto.done);
  }
}

// Clientul confirma livrarea + lasa review (4.18).
@Controller('requests')
@Roles(UserRole.CLIENT)
@UseInterceptors(AuditInterceptor)
export class ClientFulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post(':id/confirm-delivery')
  @Audit('DELIVERY_CONFIRMED', 'request')
  confirm(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.confirmDelivery(user.sub, id);
  }

  @Post(':id/review')
  @Audit('REVIEW_CREATED', 'review')
  review(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.fulfillment.createReview(user.sub, id, dto);
  }

  // e1-1 (PO 2026-11-13): "Ce urmeaza" — contactul + datele firmei castigatoare + etapele
  @Get(':id/fulfillment')
  getFulfillment(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.fulfillment.getFulfillmentForClient(user.sub, id);
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
