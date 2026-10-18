import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateEInvoiceDto } from './dto/update-e-invoice.dto';
import { BillingReadyGuard } from './billing-ready.guard';
import { BankTransferService } from './bank-transfer.service';

// Firma: pachete credite, planuri, achizitii (Stripe Checkout sau transfer bancar),
// comenzi + factura PDF.
@Controller('billing')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
@UseInterceptors(AuditInterceptor)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly bankTransfer: BankTransferService,
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
  // E-admin-platform-4: BillingReadyGuard (503 BILLING_NOT_CONFIGURED) ruleaza inaintea
  // IdempotencyInterceptor — un refuz nu creeaza chitanta de idempotenta.
  @Post('credits/purchase')
  @Audit('CREDITS_PURCHASE_REQUESTED', 'mock_billing_order')
  @UseGuards(CompanyManagerGuard, BillingReadyGuard)
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  buyCredits(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Body() dto: PurchaseCreditsDto,
  ) {
    return this.payments.purchaseCredits(ctx.companyId, user.sub, dto);
  }

  @Post('subscription/purchase')
  @Audit('SUBSCRIPTION_PURCHASE_REQUESTED', 'mock_billing_order')
  @UseGuards(CompanyManagerGuard, BillingReadyGuard)
  @Idempotent({ transactional: true })
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
  @Audit('CHECKOUT_REQUESTED', 'mock_billing_order')
  @UseGuards(CompanyManagerGuard, BillingReadyGuard)
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(200)
  checkout(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.createCheckout(ctx.companyId, user.sub, id);
  }

  // PDF randat cu Puppeteer (scump) → plafon per ruta sub limita globala (3.13)
  @Get('orders/:id/invoice')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(CompanyManagerGuard)
  async invoice(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    // E-company-19: numele fisierului per factura (factura-{serie}-{numar}.pdf)
    const { pdf, fileName } = await this.invoicePdf.generate(ctx.companyId, id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });
  }

  // E-company-24: factura proforma (fara numar fiscal) pentru o comanda in asteptarea platii.
  @Get('orders/:id/proforma')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(CompanyManagerGuard)
  async proforma(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    const { pdf, fileName } = await this.invoicePdf.generateProforma(ctx.companyId, id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });
  }

  // E-company-24: "Am platit" (transfer bancar) — marcaj setat o singura data + clopotel admini.
  // Fara Idempotency-Key: repetarea e idempotenta pe stare si pe cheia evenimentului.
  @Post('orders/:id/mark-paid')
  @HttpCode(200)
  @Audit('PAYMENT_MARKED_PAID', 'mock_billing_order')
  @UseGuards(CompanyManagerGuard)
  markPaid(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.bankTransfer.markPaid(ctx.companyId, id);
  }
}

// Admin: lista comenzi + confirma plata (calea A, 3.7 — transfer bancar) / anuleaza — auditat (3.9).
@Controller('admin/payments')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    const valid = status && (Object.values(BillingOrderStatus) as string[]).includes(status);
    return this.payments.adminList(valid ? (status as BillingOrderStatus) : undefined);
  }

  // E-admin-platform-4 — ruta manuala e-Factura: ce a facut contabilul in SPV (auditat).
  @Patch(':id/e-invoice')
  @Audit('E_INVOICE_STATUS_UPDATED', 'mock_billing_order')
  updateEInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEInvoiceDto) {
    return this.payments.updateEInvoice(id, dto);
  }

  @Get(':id/invoice')
  async invoice(@Param('id', ParseUUIDPipe) id: string) {
    const { pdf, fileName } = await this.invoicePdf.generateForAdmin(id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });
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
