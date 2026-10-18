import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  WITHDRAWAL_REASON_TYPES,
  type CreditSettlementReason,
  type AdminWithdrawalItemDto,
  type ClaimWithdrawalDto,
  type ClaimWithdrawalPreviewDto,
  type ClaimWithdrawalReasonPreviewDto,
  type RequestWithdrawalInput,
  type ReviewWithdrawalInput,
  type WithdrawalNotEligibleReason,
} from '@marketplace/shared';
import { Prisma, type RequestStatus, type WithdrawalReasonType } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_REQUEST_EXPIRATION, QUEUE_WITHDRAWAL_REMINDER } from '../../infra/queues/queues.module';
import type { CompanyContext } from '../../common/company-context/company-context';
import {
  ClaimSettlementService,
  type SettleResult,
  type SettlementCreditOutcome,
} from '../billing/claim-settlement.service';
import { OutboxService } from '../outbox/outbox.service';
import { lockIdempotentOperation, saveIdempotentResult } from '../../common/idempotency/idempotent-operation';
import { PenaltiesService } from '../penalties/penalties.service';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { scheduleRequestExpiryReminder } from '../requests/request-expiry-reminder';
import {
  CLIENT_UNRESPONSIVE_MS,
  OPEN_CLAIM_STATUSES,
  REPUBLISH_EXPIRY_WORKING_DAYS,
  REQUEST_SETTLED_STATUSES,
  VOLUNTARY_WITHDRAWAL_GRACE_MS,
} from './claims.constants';
import { recomputeRequestStatusAfterClaimChange } from './claims.helpers';
import type { WithdrawalReminderJob } from './withdrawal-reminder.processor';

type Tx = Prisma.TransactionClient;
const ADMIN_REMINDER_MS = 48 * 60 * 60 * 1000;

// L0-B — motive fara validare automata posibila in MVP (bounce email / confirmare client in
// chat nu exista): NU se mai auto-aproba → decizie admin, acelasi flux ca CUSTOM (4.15).
const ADMIN_REVIEW_REASONS: WithdrawalReasonType[] = [
  'CUSTOM',
  'CLIENT_CONTACT_INVALID',
  'CLIENT_REQUESTED_CANCELLATION',
];

// E-company-3: semnalele din care se valideaza motivele automate (incarcate de loadEligibilitySignals).
// lastFirmOutreachAt = ultimul mesaj de chat al firmei sau ultima clarificare ceruta;
// lastClientActivityAt = ultimul mesaj al clientului sau ultimul raspuns la o clarificare;
// offerSentAfterEdit = firma a trimis o versiune de oferta dupa ultima modificare a cererii.
export type UnresponsiveSignals = {
  lastFirmOutreachAt: Date | null;
  lastClientActivityAt: Date | null;
  offerSentAfterEdit: boolean;
};

export type AutoReasonEligibility = {
  eligible: boolean;
  eligibleFrom: Date | null;
  notEligibleReason: WithdrawalNotEligibleReason | null;
};

// E-company-6: eligibilitatea motivelor auto-validate (4.15), pura — folosita si la
// retragere (assertAutoReasonValidated) si la previzualizare, ca UI-ul si serverul sa coincida.
// eligibleFrom = momentul de la care CLIENT_UNRESPONSIVE_48H devine eligibil (doar daca inca nu e).
// E-company-3: "clientul nu raspunde" se dovedeste doar daca firma i-a scris in aplicatie si
// clientul tace de 48h de la acel mesaj; simpla trecere a 48h de la claim nu mai ajunge
// (altfel orice claim devenea rambursabil gratuit dupa 2 zile). REQUEST_MODIFIED_POST_CLAIM
// ramane valid doar pana cand firma oferteaza pe cererea modificata (a acceptat schimbarea).
export function autoReasonEligibility(
  reason: WithdrawalReasonType,
  slot: { createdAt: Date; request: { lastEditAt: Date | null } },
  signals: UnresponsiveSignals,
  now: number,
): AutoReasonEligibility {
  if (reason === 'CLIENT_UNRESPONSIVE_48H') {
    const out = signals.lastFirmOutreachAt;
    if (!out || (signals.lastClientActivityAt && signals.lastClientActivityAt >= out)) {
      return { eligible: false, eligibleFrom: null, notEligibleReason: 'FIRM_MESSAGE_REQUIRED' };
    }
    const from = out.getTime() + CLIENT_UNRESPONSIVE_MS;
    if (now >= from) return { eligible: true, eligibleFrom: null, notEligibleReason: null };
    return { eligible: false, eligibleFrom: new Date(from), notEligibleReason: 'WAITING_48H' };
  }
  if (reason === 'REQUEST_MODIFIED_POST_CLAIM') {
    const edited = !!slot.request.lastEditAt && slot.request.lastEditAt > slot.createdAt;
    if (!edited) return { eligible: false, eligibleFrom: null, notEligibleReason: 'REQUEST_NOT_EDITED' };
    if (signals.offerSentAfterEdit) {
      return { eligible: false, eligibleFrom: null, notEligibleReason: 'OFFER_SENT_AFTER_EDIT' };
    }
    return { eligible: true, eligibleFrom: null, notEligibleReason: null };
  }
  return { eligible: false, eligibleFrom: null, notEligibleReason: null };
}

