import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_REQUEST_EXPIRATION, QUEUE_SLA_BREACH } from '../../infra/queues/queues.module';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { CreditsService } from '../billing/credits.service';
import { PenaltiesService } from '../penalties/penalties.service';
import {
  REPUBLISH_EXPIRY_WORKING_DAYS,
  REQUEST_SETTLED_STATUSES,
  SLA_GRACE_MS,
} from './claims.constants';
import {
  recomputeRequestStatusAfterClaimChange,
  republishAfterMassBreach,
} from './claims.helpers';

export interface SlaBreachJob {
  claimSlotId: string;
}

// 4.11 — la sla_deadline_at + 12h grace, daca firma nu a trimis oferta (claim inca ACTIVE):
// ratare SLA → SLA_EXPIRED + consum credite + 3 pct penalizare firma. Daca cererea ramane
// fara claim activ → re-publicare cu ceas nou + excluderea firmelor care au ratat (Î20/D-v6-13).
@Processor(QUEUE_SLA_BREACH)
export class SlaBreachProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaBreachProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly penalties: PenaltiesService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
  ) {
    super();
  }

  async process(job: Job<SlaBreachJob>): Promise<void> {
    const { claimSlotId } = job.data;
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claimSlot.findUnique({
        where: { id: claimSlotId },
        include: { request: { select: { status: true, deletedAt: true } } },
      });
      if (!claim || claim.status !== 'ACTIVE') return null; // oferta trimisa / anulat
      // L0-B: cererea a fost deja atribuita/livrata sau stearsa → sloturile nealese s-au
      // inchis la accept/stergere; nicio penalizare/consum pentru un SLA fara obiect.
      if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) {
        return null;
      }
      if (claim.slaPausedAt) return null; // clarificare in curs (SLA pe pauza)
      if (!claim.slaDeadlineAt) return null;
      if (Date.now() < claim.slaDeadlineAt.getTime() + SLA_GRACE_MS) return null; // extins intre timp

      await tx.claimSlot.update({
        where: { id: claimSlotId },
        data: { status: 'SLA_EXPIRED', withdrawnAt: new Date() },
      });
      // credite consumate definitiv (firma a esuat sa livreze oferta).
      await this.credits.consume(
        claim.companyId,
        claim.claimCostCreditsSnapshot,
        'SLA_BREACH',
        claimSlotId,
        tx,
      );
      await this.penalties.applyPenalty(
        { companyId: claim.companyId, ruleKey: 'SLA_MISS', claimSlotId, reason: 'SLA breach' },
        tx,
      );

      const newExpiry = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
      const republished = await republishAfterMassBreach(tx, claim.requestId, newExpiry);
      if (!republished) await recomputeRequestStatusAfterClaimChange(tx, claim.requestId);
      return { requestId: claim.requestId, companyId: claim.companyId, republished, newExpiry };
    });

    if (!result) return;
    if (result.republished) {
      const delay = Math.max(0, result.newExpiry.getTime() - Date.now());
      await this.expirationQueue.add(
        'expire',
        { requestId: result.requestId },
        { delay, jobId: `req-exp-${result.requestId}-${result.newExpiry.getTime()}`, removeOnComplete: true },
      );
    }
    await this.eventBus.publish('claim.withdrawn', { claimSlotId, reason: 'SLA_EXPIRED' });
    await this.eventBus.publish('request.status_changed', {
      requestId: result.requestId,
      republished: result.republished,
    });
    this.logger.debug(`claim ${claimSlotId} SLA breach (republished=${result.republished})`);
  }
}
