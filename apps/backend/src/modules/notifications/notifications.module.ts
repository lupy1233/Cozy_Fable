import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
// E-company-24: documentele de facturare atasate emailurilor (BillingModule nu importa notificarile)
import { BillingModule } from '../billing/billing.module';
// g1-2 (etapa 9): anunturile de cereri noi refolosesc lista din marketplace + abonamentul firmei
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { OutboxModule } from '../outbox/outbox.module';
import { QUEUE_NOTIFICATIONS } from '../../infra/queues/queues.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEmailsService } from './notification-emails.service';
import { NotificationsProcessor } from './notifications.processor';
import { NewRequestsService } from './new-requests.service';
import { NewRequestsProcessor, QUEUE_NEW_REQUESTS } from './new-requests.processor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    EntitlementsModule,
    MarketplaceModule,
    OutboxModule,
    BullModule.registerQueue({ name: QUEUE_NOTIFICATIONS }),
    BullModule.registerQueue({ name: QUEUE_NEW_REQUESTS }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEmailsService,
    NewRequestsService,
    ...activeOnlyProviders(NotificationsProcessor, NewRequestsProcessor),
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
