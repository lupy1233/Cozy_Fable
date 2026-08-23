import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
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
  ) {
    super();
  }

  async process(job: Job<WithdrawalReminderJob>): Promise<void> {
    const { withdrawalId } = job.data;
    const wd = await this.prisma.claimWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        claimSlot: { select: { requestId: true, request: { select: { title: true } } } },
      },
    });
    if (!wd || wd.status !== 'PENDING_ADMIN_REVIEW') return;
    // L1 (audit 2026-08-23): reminderul ajunge la ADMINI in clopotel (inainte broadcast →
    // aruncat; adminul nu afla decat intrand singur pe /admin/withdrawals).
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      select: { id: true },
    });
    await this.eventBus.publish(
      'withdrawal.reminder',
      {
        withdrawalId,
        requestId: wd.claimSlot.requestId,
        requestTitle: wd.claimSlot.request.title ?? '',
      },
      admins.map((a) => a.id),
    );
    this.logger.warn(`withdrawal ${withdrawalId} still pending admin review after 48h`);
  }
}
