import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BillingOrderStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
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
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentWebhookDto, PurchaseCreditsDto, PurchaseSubscriptionDto } from './dto/payment.dto';

// Firma: pachete credite, planuri, achizitii (Stripe Checkout sau transfer bancar),
// comenzi + factura PDF.
@Controller('billing')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get('credit-packages')
  packages() {
    return this.payments.listPackages();
  }

  @Get('plans')
  plans() {
    return this.subscriptions.listPlans();
  }

  @Get('payment-instructions')
  paymentInstructions() {
    return this.payments.getPaymentInstructions();
  }

  @Get('orders')
  orders(@CurrentCompany() ctx: CompanyContext) {
    return this.payments.listOrders(ctx.companyId);
  }

  // POST critic — Idempotency-Key (3.2). Raspuns: { order, checkoutUrl } (null = transfer bancar).
  @Post('credits/purchase')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  buyCredits(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Body() dto: PurchaseCreditsDto,
  ) {
    return this.payments.purchaseCredits(ctx.companyId, user.sub, dto);
  }

  @Post('subscription/purchase')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  buySubscription(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Body() dto: PurchaseSubscriptionDto,
  ) {
    return this.payments.purchaseSubscription(ctx.companyId, user.sub, dto);
  }

  // "Continua plata" — sesiune Checkout noua pentru o comanda PENDING (cea veche e expirata).
  @Post('orders/:id/checkout')
  @HttpCode(200)
  checkout(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.createCheckout(ctx.companyId, user.sub, id);
  }

  @Get('orders/:id/invoice')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="factura.pdf"')
  async invoice(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.invoicePdf.generate(ctx.companyId, id));
  }
}

// Admin: lista comenzi + confirma plata (calea A, 3.7 — transfer bancar) / anuleaza — auditat (3.9).
@Controller('admin/payments')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const valid = status && (Object.values(BillingOrderStatus) as string[]).includes(status);
    return this.payments.adminList(valid ? (status as BillingOrderStatus) : undefined);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @Audit('PAYMENT_CONFIRMED', 'mock_billing_order')
  confirm(@CurrentUser() _user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.confirm(id, 'admin');
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Audit('PAYMENT_CANCELLED', 'mock_billing_order')
  cancel(@CurrentUser() _user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.cancel(id, 'admin');
  }
}

// Webhook-uri plata. Stripe (L0-D): semnatura verificata pe corpul brut, dedup pe event.id,
// fara Idempotency-Key (Stripe reincearca singur la non-2xx).
@Controller('webhooks')
export class PaymentWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const event = this.stripe.constructEvent(req.rawBody, signature);
    return this.payments.handleStripeEvent(event);
  }

  // Calea B mock (istoric, 3.7): HMAC-SHA256 + Idempotency-Key. Pastrat pana la curatarea
  // PAYMENT_WEBHOOK_SECRET din config (sprint separat).
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
