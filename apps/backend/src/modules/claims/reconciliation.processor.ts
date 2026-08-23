import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_DELIVERY_AUTOCOMPLETE,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_RECONCILIATION,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
} from '../../infra/queues/queues.module';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import type { ConsultationExpiryJob } from '../quotes/consultation-expiry.processor';
import type { QuoteValidityJob } from '../quotes/quote-validity.processor';
import type { DeliveryAutocompleteJob } from '../fulfillment/delivery-autocomplete.processor';
import { AUTO_COMPLETE_DAYS, autoCompleteJobId } from '../fulfillment/fulfillment.service';
import type { ClaimAssignJob } from './claim-assign.processor';
import type { SlaBreachJob } from './sla-breach.processor';
import { SLA_GRACE_MS } from './claims.constants';
import { slaBreachJobOptions } from './claims.helpers';

// Pasul 5 (audit 2026-08-23): SWEEP de reconciliere — Redis era SINGURA sursa a termenelor;
// delayed jobs pierdute (flush/migrare/incident) insemnau ca NIMIC nu mai expira, silentios.
// O data pe ora, sweep-ul compara coloanele materializate (expires_at, assign_deadline_at,
// sla_deadline_at, valid_until, delivered_at, suspended_until) cu ceasul si re-inarmeaza
// joburile scadente. Procesoarele-tinta sunt idempotente (updateMany conditionat + jobId
// determinist) → re-adaugarea unui job deja procesat e un no-op sigur.
const SWEEP_TAKE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

