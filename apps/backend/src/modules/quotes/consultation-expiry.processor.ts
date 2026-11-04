import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
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
    const quoteId = await runTx(this.prisma, 'write', async (tx) => {
      const invite = await tx.physicalConsultationInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.status !== 'PENDING_CLIENT') return null;
      if (invite.expiresAt.getTime() > Date.now()) return null;
      const updated = await tx.physicalConsultationInvite.updateMany({ where: { id: inviteId, status: 'PENDING_CLIENT', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } });
      if (!updated.count) return null;
      await this.quotes.publishQuoteUpdated(invite.quoteId, tx);
      return invite.quoteId;
    });

    if (quoteId) {
      this.logger.debug(`consultation invite ${inviteId} expired`);
    }
  }
}
