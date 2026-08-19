import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_NOTIFICATIONS,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';
import { AdminController } from './admin.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    BullModule.registerQueue(
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_REQUEST_EXPIRATION },
      { name: QUEUE_CLAIM_ASSIGN },
      { name: QUEUE_SLA_BREACH },
      { name: QUEUE_QUOTE_VALIDITY },
      { name: QUEUE_CONSULTATION_EXPIRY },
      { name: QUEUE_WITHDRAWAL_REMINDER },
    ),
  ],
  controllers: [AdminController, AdminSubscriptionsController],
  providers: [AdminService],
})
export class AdminModule {}
