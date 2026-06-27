import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { GeoModule } from '../geo/geo.module';
import { SizingModule } from '../sizing/sizing.module';
import { UploadsModule } from '../uploads/uploads.module';
import { RequestExpirationProcessor } from './request-expiration.processor';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthModule, BillingModule, GeoModule, SizingModule, UploadsModule],
  controllers: [RequestsController],
  providers: [RequestsService, RequestExpirationProcessor],
})
export class RequestsModule {}
