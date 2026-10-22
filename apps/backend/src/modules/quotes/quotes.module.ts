import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { BillingModule } from '../billing/billing.module';
import { UploadsModule } from '../uploads/uploads.module';
import {
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_OFFER_EXPIRY_SETTLEMENT,
  QUEUE_PROJECT_DEADLINES,
  QUEUE_QUOTE_VALIDITY,
} from '../../infra/queues/queues.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ClientQuotesController, QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import { QuoteValidityProcessor } from './quote-validity.processor';
import { ConsultationExpiryProcessor } from './consultation-expiry.processor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    BillingModule,
    UploadsModule,
    BullModule.registerQueue({ name: QUEUE_QUOTE_VALIDITY }),
    BullModule.registerQueue({ name: QUEUE_CONSULTATION_EXPIRY }),
    BullModule.registerQueue({ name: QUEUE_OFFER_EXPIRY_SETTLEMENT }),
    BullModule.registerQueue({ name: QUEUE_PROJECT_DEADLINES }),
  ],
  controllers: [QuotesController, ClientQuotesController],
  providers: [
    QuotesService,
    QuotePdfService,
    ...activeOnlyProviders(QuoteValidityProcessor, ConsultationExpiryProcessor),
    CompanyApprovedGuard,
    IdempotencyInterceptor,
  ],
  exports: [QuotesService],
})
export class QuotesModule {}
