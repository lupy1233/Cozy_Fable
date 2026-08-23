import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminWithdrawalItemDto,
  type ClaimWithdrawalDto,
  type RequestWithdrawalInput,
  type ReviewWithdrawalInput,
} from '@marketplace/shared';
import { Prisma, type WithdrawalReasonType } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_REQUEST_EXPIRATION, QUEUE_WITHDRAWAL_REMINDER } from '../../infra/queues/queues.module';
import type { CompanyContext } from '../../common/company-context/company-context';
import { CreditsService } from '../billing/credits.service';
import { PenaltiesService } from '../penalties/penalties.service';
import type { RequestExpirationJob } from '../requests/request-expiration.processor';
import { OPEN_CLAIM_STATUSES, REPUBLISH_EXPIRY_WORKING_DAYS } from './claims.constants';
import { closeOpenQuotesForSlot, recomputeRequestStatusAfterClaimChange } from './claims.helpers';
import type { WithdrawalReminderJob } from './withdrawal-reminder.processor';

type Tx = Prisma.TransactionClient;
const GRACE_30_MIN_MS = 30 * 60 * 1000;
const ADMIN_REMINDER_MS = 48 * 60 * 60 * 1000;

// L0-B — motive fara validare automata posibila in MVP (bounce email / confirmare client in
// chat nu exista): NU se mai auto-aproba → decizie admin, acelasi flux ca CUSTOM (4.15).
const ADMIN_REVIEW_REASONS: WithdrawalReasonType[] = [
  'CUSTOM',
  'CLIENT_CONTACT_INVALID',
  'CLIENT_REQUESTED_CANCELLATION',
];

