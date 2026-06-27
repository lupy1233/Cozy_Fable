import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';

export interface RequestExpirationJob {
  requestId: string;
}

// Worker expirare: la deadline, daca cererea e inca IN_MARKETPLACE (fara claim),
// trece in EXPIRED si emite evenimentul de schimbare de status.
@Processor(QUEUE_REQUEST_EXPIRATION)
export class RequestExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(RequestExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    super();
  }

  async process(job: Job<RequestExpirationJob>): Promise<void> {
    const { requestId } = job.data;
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'IN_MARKETPLACE') return;

    await this.prisma.request.update({
      where: { id: requestId },
      data: { status: 'EXPIRED' },
    });
    await this.eventBus.publish('request.status_changed', {
      requestId,
      status: 'EXPIRED',
    });
    this.logger.debug(`request ${requestId} expired`);
  }
}
