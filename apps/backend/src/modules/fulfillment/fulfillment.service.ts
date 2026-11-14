import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  EXECUTION_STAGES,
  type AdminDisputeItemDto,
  type ClientFulfillmentDto,
  type CompanyCompletionDto,
  type CreateReviewInput,
  type ExecutionStage,
  type ExecutionStageDto,
  type ResolveDisputeInput,
  type ReviewDto,
} from '@marketplace/shared';
import { Prisma, type RequestStatus } from '@prisma/client';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { OutboxService } from '../outbox/outbox.service';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { QUEUE_DELIVERY_AUTOCOMPLETE } from '../../infra/queues/queues.module';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import type { CompanyContext } from '../../common/company-context/company-context';
import type { DeliveryAutocompleteJob } from './delivery-autocomplete.processor';
import { SettingsService } from '../../common/settings/settings.service';
import { readClaimContactAccessSettings, resolveClaimContextAccess } from '../quotes/claim-context-access';

// Decizia PO 2026-08-23 (pasul 5, F1): livrarea neconfirmata de client se confirma
// AUTOMAT la 14 zile calendaristice de la delivered_at — altfel creditele castigatorului
// ramaneau RESERVED pe veci si recenzia era imposibila.
export const AUTO_COMPLETE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function autoCompleteJobId(requestId: string, deliveredAt: Date): string {
  return `auto-complete-${requestId}-${deliveredAt.getTime()}`;
}

type CaseReader = Pick<Prisma.TransactionClient, 'requestProjectCase'>;

// e2-1 (PO 2026-11-13, completeaza D-L1-1): ceasul de 14 zile e OPRIT cat timp proiectul are
// un caz OPEN; dupa ce adminul inchide cazul, termenul REPORNESTE de la resolved_at (cea mai
// recenta inchidere de dupa livrare). Intoarce momentul de start al ceasului sau null (oprit).
export async function autoCompleteClockStart(
  db: CaseReader,
  requestId: string,
  deliveredAt: Date,
): Promise<Date | null> {
  const open = await db.requestProjectCase.findFirst({ where: { requestId, status: 'OPEN' }, select: { id: true } });
  if (open) return null;
  const lastResolved = await db.requestProjectCase.findFirst({
    where: { requestId, resolvedAt: { gte: deliveredAt } },
    orderBy: { resolvedAt: 'desc' },
    select: { resolvedAt: true },
  });
  return lastResolved?.resolvedAt && lastResolved.resolvedAt > deliveredAt ? lastResolved.resolvedAt : deliveredAt;
}

export function autoCompleteDue(clockStart: Date | null, now: number = Date.now()): boolean {
  return !!clockStart && now >= clockStart.getTime() + AUTO_COMPLETE_DAYS * DAY_MS;
}

// e1-3 (PO 2026-11-13): cheia de setare + prima zi in care firma poate marca livrarea.
export const SETTING_DELIVERY_MIN_DAYS_AFTER_ACCEPT = 'delivery_min_days_after_accept';
export function earliestDeliveryAt(acceptedAt: Date | null, minDays: number): Date | null {
  if (!acceptedAt || minDays <= 0) return null;
  return new Date(acceptedAt.getTime() + minDays * DAY_MS);
}

// e1-2: etapele cererii (mereu toate 4, in ordinea EXECUTION_STAGES)
export const EXECUTION_STAGE_EDITABLE_STATUSES: RequestStatus[] = ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY'];
// e1-1 + review m4: starile in care clientul primeste contactul si datele firmei castigatoare
export const CLIENT_CONTACT_STATUSES: RequestStatus[] = ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED'];

type ContactUser = { name: string; email: string; phone: string | null; deletedAt: Date | null; blockedAt: Date | null; anonymizedAt: Date | null };
function isActiveUser(u: ContactUser | null | undefined): u is ContactUser {
  return !!u && !u.deletedAt && !u.blockedAt && !u.anonymizedAt;
}

