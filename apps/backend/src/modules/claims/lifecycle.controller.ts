import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { ClarificationsService } from './clarifications.service';
import { WithdrawalsService } from './withdrawals.service';
import {
  AnswerClarificationDto,
  RequestClarificationDto,
  RequestWithdrawalDto,
  ReviewWithdrawalDto,
} from './dto/lifecycle.dto';

// Clarificari + retrageri — firma (4.11/4.15).
@Controller('claims')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
@UseInterceptors(AuditInterceptor)
export class ClaimLifecycleController {
  constructor(
    private readonly clarifications: ClarificationsService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  @Post(':id/clarifications')
  @Audit('CLARIFICATION_REQUESTED', 'claim_slot')
  requestClarification(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestClarificationDto,
  ) {
    return this.clarifications.request(ctx, user.sub, id, dto);
  }

  @Get(':id/clarifications')
  listClarifications(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clarifications.listForClaim(ctx, id);
  }

  // POST critic pe bani (refund/consum credite) — Idempotency-Key (3.2) + rate limit,
  // ca la POST /claims (anti dubla retragere, audit 2026-08-23).
  @Post(':id/withdraw')
  @Audit('CLAIM_WITHDRAWAL_REQUESTED', 'claim_withdrawal')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  withdraw(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.withdrawals.request(ctx, user.sub, id, dto);
  }

  @Get(':id/withdrawals')
  listWithdrawals(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.withdrawals.listForClaim(ctx, id);
  }

  // E-company-6: consecintele retragerii per motiv, calculate de server (read-only, fara audit;
  // GET nu scrie nimic → sigur si pe slotul standby).
  @Get(':id/withdraw-preview')
  withdrawPreview(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.withdrawals.preview(ctx, user.sub, id);
  }
}

// Clientul raspunde la clarificare (4.11).
@Controller('client/clarifications')
@Roles(UserRole.CLIENT)
@UseInterceptors(AuditInterceptor)
export class ClientClarificationController {
  constructor(private readonly clarifications: ClarificationsService) {}

  @Get('request/:requestId')
  listForRequest(
    @CurrentUser() user: AccessTokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.clarifications.listForClientRequest(user.sub, requestId);
  }

  @Post(':id/answer')
  @Audit('CLARIFICATION_ANSWERED', 'clarification')
  answer(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerClarificationDto,
  ) {
    return this.clarifications.answer(user.sub, id, dto);
  }
}

// Admin: retragerile CUSTOM in asteptare + decizie (4.15).
@Controller('admin/withdrawals')
@Roles(UserRole.ADMIN)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  listPending() {
    return this.withdrawals.adminListPending();
  }

  @Post(':id/review')
  @Audit('WITHDRAWAL_REVIEWED', 'claim_withdrawal')
  @UseInterceptors(AuditInterceptor)
  review(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.withdrawals.adminReview(user.sub, id, dto);
  }
}
