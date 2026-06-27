import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import {
  AdminDisputesController,
  ClientFulfillmentController,
  CompanyDeliveryController,
} from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [CompanyDeliveryController, ClientFulfillmentController, AdminDisputesController],
  providers: [FulfillmentService, CompanyApprovedGuard],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
