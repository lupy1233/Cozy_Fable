import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminDisputeItemDto,
  type CreateReviewInput,
  type ResolveDisputeInput,
  type ReviewDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { CreditsService } from '../billing/credits.service';
import type { CompanyContext } from '../../common/company-context/company-context';

// Sprint 8 — livrare → COMPLETED (cu consum credite castigator) + review + dispute (4.18).
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly credits: CreditsService,
  ) {}

  // Firma castigatoare marcheaza livrarea (ACCEPTED → DELIVERED_BY_COMPANY).
  async markDelivered(ctx: CompanyContext, requestId: string): Promise<{ status: string }> {
    const quote = await this.prisma.quote.findFirst({
      where: { requestId, companyId: ctx.companyId, status: 'ACCEPTED' },
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
    await this.prisma.request.update({ where: { id: requestId }, data: { status: 'DELIVERED_BY_COMPANY' } });
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
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({ where: { id: requestId }, data: { status: 'COMPLETED' } });
      const winning = await tx.quote.findFirst({ where: { requestId, status: 'ACCEPTED' } });
      if (winning) {
        const slot = await tx.claimSlot.findUnique({ where: { id: winning.claimSlotId } });
        if (slot && slot.status === 'OFFER_SENT') {
          await tx.claimSlot.update({ where: { id: slot.id }, data: { status: 'COMPLETED' } });
          await this.credits.consume(slot.companyId, slot.claimCostCreditsSnapshot, 'COMPLETED', slot.id, tx);
        }
      }
    });
    await this.eventBus.publish('request.status_changed', { requestId, status: 'COMPLETED' });
    return { status: 'COMPLETED' };
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
      // dupa decizie cererea revine COMPLETED (review-ul ramane inregistrat).
      await tx.request.update({ where: { id: dispute.review.requestId }, data: { status: 'COMPLETED' } });
    });
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
