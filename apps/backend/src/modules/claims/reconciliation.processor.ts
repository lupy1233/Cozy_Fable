import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_DELIVERY_AUTOCOMPLETE,
  QUEUE_OFFER_EXPIRY_SETTLEMENT,
  QUEUE_PROJECT_DEADLINES,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_RECONCILIATION,
  QUEUE_REQUEST_EXPIRATION,
  QUEUE_SLA_BREACH,
  QUEUE_WITHDRAWAL_REMINDER,
} from '../../infra/queues/queues.module';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import {
  REQUEST_EXPIRY_REMINDER_JOB,
  requestExpiryReminderAt,
  requestExpiryReminderEventKey,
  requestExpiryReminderJobId,
} from '../requests/request-expiry-reminder';
import type { ConsultationExpiryJob } from '../quotes/consultation-expiry.processor';
import type { QuoteValidityJob } from '../quotes/quote-validity.processor';
import type { DeliveryAutocompleteJob } from '../fulfillment/delivery-autocomplete.processor';
import { AUTO_COMPLETE_DAYS, autoCompleteJobId } from '../fulfillment/fulfillment.service';
import {
  DELIVERY_OVERDUE_JOB,
  DELIVERY_REMINDER_JOB,
  PROJECT_ACTIVE_STATUSES,
  overdueAt,
  overdueJobId,
  reminderDue,
  reminderJobId,
  toDateOnly,
  type ProjectDeadlineJob,
} from '../fulfillment/project-deadlines';
import { SettingsService } from '../../common/settings/settings.service';
import { LedgerCheckService } from '../billing/ledger-check.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import {
  offerExpirySettlementJobId,
  readAutoCloseSettings,
  type OfferExpirySettlementJob,
} from './offer-expiry-settlement.processor';
import type { ClaimAssignJob } from './claim-assign.processor';
import type { SlaBreachJob } from './sla-breach.processor';
import {
  ASSIGN_WARNING_BEFORE_DEADLINE_MS,
  ASSIGN_WARNING_JOB,
  DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
  SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
  SLA_GRACE_MS,
  SLA_GRACE_WARNING_JOB,
  SLA_WARNING_BEFORE_MS,
  SLA_WARNING_JOB,
} from './claims.constants';
import {
  assignWarningJobOptions,
  slaBreachJobOptions,
  slaGraceWarningEventKey,
  slaGraceWarningJobOptions,
  slaWarningJobOptions,
} from './claims.helpers';

