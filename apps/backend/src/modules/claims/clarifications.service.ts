import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AnswerClarificationInput,
  type ClarificationRequestDto,
  type RequestClarificationInput,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { CompanyContext } from '../../common/company-context/company-context';
import { ClaimsService } from './claims.service';

// 4.11 — clarificare ceruta de firma catre client. Pune SLA pe pauza (slaPausedAt) si extinde
// deadline-ul cu +1 zi lucratoare; la raspunsul clientului SLA se reia.
@Injectable()
export class ClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    private readonly claims: ClaimsService,
  ) {}

  async request(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
    dto: RequestClarificationInput,
  ): Promise<ClarificationRequestDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: { select: { deletedAt: true } } },
    });
    if (!slot || slot.companyId !== ctx.companyId || slot.request.deletedAt !== null) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    if (slot.status !== 'ACTIVE') {
      throw new HttpException(
        { code: ERROR_CODES.CLAIM_NOT_ALLOWED, message: 'SLA not running on this claim' },
        409,
      );
    }
    const pending = await this.prisma.clarificationRequest.findFirst({
      where: { claimSlotId, status: 'PENDING' },
    });
    if (pending) {
      throw new HttpException(
        { code: ERROR_CODES.CLARIFICATION_ALREADY_PENDING, message: 'A clarification is already pending' },
        409,
      );
    }

    const base = slot.slaDeadlineAt ?? new Date();
    const newDeadline = this.calendar.addWorkingDays(base, 1);
    const clarification = await this.prisma.$transaction(async (tx) => {
      const c = await tx.clarificationRequest.create({
        data: { claimSlotId, requestedByUserId: actingUserId, questionText: dto.questionText },
      });
      await tx.claimSlot.update({
        where: { id: claimSlotId },
        data: { slaPausedAt: new Date(), slaDeadlineAt: newDeadline },
      });
      return c;
    });
    // reprogrameaza verificarea de breach la noul deadline (cel vechi se auto-ignora).
    await this.claims.scheduleSlaBreach(claimSlotId, newDeadline);
    return this.toDto(clarification);
  }

  async answer(
    userId: string,
    clarificationId: string,
    dto: AnswerClarificationInput,
  ): Promise<ClarificationRequestDto> {
    const clarification = await this.prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      include: { claimSlot: { include: { request: { select: { clientUserId: true } } } } },
    });
    if (!clarification) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Clarification not found' });
    }
    if (clarification.claimSlot.request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    if (clarification.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Clarification already answered' },
        409,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.clarificationRequest.update({
        where: { id: clarificationId },
        data: { status: 'ANSWERED', answerText: dto.answerText, answeredAt: new Date() },
      });
      // SLA se reia (deadline-ul a fost deja extins cu +1 zi la cerere).
      await tx.claimSlot.update({
        where: { id: clarification.claimSlotId },
        data: { slaPausedAt: null },
      });
      return c;
    });
    return this.toDto(updated);
  }

  // L0-B (IDOR): doar firma detinatoare a claim-ului vede clarificarile lui (NOT_FOUND altfel).
  async listForClaim(ctx: CompanyContext, claimSlotId: string): Promise<ClarificationRequestDto[]> {
    const slot = await this.prisma.claimSlot.findUnique({ where: { id: claimSlotId } });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    const rows = await this.prisma.clarificationRequest.findMany({
      where: { claimSlotId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // Clientul vede clarificarile (toate claim-urile) pe cererea lui — pentru a raspunde.
  async listForClientRequest(userId: string, requestId: string): Promise<ClarificationRequestDto[]> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    const rows = await this.prisma.clarificationRequest.findMany({
      where: { claimSlot: { requestId } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  private toDto(c: {
    id: string;
    claimSlotId: string;
    questionText: string;
    answerText: string | null;
    status: 'PENDING' | 'ANSWERED';
    answeredAt: Date | null;
    createdAt: Date;
  }): ClarificationRequestDto {
    return {
      id: c.id,
      claimSlotId: c.claimSlotId,
      questionText: c.questionText,
      answerText: c.answerText,
      status: c.status,
      answeredAt: c.answeredAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
