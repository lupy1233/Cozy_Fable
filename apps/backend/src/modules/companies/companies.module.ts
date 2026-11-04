import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [BillingModule, OutboxModule],
  controllers: [CompaniesController, AdminCompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
