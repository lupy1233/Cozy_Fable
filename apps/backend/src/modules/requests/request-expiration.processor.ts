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
    // L1 (audit 2026-08-23): clientul AFLA ca cererea i-a expirat (clopotel + email) —
    // inainte astepta 5 zile si nu primea nimic; broadcastul ramane pt. marketplace.
    // Guard pe clientUserId nullable: FARA tinte publish-ul ar deveni broadcast (aruncat).
    if (request.clientUserId) {
      await this.eventBus.publish(
        'request.expired',
        { requestId, requestTitle: request.title ?? '' },
        [request.clientUserId],
      );
    }
    await this.eventBus.publish('request.status_changed', {
      requestId,
      status: 'EXPIRED',
    });
    this.logger.debug(`request ${requestId} expired`);
  }
}
