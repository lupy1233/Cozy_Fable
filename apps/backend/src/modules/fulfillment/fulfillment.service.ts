import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminDisputeItemDto,
  type CreateReviewInput,
  type ResolveDisputeInput,
  type ReviewDto,
} from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { OutboxService } from '../outbox/outbox.service';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { QUEUE_DELIVERY_AUTOCOMPLETE } from '../../infra/queues/queues.module';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import type { CompanyContext } from '../../common/company-context/company-context';
import type { DeliveryAutocompleteJob } from './delivery-autocomplete.processor';

// Decizia PO 2026-08-23 (pasul 5, F1): livrarea neconfirmata de client se confirma
// AUTOMAT la 14 zile calendaristice de la delivered_at — altfel creditele castigatorului
// ramaneau RESERVED pe veci si recenzia era imposibila.
export const AUTO_COMPLETE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function autoCompleteJobId(requestId: string, deliveredAt: Date): string {
  return `auto-complete-${requestId}-${deliveredAt.getTime()}`;
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
    const deliveredAt = new Date();
    await runTx(this.prisma, 'write', async (tx) => {
      // E-company-1: acelasi lock ca retragerile; castigatorul trebuie sa fie inca OFFER_SENT (altfel completeDelivered nu mai consuma creditele)
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const open = await tx.claimSlot.count({ where: { id: quote.claimSlotId, status: 'OFFER_SENT' } });
      if (open === 0) throw FulfillmentService.winnerNotOpen();
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
      const res = await tx.request.updateMany({
        where: { id: requestId, status: 'DELIVERED_BY_COMPANY', deletedAt: null },
        data: { status: 'COMPLETED' },
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
