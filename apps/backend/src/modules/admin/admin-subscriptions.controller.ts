import { Body, Controller, Get, HttpCode, Post, Query, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { GrantSubscriptionDto } from './dto/admin-subscriptions.dto';

// Abonamente firme — consola admin (L0-D, decizie PO 2026-08-19: adminul poate ACORDA/
// PRELUNGI manual, fara comanda/factura). Auditat (3.9); nota ramane in audit (after).
@Controller('admin/subscriptions')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Query('companyId') companyId?: string) {
    return this.subscriptions.adminList(companyId || undefined);
  }

  @Post('grant')
  @HttpCode(200)
  @Audit('SUBSCRIPTION_GRANTED', 'subscription')
  async grant(@CurrentUser() _user: AccessTokenPayload, @Body() dto: GrantSubscriptionDto) {
    const sub = await this.subscriptions.adminGrant({
      companyId: dto.companyId,
      planId: dto.planId,
      days: dto.days ?? 30,
      includeCredits: dto.includeCredits ?? false,
    });
    // nota adminului intra in snapshot-ul de audit (interceptorul logheaza raspunsul)
    return { ...sub, grantedDays: dto.days ?? 30, includeCredits: dto.includeCredits ?? false, note: dto.note ?? null };
  }
}