// Pasul 5 (audit 2026-08-23): SWEEP de reconciliere — Redis era SINGURA sursa a termenelor;
// delayed jobs pierdute (flush/migrare/incident) insemnau ca NIMIC nu mai expira, silentios.
// O data pe ora, sweep-ul compara coloanele materializate (expires_at, assign_deadline_at,
// sla_deadline_at, valid_until, delivered_at, suspended_until) cu ceasul si re-inarmeaza
// joburile scadente. Procesoarele-tinta sunt idempotente (updateMany conditionat + jobId
// determinist) → re-adaugarea unui job deja procesat e un no-op sigur.
// E-admin-platform-44 (ramurile 10-12): avertizarile de termen — reminderul de expirare a cererii
// (expires_at), warning-ul de atribuire (assign_deadline_at) si sla.expiring_soon
// (sla_deadline_at) — re-inarmate doar in fereastra lor si doar daca cheia outbox lipseste.
// E-company-13 (ramura 13): reminderul de la inceputul gratiei (sla_deadline_at trecut, gratia
// inca in curs), aceeasi regula: doar in fereastra lui si doar daca cheia outbox lipseste.
const SWEEP_TAKE = 500;
// fereastra calendaristica ce acopera sigur 2 zile lucratoare + sarbatori (ramura 10)
const REQUEST_REMINDER_LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// E-admin-platform-15: jobul zilnic ledger vs portofel pe aceeasi coada (doar citiri + alerta)
export const LEDGER_CHECK_JOB = 'ledger-check';

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
    private readonly outbox: OutboxService,
    @InjectQueue(QUEUE_WITHDRAWAL_REMINDER) private readonly withdrawalQueue: Queue,
    // E-admin-platform-3: ramurile 8 (oferte expirate fara decizie) si 9 (termene de livrare)
    @InjectQueue(QUEUE_OFFER_EXPIRY_SETTLEMENT) private readonly offerExpiryQueue: Queue<OfferExpirySettlementJob>,
    @InjectQueue(QUEUE_PROJECT_DEADLINES) private readonly projectDeadlinesQueue: Queue<ProjectDeadlineJob>,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    // E-admin-platform-15: verificarea zilnica ledger vs portofel (job 'ledger-check')
    private readonly ledgerCheck: LedgerCheckService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // orar, la :20 (decalat de subscription-expiry); cheie repeat stabila → idempotent la restart
    await this.queue.add(
      'sweep',
      {},
      { repeat: { pattern: '20 * * * *' }, removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    await this.queue.add('sweep', {}, { jobId: 'startup-sweep', removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    // E-admin-platform-15: zilnic la 03:40 Bucuresti (dupa sweep-ul de la :20) + o data la pornire
    await this.queue.add(
      LEDGER_CHECK_JOB,
      {},
      { repeat: { pattern: '40 3 * * *', tz: 'Europe/Bucharest' }, removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    await this.queue.add(LEDGER_CHECK_JOB, {}, { jobId: 'startup-ledger-check', removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  private async rearm(queue: Queue, name: string, data: object, options: JobsOptions): Promise<void> {
    const existing = options.jobId ? await queue.getJob(options.jobId) : null;
    if (existing && await existing.getState() === 'failed') {
      await existing.retry();
      return;
    }
    await queue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...options });
  }

  async process(job: Job): Promise<void> {
    if (job.name === LEDGER_CHECK_JOB) {
      await this.ledgerCheck.runAndAlert(new Date());
      return;
    }
    const now = new Date();
    const counts: Record<string, number> = {};

    // 1. cereri IN_MARKETPLACE cu expires_at depasit
    const expiredRequests = await this.prisma.request.findMany({
      where: { status: 'IN_MARKETPLACE', deletedAt: null, expiresAt: { lt: now } },
      select: { id: true, expiresAt: true },
      take: SWEEP_TAKE,
    });
    for (const r of expiredRequests) {
      await this.rearm(this.expirationQueue,
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
      await this.rearm(this.claimAssignQueue,
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
      await this.rearm(this.slaQueue,'breach', { claimSlotId: c.id }, slaBreachJobOptions(c.id, c.slaDeadlineAt!));
    }
    counts.slaBreach = breached.length;

    // 4. oferte SENT cu ultima versiune peste valid_until
    let staleQuotes = 0;
    let quoteCursor: string | undefined;
    for (;;) {
      const sentQuotes = await this.prisma.quote.findMany({
        where: { status: 'SENT', versions: { some: { validUntil: { lt: now } } } },
        select: { id: true, versions: { select: { id: true, version: true, validUntil: true }, orderBy: { version: 'desc' }, take: 1 } },
        take: SWEEP_TAKE, orderBy: { id: 'asc' },
        ...(quoteCursor ? { cursor: { id: quoteCursor }, skip: 1 } : {}),
      });
      for (const q of sentQuotes) {
        const latest = q.versions[0];
        if (!latest || latest.validUntil.getTime() >= now.getTime()) continue;
        await this.rearm(this.quoteValidityQueue, 'expire', { quoteVersionId: latest.id }, {
          jobId: `qv-${latest.id}-${latest.validUntil.getTime()}`, removeOnComplete: true, removeOnFail: 1000,
        });
        staleQuotes += 1;
      }
      if (sentQuotes.length < SWEEP_TAKE) break;
      quoteCursor = sentQuotes[sentQuotes.length - 1].id;
    }
    counts.quoteValidity = staleQuotes;

    // 5. invitatii la sediu PENDING peste expires_at
    const staleInvites = await this.prisma.physicalConsultationInvite.findMany({
      where: { status: 'PENDING_CLIENT', expiresAt: { lt: now } },
      select: { id: true },
      take: SWEEP_TAKE,
    });
    for (const inv of staleInvites) {
      await this.rearm(this.consultationQueue,
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
      await this.rearm(this.autoCompleteQueue,
        'auto-complete',
        { requestId: r.id },
        { jobId: autoCompleteJobId(r.id, r.deliveredAt!), removeOnComplete: true, removeOnFail: 1000 },
      );
    }
    counts.deliveryAutocomplete = staleDeliveries.length;

    // 7. suspendari expirate (F2): ridica + anunta firma (guard-ul deja nu le mai blocheaza)
    const suspensions = await this.prisma.company.findMany({
      where: { status: 'SUSPENDED', deletedAt: null, suspendedUntil: { lt: now } },
      select: { id: true, name: true, suspendedUntil: true },
      take: SWEEP_TAKE,
    });
    let lifted = 0;
    for (const company of suspensions) {
      const changed = await runTx(this.prisma, 'write', async (tx) => {
        const res = await tx.company.updateMany({
          where: { id: company.id, status: 'SUSPENDED', suspendedUntil: company.suspendedUntil },
          data: { status: 'APPROVED', suspendedAt: null, suspendedUntil: null },
        });
        if (res.count === 0) return false; // ridicata concurent (admin unsuspend)
        const members = await tx.companyMember.findMany({
          where: { companyId: company.id },
          select: { userId: true },
        });
        await this.outbox.record(tx, `company.unsuspended:${company.id}:${company.suspendedUntil?.toISOString()}`,
          'company.unsuspended',
          { companyId: company.id, companyName: company.name },
          members.map((m) => m.userId),
        );
        return true;
      });
      if (changed) lifted += 1;
    }
    counts.suspensionsLifted = lifted;

    let withdrawalCursor: string | undefined;
    let reminderCount = 0;
    for (;;) {
      const pendingWithdrawals = await this.prisma.claimWithdrawal.findMany({
        where: { status: 'PENDING_ADMIN_REVIEW', createdAt: { lte: new Date(now.getTime() - 2 * DAY_MS) } },
        select: { id: true }, take: SWEEP_TAKE, orderBy: { id: 'asc' },
        ...(withdrawalCursor ? { cursor: { id: withdrawalCursor }, skip: 1 } : {}),
      });
      for (const withdrawal of pendingWithdrawals) {
        await this.rearm(this.withdrawalQueue, 'remind', { withdrawalId: withdrawal.id }, { jobId: `wd-rem-${withdrawal.id}`, removeOnComplete: true, removeOnFail: 1000 });
      }
      reminderCount += pendingWithdrawals.length;
      if (pendingWithdrawals.length < SWEEP_TAKE) break;
      withdrawalCursor = pendingWithdrawals[pendingWithdrawals.length - 1].id;
    }
    counts.withdrawalReminder = reminderCount;

    // 8. E-admin-platform-3: oferte EXPIRED fara decizie peste valid_until + N zile (doar cu
    // inchiderea automata ACTIVATA din setari; implicit oprita → ramura nu face nimic)
    counts.offerExpirySettlement = await this.sweepExpiredOffers(now);

    // 9. E-admin-platform-3: reminder de livrare / termen depasit pe proiectele in lucru
    counts.projectDeadlines = await this.sweepProjectDeadlines(now);

    // 10-12. E-admin-platform-44: avertizari de termen (doar notificari, fara bani)
    counts.requestExpiryReminder = await this.sweepRequestExpiryReminders(now);
    counts.claimAssignWarning = await this.sweepAssignWarnings(now);
    counts.slaWarning = await this.sweepSlaWarnings(now);
    // 13. E-company-13: reminderul de la inceputul gratiei (tot doar notificare)
    counts.slaGraceWarning = await this.sweepSlaGraceWarnings(now);

    // Avertizarile (10-13) se re-armeaza normal la fiecare sweep cat timp sunt in fereastra
    // (un job sarit nu scrie cheie in outbox) → debug, ca sa nu inece warn-ul real.
    const NOTICE_KEYS = new Set(['requestExpiryReminder', 'claimAssignWarning', 'slaWarning', 'slaGraceWarning']);
    const entries = Object.entries(counts);
    const repaired = entries.filter(([k, n]) => !NOTICE_KEYS.has(k) && n > 0);
    const notices = entries.filter(([k, n]) => NOTICE_KEYS.has(k) && n > 0);
    if (repaired.length > 0) {
      this.logger.warn(`reconciliere: termene re-inarmate ${JSON.stringify(counts)}`);
    } else if (notices.length > 0) {
      this.logger.debug(`reconciliere: avertizari re-inarmate ${JSON.stringify(Object.fromEntries(notices))}`);
    }
  }

  private async sweepExpiredOffers(now: Date): Promise<number> {
    const autoClose = await readAutoCloseSettings(this.settings);
    if (!autoClose) return 0;
    const cutoff = now.getTime() - autoClose.days * DAY_MS;
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.quote.findMany({
        where: {
          status: 'EXPIRED',
          claimSlot: { status: 'OFFER_SENT' },
          request: { status: { in: ['OFFERS_RECEIVED', 'NEGOTIATION'] }, deletedAt: null },
        },
        select: { id: true, versions: { select: { validUntil: true }, orderBy: { version: 'desc' }, take: 1 } },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const q of rows) {
        const latest = q.versions[0];
        if (!latest || latest.validUntil.getTime() > cutoff) continue;
        await this.rearm(this.offerExpiryQueue, 'settle', { quoteId: q.id }, {
          jobId: offerExpirySettlementJobId(q.id, latest.validUntil), removeOnComplete: true, removeOnFail: 1000,
        });
        count += 1;
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async sweepProjectDeadlines(now: Date): Promise<number> {
    const daysBefore = await this.settings.getInt(
      SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
      DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
    );
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.request.findMany({
        where: {
          status: { in: [...PROJECT_ACTIVE_STATUSES] },
          deletedAt: null,
          quotes: { some: { status: 'ACCEPTED' } },
        },
        select: {
          id: true,
          quotes: {
            where: { status: 'ACCEPTED' },
            take: 1,
            select: { acceptedAt: true, versions: { select: { deliveryDate: true }, orderBy: { version: 'desc' }, take: 1 } },
          },
        },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const r of rows) {
        const winner = r.quotes[0];
        const deliveryDate = toDateOnly(winner?.versions[0]?.deliveryDate);
        if (!winner || !deliveryDate) continue;
        const data: ProjectDeadlineJob = { requestId: r.id, deliveryDate };
        const opts = { removeOnComplete: true, removeOnFail: 1000 } as const;
        if (now.getTime() >= overdueAt(this.calendar, deliveryDate).getTime()) {
          // deja anuntat (cheie outbox determinista) → nu mai re-inarmam la fiecare ora
          if (await this.alreadyRecorded(`project.overdue:${r.id}:${deliveryDate}`)) continue;
          await this.rearm(this.projectDeadlinesQueue, DELIVERY_OVERDUE_JOB, data, { ...opts, jobId: overdueJobId(r.id, deliveryDate) });
          count += 1;
        } else if (reminderDue(this.calendar, deliveryDate, daysBefore, winner.acceptedAt, now.getTime())) {
          if (await this.alreadyRecorded(`project.delivery_reminder:${r.id}:${deliveryDate}`)) continue;
          await this.rearm(this.projectDeadlinesQueue, DELIVERY_REMINDER_JOB, data, { ...opts, jobId: reminderJobId(r.id, deliveryDate) });
          count += 1;
        }
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async sweepRequestExpiryReminders(now: Date): Promise<number> {
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.request.findMany({
        where: {
          status: 'IN_MARKETPLACE',
          deletedAt: null,
          expiresAt: { gt: now, lte: new Date(now.getTime() + REQUEST_REMINDER_LOOKAHEAD_MS) },
        },
        select: { id: true, expiresAt: true },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const r of rows) {
        if (!r.expiresAt) continue;
        const remindAt = requestExpiryReminderAt(this.calendar, r.expiresAt);
        if (now.getTime() < remindAt.getTime()) continue;
        if (await this.alreadyRecorded(requestExpiryReminderEventKey(r.id, r.expiresAt))) continue;
        await this.rearm(this.expirationQueue, REQUEST_EXPIRY_REMINDER_JOB, {
          requestId: r.id,
          expiresAt: r.expiresAt.toISOString(),
          remindAt: remindAt.toISOString(),
        }, { jobId: requestExpiryReminderJobId(r.id, r.expiresAt), removeOnComplete: true, removeOnFail: 1000 });
        count += 1;
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async sweepAssignWarnings(now: Date): Promise<number> {
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.claimSlot.findMany({
        where: {
          status: 'ACTIVE',
          assignedToUserId: null,
          assignDeadlineAt: { gt: now, lte: new Date(now.getTime() + ASSIGN_WARNING_BEFORE_DEADLINE_MS) },
        },
        select: { id: true, assignDeadlineAt: true },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const c of rows) {
        if (!c.assignDeadlineAt) continue;
        if (await this.alreadyRecorded(`claim.assign_warning:${c.id}`)) continue;
        await this.rearm(this.claimAssignQueue, ASSIGN_WARNING_JOB, { claimSlotId: c.id },
          assignWarningJobOptions(c.id, c.assignDeadlineAt));
        count += 1;
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async sweepSlaWarnings(now: Date): Promise<number> {
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.claimSlot.findMany({
        where: {
          status: 'ACTIVE',
          slaPausedAt: null,
          slaDeadlineAt: { gt: now, lte: new Date(now.getTime() + SLA_WARNING_BEFORE_MS) },
        },
        select: { id: true, slaDeadlineAt: true },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const c of rows) {
        if (!c.slaDeadlineAt) continue;
        if (await this.alreadyRecorded(`sla.expiring_soon:${c.id}:${c.slaDeadlineAt.getTime()}`)) continue;
        await this.rearm(this.slaQueue, SLA_WARNING_JOB,
          { claimSlotId: c.id, slaDeadlineAt: c.slaDeadlineAt.toISOString() },
          slaWarningJobOptions(c.id, c.slaDeadlineAt));
        count += 1;
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async sweepSlaGraceWarnings(now: Date): Promise<number> {
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.claimSlot.findMany({
        where: {
          status: 'ACTIVE',
          slaPausedAt: null,
          slaDeadlineAt: { lte: now, gt: new Date(now.getTime() - SLA_GRACE_MS) },
        },
        select: { id: true, slaDeadlineAt: true },
        take: SWEEP_TAKE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const c of rows) {
        if (!c.slaDeadlineAt) continue;
        if (await this.alreadyRecorded(slaGraceWarningEventKey(c.id, c.slaDeadlineAt.getTime()))) continue;
        await this.rearm(this.slaQueue, SLA_GRACE_WARNING_JOB,
          { claimSlotId: c.id, slaDeadlineAt: c.slaDeadlineAt.toISOString() },
          slaGraceWarningJobOptions(c.id, c.slaDeadlineAt));
        count += 1;
      }
      if (rows.length < SWEEP_TAKE) break;
      cursor = rows[rows.length - 1].id;
    }
    return count;
  }

  private async alreadyRecorded(eventKey: string): Promise<boolean> {
    const row = await this.prisma.domainEventOutbox.findUnique({ where: { eventKey }, select: { id: true } });
    return row !== null;
  }
}
