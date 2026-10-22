import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { BillingModule } from '../billing/billing.module';
import { GeoModule } from '../geo/geo.module';
import { InspirationModule } from '../inspiration/inspiration.module';
import { SizingModule } from '../sizing/sizing.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ConfiguratorService } from './configurator.service';
import { RequestExpirationProcessor } from './request-expiration.processor';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [AuthModule, OutboxModule, BillingModule, GeoModule, InspirationModule, SizingModule, UploadsModule],
  controllers: [RequestsController],
  providers: [RequestsService, ConfiguratorService, ...activeOnlyProviders(RequestExpirationProcessor)],
})
export class RequestsModule {}
