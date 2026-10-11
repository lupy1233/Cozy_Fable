import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { BillingModule } from '../billing/billing.module';
import { PenaltiesModule } from '../penalties/penalties.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_DELIVERY_AUTOCOMPLETE,
  QUEUE_OFFER_EXPIRY_SETTLEMENT,
  QUEUE_PROJECT_DEADLINES,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_RECONCILIATION,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ClaimAssignProcessor } from './claim-assign.processor';
import { OfferExpirySettlementProcessor } from './offer-expiry-settlement.processor';
import { ReconciliationProcessor } from './reconciliation.processor';
import { SlaBreachProcessor } from './sla-breach.processor';
import { WithdrawalReminderProcessor } from './withdrawal-reminder.processor';
import { ClaimsController } from './claims.controller';
import {
  AdminWithdrawalsController,
  ClaimLifecycleController,
  ClientClarificationController,
} from './lifecycle.controller';
import { ClaimsService } from './claims.service';
import { ClarificationsService } from './clarifications.service';
import { WithdrawalsService } from './withdrawals.service';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    BillingModule,
    PenaltiesModule,
    EntitlementsModule,
    BullModule.registerQueue(
      { name: QUEUE_CLAIM_ASSIGN },
      { name: QUEUE_SLA_BREACH },
      { name: QUEUE_REQUEST_EXPIRATION },
      { name: QUEUE_WITHDRAWAL_REMINDER },
      { name: QUEUE_QUOTE_VALIDITY },
      { name: QUEUE_CONSULTATION_EXPIRY },
      { name: QUEUE_DELIVERY_AUTOCOMPLETE },
      { name: QUEUE_RECONCILIATION },
      { name: QUEUE_OFFER_EXPIRY_SETTLEMENT },
      { name: QUEUE_PROJECT_DEADLINES },
    ),
  ],
  controllers: [
    ClaimsController,
    ClaimLifecycleController,
    ClientClarificationController,
    AdminWithdrawalsController,
  ],
  providers: [
    ClaimsService,
    ClarificationsService,
    WithdrawalsService,
    ...activeOnlyProviders(
      ClaimAssignProcessor,
      OfferExpirySettlementProcessor,
      ReconciliationProcessor,
      SlaBreachProcessor,
      WithdrawalReminderProcessor,
    ),
    CompanyApprovedGuard,
    SubscriptionActiveGuard,
    IdempotencyInterceptor,
  ],
  exports: [ClaimsService],
})
export class ClaimsModule {}
