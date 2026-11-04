import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
// E-company-24: documentele de facturare atasate emailurilor (BillingModule nu importa notificarile)
import { BillingModule } from '../billing/billing.module';
import { QUEUE_NOTIFICATIONS } from '../../infra/queues/queues.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEmailsService } from './notification-emails.service';
import { NotificationsProcessor } from './notifications.processor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [AuthModule, BillingModule, BullModule.registerQueue({ name: QUEUE_NOTIFICATIONS })],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEmailsService, ...activeOnlyProviders(NotificationsProcessor)],
  exports: [NotificationsService],
})
export class NotificationsModule {}
