import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ClaimsService } from './claims.service';
import { AssignClaimDto, CreateClaimDto } from './dto/claim.dto';

@Controller('claims')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard, SubscriptionActiveGuard)
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  // POST critic — Idempotency-Key (3.2) + rate limit 10/min (3.13).
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  create(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateClaimDto,
  ) {
    return this.claims.create(ctx, user.sub, dto);
  }

  @Get('mine')
  listMine(@CurrentCompany() ctx: CompanyContext) {
    return this.claims.listMine(ctx.companyId);
  }

  @Post(':id/assign')
  assign(
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignClaimDto,
  ) {
    return this.claims.assign(ctx, id, dto);
  }
}