// Sprint 8 — livrare → COMPLETED (cu consum credite castigator) + review + dispute (4.18).
@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settlement: ClaimSettlementService,
    @InjectQueue(QUEUE_DELIVERY_AUTOCOMPLETE)
    private readonly autoCompleteQueue: Queue<DeliveryAutocompleteJob>,
    private readonly outbox: OutboxService,
    // injectat de Nest (modul global); implicitul tine compatibile constructiile manuale din
    // harness-urile de test (src/test/money-services.ts) — SettingsService citeste direct din DB
    private readonly settings: SettingsService = new SettingsService(prisma),
  ) {}

  // Firma castigatoare marcheaza livrarea (ACCEPTED → DELIVERED_BY_COMPANY).
  // E-company-1: doar OWNER/MANAGER (rolul in service pt. testabilitate — mesajul
  // CompanyManagerGuard e specific facturarii).
  async markDelivered(ctx: CompanyContext, requestId: string): Promise<{ status: string }> {
    if (ctx.memberRole !== 'OWNER' && ctx.memberRole !== 'MANAGER') {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Only the owner or a manager can mark delivery' });
    }
    const quote = await this.prisma.quote.findFirst({
      where: { requestId, companyId: ctx.companyId, status: 'ACCEPTED' },
      include: { company: { select: { name: true } }, claimSlot: { select: { status: true } } },
    });
    if (!quote) {
      throw new ForbiddenException({ code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'No accepted offer for your company' });
    }
    if (quote.claimSlot.status !== 'OFFER_SENT') {
      throw FulfillmentService.winnerNotOpen();
    }
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || (request.status !== 'ACCEPTED' && request.status !== 'IN_EXECUTION')) {
      throw new HttpException(
        { code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'Request not in a deliverable state' },
        409,
      );
    }
    const minDays = await this.deliveryMinDays();
    const deliveredAt = new Date();
    await runTx(this.prisma, 'write', async (tx) => {
      // E-company-1: acelasi lock ca retragerile; castigatorul trebuie sa fie inca OFFER_SENT (altfel completeDelivered nu mai consuma creditele)
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const open = await tx.claimSlot.count({ where: { id: quote.claimSlotId, status: 'OFFER_SENT' } });
      if (open === 0) throw FulfillmentService.winnerNotOpen();
      // e1-3 (PO 2026-11-13): "livrat" doar dupa N zile de la acceptare (0 = fara limita),
      // verificat sub acelasi lock. accepted_at nu se mai schimba dupa acceptare.
      const earliest = earliestDeliveryAt(quote.acceptedAt, minDays);
      if (earliest && deliveredAt.getTime() < earliest.getTime()) {
        throw new HttpException(
          {
            code: ERROR_CODES.DELIVERY_TOO_EARLY,
            message: 'Delivery can be marked only after the minimum number of days since acceptance',
            details: { earliestDeliveryAt: earliest.toISOString() },
          },
          409,
        );
      }
      const changed = await tx.request.updateMany({
        where: { id: requestId, status: { in: ['ACCEPTED', 'IN_EXECUTION'] }, deletedAt: null },
        data: { status: 'DELIVERED_BY_COMPANY', deliveredAt },
      });
      if (changed.count === 0) throw new HttpException({ code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'Request not in a deliverable state' }, 409);
      // L1 (audit 2026-08-23): clientul AFLA ca trebuie sa confirme livrarea (clopotel + email)
      // — inainte broadcastul se arunca si recenzia ramanea blocata pe veci.
      // Guard pe clientUserId nullable: FARA tinte publish-ul ar deveni broadcast (aruncat).
      if (request.clientUserId) {
        await this.outbox.record(tx, `delivery.marked:${requestId}`,
          'delivery.marked',
          {
            requestId,
            requestTitle: request.title ?? '',
            companyId: ctx.companyId,
            companyName: quote.company.name,
            clientUserId: request.clientUserId,
          },
          [request.clientUserId],
        );
      }
      await this.outbox.record(tx, `request.delivered:${requestId}`, 'request.status_changed', { requestId, status: 'DELIVERED_BY_COMPANY' }, []);

    });
    // Pasul 5 (D-PO 2026-08-23): ceasul de auto-confirmare — daca clientul nu confirma in
    // 14 zile, workerul finalizeaza automat (consuma creditele castigatorului + deblocheaza
    // recenzia). jobId determinist pe delivered_at → sweep-ul de reconciliere il poate re-adauga.
    await this.autoCompleteQueue.add(
      'auto-complete',
      { requestId } satisfies DeliveryAutocompleteJob,
      {
        delay: AUTO_COMPLETE_DAYS * DAY_MS,
        jobId: autoCompleteJobId(requestId, deliveredAt),
        removeOnComplete: true,
        removeOnFail: 1000,
        attempts: 3, backoff: { type: 'exponential', delay: 2000 },
      },
    ).catch(() => this.logger.warn(`Auto-completion scheduling deferred for request ${requestId}`));
    return { status: 'DELIVERED_BY_COMPANY' };
  }

  private static winnerNotOpen(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'Winning claim is no longer open' },
      409,
    );
  }

  // Clientul confirma livrarea → COMPLETED + consum credite castigator + slot COMPLETED.
  async confirmDelivery(userId: string, requestId: string): Promise<{ status: string }> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    if (request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    if (request.status !== 'DELIVERED_BY_COMPANY') {
      throw new HttpException(
        { code: ERROR_CODES.COMPLETION_NOT_ALLOWED, message: 'Request not delivered yet' },
        409,
      );
    }
    const result = await this.completeDelivered(requestId, false);
    if (!result.completed) {
      // decontat intre timp pe cealalta cale (auto-complete) → nu consumam de doua ori
      throw new HttpException(
        { code: ERROR_CODES.COMPLETION_NOT_ALLOWED, message: 'Request not delivered yet' },
        409,
      );
    }
    // best-effort: anuleaza ceasul de auto-confirmare (procesorul e oricum no-op pe COMPLETED)
    if (request.deliveredAt) {
      await this.autoCompleteQueue
        .remove(autoCompleteJobId(requestId, request.deliveredAt))
        .catch(() => undefined);
    }
    return { status: 'COMPLETED' };
  }

  // Workerul de auto-confirmare (D-PO 2026-08-23, pasul 5): la 14 zile calendaristice de la
  // livrare, daca clientul nu a confirmat. Idempotent — gardele reale sunt in completeDelivered.
  async autoCompleteDelivered(requestId: string): Promise<boolean> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.deletedAt || request.status !== 'DELIVERED_BY_COMPANY') return false;
    if (!request.deliveredAt || Date.now() < request.deliveredAt.getTime() + AUTO_COMPLETE_DAYS * DAY_MS) {
      return false; // re-livrare cu ceas nou intre timp / job vechi
    }
    // e2-1: raport deschis → ceas oprit; inchis de admin → termenul curge de la inchidere
    if (!autoCompleteDue(await autoCompleteClockStart(this.prisma, requestId, request.deliveredAt))) {
      return false;
    }
    const result = await this.completeDelivered(requestId, true);
    if (!result.completed) return false;
    this.logger.log(`request ${requestId} auto-COMPLETED dupa ${AUTO_COMPLETE_DAYS} zile de la livrare`);
    return true;
  }

  // Tranzitia DELIVERED_BY_COMPANY → COMPLETED = biletul de decontare (audit 2026-08-23):
  // updateMany conditionat pe status — doar calea care reuseste (count===1) consuma creditele
  // castigatorului. Inchide race-ul client-confirm vs auto-complete (dublu consum).
  private async completeDelivered(requestId: string, autoCompleted: boolean): Promise<
    { completed: false } | { completed: true; winner: { companyId: string; claimSlotId: string } | null }
  > {
    return runTx(this.prisma, 'claim', async (tx) => {
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const request = await tx.request.findUnique({ where: { id: requestId } });
      if (!request || (autoCompleted && (!request.deliveredAt || Date.now() < request.deliveredAt.getTime() + AUTO_COMPLETE_DAYS * DAY_MS))) return { completed: false as const };
      // e2-1: re-verificat SUB lock (deschiderea cazului ia acelasi FOR UPDATE pe cerere)
      if (autoCompleted && !autoCompleteDue(await autoCompleteClockStart(tx, requestId, request.deliveredAt!))) {
        return { completed: false as const };
      }
      const res = await tx.request.updateMany({
        where: { id: requestId, status: 'DELIVERED_BY_COMPANY', deletedAt: null },
        // e2-2: completed_at = baza ferestrei de raportare in garantie
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (res.count === 0) return { completed: false as const };
      const winning = await tx.quote.findFirst({ where: { requestId, status: 'ACCEPTED' } });
      let winner: { companyId: string; claimSlotId: string } | null = null;
      if (winning) {
        // E-admin-platform-15: settle() = tranzitia conditionata OFFER_SENT → COMPLETED (fara
        // withdrawnAt) + exact un CONSUME pe RESERVE-ul din ledger
        const closed = await this.settlement.settle(tx, {
          claimSlotId: winning.claimSlotId,
          from: ['OFFER_SENT'],
          to: 'COMPLETED',
          outcome: 'CONSUME',
          reason: 'COMPLETED',
          quotes: 'KEEP',
        });
        if (closed.settled) {
          winner = { companyId: closed.slot.companyId, claimSlotId: closed.slot.id };
        }
      }
      await this.notifyCompleted(tx, requestId, request.title ?? '', winner, autoCompleted, request.clientUserId);
      return { completed: true as const, winner };
    });
  }

  private async notifyCompleted(
    tx: Prisma.TransactionClient,
    requestId: string,
    requestTitle: string,
    winner: { companyId: string; claimSlotId: string } | null,
    autoCompleted: boolean,
    clientUserId: string | null,
  ): Promise<void> {
    // firma afla ca lucrarea e finalizata (clopotel, tintit membrilor)
    if (winner) {
      const members = await tx.companyMember.findMany({
        where: { companyId: winner.companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `delivery.confirmed:${requestId}`,
        'delivery.confirmed',
        { requestId, requestTitle, claimSlotId: winner.claimSlotId, autoCompleted },
        members.map((m) => m.userId),
      );
    }
    // la auto-confirmare, clientul afla ca fereastra s-a inchis si poate lasa recenzie
    if (autoCompleted && clientUserId) {
      await this.outbox.record(tx, `delivery.autocompleted:${requestId}`, 'delivery.autocompleted', { requestId, requestTitle }, [clientUserId]);
    }
    await this.outbox.record(tx, `request.completed:${requestId}`, 'request.status_changed', { requestId, status: 'COMPLETED' }, []);
  }

  // Clientul lasa review dupa COMPLETED; sub 3★ → dispute OPEN + request DISPUTED (4.18).
  async createReview(userId: string, requestId: string, dto: CreateReviewInput): Promise<ReviewDto> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    if (request.status !== 'COMPLETED' && request.status !== 'DISPUTED') {
      throw new HttpException(
        { code: ERROR_CODES.REVIEW_NOT_ALLOWED_YET, message: 'Review allowed only after completion' },
        409,
      );
    }
    const existing = await this.prisma.review.findUnique({ where: { requestId } });
    if (existing) {
      throw new HttpException(
        { code: ERROR_CODES.REVIEW_ALREADY_SUBMITTED, message: 'Review already submitted' },
        409,
      );
    }
    const winning = await this.prisma.quote.findFirst({ where: { requestId, status: 'ACCEPTED' } });
    if (!winning) {
      throw new HttpException(
        { code: ERROR_CODES.REVIEW_NOT_ALLOWED_YET, message: 'No accepted offer to review' },
        409,
      );
    }
    const disputed = dto.rating < 3;
    const review = await runTx(this.prisma, 'write', async (tx) => {
      const r = await tx.review.create({
        data: {
          requestId,
          companyId: winning.companyId,
          clientUserId: userId,
          rating: dto.rating,
          comment: dto.comment || null,
        },
      });
      if (disputed) {
        await tx.reviewDispute.create({ data: { reviewId: r.id } });
        await tx.request.update({ where: { id: requestId }, data: { status: 'DISPUTED' } });
      }
      // L1 (audit 2026-08-23): firma AFLA ca a primit o recenzie (clopotel, tintit membrilor).
      const members = await tx.companyMember.findMany({
        where: { companyId: winning.companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `review.created:${r.id}`,
        'review.created',
        {
          requestId,
          requestTitle: request.title ?? '',
          claimSlotId: winning.claimSlotId,
          rating: dto.rating,
          disputed,
        },
        members.map((m) => m.userId),
      );
      // Pasul 5 (audit 2026-08-23): adminul AFLA de disputa noua (clopotel, /admin/disputes).
      if (disputed) {
        const admins = await tx.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true },
        });
        await this.outbox.record(tx, `dispute.opened:${r.id}`,
          'dispute.opened',
          { requestId, requestTitle: request.title ?? '', rating: dto.rating },
          admins.map((a) => a.id),
        );
      }
      await this.outbox.record(tx, `request.reviewed:${r.id}`, 'request.status_changed', {
        requestId,
        status: disputed ? 'DISPUTED' : 'COMPLETED',
        reviewed: true,
      }, []);

      return r;
    });
    return this.toReviewDto(review, disputed);
  }

  async getReviewForClient(userId: string, requestId: string): Promise<ReviewDto | null> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    const review = await this.prisma.review.findUnique({
      where: { requestId },
      include: { dispute: true },
    });
    return review ? this.toReviewDto(review, !!review.dispute) : null;
  }

  // e2 pasul 4: fisa firmei castigatoare (IDOR → 404). Review m5: aceleasi reguli de acces ca
  // fisa de lucru (resolveClaimContextAccess): vizibilitate non-FULL → 404; textele clientului
  // (comentariul recenziei, nota raportului) doar cand fisa ar arata si ea datele clientului.
  async getCompletionForCompany(
    ctx: CompanyContext,
    actingUserId: string,
    requestId: string,
  ): Promise<CompanyCompletionDto> {
    const winning = await this.prisma.quote.findFirst({
      where: { requestId, status: 'ACCEPTED', companyId: ctx.companyId },
      select: {
        id: true,
        acceptedAt: true,
        claimSlot: {
          select: { status: true, createdAt: true, updatedAt: true, claimedByUserId: true, assignedToUserId: true },
        },
      },
    });
    const request = winning
      ? await this.prisma.request.findUnique({
          where: { id: requestId },
          select: { id: true, status: true, deliveredAt: true, completedAt: true, deletedAt: true },
        })
      : null;
    if (!winning || !request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    const [revealPolicy, retentionDays] = await readClaimContactAccessSettings(this.settings);
    const access = resolveClaimContextAccess({
      slotStatus: winning.claimSlot.status,
      requestDeletedAt: request.deletedAt,
      slotCreatedAt: winning.claimSlot.createdAt,
      slotUpdatedAt: winning.claimSlot.updatedAt,
      requestDeliveredAt: request.deliveredAt,
      claimedByUserId: winning.claimSlot.claimedByUserId,
      assignedToUserId: winning.claimSlot.assignedToUserId,
      memberRole: ctx.memberRole,
      actingUserId,
      revealPolicy,
      retentionDays,
      now: Date.now(),
    });
    if (access.visibility !== 'FULL') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    const hideText = !access.clientVisible;
    const [review, openCase, minDays, autoCompleteAt, stages] = await Promise.all([
      this.prisma.review.findUnique({ where: { requestId }, include: { dispute: true } }),
      this.prisma.requestProjectCase.findFirst({
        where: { requestId, status: 'OPEN', openedBy: 'CLIENT' },
        select: { reason: true, note: true, createdAt: true },
      }),
      this.deliveryMinDays(),
      this.autoCompleteAt(requestId, request.status, request.deliveredAt),
      this.loadStages(requestId),
    ]);
    const acceptedAt = winning.acceptedAt ?? null;
    return {
      requestId,
      requestStatus: request.status,
      deliveredAt: request.deliveredAt?.toISOString() ?? null,
      completedAt: request.completedAt?.toISOString() ?? null,
      review: review
        ? {
            rating: review.rating,
            comment: hideText ? null : review.comment,
            disputed: !!review.dispute,
            createdAt: review.createdAt.toISOString(),
          }
        : null,
      openCase: openCase
        ? { reason: openCase.reason, note: hideText ? null : openCase.note, createdAt: openCase.createdAt.toISOString() }
        : null,
      clientTextsHidden: hideText,
      acceptedAt: acceptedAt?.toISOString() ?? null,
      earliestDeliveryAt: earliestDeliveryAt(acceptedAt, minDays)?.toISOString() ?? null,
      autoCompleteAt: autoCompleteAt?.toISOString() ?? null,
      stages,
    };
  }

  // e1-2 (PO 2026-11-13): firma castigatoare bifeaza / debifeaza o etapa informativa.
  // Acces = regula fisei de lucru (resolveClaimContextAccess): angajatul cu rol limitat doar pe
  // preluarea preluata de el sau atribuita lui. Idempotent: (request_id, stage) e unic.
  async setExecutionStage(
    ctx: CompanyContext,
    actingUserId: string,
    requestId: string,
    stage: ExecutionStage,
    done: boolean,
  ): Promise<CompanyCompletionDto> {
    const winning = await this.prisma.quote.findFirst({
      where: { requestId, status: 'ACCEPTED', companyId: ctx.companyId },
      select: {
        id: true,
        company: { select: { name: true } },
        claimSlot: {
          select: { status: true, createdAt: true, updatedAt: true, claimedByUserId: true, assignedToUserId: true },
        },
      },
    });
    if (!winning) throw FulfillmentService.stageNotEditable();
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true, deliveredAt: true, deletedAt: true },
    });
    if (!request || request.deletedAt || !EXECUTION_STAGE_EDITABLE_STATUSES.includes(request.status)) {
      throw FulfillmentService.stageNotEditable();
    }
    const [revealPolicy, retentionDays] = await readClaimContactAccessSettings(this.settings);
    const access = resolveClaimContextAccess({
      slotStatus: winning.claimSlot.status,
      requestDeletedAt: request.deletedAt,
      slotCreatedAt: winning.claimSlot.createdAt,
      slotUpdatedAt: winning.claimSlot.updatedAt,
      requestDeliveredAt: request.deliveredAt,
      claimedByUserId: winning.claimSlot.claimedByUserId,
      assignedToUserId: winning.claimSlot.assignedToUserId,
      memberRole: ctx.memberRole,
      actingUserId,
      revealPolicy,
      retentionDays,
      now: Date.now(),
    });
    if (access.visibility !== 'FULL') throw FulfillmentService.stageNotEditable();
    if (access.clientHiddenReason === 'NOT_ASSIGNED_TO_YOU') {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'This claim is not assigned to you' });
    }
    await runTx(this.prisma, 'write', async (tx) => {
      // acelasi lock ca tranzitiile de stare: starea se re-verifica sub el
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const locked = await tx.request.findUnique({
        where: { id: requestId },
        select: { status: true, deletedAt: true, clientUserId: true, title: true },
      });
      if (!locked || locked.deletedAt || !EXECUTION_STAGE_EDITABLE_STATUSES.includes(locked.status)) {
        throw FulfillmentService.stageNotEditable();
      }
      if (!done) {
        // debifarea sterge randul; nu se anunta nimic
        await tx.requestExecutionStage.deleteMany({ where: { requestId, stage } });
        return;
      }
      const completedAt = new Date();
      const created = await tx.requestExecutionStage.createMany({
        data: [{ requestId, stage, completedAt, completedByUserId: actingUserId }],
        skipDuplicates: true,
      });
      // bifata deja → nimic nou, fara a doua notificare
      if (created.count === 0 || !locked.clientUserId) return;
      // review m3: cheie stabila pe (cerere, etapa) — outbox-ul are skipDuplicates pe event_key,
      // deci clientul afla cel mult o data per etapa, oricate bifari / debifari urmeaza.
      // review m2: companyId → outbox-ul pune la loc companyName la livrare (ca delivery.marked).
      await this.outbox.record(
        tx,
        `execution.stage_updated:${requestId}:${stage}`,
        'execution.stage_updated',
        { requestId, stage, companyId: ctx.companyId, companyName: winning.company.name, requestTitle: locked.title ?? '' },
        [locked.clientUserId],
      );
    });
    return this.getCompletionForCompany(ctx, actingUserId, requestId);
  }

  // e1-1 (PO 2026-11-13): "Ce urmeaza" la client. Datele firmei si contactul pleaca DOAR catre
  // clientul cererii, DOAR dupa acceptare si DOAR pentru firma cu oferta acceptata.
  async getFulfillmentForClient(userId: string, requestId: string): Promise<ClientFulfillmentDto> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, clientUserId: true, status: true, deliveredAt: true, completedAt: true, deletedAt: true },
    });
    if (!request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    if (!request.clientUserId || request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    const [winning, autoCompleteAt] = await Promise.all([
      this.prisma.quote.findFirst({
        where: { requestId, status: 'ACCEPTED' },
        select: {
          acceptedAt: true,
          companyId: true,
          company: { select: { name: true, cui: true, addressText: true, city: true, county: true } },
          claimSlot: { select: { claimedByUserId: true, assignedToUserId: true } },
        },
      }),
      this.autoCompleteAt(requestId, request.status, request.deliveredAt),
    ]);
    const base = {
      requestId,
      deliveredAt: request.deliveredAt?.toISOString() ?? null,
      completedAt: request.completedAt?.toISOString() ?? null,
      autoCompleteAt: autoCompleteAt?.toISOString() ?? null,
    };
    // review m4 (coordonator): datele firmei doar cat proiectul e in executie sau finalizat
    // (garantie); CANCELLED si orice alta stare → fara contact, fara etape.
    if (!winning || !CLIENT_CONTACT_STATUSES.includes(request.status)) {
      return { ...base, acceptedAt: winning?.acceptedAt?.toISOString() ?? null, company: null, contact: null, stages: [] };
    }
    const [contact, stages] = await Promise.all([
      this.resolveClientContact(winning.companyId, winning.claimSlot.assignedToUserId, winning.claimSlot.claimedByUserId),
      this.loadStages(requestId),
    ]);
    return {
      ...base,
      acceptedAt: winning.acceptedAt?.toISOString() ?? null,
      company: {
        name: winning.company.name,
        cui: winning.company.cui || null,
        addressText: winning.company.addressText || null,
        city: winning.company.city || null,
        county: winning.company.county || null,
      },
      contact,
      stages,
    };
  }

  // contactul = persoana atribuita → cel care a preluat → proprietarul firmei; primul cu cont
  // activ (nesters, neblocat, neanonimizat) care e inca membru al firmei castigatoare.
  private async resolveClientContact(
    companyId: string,
    assignedToUserId: string | null,
    claimedByUserId: string,
  ): Promise<ClientFulfillmentDto['contact']> {
    const userSelect = { name: true, email: true, phone: true, deletedAt: true, blockedAt: true, anonymizedAt: true } as const;
    const candidates = [assignedToUserId, claimedByUserId].filter((id): id is string => !!id);
    const members = candidates.length
      ? await this.prisma.companyMember.findMany({
          where: { companyId, userId: { in: candidates } },
          select: { userId: true, user: { select: userSelect } },
        })
      : [];
    for (const id of candidates) {
      const user = members.find((m) => m.userId === id)?.user;
      if (isActiveUser(user)) return { name: user.name, email: user.email, phone: user.phone || null };
    }
    const owners = await this.prisma.companyMember.findMany({
      where: { companyId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: userSelect } },
    });
    const owner = owners.map((o) => o.user).find(isActiveUser);
    return owner ? { name: owner.name, email: owner.email, phone: owner.phone || null } : null;
  }

  private async loadStages(requestId: string): Promise<ExecutionStageDto[]> {
    const rows = await this.prisma.requestExecutionStage.findMany({
      where: { requestId },
      select: { stage: true, completedAt: true, completedBy: { select: { name: true } } },
    });
    return EXECUTION_STAGES.map((stage) => {
      const row = rows.find((r) => r.stage === stage);
      return {
        stage,
        done: !!row,
        completedAt: row?.completedAt.toISOString() ?? null,
        completedByName: row?.completedBy?.name ?? null,
      };
    });
  }

  // regula existenta a finalizarii automate (autoCompleteClockStart, cu ceasul repornit dupa un
  // caz inchis); null in afara DELIVERED_BY_COMPANY sau cat timp un caz deschis opreste ceasul
  private async autoCompleteAt(requestId: string, status: string, deliveredAt: Date | null): Promise<Date | null> {
    if (status !== 'DELIVERED_BY_COMPANY' || !deliveredAt) return null;
    const start = await autoCompleteClockStart(this.prisma, requestId, deliveredAt);
    return start ? new Date(start.getTime() + AUTO_COMPLETE_DAYS * DAY_MS) : null;
  }

  private async deliveryMinDays(): Promise<number> {
    const fallback = SETTING_DEFAULTS.delivery_min_days_after_accept;
    const n = await this.settings.getInt(SETTING_DELIVERY_MIN_DAYS_AFTER_ACCEPT, fallback);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  }

  private static stageNotEditable(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.EXECUTION_STAGE_NOT_EDITABLE, message: 'Execution stages cannot be changed now' },
      409,
    );
  }

  // --- admin dispute ---
  async listDisputes(): Promise<AdminDisputeItemDto[]> {
    const rows = await this.prisma.reviewDispute.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: { review: { include: { company: true } } },
    });
    return rows.map((d) => ({
      id: d.id,
      reviewId: d.reviewId,
      requestId: d.review.requestId,
      companyName: d.review.company.name,
      rating: d.review.rating,
      comment: d.review.comment,
      status: d.status,
      resolutionNote: d.resolutionNote,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async resolveDispute(
    adminUserId: string,
    disputeId: string,
    dto: ResolveDisputeInput,
  ): Promise<{ id: string; status: string }> {
    const dispute = await this.prisma.reviewDispute.findUnique({
      where: { id: disputeId },
      include: { review: true },
    });
    if (!dispute) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Dispute not found' });
    }
    if (dispute.status !== 'OPEN') {
      throw new HttpException(
        { code: ERROR_CODES.DISPUTE_ALREADY_DECIDED, message: 'Dispute already decided' },
        409,
      );
    }
    await runTx(this.prisma, 'write', async (tx) => {
      const changed = await tx.reviewDispute.updateMany({
        where: { id: disputeId, status: 'OPEN' },
        data: {
          status: dto.status,
          resolutionNote: dto.resolutionNote || null,
          resolvedByUserId: adminUserId,
          resolvedAt: new Date(),
        },
      });
      if (changed.count === 0) throw new HttpException({ code: ERROR_CODES.DISPUTE_ALREADY_DECIDED, message: 'Dispute already decided' }, 409);
      // D-L1-3 (PO 2026-08-23): DISMISSED = recenzia se STERGE (disputa dispare in cascada;
      // trail-ul ramane in audit_logs prin @Audit). RESOLVED = recenzia ramane inregistrata.
      // Nota: dupa stergere clientul poate lasa o recenzie noua (unicitatea e per cerere).
      if (dto.status === 'DISMISSED') {
        await tx.review.delete({ where: { id: dispute.review.id } });
      }
      // dupa decizie cererea revine COMPLETED.
      await tx.request.update({ where: { id: dispute.review.requestId }, data: { status: 'COMPLETED' } });
      // Pasul 6: partile AFLA decizia — clientul (recenzia pastrata/stearsa) + membrii firmei.
      const [request, members] = await Promise.all([
        tx.request.findUnique({
          where: { id: dispute.review.requestId },
          select: { title: true, clientUserId: true },
        }),
        tx.companyMember.findMany({
          where: { companyId: dispute.review.companyId },
          select: { userId: true },
        }),
      ]);
      const targets = [
        ...members.map((m) => m.userId),
        ...(request?.clientUserId ? [request.clientUserId] : []),
      ];
      if (targets.length > 0) {
        await this.outbox.record(tx, `dispute.decided:${disputeId}`,
          'dispute.decided',
          {
            requestId: dispute.review.requestId,
            requestTitle: request?.title ?? '',
            dismissed: dto.status === 'DISMISSED',
          },
          targets,
        );
      }
      await this.outbox.record(tx, `request.dispute-decided:${disputeId}`, 'request.status_changed', {
        requestId: dispute.review.requestId,
        status: 'COMPLETED',
      }, []);

    });
    return { id: disputeId, status: dto.status };
  }

  private toReviewDto(
    r: { id: string; requestId: string; companyId: string; rating: number; comment: string | null; createdAt: Date },
    disputed: boolean,
  ): ReviewDto {
    return {
      id: r.id,
      requestId: r.requestId,
      companyId: r.companyId,
      rating: r.rating,
      comment: r.comment,
      disputed,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
