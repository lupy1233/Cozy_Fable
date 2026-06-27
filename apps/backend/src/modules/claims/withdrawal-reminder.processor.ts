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
      include: { claimSlot: { select: { requestId: true } } },
    });
    if (!wd || wd.status !== 'PENDING_ADMIN_REVIEW') return;
    await this.eventBus.publish('withdrawal.reminder', {
      withdrawalId,
      requestId: wd.claimSlot.requestId,
    });
    this.logger.warn(`withdrawal ${withdrawalId} still pending admin review after 48h`);
  }
}
