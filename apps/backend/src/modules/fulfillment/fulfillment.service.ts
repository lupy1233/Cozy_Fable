import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminDisputeItemDto,
  type CreateReviewInput,
  type ResolveDisputeInput,
  type ReviewDto,
} from '@marketplace/shared';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { QUEUE_DELIVERY_AUTOCOMPLETE } from '../../infra/queues/queues.module';
import { CreditsService } from '../billing/credits.service';
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
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_DELIVERY_AUTOCOMPLETE)
    private readonly autoCompleteQueue: Queue<DeliveryAutocompleteJob>,
  ) {}

  // Firma castigatoare marcheaza livrarea (ACCEPTED → DELIVERED_BY_COMPANY).
  async markDelivered(ctx: CompanyContext, requestId: string): Promise<{ status: string }> {
    const quote = await this.prisma.quote.findFirst({
      where: { requestId, companyId: ctx.companyId, status: 'ACCEPTED' },
      include: { company: { select: { name: true } } },
    });
    if (!quote) {
      throw new ForbiddenException({ code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'No accepted offer for your company' });
    }
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || (request.status !== 'ACCEPTED' && request.status !== 'IN_EXECUTION')) {
      throw new HttpException(
        { code: ERROR_CODES.DELIVERY_NOT_ALLOWED, message: 'Request not in a deliverable state' },
        409,
      );
    }
    const deliveredAt = new Date();
    await this.prisma.request.update({
      where: { id: requestId },
      data: { status: 'DELIVERED_BY_COMPANY', deliveredAt },
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
      },
    );
    // L1 (audit 2026-08-23): clientul AFLA ca trebuie sa confirme livrarea (clopotel + email)
    // — inainte broadcastul se arunca si recenzia ramanea blocata pe veci.
    // Guard pe clientUserId nullable: FARA tinte publish-ul ar deveni broadcast (aruncat).
    if (request.clientUserId) {
      await this.eventBus.publish(
        'delivery.marked',
        {
          requestId,
          requestTitle: request.title ?? '',
          companyName: quote.company.name,
          clientUserId: request.clientUserId,
        },
        [request.clientUserId],
      );
    }
    await this.eventBus.publish('request.status_changed', { requestId, status: 'DELIVERED_BY_COMPANY' });
    return { status: 'DELIVERED_BY_COMPANY' };
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
    const result = await this.completeDelivered(requestId);
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
    await this.notifyCompleted(requestId, request.title ?? '', result.winner, false, request.clientUserId);
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
    const result = await this.completeDelivered(requestId);
    if (!result.completed) return false;
    await this.notifyCompleted(requestId, request.title ?? '', result.winner, true, request.clientUserId);
    this.logger.log(`request ${requestId} auto-COMPLETED dupa ${AUTO_COMPLETE_DAYS} zile de la livrare`);
    return true;
  }

  // Tranzitia DELIVERED_BY_COMPANY → COMPLETED = biletul de decontare (audit 2026-08-23):
  // updateMany conditionat pe status — doar calea care reuseste (count===1) consuma creditele
  // castigatorului. Inchide race-ul client-confirm vs auto-complete (dublu consum).
  private async completeDelivered(requestId: string): Promise<
    { completed: false } | { completed: true; winner: { companyId: string; claimSlotId: string } | null }
  > {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.request.updateMany({
        where: { id: requestId, status: 'DELIVERED_BY_COMPANY', deletedAt: null },
        data: { status: 'COMPLETED' },
      });
      if (res.count === 0) return { completed: false as const };
      const winning = await tx.quote.findFirst({ where: { requestId, status: 'ACCEPTED' } });
      let winner: { companyId: string; claimSlotId: string } | null = null;
      if (winning) {
        const closed = await tx.claimSlot.updateMany({
          where: { id: winning.claimSlotId, status: 'OFFER_SENT' },
          data: { status: 'COMPLETED' },
        });
        if (closed.count === 1) {
          const slot = await tx.claimSlot.findUniqueOrThrow({ where: { id: winning.claimSlotId } });
          await this.credits.consume(slot.companyId, slot.claimCostCreditsSnapshot, 'COMPLETED', slot.id, tx);
          winner = { companyId: slot.companyId, claimSlotId: slot.id };
        }
      }
      return { completed: true as const, winner };
    });
  }

  private async notifyCompleted(
    requestId: string,
    requestTitle: string,
    winner: { companyId: string; claimSlotId: string } | null,
    autoCompleted: boolean,
    clientUserId: string | null,
  ): Promise<void> {
    // firma afla ca lucrarea e finalizata (clopotel, tintit membrilor)
    if (winner) {
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: winner.companyId },
        select: { userId: true },
      });
      await this.eventBus.publish(
        'delivery.confirmed',
        { requestId, requestTitle, claimSlotId: winner.claimSlotId, autoCompleted },
        members.map((m) => m.userId),
      );
    }
    // la auto-confirmare, clientul afla ca fereastra s-a inchis si poate lasa recenzie
    if (autoCompleted && clientUserId) {
      await this.eventBus.publish('delivery.autocompleted', { requestId, requestTitle }, [clientUserId]);
    }
    await this.eventBus.publish('request.status_changed', { requestId, status: 'COMPLETED' });
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
    const review = await this.prisma.$transaction(async (tx) => {
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
      return r;
    });
    // L1 (audit 2026-08-23): firma AFLA ca a primit o recenzie (clopotel, tintit membrilor).
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: winning.companyId },
      select: { userId: true },
    });
    await this.eventBus.publish(
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
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', deletedAt: null },
        select: { id: true },
      });
      await this.eventBus.publish(
        'dispute.opened',
        { requestId, requestTitle: request.title ?? '', rating: dto.rating },
        admins.map((a) => a.id),
      );
    }
    await this.eventBus.publish('request.status_changed', {
      requestId,
      status: disputed ? 'DISPUTED' : 'COMPLETED',
      reviewed: true,
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
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewDispute.update({
        where: { id: disputeId },
        data: {
          status: dto.status,
          resolutionNote: dto.resolutionNote || null,
          resolvedByUserId: adminUserId,
          resolvedAt: new Date(),
        },
      });
      // D-L1-3 (PO 2026-08-23): DISMISSED = recenzia se STERGE (disputa dispare in cascada;
      // trail-ul ramane in audit_logs prin @Audit). RESOLVED = recenzia ramane inregistrata.
      // Nota: dupa stergere clientul poate lasa o recenzie noua (unicitatea e per cerere).
      if (dto.status === 'DISMISSED') {
        await tx.review.delete({ where: { id: dispute.review.id } });
      }
      // dupa decizie cererea revine COMPLETED.
      await tx.request.update({ where: { id: dispute.review.requestId }, data: { status: 'COMPLETED' } });
    });
    // Pasul 6: partile AFLA decizia — clientul (recenzia pastrata/stearsa) + membrii firmei.
    const [request, members] = await Promise.all([
      this.prisma.request.findUnique({
        where: { id: dispute.review.requestId },
        select: { title: true, clientUserId: true },
      }),
      this.prisma.companyMember.findMany({
        where: { companyId: dispute.review.companyId },
        select: { userId: true },
      }),
    ]);
    const targets = [
      ...members.map((m) => m.userId),
      ...(request?.clientUserId ? [request.clientUserId] : []),
    ];
    if (targets.length > 0) {
      await this.eventBus.publish(
        'dispute.decided',
        {
          requestId: dispute.review.requestId,
          requestTitle: request?.title ?? '',
          dismissed: dto.status === 'DISMISSED',
        },
        targets,
      );
    }
    await this.eventBus.publish('request.status_changed', {
      requestId: dispute.review.requestId,
      status: 'COMPLETED',
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
