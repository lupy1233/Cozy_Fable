import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { QUEUE_DELIVERY_AUTOCOMPLETE, QUEUE_PROJECT_DEADLINES } from '../../infra/queues/queues.module';
import { DeliveryAutocompleteProcessor } from './delivery-autocomplete.processor';
import {
  AdminDisputesController,
  ClientFulfillmentController,
  CompanyDeliveryController,
} from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';
import {
  AdminProjectCasesController,
  AdminRequestsController,
  ClientProjectCaseController,
  CompanyProjectCaseController,
} from './project-cases.controller';
import { ProjectCasesService } from './project-cases.service';
import { ProjectClosureService } from './project-closure.service';
import { ProjectDeadlinesProcessor } from './project-deadlines.processor';
import { OutboxModule } from '../outbox/outbox.module';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    OutboxModule,
    BullModule.registerQueue({ name: QUEUE_DELIVERY_AUTOCOMPLETE }),
    BullModule.registerQueue({ name: QUEUE_PROJECT_DEADLINES }),
  ],
  controllers: [
    CompanyDeliveryController,
    ClientFulfillmentController,
    AdminDisputesController,
    ClientProjectCaseController,
    CompanyProjectCaseController,
    AdminRequestsController,
    AdminProjectCasesController,
  ],
  providers: [
    FulfillmentService,
    ProjectCasesService,
    ProjectClosureService,
    ...activeOnlyProviders(DeliveryAutocompleteProcessor, ProjectDeadlinesProcessor),
    CompanyApprovedGuard,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
