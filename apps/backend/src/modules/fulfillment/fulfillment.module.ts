import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { QUEUE_DELIVERY_AUTOCOMPLETE } from '../../infra/queues/queues.module';
import { DeliveryAutocompleteProcessor } from './delivery-autocomplete.processor';
import {
  AdminDisputesController,
  ClientFulfillmentController,
  CompanyDeliveryController,
} from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    BullModule.registerQueue({ name: QUEUE_DELIVERY_AUTOCOMPLETE }),
  ],
  controllers: [CompanyDeliveryController, ClientFulfillmentController, AdminDisputesController],
  providers: [FulfillmentService, DeliveryAutocompleteProcessor, CompanyApprovedGuard],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