// 4.15 — anulare/retragere claim: motive auto-validate (refund), voluntar cu gratie 30 min,
// CUSTOM / fara dovada → decizie admin (48h, fara auto-decizie).
@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly penalties: PenaltiesService,
    private readonly eventBus: EventBusService,
    private readonly calendar: BusinessCalendarService,
    @InjectQueue(QUEUE_WITHDRAWAL_REMINDER) private readonly reminderQueue: Queue<WithdrawalReminderJob>,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue<RequestExpirationJob>,
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
    );
  }

  async request(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
    dto: RequestWithdrawalInput,
  ): Promise<ClaimWithdrawalDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: true, chatThread: true },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    if (slot.status !== 'ACTIVE' && slot.status !== 'OFFER_SENT') {
      throw new HttpException(
        { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim is not withdrawable' },
        409,
      );
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
      return this.handleVoluntary(slot, actingUserId);
    }
    // motive auto-validate
    this.assertAutoReasonValidated(dto.reasonType, slot);
    return this.autoApproveRefund(slot, actingUserId, dto.reasonType);
  }

  private assertAutoReasonValidated(
    reason: WithdrawalReasonType,
    slot: {
      createdAt: Date;
      request: { lastEditAt: Date | null };
      chatThread: { lastClientMessageAt: Date | null } | null;
    },
  ): void {
    const now = Date.now();
    if (reason === 'CLIENT_UNRESPONSIVE_48H') {
      const last = slot.chatThread?.lastClientMessageAt?.getTime() ?? slot.createdAt.getTime();
      if (now - last < 48 * 60 * 60 * 1000) {
        throw new HttpException(
          { code: ERROR_CODES.WITHDRAWAL_REASON_NOT_VALIDATED, message: 'Client responded within 48h' },
          409,
        );
      }
      return;
    }
    if (reason === 'REQUEST_MODIFIED_POST_CLAIM') {
      const edited = slot.request.lastEditAt && slot.request.lastEditAt > slot.createdAt;
      if (!edited) {
        throw new HttpException(
          { code: ERROR_CODES.WITHDRAWAL_REASON_NOT_VALIDATED, message: 'Request not modified post-claim' },
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
    const { wd, recompute } = await this.prisma.$transaction(async (tx) => {
      if (!(await this.closeSlot(tx, slot.id, 'WITHDRAWN'))) {
        // slotul a fost inchis/decontat intre verificare si tranzactie → nimic de rambursat
        throw WithdrawalsService.claimNotWithdrawable();
      }
      await this.credits.refund(
        slot.companyId,
        slot.claimCostCreditsSnapshot,
        `WITHDRAWAL_${reasonType}`,
        slot.id,
        tx,
      );
      const w = await tx.claimWithdrawal.create({
        data: { claimSlotId: slot.id, requestedByUserId: actingUserId, reasonType, status: 'AUTO_APPROVED', refunded: true },
      });
      const r = await recomputeRequestStatusAfterClaimChange(tx, slot.requestId, { republishExpiresAt });
      return { wd: w, recompute: r };
    });
    await this.scheduleRepublishExpiry(slot.requestId, recompute.republishedExpiresAt);
    await this.notifyWithdrawn(slot, reasonType, true);
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
  ): Promise<ClaimWithdrawalDto> {
    const withinGrace = Date.now() - slot.createdAt.getTime() < GRACE_30_MIN_MS;
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    const { wd, penalty, recompute } = await this.prisma.$transaction(async (tx) => {
      if (!(await this.closeSlot(tx, slot.id, 'WITHDRAWN_VOLUNTARY'))) {
        // slot deja inchis (dublu request / decontat pe alta cale) → fara refund/consum dublu
        throw WithdrawalsService.claimNotWithdrawable();
      }
      let penaltyResult = null;
      if (withinGrace) {
        // refund integral + 0 penalizare (misclick / razgandire rapida, Î18)
        await this.credits.refund(slot.companyId, slot.claimCostCreditsSnapshot, 'WITHDRAWAL_VOLUNTARY_GRACE', slot.id, tx);
      } else {
        // dupa gratie: fara refund → creditele rezervate se CONSUMA definitiv (altfel raman
        // RESERVED la infinit in portofel, L0-B) + 2 puncte penalizare firma (4.12)
        await this.credits.consume(slot.companyId, slot.claimCostCreditsSnapshot, 'WITHDRAWAL_VOLUNTARY_LATE', slot.id, tx);
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
          refunded: withinGrace,
        },
      });
      const r = await recomputeRequestStatusAfterClaimChange(tx, slot.requestId, { republishExpiresAt });
      return { wd: w, penalty: penaltyResult, recompute: r };
    });
    await this.scheduleRepublishExpiry(slot.requestId, recompute.republishedExpiresAt);
    await this.notifyWithdrawn(slot, 'VOLUNTARY_NO_REASON', withinGrace);
    // L1 (audit 2026-08-23): penalizarea/suspendarea se comunica firmei dupa commit.
    if (penalty && penalty.pointsApplied > 0) {
      const memberIds = await this.companyMemberIds(slot.companyId);
      await this.eventBus.publish(
        'penalty.applied',
        {
          companyId: slot.companyId,
          claimSlotId: slot.id,
          requestId: slot.requestId,
          requestTitle: slot.request.title ?? '',
          ruleKey: 'VOLUNTARY_WITHDRAWAL',
          points: penalty.pointsApplied,
        },
        memberIds,
      );
      if (penalty.suspended) {
        const company = await this.prisma.company.findUnique({
          where: { id: slot.companyId },
          select: { name: true },
        });
        await this.eventBus.publish(
          'company.suspended',
          {
            companyId: slot.companyId,
            companyName: company?.name ?? '',
            suspendedUntil: penalty.suspendedUntil?.toISOString() ?? null,
          },
          memberIds,
        );
      }
    }
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
    const wd = await this.prisma.claimWithdrawal.create({
      data: { claimSlotId, requestedByUserId: actingUserId, reasonType, status: 'PENDING_ADMIN_REVIEW', customReason },
    });
    await this.reminderQueue.add(
      'remind',
      { withdrawalId: wd.id },
      { delay: ADMIN_REMINDER_MS, jobId: `wd-rem-${wd.id}`, removeOnComplete: true },
    );
    await this.eventBus.publish('request.status_changed', { requestId, withdrawalPending: true });
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
      include: { claimSlot: { include: { request: { select: { title: true } } } } },
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
    if (dto.approve && !OPEN_CLAIM_STATUSES.includes(wd.claimSlot.status)) {
      throw new HttpException(
        { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim already closed; reject instead' },
        409,
      );
    }
    const republishExpiresAt = this.calendar.addWorkingDays(new Date(), REPUBLISH_EXPIRY_WORKING_DAYS);
    let republishedExpiresAt: Date | null = null;
    const updated = await this.prisma.$transaction(async (tx) => {
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
        if (!(await this.closeSlot(tx, wd.claimSlotId, 'WITHDRAWN'))) {
          throw new HttpException(
            { code: ERROR_CODES.CLAIM_NOT_WITHDRAWABLE, message: 'Claim already closed; reject instead' },
            409,
          );
        }
        await this.credits.refund(
          wd.claimSlot.companyId,
          wd.claimSlot.claimCostCreditsSnapshot,
          'WITHDRAWAL_ADMIN_APPROVED',
          wd.claimSlotId,
          tx,
        );
        const r = await recomputeRequestStatusAfterClaimChange(tx, wd.claimSlot.requestId, {
          republishExpiresAt,
        });
        republishedExpiresAt = r.republishedExpiresAt;
      }
      return tx.claimWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    });
    await this.scheduleRepublishExpiry(wd.claimSlot.requestId, republishedExpiresAt);
    // L1 (audit 2026-08-23): firma AFLA decizia (aprobare SAU respingere) — clopotel + email
    // tintit membrilor; inainte respingerea nu publica absolut nimic.
    await this.eventBus.publish(
      'withdrawal.decided',
      {
        withdrawalId,
        claimSlotId: wd.claimSlotId,
        requestId: wd.claimSlot.requestId,
        requestTitle: wd.claimSlot.request.title ?? '',
        approved: dto.approve,
      },
      await this.companyMemberIds(wd.claimSlot.companyId),
    );
    if (dto.approve) {
      await this.eventBus.publish('request.status_changed', { requestId: wd.claimSlot.requestId });
    }
    return this.toDto(updated);
  }

  // Inchide slotul cu statusul dat; daca avea oferta trimisa (OFFER_SENT), ofertele deschise
  // devin WITHDRAWN si thread-ul read-only — clientul nu le mai poate accepta (L0-B).
  // updateMany CONDITIONAT pe status deschis: tranzitia e "biletul" unic de decontare —
  // doar cine o reuseste (count===1) misca creditele. Slot inchis intre timp pe alta cale
  // (dublu request, accept, SLA, stergere) → false, apelantul NU deconteaza (anti dubla
  // rambursare — invarianta 3.1 / IMPACT credite pct. 2).
  private async closeSlot(
    tx: Tx,
    claimSlotId: string,
    status: 'WITHDRAWN' | 'WITHDRAWN_VOLUNTARY',
  ): Promise<boolean> {
    const res = await tx.claimSlot.updateMany({
      where: { id: claimSlotId, status: { in: OPEN_CLAIM_STATUSES } },
      data: { status, withdrawnAt: new Date() },
    });
    if (res.count === 0) return false;
    await closeOpenQuotesForSlot(tx, claimSlotId, 'WITHDRAWN');
    return true;
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

  private async companyMemberIds(companyId: string): Promise<string[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // L1 (audit 2026-08-23): claim.withdrawn TINTIT membrilor firmei (inainte broadcast →
  // procesorul de notificari il arunca); + broadcast request.status_changed pt. marketplace.
  private async notifyWithdrawn(
    slot: { id: string; companyId: string; requestId: string; request: { title: string | null } },
    reason: string,
    refunded: boolean,
  ): Promise<void> {
    await this.eventBus.publish(
      'claim.withdrawn',
      {
        claimSlotId: slot.id,
        requestId: slot.requestId,
        requestTitle: slot.request.title ?? '',
        reason,
        refunded,
      },
      await this.companyMemberIds(slot.companyId),
    );
    await this.eventBus.publish('request.status_changed', { requestId: slot.requestId });
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
