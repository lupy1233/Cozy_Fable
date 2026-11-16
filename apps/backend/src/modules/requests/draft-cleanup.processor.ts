import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUE_DRAFT_CLEANUP } from '../../infra/queues/queues.module';
import { DraftCleanupService } from './draft-cleanup.service';

// f6: coada proprie a curatarii de ciorne (inregistrata in QueuesModule, ca sa apara si in /admin/jobs)
export { QUEUE_DRAFT_CLEANUP };
export const DRAFT_CLEANUP_JOB = 'cleanup.drafts';
// zilnic la 03:30 ora Romaniei (ca celelalte joburi repetate de noapte); cheie repeat stabila
export const DRAFT_CLEANUP_REPEAT = { pattern: '30 3 * * *', tz: 'Europe/Bucharest' } as const;

@Processor(QUEUE_DRAFT_CLEANUP)
export class DraftCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DraftCleanupProcessor.name);

  constructor(
    private readonly cleanup: DraftCleanupService,
    @InjectQueue(QUEUE_DRAFT_CLEANUP) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      DRAFT_CLEANUP_JOB,
      {},
      { repeat: DRAFT_CLEANUP_REPEAT, removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    ).catch(() => this.logger.warn('draft cleanup schedule deferred (queue unavailable)'));
  }

  async process(job: Job): Promise<void> {
    if (job.name !== DRAFT_CLEANUP_JOB) return;
    await this.cleanup.run(new Date());
  }
}
