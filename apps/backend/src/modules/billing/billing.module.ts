import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import {
  AdminPaymentsController,
  PaymentWebhookController,
  PaymentsController,
} from './payments.controller';
import { CreditsService } from './credits.service';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentsService } from './payments.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, PaymentsController, AdminPaymentsController, PaymentWebhookController],
  providers: [
    CreditsService,
    SubscriptionsService,
    PaymentsService,
    InvoicePdfService,
    CompanyApprovedGuard,
    IdempotencyInterceptor,
  ],
  exports: [CreditsService, SubscriptionsService, PaymentsService],
})
export class BillingModule {}
