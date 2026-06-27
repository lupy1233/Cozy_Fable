import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NOTIFICATIONS } from '../../infra/queues/queues.module';
import { NotificationsService } from './notifications.service';

// Consuma coada `notifications` (alimentata de EventBusService.publish). Daca jobul are
// __targets (destinatari rezolvati la publish), persista cate o notificare per user (3.5/docs06).
@Processor(QUEUE_NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<void> {
    const payload = job.data ?? {};
    const targets = payload.__targets;
    if (!Array.isArray(targets) || targets.length === 0) return; // eveniment broadcast → fara persistenta
    const { __targets, ...clean } = payload;
    void __targets;
    await this.notifications.createForUsers(targets as string[], job.name, clean);
  }
}
