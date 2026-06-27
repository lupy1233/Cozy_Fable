import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import { ERROR_CODES } from '@marketplace/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { PaymentsService } from './payments.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { PaymentWebhookDto, PurchaseCreditsDto, PurchaseSubscriptionDto } from './dto/payment.dto';

// Firma: pachete credite, achizitii, comenzi + factura PDF.
@Controller('billing')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get('credit-packages')
  packages() {
    return this.payments.listPackages();
  }

  @Get('orders')
  orders(@CurrentCompany() ctx: CompanyContext) {
    return this.payments.listOrders(ctx.companyId);
  }

  // POST critic — Idempotency-Key (3.2).
  @Post('credits/purchase')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  buyCredits(@CurrentCompany() ctx: CompanyContext, @Body() dto: PurchaseCreditsDto) {
    return this.payments.purchaseCredits(ctx.companyId, dto);
  }

  @Post('subscription/purchase')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  buySubscription(@CurrentCompany() ctx: CompanyContext, @Body() dto: PurchaseSubscriptionDto) {
    return this.payments.purchaseSubscription(ctx.companyId, dto);
  }

  @Get('orders/:id/invoice')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="factura.pdf"')
  async invoice(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.invoicePdf.generate(ctx.companyId, id));
  }
}

// Admin: confirma plata (calea A, 3.7) — auditat (3.9).
@Controller('admin/payments')
@Roles(UserRole.ADMIN)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  pending() {
    return this.payments.adminListPending();
  }

  @Post(':id/confirm')
  @Audit('PAYMENT_CONFIRMED', 'mock_billing_order')
  @UseInterceptors(AuditInterceptor)
  confirm(@CurrentUser() _user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.confirm(id, 'admin');
  }
}

// Webhook plata (calea B, 3.7): HMAC-SHA256 + Idempotency-Key + replay protection.
@Controller('webhooks')
export class PaymentWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('payment')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  webhook(
    @Body() dto: PaymentWebhookDto,
    @Headers('x-payment-signature') signature?: string,
  ) {
    const secret = this.config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(`${dto.orderId}.${dto.status}`).digest('hex');
    const provided = signature ?? '';
    const ok =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) {
      throw new UnauthorizedException({
        code: ERROR_CODES.PAYMENT_SIGNATURE_INVALID,
        message: 'Invalid payment signature',
      });
    }
    if (dto.status !== 'CONFIRMED') {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Unsupported status' });
    }
    return this.payments.confirm(dto.orderId, 'webhook');
  }
}
