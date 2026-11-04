import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { CreditSettlementReason } from '@marketplace/shared';
import { type RequestStatus } from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_OFFER_EXPIRY_SETTLEMENT, QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { SettingsService } from '../../common/settings/settings.service';
import { ClaimSettlementService, type SettlementCreditOutcome } from '../billing/claim-settlement.service';
import { OutboxService } from '../outbox/outbox.service';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { scheduleRequestExpiryReminder } from '../requests/request-expiry-reminder';
import {
  ACCEPTABLE_REQUEST_STATUSES,
  DEFAULT_EXPIRED_OFFER_AUTOCLOSE_DAYS,
  REPUBLISH_EXPIRY_WORKING_DAYS,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_DAYS,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_ENABLED,
  SETTING_EXPIRED_OFFER_AUTOCLOSE_OUTCOME,
  SETTLEMENT_REASON,
} from './claims.constants';
import { recomputeRequestStatusAfterClaimChange } from './claims.helpers';

export interface OfferExpirySettlementJob {
  quoteId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// motivul din ledger pe rezultatul din setari (literal tipat, nu template string)
const OFFER_EXPIRED_CREDIT_REASON: Record<SettlementCreditOutcome, CreditSettlementReason> = {
  REFUND: 'OFFER_EXPIRED_UNDECIDED_REFUND',
  CONSUME: 'OFFER_EXPIRED_UNDECIDED_CONSUME',
};

// jobId determinist pe (oferta, valid_until al ultimei versiuni) → sweep-ul il poate re-adauga,
// iar o prelungire urmata de o noua expirare produce un job nou (cel vechi iese no-op).
export function offerExpirySettlementJobId(quoteId: string, validUntil: Date): string {
  return `oes-${quoteId}-${validUntil.getTime()}`;
}

export interface AutoCloseSettings {
  days: number;
  outcome: SettlementCreditOutcome;
}

// E-admin-platform-3 — inchiderea automata e ACTIVA doar daca PO a setat explicit
// enabled=true SI un rezultat al creditelor (REFUND/CONSUME). Altfel (implicit: false / UNSET)
// → null = no-op peste tot (procesor, sweep, programare).
export async function readAutoCloseSettings(
  settings: Pick<SettingsService, 'getString' | 'getInt'>,
): Promise<AutoCloseSettings | null> {
  const [enabled, outcome, days] = await Promise.all([
    settings.getString(SETTING_EXPIRED_OFFER_AUTOCLOSE_ENABLED, 'false'),
    settings.getString(SETTING_EXPIRED_OFFER_AUTOCLOSE_OUTCOME, 'UNSET'),
    settings.getInt(SETTING_EXPIRED_OFFER_AUTOCLOSE_DAYS, DEFAULT_EXPIRED_OFFER_AUTOCLOSE_DAYS),
  ]);
  if (enabled !== 'true') return null;
  if (outcome !== 'REFUND' && outcome !== 'CONSUME') return null;
  return { days: Math.max(0, days), outcome };
}

// E-admin-platform-3 — oferta EXPIRED pe care clientul nu a decis-o (nici acceptare, nici
// prelungire ceruta si acordata) N zile dupa valid_until: slotul firmei se inchide
// (CANCELLED_OFFER_EXPIRED), oferta → WITHDRAWN, creditele se deconteaza O SINGURA data
// conform setarii (REFUND/CONSUME), cererea se recalculeaza (inapoi in piata cu ceas nou sau
// CLAIMED_*), ambele parti afla. Lock 3.1 + Serializable; P2034 → retry in proces (runTx
// profil claim), apoi retry BullMQ.
// Nu atinge sloturile cu retragere PENDING_ADMIN_REVIEW (decizia adminului are prioritate).
@Processor(QUEUE_OFFER_EXPIRY_SETTLEMENT)
export class OfferExpirySettlementProcessor extends WorkerHost {
  private readonly logger = new Logger(OfferExpirySettlementProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: ClaimSettlementService,
    private readonly calendar: BusinessCalendarService,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
  ) {
    super();
  }

