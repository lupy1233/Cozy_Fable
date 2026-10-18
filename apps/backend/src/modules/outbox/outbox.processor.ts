import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUE_DOMAIN_EVENTS } from '../../infra/queues/queues.module';
import { OutboxService } from './outbox.service';

@Processor(QUEUE_DOMAIN_EVENTS)
export class OutboxProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private heartbeat?: ReturnType<typeof setInterval>;
  private scheduling = false;
  constructor(private readonly outbox: OutboxService, @InjectQueue(QUEUE_DOMAIN_EVENTS) private readonly queue: Queue) { super(); }

  async onModuleInit(): Promise<void> {
    // Timerul doar rearmeaza coada dupa pierderea Redis; livrarea ramane in worker.
    void this.schedule();
    this.heartbeat = setInterval(() => { void this.schedule(); }, 30_000);
    this.heartbeat.unref();
  }

  onModuleDestroy(): void { if (this.heartbeat) clearInterval(this.heartbeat); }

  private async schedule(): Promise<void> {
    if (this.scheduling) return;
    this.scheduling = true;
    try {
      await this.queue.add('dispatch.outbox', {}, {
        jobId: 'outbox-sweep', repeat: { every: 15_000 }, attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 20, removeOnFail: 100,
      });
    } catch { this.logger.warn('Outbox queue unavailable; scheduler will retry'); }
    finally { this.scheduling = false; }
  }

  async process(): Promise<void> { await this.outbox.dispatchBatch(); }
}
