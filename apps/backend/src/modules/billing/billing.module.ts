import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingController } from './billing.controller';
import {
  AdminPaymentsController,
  PaymentWebhookController,
  PaymentsController,
} from './payments.controller';
import { CreditsService } from './credits.service';
import { ClaimSettlementService } from './claim-settlement.service';
import { LedgerCheckService } from './ledger-check.service';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentsService } from './payments.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { StripeService } from './stripe.service';
import { SubscriptionExpiryProcessor } from './subscription-expiry.processor';
import { BillingReadinessService } from './billing-readiness.service';
import { BillingReadyGuard } from './billing-ready.guard';
import { EInvoiceExportService } from './e-invoice-export.service';
import { AdminBillingController } from './admin-billing.controller';
import { BankTransferService } from './bank-transfer.service';
import { BillingDocumentsService } from './billing-documents.service';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CompanyManagerGuard } from '../../common/guards/company-manager.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [AuthModule, OutboxModule, EntitlementsModule],
  controllers: [
    BillingController,
    PaymentsController,
    AdminPaymentsController,
    AdminBillingController,
    PaymentWebhookController,
  ],
  providers: [
    BillingReadinessService,
    BillingReadyGuard,
    EInvoiceExportService,
    CreditsService,
    // E-admin-platform-15: decontarea unica a rezervarilor + verificarea zilnica ledger/portofel
    ClaimSettlementService,
    LedgerCheckService,
    SubscriptionsService,
    PaymentsService,
    InvoicePdfService,
    StripeService,
    // E-company-24: transfer bancar ("Am platit", reminder, anulare automata) + documentele din emailuri
    BankTransferService,
    BillingDocumentsService,
    ...activeOnlyProviders(SubscriptionExpiryProcessor),
    CompanyApprovedGuard,
    CompanyManagerGuard,
    IdempotencyInterceptor,
  ],
  exports: [
    CreditsService,
    ClaimSettlementService,
    LedgerCheckService,
    SubscriptionsService,
    PaymentsService,
    StripeService,
    BillingReadinessService,
    BillingDocumentsService,
  ],
})
export class BillingModule {}
