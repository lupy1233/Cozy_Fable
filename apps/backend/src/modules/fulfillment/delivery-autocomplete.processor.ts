import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_DELIVERY_AUTOCOMPLETE } from '../../infra/queues/queues.module';
import { FulfillmentService } from './fulfillment.service';

export interface DeliveryAutocompleteJob {
  requestId: string;
}

// D-PO 2026-08-23 (pasul 5, F1): la 14 zile calendaristice de la delivered_at, daca clientul
// nu a confirmat livrarea → COMPLETED automat (consum credite castigator + recenzia devine
// posibila). Gardele si biletul de decontare traiesc in FulfillmentService — jobul e subtire.
@Processor(QUEUE_DELIVERY_AUTOCOMPLETE)
export class DeliveryAutocompleteProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryAutocompleteProcessor.name);

  constructor(private readonly fulfillment: FulfillmentService) {
    super();
  }

  async process(job: Job<DeliveryAutocompleteJob>): Promise<void> {
    const done = await this.fulfillment.autoCompleteDelivered(job.data.requestId);
    if (!done) this.logger.debug(`auto-complete no-op pentru ${job.data.requestId}`);
  }
}
