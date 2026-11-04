import { Processor, WorkerHost } from '@nestjs/bullmq';
import { OutboxService } from '../outbox/outbox.service';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_WITHDRAWAL_REMINDER } from '../../infra/queues/queues.module';

export interface WithdrawalReminderJob {
  withdrawalId: string;
}

// 4.15 — reminder la 48h pentru retragerile CUSTOM inca nedecise (FARA auto-decizie).
@Processor(QUEUE_WITHDRAWAL_REMINDER)
export class WithdrawalReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(WithdrawalReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async process(job: Job<WithdrawalReminderJob>): Promise<void> {
    const { withdrawalId } = job.data;
    await runTx(this.prisma, 'write', async (tx) => {
      const wd = await tx.claimWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: {
          claimSlot: { select: { requestId: true, request: { select: { title: true } } } },
        },
      });
      if (!wd || wd.status !== 'PENDING_ADMIN_REVIEW' || Date.now() - wd.createdAt.getTime() < 48 * 60 * 60 * 1000) return;
      // L1 (audit 2026-08-23): reminderul ajunge la ADMINI in clopotel (inainte broadcast →
      // aruncat; adminul nu afla decat intrand singur pe /admin/withdrawals).
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN', deletedAt: null },
        select: { id: true },
      });
      await this.outbox.record(tx, `withdrawal.reminder:${withdrawalId}`,
        'withdrawal.reminder',
        {
          withdrawalId,
          requestId: wd.claimSlot.requestId,
          requestTitle: wd.claimSlot.request.title ?? '',
        },
        admins.map((a) => a.id),
      );
    });
    this.logger.warn(`withdrawal ${withdrawalId} still pending admin review after 48h`);
  }
}
