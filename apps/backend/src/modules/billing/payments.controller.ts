import {
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BillingOrderStatus, UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CompanyManagerGuard } from '../../common/guards/company-manager.guard';
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
import { PurchaseCreditsDto, PurchaseSubscriptionDto } from './dto/payment.dto';

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
  @UseGuards(CompanyManagerGuard)
  paymentInstructions() {
    return this.payments.getPaymentInstructions();
  }

  // Pasul 6 (audit 2026-08-23): comenzile/facturile/achizitiile = doar OWNER/MANAGER.
  @Get('orders')
  @UseGuards(CompanyManagerGuard)
  orders(@CurrentCompany() ctx: CompanyContext) {
    return this.payments.listOrders(ctx.companyId);
  }

  // POST critic — Idempotency-Key (3.2). Raspuns: { order, checkoutUrl } (null = transfer bancar).
  @Post('credits/purchase')
  @UseGuards(CompanyManagerGuard)
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
  @UseGuards(CompanyManagerGuard)
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
  @UseGuards(CompanyManagerGuard)
  @HttpCode(200)
  checkout(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.createCheckout(ctx.companyId, user.sub, id);
  }

  @Get('orders/:id/invoice')
  @UseGuards(CompanyManagerGuard)
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
}
