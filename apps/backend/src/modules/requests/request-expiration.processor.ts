import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { REQUEST_EXPIRY_REMINDER_JOB, requestExpiryReminderEventKey } from './request-expiry-reminder';

export interface RequestExpirationJob {
  requestId: string;
  // E-admin-platform-44 — doar pe joburile 'remind-expiry' (ISO)
  expiresAt?: string;
  remindAt?: string;
}

// Worker expirare: la deadline, daca cererea e inca IN_MARKETPLACE (fara claim),
// trece in EXPIRED si emite evenimentul de schimbare de status.
@Processor(QUEUE_REQUEST_EXPIRATION)
export class RequestExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(RequestExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async process(job: Job<RequestExpirationJob>): Promise<void> {
    if (job.name === REQUEST_EXPIRY_REMINDER_JOB) return this.remind(job.data);
    const { requestId } = job.data;
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'IN_MARKETPLACE' || request.deletedAt || !request.expiresAt || request.expiresAt > new Date()) return;
    await runTx(this.prisma, 'write', async (tx) => {
      const changed = await tx.request.updateMany({
        where: { id: requestId, status: 'IN_MARKETPLACE', deletedAt: null, expiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED' },
      });
      if (changed.count !== 1) return;
      const key = `request.expired:${requestId}:${request.expiresAt!.getTime()}`;
      if (request.clientUserId) await this.outbox.record(tx, key, 'request.expired', { requestId }, [request.clientUserId]);
      await this.outbox.record(tx, `${key}:status`, 'request.status_changed', { requestId, status: 'EXPIRED' }, []);
    });
    this.logger.debug(`request ${requestId} expired`);
  }

  // E-admin-platform-44 — reminder 4.4: doar notificare (fara schimbare de stare). No-op daca
  // cererea a fost preluata/stearsa, daca termenul s-a mutat (job vechi) sau fereastra a trecut.
  private async remind(data: RequestExpirationJob): Promise<void> {
    const { requestId } = data;
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true, deletedAt: true, expiresAt: true, clientUserId: true },
    });
    if (!request || request.status !== 'IN_MARKETPLACE' || request.deletedAt || !request.expiresAt) return;
    const expiresAt = request.expiresAt;
    const now = Date.now();
    if (!data.expiresAt || expiresAt.getTime() !== Date.parse(data.expiresAt)) return;
    if (!data.remindAt || now < Date.parse(data.remindAt) || now >= expiresAt.getTime()) return;
    const clientUserId = request.clientUserId;
    if (!clientUserId) return;
    await runTx(this.prisma, 'write', async (tx) => {
      await this.outbox.record(
        tx,
        requestExpiryReminderEventKey(requestId, expiresAt),
        'request.expiry_reminder',
        { requestId, expiresAt: expiresAt.toISOString(), clientUserId },
        [clientUserId],
      );
    });
    this.logger.debug(`request ${requestId} expiry reminder`);
  }
}