@Processor(QUEUE_RECONCILIATION)
export class ReconciliationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @InjectQueue(QUEUE_RECONCILIATION) private readonly queue: Queue,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
    @InjectQueue(QUEUE_CLAIM_ASSIGN) private readonly claimAssignQueue: Queue<ClaimAssignJob>,
    @InjectQueue(QUEUE_SLA_BREACH) private readonly slaQueue: Queue<SlaBreachJob>,
    @InjectQueue(QUEUE_QUOTE_VALIDITY) private readonly quoteValidityQueue: Queue<QuoteValidityJob>,
    @InjectQueue(QUEUE_CONSULTATION_EXPIRY) private readonly consultationQueue: Queue<ConsultationExpiryJob>,
    @InjectQueue(QUEUE_DELIVERY_AUTOCOMPLETE) private readonly autoCompleteQueue: Queue<DeliveryAutocompleteJob>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // orar, la :20 (decalat de subscription-expiry); cheie repeat stabila → idempotent la restart
    await this.queue.add(
      'sweep',
      {},
      { repeat: { pattern: '20 * * * *' }, removeOnComplete: true, removeOnFail: true },
    );
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();
    const counts: Record<string, number> = {};

    // 1. cereri IN_MARKETPLACE cu expires_at depasit
    const expiredRequests = await this.prisma.request.findMany({
      where: { status: 'IN_MARKETPLACE', deletedAt: null, expiresAt: { lt: now } },
      select: { id: true, expiresAt: true },
      take: SWEEP_TAKE,
    });
    for (const r of expiredRequests) {
      await this.expirationQueue.add(
        'expire',
        { requestId: r.id },
        { jobId: `req-exp-${r.id}-${r.expiresAt!.getTime()}`, removeOnComplete: true, removeOnFail: 1000 },
      );
    }
    counts.requestExpiration = expiredRequests.length;

    // 2. claim-uri ACTIVE neatribuite cu assign_deadline_at depasit
    const unassigned = await this.prisma.claimSlot.findMany({
      where: { status: 'ACTIVE', assignedToUserId: null, assignDeadlineAt: { lt: now } },
      select: { id: true },
      take: SWEEP_TAKE,
    });
    for (const c of unassigned) {
      await this.claimAssignQueue.add(
        'assign-deadline',
        { claimSlotId: c.id },
        { jobId: `claim-assign-${c.id}`, removeOnComplete: true, removeOnFail: 1000 },
      );
    }
    counts.claimAssign = unassigned.length;

    // 3. claim-uri ACTIVE (fara pauza) cu SLA + grace depasit
    const breached = await this.prisma.claimSlot.findMany({
      where: {
        status: 'ACTIVE',
        slaPausedAt: null,
        slaDeadlineAt: { lt: new Date(now.getTime() - SLA_GRACE_MS) },
      },
      select: { id: true, slaDeadlineAt: true },
      take: SWEEP_TAKE,
    });
    for (const c of breached) {
      await this.slaQueue.add('breach', { claimSlotId: c.id }, slaBreachJobOptions(c.id, c.slaDeadlineAt!));
    }
    counts.slaBreach = breached.length;

    // 4. oferte SENT cu ultima versiune peste valid_until
    const sentQuotes = await this.prisma.quote.findMany({
      where: { status: 'SENT', versions: { some: { validUntil: { lt: now } } } },
      select: { id: true, versions: { select: { id: true, version: true, validUntil: true } } },
      take: SWEEP_TAKE,
    });
    let staleQuotes = 0;
    for (const q of sentQuotes) {
      const latest = q.versions.reduce((a, b) => (b.version > a.version ? b : a));
      if (latest.validUntil.getTime() >= now.getTime()) continue; // extinsa — doar o versiune veche era expirata
      await this.quoteValidityQueue.add(
        'expire',
        { quoteVersionId: latest.id },
        { jobId: `qv-${latest.id}-${latest.validUntil.getTime()}`, removeOnComplete: true, removeOnFail: 1000 },
      );
      staleQuotes += 1;
    }
    counts.quoteValidity = staleQuotes;

    // 5. invitatii la sediu PENDING peste expires_at
    const staleInvites = await this.prisma.physicalConsultationInvite.findMany({
      where: { status: 'PENDING_CLIENT', expiresAt: { lt: now } },
      select: { id: true },
      take: SWEEP_TAKE,
    });
    for (const inv of staleInvites) {
      await this.consultationQueue.add(
        'expire',
        { inviteId: inv.id },
        { jobId: `ci-${inv.id}`, removeOnComplete: true, removeOnFail: 1000 },
      );
    }
    counts.consultationExpiry = staleInvites.length;

    // 6. livrari neconfirmate peste fereastra de 14 zile (D-PO 2026-08-23)
    const staleDeliveries = await this.prisma.request.findMany({
      where: {
        status: 'DELIVERED_BY_COMPANY',
        deletedAt: null,
        deliveredAt: { lt: new Date(now.getTime() - AUTO_COMPLETE_DAYS * DAY_MS) },
      },
      select: { id: true, deliveredAt: true },
      take: SWEEP_TAKE,
    });
    for (const r of staleDeliveries) {
      await this.autoCompleteQueue.add(
        'auto-complete',
        { requestId: r.id },
        { jobId: autoCompleteJobId(r.id, r.deliveredAt!), removeOnComplete: true, removeOnFail: 1000 },
      );
    }
    counts.deliveryAutocomplete = staleDeliveries.length;

    // 7. suspendari expirate (F2): ridica + anunta firma (guard-ul deja nu le mai blocheaza)
    const suspensions = await this.prisma.company.findMany({
      where: { status: 'SUSPENDED', deletedAt: null, suspendedUntil: { lt: now } },
      select: { id: true, name: true },
      take: SWEEP_TAKE,
    });
    let lifted = 0;
    for (const company of suspensions) {
      const res = await this.prisma.company.updateMany({
        where: { id: company.id, status: 'SUSPENDED' },
        data: { status: 'APPROVED', suspendedAt: null, suspendedUntil: null },
      });
      if (res.count === 0) continue; // ridicata concurent (admin unsuspend)
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: company.id },
        select: { userId: true },
      });
      await this.eventBus.publish(
        'company.unsuspended',
        { companyId: company.id, companyName: company.name },
        members.map((m) => m.userId),
      );
      lifted += 1;
    }
    counts.suspensionsLifted = lifted;

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    if (total > 0) {
      this.logger.warn(`reconciliere: termene re-inarmate ${JSON.stringify(counts)}`);
    }
  }
}
