import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUE_NEW_REQUESTS } from '../../infra/queues/queues.module';
import { NewRequestsService } from './new-requests.service';

// g1-2 (etapa 9): coada proprie a anunturilor de cereri noi (inregistrata in QueuesModule, ca sa
// apara si in /admin/jobs).
export { QUEUE_NEW_REQUESTS };
export const SCAN_NEW_IN_AREA_JOB = 'scan.new-in-area';
export const DAILY_DIGEST_JOB = 'digest.new-requests';

// Scanarea la un minut (clopotelul pleaca la cel mult ~1 min dupa ce cererea devine vizibila
// firmei) + rezumatul zilnic la 08:00 ora Romaniei. Ambele sunt idempotente (cheie outbox pe
// cerere+firma; marcaj pe firma pentru rezumat), deci reluarile nu dubleaza nimic.
@Processor(QUEUE_NEW_REQUESTS)
export class NewRequestsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NewRequestsProcessor.name);

  constructor(
    private readonly newRequests: NewRequestsService,
    @InjectQueue(QUEUE_NEW_REQUESTS) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const options = { removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 } };
    try {
      await this.queue.add(SCAN_NEW_IN_AREA_JOB, {}, { ...options, repeat: { every: 60_000 } });
      await this.queue.add(DAILY_DIGEST_JOB, {}, { ...options, repeat: { pattern: '0 8 * * *', tz: 'Europe/Bucharest' } });
    } catch {
      this.logger.warn('Coada new-requests indisponibila; programarea se reia la urmatoarea pornire');
    }
  }

  async process(job: Job): Promise<void> {
    if (job.name === SCAN_NEW_IN_AREA_JOB) {
      await this.newRequests.scanNewInArea();
      return;
    }
    if (job.name === DAILY_DIGEST_JOB) {
      await this.newRequests.sendDailyDigest();
    }
  }
}
