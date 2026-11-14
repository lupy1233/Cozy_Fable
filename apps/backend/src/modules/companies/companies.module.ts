import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { OutboxModule } from '../outbox/outbox.module';
import { GeoModule } from '../geo/geo.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  // h1 (etapa 11): GeoModule = coordonatele locatiilor; UploadsModule = pozele din portofoliu
  imports: [BillingModule, OutboxModule, GeoModule, UploadsModule],
  controllers: [CompaniesController, AdminCompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
