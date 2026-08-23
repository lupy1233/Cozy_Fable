import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_CLAIM_ASSIGN } from '../../infra/queues/queues.module';
import { CreditsService } from '../billing/credits.service';
import { REQUEST_SETTLED_STATUSES } from './claims.constants';
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
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claimSlot.findUnique({
        where: { id: claimSlotId },
        include: { request: { select: { status: true, deletedAt: true, title: true } } },
      });
      if (!claim || claim.status !== 'ACTIVE' || claim.assignedToUserId !== null) {
        return null; // a fost atribuit/anulat intre timp
      }
      // L0-B: cerere deja atribuita/stearsa → slotul e (sau va fi) inchis pe alta cale.
      if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) {
        return null;
      }
      // updateMany conditionat: tranzitia de status = biletul unic de decontare. Slot
      // atribuit/inchis (retragere, accept) intre citirea de mai sus si scriere → count 0,
      // fara refund (anti dubla decontare, audit 2026-08-23).
      const res = await tx.claimSlot.updateMany({
        where: { id: claimSlotId, status: 'ACTIVE', assignedToUserId: null },
        data: { status: 'CANCELLED_UNASSIGNED', withdrawnAt: new Date() },
      });
      if (res.count === 0) return null;
      await this.credits.refund(
        claim.companyId,
        claim.claimCostCreditsSnapshot,
        'CLAIM_AUTO_CANCEL_UNASSIGNED',
        claimSlotId,
        tx,
      );
      await recomputeRequestStatusAfterClaimChange(tx, claim.requestId);
      return {
        requestId: claim.requestId,
        requestTitle: claim.request.title ?? '',
        companyId: claim.companyId,
      };
    });

    if (result) {
      // L1 (audit 2026-08-23): tintit membrilor firmei (inainte broadcast → invizibil);
      // + request.status_changed broadcast ca marketplace-ul sa vada slotul eliberat.
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: result.companyId },
        select: { userId: true },
      });
      await this.eventBus.publish(
        'claim.withdrawn',
        {
          claimSlotId,
          requestId: result.requestId,
          requestTitle: result.requestTitle,
          reason: 'UNASSIGNED_1H',
          refunded: true,
        },
        members.map((m) => m.userId),
      );
      await this.eventBus.publish('request.status_changed', { requestId: result.requestId });
      this.logger.debug(`claim ${claimSlotId} auto-cancelled (unassigned 1h)`);
    }
  }
}
