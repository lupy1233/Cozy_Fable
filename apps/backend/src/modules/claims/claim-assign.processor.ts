import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_CLAIM_ASSIGN } from '../../infra/queues/queues.module';
import { CreditsService } from '../billing/credits.service';
import { recomputeRequestStatusAfterClaimChange } from './claims.helpers';

export interface ClaimAssignJob {
  claimSlotId: string;
}

// 4.9 — la +1h de la claim, daca slotul e inca ACTIVE si neatribuit:
// auto-cancel (CANCELLED_UNASSIGNED) + refund credite + recalcul status cerere.
@Processor(QUEUE_CLAIM_ASSIGN)
export class ClaimAssignProcessor extends WorkerHost {
  private readonly logger = new Logger(ClaimAssignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly eventBus: EventBusService,
  ) {
    super();
  }

  async process(job: Job<ClaimAssignJob>): Promise<void> {
    const { claimSlotId } = job.data;
    const requestId = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claimSlot.findUnique({ where: { id: claimSlotId } });
      if (!claim || claim.status !== 'ACTIVE' || claim.assignedToUserId !== null) {
        return null; // a fost atribuit/anulat intre timp
      }
      await tx.claimSlot.update({
        where: { id: claimSlotId },
        data: { status: 'CANCELLED_UNASSIGNED', withdrawnAt: new Date() },
      });
      await this.credits.refund(
        claim.companyId,
        claim.claimCostCreditsSnapshot,
        'CLAIM_AUTO_CANCEL_UNASSIGNED',
        claimSlotId,
        tx,
      );
      await recomputeRequestStatusAfterClaimChange(tx, claim.requestId);
      return claim.requestId;
    });

    if (requestId) {
      await this.eventBus.publish('claim.withdrawn', { claimSlotId, reason: 'UNASSIGNED_1H' });
      this.logger.debug(`claim ${claimSlotId} auto-cancelled (unassigned 1h)`);
    }
  }
}
