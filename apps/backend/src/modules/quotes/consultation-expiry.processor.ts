import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_CONSULTATION_EXPIRY } from '../../infra/queues/queues.module';
import { QuotesService } from './quotes.service';

export interface ConsultationExpiryJob {
  inviteId: string;
}

// D-v6-8 — invitatia la sediu expira dupa 7 zile calendaristice daca clientul nu raspunde.
// Firma e notificata si poate retrimite o invitatie noua.
@Processor(QUEUE_CONSULTATION_EXPIRY)
export class ConsultationExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ConsultationExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {
    super();
  }

  async process(job: Job<ConsultationExpiryJob>): Promise<void> {
    const { inviteId } = job.data;
    const quoteId = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.physicalConsultationInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.status !== 'PENDING_CLIENT') return null;
      if (invite.expiresAt.getTime() > Date.now()) return null;
      await tx.physicalConsultationInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } });
      return invite.quoteId;
    });

    if (quoteId) {
      await this.quotes.publishQuoteUpdated(quoteId);
      this.logger.debug(`consultation invite ${inviteId} expired`);
    }
  }
}
