import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { SizingModule } from '../sizing/sizing.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_NOTIFICATIONS,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_DELIVERY_AUTOCOMPLETE,
  QUEUE_RECONCILIATION,
  QUEUE_SLA_BREACH,
  QUEUE_SUBSCRIPTION_EXPIRY,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';
import { AdminController } from './admin.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminService } from './admin.service';
import { AdminCalendarController } from './admin-calendar.controller';
import { AdminCalendarService } from './admin-calendar.service';
import { AdminSizingController } from './admin-sizing.controller';
import { AdminSizingService } from './admin-sizing.service';
import { AdminContactDetectionsController } from './admin-contact-detections.controller';
import { AdminContactDetectionsService } from './admin-contact-detections.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    SizingModule,
    EntitlementsModule,
    BullModule.registerQueue(
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_REQUEST_EXPIRATION },
      { name: QUEUE_CLAIM_ASSIGN },
      { name: QUEUE_SLA_BREACH },
      { name: QUEUE_QUOTE_VALIDITY },
      { name: QUEUE_CONSULTATION_EXPIRY },
      { name: QUEUE_WITHDRAWAL_REMINDER },
      { name: QUEUE_SUBSCRIPTION_EXPIRY },
      { name: QUEUE_DELIVERY_AUTOCOMPLETE },
      { name: QUEUE_RECONCILIATION },
    ),
  ],
  controllers: [
    AdminController,
    AdminSubscriptionsController,
    AdminCalendarController,
    AdminSizingController,
    AdminContactDetectionsController,
  ],
  providers: [AdminService, AdminCalendarService, AdminSizingService, AdminContactDetectionsService],
})
export class AdminModule {}