const latestDate = (...dates: (Date | null | undefined)[]): Date | null =>
  dates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);

// E-admin-platform-15 — motivul din ledger pentru retragerile auto-validate (harta exhaustiva;
// motivele admin/voluntar au caile lor, orice alt motiv aici e o eroare de programare).
export function autoWithdrawalCreditReason(reasonType: WithdrawalReasonType): CreditSettlementReason {
  switch (reasonType) {
    case 'CLIENT_UNRESPONSIVE_48H':
      return 'WITHDRAWAL_CLIENT_UNRESPONSIVE_48H';
    case 'REQUEST_MODIFIED_POST_CLAIM':
      return 'WITHDRAWAL_REQUEST_MODIFIED_POST_CLAIM';
    default:
      throw new Error(`Motiv de retragere fara decontare automata: ${reasonType}`);
  }
}

// 4.15 — anulare/retragere claim: motive auto-validate (refund), voluntar cu gratie 30 min,
// CUSTOM / fara dovada → decizie admin (48h, fara auto-decizie).
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: ClaimSettlementService,
    private readonly penalties: PenaltiesService,
    private readonly eventBus: EventBusService,
    private readonly calendar: BusinessCalendarService,
    @InjectQueue(QUEUE_WITHDRAWAL_REMINDER) private readonly reminderQueue: Queue<WithdrawalReminderJob>,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
    private readonly outbox: OutboxService,
  ) {}

  // Pasul 5 (F5): cererea revenita IN_MARKETPLACE dupa retragere primeste ceas NOU de
  // expirare — jobul se programeaza DUPA commit, cu expiresAt-ul scris de recompute.
  private async scheduleRepublishExpiry(requestId: string, expiresAt: Date | null): Promise<void> {
    if (!expiresAt) return;
    await this.expirationQueue.add(
      'expire',
      { requestId } satisfies RequestExpirationJob,
      {
        delay: Math.max(0, expiresAt.getTime() - Date.now()),
        jobId: `req-exp-${requestId}-${expiresAt.getTime()}`,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    ).catch(() => this.logger.warn(`Expiry scheduling deferred for request ${requestId}`));
    await scheduleRequestExpiryReminder(this.expirationQueue, this.calendar, requestId, expiresAt);
  }

  async request(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
    dto: RequestWithdrawalInput,
  ): Promise<ClaimWithdrawalDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: {
        request: true,
        chatThread: true,
        quotes: { where: { status: 'ACCEPTED' }, select: { id: true } },
      },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    // E-company-6: un singur "acum" pentru gratie → rezultatul verificat = rezultatul aplicat
    const now = Date.now();
    // E-company-1: rolul se verifica INAINTE de stare (angajatul nu afla starea cererii)
    this.assertMayWithdraw(ctx, actingUserId, slot, now);
    if (slot.status !== 'ACTIVE' && slot.status !== 'OFFER_SENT') {
      throw new HttpException(
        { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim is not withdrawable' },
        409,
      );
    }
    if (WithdrawalsService.isSettled(slot.request.status, slot.quotes)) {
      throw WithdrawalsService.claimNotWithdrawable();
    }
    const existingPending = await this.prisma.claimWithdrawal.findFirst({
      where: { claimSlotId, status: 'PENDING_ADMIN_REVIEW' },
    });
    if (existingPending) {
      throw new HttpException(
        { code: ERROR_CODES.WITHDRAWAL_ALREADY_PENDING, message: 'A withdrawal is already pending' },
        409,
      );
    }

    if (ADMIN_REVIEW_REASONS.includes(dto.reasonType)) {
      return this.handleAdminReview(
        slot.id,
        slot.requestId,
        actingUserId,
        dto.reasonType,
        dto.customReason ?? null,
      );
    }
    if (dto.reasonType === 'VOLUNTARY_NO_REASON') {
      const withinGrace = now - slot.createdAt.getTime() < VOLUNTARY_WITHDRAWAL_GRACE_MS;
      const outcome = withinGrace ? 'REFUND' : 'CONSUME_AND_PENALTY';
      // E-company-6: firma a confirmat alt rezultat (ex. gratia a expirat intre dialog si click)
      // → refuz fara efecte, INAINTE de orice tranzactie; fara expectedOutcome = comportament vechi.
      if (dto.expectedOutcome && dto.expectedOutcome !== outcome) {
        throw new HttpException(
          { code: ERROR_CODES.WITHDRAWAL_OUTCOME_CHANGED, message: 'Withdrawal outcome changed', details: { outcome } },
          409,
        );
      }
      return this.handleVoluntary(slot, actingUserId, withinGrace);
    }
    // motive auto-validate — semnalele se citesc doar pe aceasta ramura
    const signals = await this.loadEligibilitySignals(slot);
    this.assertAutoReasonValidated(dto.reasonType, slot, signals, now);
    return this.autoApproveRefund(slot, actingUserId, dto.reasonType);
  }

  // E-company-6: previzualizare read-only a consecintelor retragerii, per motiv. Fara tranzactie,
  // fara scrieri (GET — trebuie sa ramana sigur si pe slotul standby). Serverul ramane autoritar
  // la POST /withdraw; blockedCode reproduce ordinea verificarilor din request().
  async preview(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
  ): Promise<ClaimWithdrawalPreviewDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: {
        request: true,
        chatThread: true,
        quotes: { where: { status: 'ACCEPTED' }, select: { id: true } },
      },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    const now = Date.now();
    const [pending, penalty, signals] = await Promise.all([
      this.prisma.claimWithdrawal.findFirst({ where: { claimSlotId, status: 'PENDING_ADMIN_REVIEW' } }),
      this.penalties.previewCompanyPenalty(slot.companyId, 'VOLUNTARY_WITHDRAWAL'),
      this.loadEligibilitySignals(slot),
    ]);

    let blockedCode: ClaimWithdrawalPreviewDto['blockedCode'] = null;
    if (!this.mayWithdraw(ctx, actingUserId, slot, now)) {
      blockedCode = 'FORBIDDEN';
    } else if (
      (slot.status !== 'ACTIVE' && slot.status !== 'OFFER_SENT') ||
      WithdrawalsService.isSettled(slot.request.status, slot.quotes)
    ) {
      blockedCode = 'CLAIM_NOT_WITHDRAWABLE';
    } else if (pending) {
      blockedCode = 'WITHDRAWAL_ALREADY_PENDING';
    }

    const graceEndsAtMs = slot.createdAt.getTime() + VOLUNTARY_WITHDRAWAL_GRACE_MS;
    const withinGrace = now < graceEndsAtMs;
    const reasons: ClaimWithdrawalReasonPreviewDto[] = WITHDRAWAL_REASON_TYPES.map((reasonType) => {
      if (ADMIN_REVIEW_REASONS.includes(reasonType)) {
        return { reasonType, outcome: 'ADMIN_REVIEW', eligibleFrom: null, notEligibleReason: null };
      }
      if (reasonType === 'VOLUNTARY_NO_REASON') {
        return {
          reasonType,
          outcome: withinGrace ? 'REFUND' : 'CONSUME_AND_PENALTY',
          eligibleFrom: null,
          notEligibleReason: null,
        };
      }
      const e = autoReasonEligibility(reasonType, slot, signals, now);
      return {
        reasonType,
        outcome: e.eligible ? 'REFUND' : 'NOT_ELIGIBLE',
        eligibleFrom: e.eligibleFrom?.toISOString() ?? null,
        notEligibleReason: e.notEligibleReason,
      };
    });

    return {
      claimSlotId: slot.id,
      blockedCode,
      claimCostCredits: slot.claimCostCreditsSnapshot,
      graceEndsAt: new Date(graceEndsAtMs).toISOString(),
      withinGrace,
      offerWillBeWithdrawn: slot.status === 'OFFER_SENT',
      penalty: {
        lateWithdrawalPoints: penalty.points,
        activePoints: penalty.activePoints,
        threshold: penalty.threshold,
        suspensionMonths: penalty.suspensionMonths,
      },
      reasons,
      pendingWithdrawal: pending ? this.toDto(pending) : null,
      computedAt: new Date(now).toISOString(),
    };
  }

  // E-company-1: OWNER/MANAGER oricand (sub rezerva starii); ceilalti membri doar pe slotul
  // propriu (claimer sau atribuit) si doar in gratia de 30 min (Î18, ceas de perete).
  private mayWithdraw(
    ctx: CompanyContext,
    actingUserId: string,
    slot: { claimedByUserId: string; assignedToUserId: string | null; createdAt: Date },
    now: number,
  ): boolean {
    if (ctx.memberRole === 'OWNER' || ctx.memberRole === 'MANAGER') return true;
    const own = slot.claimedByUserId === actingUserId || slot.assignedToUserId === actingUserId;
    const withinGrace = now - slot.createdAt.getTime() < VOLUNTARY_WITHDRAWAL_GRACE_MS;
    return own && withinGrace;
  }

  private assertMayWithdraw(
    ctx: CompanyContext,
    actingUserId: string,
    slot: { claimedByUserId: string; assignedToUserId: string | null; createdAt: Date },
    now: number,
  ): void {
    if (this.mayWithdraw(ctx, actingUserId, slot, now)) return;
    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the owner or a manager can withdraw this claim',
    });
  }

  // E-company-3: citiri indexate (messages.chat_thread_id, clarification_requests.claim_slot_id,
  // quote_versions.quote_id) — fara scrieri, sigur si pe GET-ul de previzualizare.
  // Firma trebuie sa-i fi scris clientului in aplicatie (mesaj sau clarificare) ca
  // CLIENT_UNRESPONSIVE_48H sa fie dovedit; altfel rambursarea la 48h era gratuita pe orice claim.
  private async loadEligibilitySignals(slot: {
    id: string;
    createdAt: Date;
    request: { clientUserId: string | null; lastEditAt: Date | null };
    chatThread: { id: string; lastClientMessageAt: Date | null } | null;
  }): Promise<UnresponsiveSignals> {
    const clientUserId = slot.request.clientUserId;
    const lastEditAt = slot.request.lastEditAt;
    const edited = !!lastEditAt && lastEditAt > slot.createdAt;
    const [firmMessage, clarification, versionAfterEdit] = await Promise.all([
      slot.chatThread
        ? this.prisma.message.findFirst({
            where: {
              chatThreadId: slot.chatThread.id,
              ...(clientUserId ? { senderUserId: { not: clientUserId } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
        : null,
      this.prisma.clarificationRequest.findFirst({
        where: { claimSlotId: slot.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, answeredAt: true },
      }),
      // editarile post-claim au loc doar inainte de orice oferta (4.3) → o versiune trimisa
      // dupa last_edit_at inseamna ca firma a ofertat pe cererea modificata
      edited && lastEditAt
        ? this.prisma.quoteVersion.findFirst({
            where: { quote: { claimSlotId: slot.id, status: { not: 'DRAFT' } }, sentAt: { gt: lastEditAt } },
            select: { id: true },
          })
        : null,
    ]);
    return {
      lastFirmOutreachAt: latestDate(firmMessage?.createdAt, clarification?.createdAt),
      // o singura clarificare poate fi PENDING → answeredAt-ul celei mai noi e ultimul raspuns
      lastClientActivityAt: latestDate(slot.chatThread?.lastClientMessageAt, clarification?.answeredAt),
      offerSentAfterEdit: !!versionAfterEdit,
    };
  }

  private assertAutoReasonValidated(
    reason: WithdrawalReasonType,
    slot: { createdAt: Date; request: { lastEditAt: Date | null } },
    signals: UnresponsiveSignals,
    now: number,
  ): void {
    const e = autoReasonEligibility(reason, slot, signals, now);
    const details = { notEligibleReason: e.notEligibleReason, eligibleFrom: e.eligibleFrom?.toISOString() ?? null };
    if (reason === 'CLIENT_UNRESPONSIVE_48H') {
      if (!e.eligible) {
        throw new HttpException(
          {
            code: ERROR_CODES.WITHDRAWAL_REASON_NOT_VALIDATED,
            message: 'Client unresponsiveness not proven (firm message 48h+ old, unanswered)',
            details,
          },
          409,
        );
      }
      return;
    }
    if (reason === 'REQUEST_MODIFIED_POST_CLAIM') {
      if (!e.eligible) {
        throw new HttpException(
          {
            code: ERROR_CODES.WITHDRAWAL_REASON_NOT_VALIDATED,
            message: 'Request not modified post-claim, or an offer was sent after the change',
            details,
          },
          409,
        );
      }
      return;
    }
    // CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION nu ajung aici (decizie admin).
    throw new HttpException(
      { code: ERROR_CODES.WITHDRAWAL_REASON_NOT_VALIDATED, message: 'Reason requires admin review' },
      409,
    );
  }

  private async autoApproveRefund(
    slot: {
      id: string;
      companyId: string;
      requestId: string;
      claimCostCreditsSnapshot: number;
      request: { title: string | null };
    },
    actingUserId: string,
    reasonType: WithdrawalReasonType,
  ): Promise<ClaimWithdrawalDto> {
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    const { wd, recompute } = await runTx(this.prisma, 'claim', async (tx) => {
      await lockIdempotentOperation(tx);
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${slot.requestId} FOR UPDATE`;
      const settled = await this.closeSlot(tx, slot, 'WITHDRAWN', 'REFUND', autoWithdrawalCreditReason(reasonType));
      if (!settled.settled) {
        // slotul a fost inchis/decontat intre verificare si tranzactie → nimic de rambursat
        throw WithdrawalsService.claimNotWithdrawable();
      }
      const w = await tx.claimWithdrawal.create({
        data: {
          claimSlotId: slot.id,
          requestedByUserId: actingUserId,
          reasonType,
          status: 'AUTO_APPROVED',
          refunded: settled.refunded,
        },
      });
      const r = await recomputeRequestStatusAfterClaimChange(tx, slot.requestId, { republishExpiresAt });
      await this.notifyWithdrawn(tx, slot, reasonType, settled.refunded);
      await saveIdempotentResult(tx, this.toDto(w));
      return { wd: w, recompute: r };
    });
    await this.scheduleRepublishExpiry(slot.requestId, recompute.republishedExpiresAt);
    return this.toDto(wd);
  }

  private async handleVoluntary(
    slot: {
      id: string;
      companyId: string;
      requestId: string;
      claimCostCreditsSnapshot: number;
      createdAt: Date;
      request: { title: string | null };
    },
    actingUserId: string,
    // E-company-6: calculat o singura data in request() (acelasi rezultat ca cel verificat)
    withinGrace: boolean,
  ): Promise<ClaimWithdrawalDto> {
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    const { wd, recompute } = await runTx(this.prisma, 'claim', async (tx) => {
      await lockIdempotentOperation(tx);
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${slot.requestId} FOR UPDATE`;
      // in gratie: refund integral + 0 penalizare (misclick / razgandire rapida, Î18);
      // dupa gratie: fara refund → creditele rezervate se CONSUMA definitiv (altfel raman
      // RESERVED la infinit in portofel, L0-B) + 2 puncte penalizare firma (4.12)
      const settled = await this.closeSlot(
        tx,
        slot,
        'WITHDRAWN_VOLUNTARY',
        withinGrace ? 'REFUND' : 'CONSUME',
        withinGrace ? 'WITHDRAWAL_VOLUNTARY_GRACE' : 'WITHDRAWAL_VOLUNTARY_LATE',
      );
      if (!settled.settled) {
        // slot deja inchis (dublu request / decontat pe alta cale) → fara refund/consum dublu
        throw WithdrawalsService.claimNotWithdrawable();
      }
      let penaltyResult = null;
      if (!withinGrace) {
        penaltyResult = await this.penalties.applyPenalty(
          { companyId: slot.companyId, ruleKey: 'VOLUNTARY_WITHDRAWAL', claimSlotId: slot.id, reason: 'Voluntary withdrawal after grace' },
          tx,
        );
      }
      const w = await tx.claimWithdrawal.create({
        data: {
          claimSlotId: slot.id,
          requestedByUserId: actingUserId,
          reasonType: 'VOLUNTARY_NO_REASON',
          status: 'AUTO_APPROVED',
          refunded: settled.refunded,
        },
      });
      const r = await recomputeRequestStatusAfterClaimChange(tx, slot.requestId, { republishExpiresAt });
      await this.notifyWithdrawn(tx, slot, 'VOLUNTARY_NO_REASON', settled.refunded);
      // L1 (audit 2026-08-23): intentia de notificare se salveaza atomic; livrarea are loc dupa commit.
      if (penaltyResult && penaltyResult.pointsApplied > 0) {
        const memberIds = await this.companyMemberIds(slot.companyId, tx);
        await this.outbox.record(tx, `penalty.withdrawal:${w.id}`,
          'penalty.applied',
          {
            companyId: slot.companyId,
            claimSlotId: slot.id,
            requestId: slot.requestId,
            requestTitle: slot.request.title ?? '',
            ruleKey: 'VOLUNTARY_WITHDRAWAL',
            points: penaltyResult.pointsApplied,
          },
          memberIds,
        );
        if (penaltyResult.suspended) {
          const company = await tx.company.findUnique({
            where: { id: slot.companyId },
            select: { name: true },
          });
          await this.outbox.record(tx, `suspension.withdrawal:${w.id}`,
            'company.suspended',
            {
              companyId: slot.companyId,
              companyName: company?.name ?? '',
              suspendedUntil: penaltyResult.suspendedUntil?.toISOString() ?? null,
            },
            memberIds,
          );
        }
      }
      await saveIdempotentResult(tx, this.toDto(w));
      return { wd: w, recompute: r };
    });
    await this.scheduleRepublishExpiry(slot.requestId, recompute.republishedExpiresAt);
    return this.toDto(wd);
  }

  private async handleAdminReview(
    claimSlotId: string,
    requestId: string,
    actingUserId: string,
    reasonType: WithdrawalReasonType,
    customReason: string | null,
  ): Promise<ClaimWithdrawalDto> {
    // slotul ramane ocupat pana la decizia adminului; reminder la 48h.
    const wd = await runTx(this.prisma, 'claim', async (tx) => {
      await lockIdempotentOperation(tx);
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const currentSlot = await tx.claimSlot.findUnique({
        where: { id: claimSlotId },
        select: {
          status: true,
          request: { select: { status: true } },
          quotes: { where: { status: 'ACCEPTED' }, select: { id: true } },
        },
      });
      if (
        !currentSlot ||
        !OPEN_CLAIM_STATUSES.includes(currentSlot.status) ||
        WithdrawalsService.isSettled(currentSlot.request.status, currentSlot.quotes)
      ) {
        throw WithdrawalsService.claimNotWithdrawable();
      }
      const pending = await tx.claimWithdrawal.findFirst({ where: { claimSlotId, status: 'PENDING_ADMIN_REVIEW' } });
      if (pending) throw new HttpException({ code: ERROR_CODES.WITHDRAWAL_ALREADY_PENDING, message: 'A withdrawal is already pending' }, 409);
      const row = await tx.claimWithdrawal.create({ data: { claimSlotId, requestedByUserId: actingUserId, reasonType, status: 'PENDING_ADMIN_REVIEW', customReason } });
      await this.outbox.record(tx, `withdrawal.pending:${row.id}`, 'request.status_changed', { requestId, withdrawalPending: true }, []);
      await saveIdempotentResult(tx, this.toDto(row));
      return row;
    });
    await this.reminderQueue.add(
      'remind',
      { withdrawalId: wd.id },
      { delay: ADMIN_REMINDER_MS, jobId: `wd-rem-${wd.id}`, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    ).catch(() => this.logger.warn(`Withdrawal reminder scheduling deferred for ${wd.id}`));
    return this.toDto(wd);
  }

  // --- admin ---
  async adminListPending(): Promise<AdminWithdrawalItemDto[]> {
    const rows = await this.prisma.claimWithdrawal.findMany({
      where: { status: 'PENDING_ADMIN_REVIEW' },
      orderBy: { createdAt: 'asc' },
      include: { claimSlot: { include: { company: true, request: true } } },
    });
    return rows.map((w) => ({
      id: w.id,
      claimSlotId: w.claimSlotId,
      companyName: w.claimSlot.company.name,
      requestTitle: w.claimSlot.request.title ?? '',
      reasonType: w.reasonType,
      customReason: w.customReason,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async adminReview(
    adminUserId: string,
    withdrawalId: string,
    dto: ReviewWithdrawalInput,
  ): Promise<ClaimWithdrawalDto> {
    const wd = await this.prisma.claimWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        claimSlot: {
          include: {
            request: { select: { title: true, status: true } },
            quotes: { where: { status: 'ACCEPTED' }, select: { id: true } },
          },
        },
      },
    });
    if (!wd) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Withdrawal not found' });
    }
    if (wd.status !== 'PENDING_ADMIN_REVIEW') {
      throw new HttpException(
        { code: ERROR_CODES.WITHDRAWAL_ALREADY_DECIDED, message: 'Withdrawal already decided' },
        409,
      );
    }
    // slotul a fost intre timp inchis pe alta cale (accept pe alta oferta, SLA, stergere
    // cerere) → creditele s-au decontat acolo; aprobarea ar face refund dublu → 409.
    // E-company-1: la fel daca slotul a CASTIGAT (cerere decontata / oferta ACCEPTED) —
    // respingerea ramane permisa ca adminul sa poata goli coada.
    if (
      dto.approve &&
      (!OPEN_CLAIM_STATUSES.includes(wd.claimSlot.status) ||
        WithdrawalsService.isSettled(wd.claimSlot.request.status, wd.claimSlot.quotes))
    ) {
      throw new HttpException(
        { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim already closed; reject instead' },
        409,
      );
    }
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    let republishedExpiresAt: Date | null = null;
    const updated = await runTx(this.prisma, 'claim', async (tx) => {
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${wd.claimSlot.requestId} FOR UPDATE`;
      // Decizia se ia O SINGURA data: updateMany conditionat pe PENDING_ADMIN_REVIEW —
      // doi admini / dublu-click concurent → al doilea vede count 0 → 409, fara refund dublu.
      const decided = await tx.claimWithdrawal.updateMany({
        where: { id: withdrawalId, status: 'PENDING_ADMIN_REVIEW' },
        data: {
          status: dto.approve ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED',
          refunded: dto.approve,
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
          adminNote: dto.adminNote ?? null,
        },
      });
      if (decided.count === 0) {
        throw new HttpException(
          { code: ERROR_CODES.WITHDRAWAL_ALREADY_DECIDED, message: 'Withdrawal already decided' },
          409,
        );
      }
      if (dto.approve) {
        // Slot decontat intre timp pe alta cale (accept/SLA/stergere) → 409 cu rollback:
        // retragerea ramane PENDING (adminul respinge in schimb) si NU se face refund dublu.
        const settled = await this.closeSlot(
          tx,
          {
            id: wd.claimSlotId,
            companyId: wd.claimSlot.companyId,
            requestId: wd.claimSlot.requestId,
            claimCostCreditsSnapshot: wd.claimSlot.claimCostCreditsSnapshot,
          },
          'WITHDRAWN',
          'REFUND',
          'WITHDRAWAL_ADMIN_APPROVED',
        );
        if (!settled.settled) {
          throw new HttpException(
            { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim already closed; reject instead' },
            409,
          );
        }
        // E-admin-platform-15: flag-ul urmeaza banii (slot fara RESERVE / portofel deviat)
        if (!settled.refunded) {
          await tx.claimWithdrawal.update({ where: { id: withdrawalId }, data: { refunded: false } });
        }
        const r = await recomputeRequestStatusAfterClaimChange(tx, wd.claimSlot.requestId, {
          republishExpiresAt,
        });
        republishedExpiresAt = r.republishedExpiresAt;
      }
      // L1 (audit 2026-08-23): firma AFLA decizia (aprobare SAU respingere) — clopotel + email
      // tintit membrilor; inainte respingerea nu publica absolut nimic.
      await this.outbox.record(tx, `withdrawal.decided:${withdrawalId}`,
        'withdrawal.decided',
        {
          withdrawalId,
          claimSlotId: wd.claimSlotId,
          requestId: wd.claimSlot.requestId,
          requestTitle: wd.claimSlot.request.title ?? '',
          approved: dto.approve,
        },
        await this.companyMemberIds(wd.claimSlot.companyId, tx),
      );
      if (dto.approve) {
        await this.outbox.record(tx, `request.withdrawal-decided:${withdrawalId}`, 'request.status_changed', { requestId: wd.claimSlot.requestId }, []);
      }
      return tx.claimWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    });
    await this.scheduleRepublishExpiry(wd.claimSlot.requestId, republishedExpiresAt);
    return this.toDto(updated);
  }

  // Inchide slotul cu statusul dat si deconteaza rezervarea (ClaimSettlementService.settle);
  // daca avea oferta trimisa (OFFER_SENT), ofertele deschise devin WITHDRAWN si thread-ul
  // read-only — clientul nu le mai poate accepta (L0-B). Tranzitia CONDITIONATA pe status
  // deschis e "biletul" unic de decontare — doar cine o reuseste misca creditele. Slot inchis
  // intre timp pe alta cale (dublu request, accept, SLA, stergere) → settled false, apelantul
  // arunca 409 (anti dubla rambursare — invarianta 3.1 / IMPACT credite pct. 2).
  // E-company-1: filtrele pe relatii (cerere nedecontata + nicio oferta ACCEPTED) sunt
  // evaluate atomic in acelasi statement, sub FOR UPDATE → castigatorul nu poate fi inchis.
  private closeSlot(
    tx: Tx,
    slot: { id: string; companyId: string; requestId: string; claimCostCreditsSnapshot: number },
    status: 'WITHDRAWN' | 'WITHDRAWN_VOLUNTARY',
    outcome: SettlementCreditOutcome,
    reason: CreditSettlementReason,
  ): Promise<SettleResult> {
    return this.settlement.settle(tx, {
      claimSlotId: slot.id,
      from: OPEN_CLAIM_STATUSES,
      where: {
        request: { status: { notIn: REQUEST_SETTLED_STATUSES } },
        quotes: { none: { status: 'ACCEPTED' } },
      },
      to: status,
      outcome,
      reason,
      quotes: 'WITHDRAWN',
      slot: {
        companyId: slot.companyId,
        requestId: slot.requestId,
        claimCostCreditsSnapshot: slot.claimCostCreditsSnapshot,
      },
    });
  }

  // E-company-1: dupa accept castigatorul nu mai poate retrage (refund pe proiect castigat); iesirea post-accept = flux dedicat
  private static isSettled(
    requestStatus: RequestStatus | undefined,
    acceptedQuotes: { id: string }[] | undefined,
  ): boolean {
    return (
      (!!requestStatus && REQUEST_SETTLED_STATUSES.includes(requestStatus)) ||
      (acceptedQuotes?.length ?? 0) > 0
    );
  }

  private static claimNotWithdrawable(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim is not withdrawable' },
      409,
    );
  }

  async listForClaim(ctx: CompanyContext, claimSlotId: string): Promise<ClaimWithdrawalDto[]> {
    const slot = await this.prisma.claimSlot.findUnique({ where: { id: claimSlotId } });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    const rows = await this.prisma.claimWithdrawal.findMany({
      where: { claimSlotId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((w) => this.toDto(w));
  }

  private async companyMemberIds(companyId: string, db: Tx = this.prisma): Promise<string[]> {
    const members = await db.companyMember.findMany({
      where: { companyId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // L1 (audit 2026-08-23): claim.withdrawn TINTIT membrilor firmei (inainte broadcast →
  // procesorul de notificari il arunca); + broadcast request.status_changed pt. marketplace.
  private async notifyWithdrawn(
    tx: Tx,
    slot: { id: string; companyId: string; requestId: string; request: { title: string | null } },
    reason: string,
    refunded: boolean,
  ): Promise<void> {
    await this.outbox.record(tx, `claim.withdrawn:${slot.id}:${reason}`,
      'claim.withdrawn',
      {
        claimSlotId: slot.id,
        requestId: slot.requestId,
        requestTitle: slot.request.title ?? '',
        reason,
        refunded,
      },
      await this.companyMemberIds(slot.companyId, tx),
    );
    await this.outbox.record(tx, `request.withdrawn:${slot.id}:${reason}`, 'request.status_changed', { requestId: slot.requestId }, []);
  }

  private toDto(w: {
    id: string;
    claimSlotId: string;
    reasonType: WithdrawalReasonType;
    status: 'AUTO_APPROVED' | 'PENDING_ADMIN_REVIEW' | 'ADMIN_APPROVED' | 'ADMIN_REJECTED';
    customReason: string | null;
    refunded: boolean;
    adminNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }): ClaimWithdrawalDto {
    return {
      id: w.id,
      claimSlotId: w.claimSlotId,
      reasonType: w.reasonType,
      status: w.status,
      customReason: w.customReason,
      refunded: w.refunded,
      adminNote: w.adminNote,
      reviewedAt: w.reviewedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    };
  }
}