  async process(job: Job<OfferExpirySettlementJob>): Promise<void> {
    const cfg = await readAutoCloseSettings(this.settings);
    if (!cfg) return; // oprit pana la decizia PO
    const { quoteId } = job.data;
    const head = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { requestId: true },
    });
    if (!head) return;
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);

    const result = await runTx(this.prisma, 'claim', async (tx) => {
      const locked = await tx.$queryRaw<{ status: RequestStatus; deleted_at: Date | null }[]>`
        SELECT status, deleted_at FROM requests WHERE id = ${head.requestId} FOR UPDATE`;
      const req = locked[0];
      if (!req || req.deleted_at !== null || !ACCEPTABLE_REQUEST_STATUSES.includes(req.status)) return null;
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        select: {
          status: true,
          claimSlotId: true,
          companyId: true,
          request: { select: { clientUserId: true } },
          versions: { orderBy: { version: 'desc' }, take: 1, select: { validUntil: true } },
        },
      });
      // prelungita / reofertata intre timp (SENT) sau inchisa pe alta cale → no-op
      if (!quote || quote.status !== 'EXPIRED') return null;
      const latest = quote.versions[0];
      if (!latest || latest.validUntil.getTime() + cfg.days * DAY_MS > Date.now()) return null;

      const settled = await this.settlement.settle(tx, {
        claimSlotId: quote.claimSlotId,
        from: ['OFFER_SENT'],
        to: 'CANCELLED_OFFER_EXPIRED',
        outcome: cfg.outcome,
        reason: OFFER_EXPIRED_CREDIT_REASON[cfg.outcome],
        where: { withdrawals: { none: { status: 'PENDING_ADMIN_REVIEW' } } },
        quotes: 'WITHDRAWN',
      });
      if (!settled.settled) return null;

      const recompute = await recomputeRequestStatusAfterClaimChange(tx, head.requestId, { republishExpiresAt });
      const members = await tx.companyMember.findMany({
        where: { companyId: quote.companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `claim.withdrawn:${quote.claimSlotId}:${SETTLEMENT_REASON.OFFER_EXPIRED_UNDECIDED}`,
        'claim.withdrawn',
        {
          claimSlotId: quote.claimSlotId,
          requestId: head.requestId,
          reason: SETTLEMENT_REASON.OFFER_EXPIRED_UNDECIDED,
          refunded: settled.refunded,
        },
        members.map((m) => m.userId),
      );
      if (quote.request.clientUserId) {
        await this.outbox.record(tx, `quote.expired_closed:${quoteId}`,
          'quote.expired_closed',
          {
            quoteId,
            requestId: head.requestId,
            claimSlotId: quote.claimSlotId,
            companyId: quote.companyId,
            clientUserId: quote.request.clientUserId,
          },
          [quote.request.clientUserId],
        );
      }
      await this.outbox.record(tx, `request.offer-expired-closed:${quote.claimSlotId}`, 'request.status_changed', {
        requestId: head.requestId,
      }, []);
      return { requestId: head.requestId, republishedExpiresAt: recompute.republishedExpiresAt };
    });

    if (!result) return;
    if (result.republishedExpiresAt) {
      const expiresAt = result.republishedExpiresAt;
      await this.expirationQueue
        .add(
          'expire',
          { requestId: result.requestId } satisfies RequestExpirationJob,
          {
            delay: Math.max(0, expiresAt.getTime() - Date.now()),
            jobId: `req-exp-${result.requestId}-${expiresAt.getTime()}`,
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        )
        .catch(() => this.logger.warn(`Expiry scheduling deferred for request ${result.requestId}`));
      await scheduleRequestExpiryReminder(this.expirationQueue, this.calendar, result.requestId, expiresAt);
    }
    this.logger.log(`oferta ${quoteId} expirata fara decizie: slot inchis (${cfg.outcome})`);
  }
}
