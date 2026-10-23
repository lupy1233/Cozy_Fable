import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OutboxService } from '../outbox/outbox.service';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_CLAIM_ASSIGN, QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { scheduleRequestExpiryReminder } from '../requests/request-expiry-reminder';
import {
  ASSIGN_WARNING_BEFORE_DEADLINE_MS,
  ASSIGN_WARNING_JOB,
  REPUBLISH_EXPIRY_WORKING_DAYS,
  REQUEST_SETTLED_STATUSES,
} from './claims.constants';
import {
  claimAlertTargets,
  recomputeRequestStatusAfterClaimChange,
} from './claims.helpers';

export interface ClaimAssignJob {
  claimSlotId: string;
}

// 4.9 — la +1h de la claim, daca slotul e inca ACTIVE si neatribuit:
// auto-cancel (CANCELLED_UNASSIGNED) + refund credite + recalcul status cerere.
// E-admin-platform-44: jobul 'warn-assign' (+30 min) doar avertizeaza OWNER/MANAGER + cine a preluat.
@Processor(QUEUE_CLAIM_ASSIGN)
export class ClaimAssignProcessor extends WorkerHost {
  private readonly logger = new Logger(ClaimAssignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: ClaimSettlementService,
    private readonly eventBus: EventBusService,
    private readonly calendar: BusinessCalendarService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async process(job: Job<ClaimAssignJob>): Promise<void> {
    if (job.name === ASSIGN_WARNING_JOB) return this.warn(job.data.claimSlotId);
    const { claimSlotId } = job.data;
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    const result = await runTx(this.prisma, 'claim', async (tx) => {
      const claim = await tx.claimSlot.findUnique({
        where: { id: claimSlotId },
        include: { request: { select: { status: true, deletedAt: true, title: true } } },
      });
      if (!claim || claim.status !== 'ACTIVE' || claim.assignedToUserId !== null) {
        return null; // a fost atribuit/anulat intre timp
      }
      if (!claim.assignDeadlineAt || Date.now() < claim.assignDeadlineAt.getTime()) return null;
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${claim.requestId} FOR UPDATE`;
      // L0-B: cerere deja atribuita/stearsa → slotul e (sau va fi) inchis pe alta cale.
      if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) {
        return null;
      }
      // Tranzitia conditionata (settle) = biletul unic de decontare. Slot atribuit/inchis
      // (retragere, accept) intre citirea de mai sus si scriere → nedecontat, fara refund
      // (anti dubla decontare, audit 2026-08-23; E-admin-platform-15).
      const settled = await this.settlement.settle(tx, {
        claimSlotId,
        from: ['ACTIVE'],
        where: { assignedToUserId: null },
        to: 'CANCELLED_UNASSIGNED',
        outcome: 'REFUND',
        reason: 'CLAIM_AUTO_CANCEL_UNASSIGNED',
        quotes: 'KEEP',
        slot: claim,
      });
      if (!settled.settled) return null;
      const recompute = await recomputeRequestStatusAfterClaimChange(tx, claim.requestId, {
        republishExpiresAt,
      });
      // L1 (audit 2026-08-23): tintit membrilor firmei (inainte broadcast → invizibil);
      // + request.status_changed broadcast ca marketplace-ul sa vada slotul eliberat.
      const members = await tx.companyMember.findMany({
        where: { companyId: claim.companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `claim.unassigned:${claimSlotId}`,
        'claim.withdrawn',
        {
          claimSlotId,
          requestId: claim.requestId,
          requestTitle: claim.request.title ?? '',
          reason: 'UNASSIGNED_1H',
          refunded: settled.refunded,
        },
        members.map((m) => m.userId),
      );
      await this.outbox.record(tx, `request.unassigned:${claimSlotId}`, 'request.status_changed', { requestId: claim.requestId }, []);

      return {
        requestId: claim.requestId,
        requestTitle: claim.request.title ?? '',
        companyId: claim.companyId,
        republishedExpiresAt: recompute.republishedExpiresAt,
      };
    });

    if (result) {
      // F5: cererea revenita in piata primeste ceas nou de expirare (post-commit)
      if (result.republishedExpiresAt) {
        await this.expirationQueue.add(
          'expire',
          { requestId: result.requestId } satisfies RequestExpirationJob,
          {
            delay: Math.max(0, result.republishedExpiresAt.getTime() - Date.now()),
            jobId: `req-exp-${result.requestId}-${result.republishedExpiresAt.getTime()}`,
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        );
        await scheduleRequestExpiryReminder(this.expirationQueue, this.calendar, result.requestId, result.republishedExpiresAt);
      }
      this.logger.debug(`claim ${claimSlotId} auto-cancelled (unassigned 1h)`);
    }
  }

  // E-admin-platform-44 — warning +30 min (4.9 / D2). Doar notificare: fara lock, fara
  // Serializable, fara bani. No-op daca s-a atribuit/inchis intre timp sau fereastra a trecut.
  private async warn(claimSlotId: string): Promise<void> {
    const claim = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: { select: { status: true, deletedAt: true } } },
    });
    if (!claim || claim.status !== 'ACTIVE' || claim.assignedToUserId !== null) return;
    if (!claim.assignDeadlineAt) return;
    const deadline = claim.assignDeadlineAt.getTime();
    const now = Date.now();
    if (now < deadline - ASSIGN_WARNING_BEFORE_DEADLINE_MS || now >= deadline) return;
    if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) return;
    await runTx(this.prisma, 'write', async (tx) => {
      const targets = await claimAlertTargets(tx, claim, false);
      await this.outbox.record(
        tx,
        `claim.assign_warning:${claimSlotId}`,
        'claim.assign_warning',
        {
          claimSlotId,
          requestId: claim.requestId,
          companyId: claim.companyId,
          assignDeadlineAt: claim.assignDeadlineAt!.toISOString(),
        },
        targets,
      );
    });
    this.logger.debug(`claim ${claimSlotId} assign warning`);
  }
}
