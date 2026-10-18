import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OutboxService } from '../outbox/outbox.service';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_REQUEST_EXPIRATION, QUEUE_SLA_BREACH } from '../../infra/queues/queues.module';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { scheduleRequestExpiryReminder } from '../requests/request-expiry-reminder';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import { PenaltiesService } from '../penalties/penalties.service';
import {
  REPUBLISH_EXPIRY_WORKING_DAYS,
  REQUEST_SETTLED_STATUSES,
  SLA_GRACE_MS,
  SLA_GRACE_WARNING_JOB,
  SLA_WARNING_BEFORE_MS,
  SLA_WARNING_JOB,
  SLA_WARNING_PHASE_GRACE,
} from './claims.constants';
import {
  claimAlertTargets,
  recomputeRequestStatusAfterClaimChange,
  republishAfterMassBreach,
  slaGraceWarningEventKey,
} from './claims.helpers';

export interface SlaBreachJob {
  claimSlotId: string;
  // E-admin-platform-44 / E-company-13 — doar pe joburile 'warn-sla' / 'warn-sla-grace' (ISO):
  // termenul pentru care s-a programat
  slaDeadlineAt?: string;
}

// 4.11 — la sla_deadline_at + 12h grace, daca firma nu a trimis oferta (claim inca ACTIVE):
// ratare SLA → SLA_EXPIRED + consum credite + 3 pct penalizare firma. Daca cererea ramane
// fara claim activ → re-publicare cu ceas nou + excluderea firmelor care au ratat (Î20/D-v6-13).
// E-admin-platform-44: jobul 'warn-sla' (24h inainte de termen) doar avertizeaza — fara bani.
// E-company-13: jobul 'warn-sla-grace' (la termen = inceputul gratiei) la fel, doar notificare
// (sla.expiring_soon cu phase=GRACE + slaBreachAt).
@Processor(QUEUE_SLA_BREACH)
export class SlaBreachProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaBreachProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: ClaimSettlementService,
    private readonly penalties: PenaltiesService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async process(job: Job<SlaBreachJob>): Promise<void> {
    if (job.name === SLA_WARNING_JOB) return this.warn(job.data);
    if (job.name === SLA_GRACE_WARNING_JOB) return this.warnGrace(job.data);
    const { claimSlotId } = job.data;
    const result = await runTx(this.prisma, 'claim', async (tx) => {
      const claim = await tx.claimSlot.findUnique({
        where: { id: claimSlotId },
        include: { request: { select: { status: true, deletedAt: true, title: true } } },
      });
      if (!claim || claim.status !== 'ACTIVE') return null; // oferta trimisa / anulat
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${claim.requestId} FOR UPDATE`;
      // L0-B: cererea a fost deja atribuita/livrata sau stearsa → sloturile nealese s-au
      // inchis la accept/stergere; nicio penalizare/consum pentru un SLA fara obiect.
      if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) {
        return null;
      }
      if (claim.slaPausedAt) return null; // clarificare in curs (SLA pe pauza)
      if (!claim.slaDeadlineAt) return null;
      if (Date.now() < claim.slaDeadlineAt.getTime() + SLA_GRACE_MS) return null; // extins intre timp

      // Tranzitia conditionata (settle): oferta trimisa / retragere / inchidere comisa intre
      // citirea de mai sus si scriere → nedecontat, fara consum/penalizare (anti dubla
      // decontare, audit 2026-08-23). Creditele se consuma definitiv (firma a esuat sa livreze
      // oferta). E-admin-platform-15 (LIVE-11): slot fara RESERVE (demo/vechi) sau portofel
      // deviat → tranzitia + penalizarea se aplica, fara miscare de credite (jobul nu mai pica).
      const settled = await this.settlement.settle(tx, {
        claimSlotId,
        from: ['ACTIVE'],
        to: 'SLA_EXPIRED',
        outcome: 'CONSUME',
        reason: 'SLA_BREACH',
        quotes: 'KEEP',
        slot: claim,
      });
      if (!settled.settled) return null;
      const penalty = await this.penalties.applyPenalty(
        { companyId: claim.companyId, ruleKey: 'SLA_MISS', claimSlotId, reason: 'SLA breach' },
        tx,
      );

      const newExpiry = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
      const republished = await republishAfterMassBreach(tx, claim.requestId, newExpiry);
      if (!republished) await recomputeRequestStatusAfterClaimChange(tx, claim.requestId);
      // L1 (audit 2026-08-23): firma AFLA ca a ratat SLA — clopotel + email TINTIT membrilor
      // (inainte: broadcast aruncat de procesorul de notificari; firma pierdea credite si
      // puncte fara nicio instiintare).
      const members = await tx.companyMember.findMany({
        where: { companyId: claim.companyId },
        select: { userId: true },
      });
      const memberIds = members.map((m) => m.userId);
      await this.outbox.record(tx, `claim.sla:${claimSlotId}`,
        'claim.withdrawn',
        {
          claimSlotId,
          requestId: claim.requestId,
          requestTitle: claim.request.title ?? '',
          reason: 'SLA_EXPIRED',
          refunded: settled.refunded,
        },
        memberIds,
      );
      if (penalty.pointsApplied > 0) {
        await this.outbox.record(tx, `penalty.sla:${claimSlotId}`,
          'penalty.applied',
          {
            companyId: claim.companyId,
            claimSlotId,
            requestId: claim.requestId,
            requestTitle: claim.request.title ?? '',
            ruleKey: 'SLA_MISS',
            points: penalty.pointsApplied,
          },
          memberIds,
        );
      }
      if (penalty.suspended) {
        const company = await tx.company.findUnique({
          where: { id: claim.companyId },
          select: { name: true },
        });
        await this.outbox.record(tx, `suspension.sla:${claimSlotId}`,
          'company.suspended',
          {
            companyId: claim.companyId,
            companyName: company?.name ?? '',
            suspendedUntil: penalty.suspendedUntil?.toISOString() ?? null,
          },
          memberIds,
        );
      }
      await this.outbox.record(tx, `request.sla:${claimSlotId}`, 'request.status_changed', {
        requestId: claim.requestId,
        republished,
      }, []);

      return {
        requestId: claim.requestId,
        requestTitle: claim.request.title ?? '',
        companyId: claim.companyId,
        republished,
        newExpiry,
        penalty,
      };
    });

    if (!result) return;
    if (result.republished) {
      const delay = Math.max(0, result.newExpiry.getTime() - Date.now());
      await this.expirationQueue.add(
        'expire',
        { requestId: result.requestId },
        { delay, jobId: `req-exp-${result.requestId}-${result.newExpiry.getTime()}`, removeOnComplete: true },
      );
      await scheduleRequestExpiryReminder(this.expirationQueue, this.calendar, result.requestId, result.newExpiry);
    }
    this.logger.debug(`claim ${claimSlotId} SLA breach (republished=${result.republished})`);
  }

  // E-admin-platform-44 — sla.expiring_soon: doar notificare catre responsabil + OWNER/MANAGER.
  // NU consuma credite si NU aplica penalizari; fara lock (nu schimba stari). No-op daca oferta
  // a plecat, SLA e pe pauza sau termenul s-a mutat (jobul termenului nou il inlocuieste).
  private async warn(data: SlaBreachJob): Promise<void> {
    const { claimSlotId } = data;
    const claim = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: { select: { status: true, deletedAt: true } } },
    });
    if (!claim || claim.status !== 'ACTIVE' || claim.slaPausedAt || !claim.slaDeadlineAt) return;
    const deadline = claim.slaDeadlineAt.getTime();
    if (!data.slaDeadlineAt || deadline !== Date.parse(data.slaDeadlineAt)) return;
    const now = Date.now();
    if (now < deadline - SLA_WARNING_BEFORE_MS || now >= deadline) return;
    if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) return;
    await runTx(this.prisma, 'write', async (tx) => {
      const targets = await claimAlertTargets(tx, claim, true);
      await this.outbox.record(
        tx,
        `sla.expiring_soon:${claimSlotId}:${deadline}`,
        'sla.expiring_soon',
        {
          claimSlotId,
          requestId: claim.requestId,
          companyId: claim.companyId,
          slaDeadlineAt: claim.slaDeadlineAt!.toISOString(),
        },
        targets,
      );
    });
    this.logger.debug(`claim ${claimSlotId} SLA warning`);
  }

  // E-company-13 — reminder la inceputul gratiei (termen trecut, oferta netrimisa): aceleasi
  // tinte ca warn(), payload cu phase=GRACE + slaBreachAt. Fara lock, fara bani, fara stari.
  // No-op daca oferta a plecat, SLA e pe pauza, termenul s-a mutat sau gratia s-a terminat.
  private async warnGrace(data: SlaBreachJob): Promise<void> {
    const { claimSlotId } = data;
    const claim = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: { select: { status: true, deletedAt: true } } },
    });
    if (!claim || claim.status !== 'ACTIVE' || claim.slaPausedAt || !claim.slaDeadlineAt) return;
    const deadline = claim.slaDeadlineAt.getTime();
    if (!data.slaDeadlineAt || deadline !== Date.parse(data.slaDeadlineAt)) return;
    const now = Date.now();
    if (now < deadline || now >= deadline + SLA_GRACE_MS) return;
    if (claim.request.deletedAt !== null || REQUEST_SETTLED_STATUSES.includes(claim.request.status)) return;
    await runTx(this.prisma, 'write', async (tx) => {
      const targets = await claimAlertTargets(tx, claim, true);
      await this.outbox.record(
        tx,
        slaGraceWarningEventKey(claimSlotId, deadline),
        'sla.expiring_soon',
        {
          claimSlotId,
          requestId: claim.requestId,
          companyId: claim.companyId,
          slaDeadlineAt: claim.slaDeadlineAt!.toISOString(),
          slaBreachAt: new Date(deadline + SLA_GRACE_MS).toISOString(),
          phase: SLA_WARNING_PHASE_GRACE,
        },
        targets,
      );
    });
    this.logger.debug(`claim ${claimSlotId} SLA grace warning`);
  }
}
