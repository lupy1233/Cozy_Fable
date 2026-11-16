import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { BillingModule } from '../billing/billing.module';
import { GeoModule } from '../geo/geo.module';
import { InspirationModule } from '../inspiration/inspiration.module';
import { SizingModule } from '../sizing/sizing.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ConfiguratorService } from './configurator.service';
import { DraftCleanupProcessor } from './draft-cleanup.processor';
import { DraftCleanupService } from './draft-cleanup.service';
import { RequestExpirationProcessor } from './request-expiration.processor';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [
    // f6: coada draft-cleanup e inregistrata global in QueuesModule
    AuthModule, OutboxModule, BillingModule, GeoModule, InspirationModule, SizingModule, UploadsModule,
  ],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    ConfiguratorService,
    DraftCleanupService,
    ...activeOnlyProviders(RequestExpirationProcessor, DraftCleanupProcessor),
  ],
})
export class RequestsModule {}
