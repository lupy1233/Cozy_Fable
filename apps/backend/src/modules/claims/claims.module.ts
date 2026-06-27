import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PenaltiesModule } from '../penalties/penalties.module';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ClaimAssignProcessor } from './claim-assign.processor';
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

@Module({
  imports: [
    AuthModule,
    BillingModule,
    PenaltiesModule,
    BullModule.registerQueue(
      { name: QUEUE_CLAIM_ASSIGN },
      { name: QUEUE_SLA_BREACH },
      { name: QUEUE_REQUEST_EXPIRATION },
      { name: QUEUE_WITHDRAWAL_REMINDER },
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
    ClaimAssignProcessor,
    SlaBreachProcessor,
    WithdrawalReminderProcessor,
    CompanyApprovedGuard,
    SubscriptionActiveGuard,
    IdempotencyInterceptor,
  ],
  exports: [ClaimsService],
})
export class ClaimsModule {}
