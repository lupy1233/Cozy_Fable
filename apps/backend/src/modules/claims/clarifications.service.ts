import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AnswerClarificationInput,
  type ClarificationRequestDto,
  type RequestClarificationInput,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { Prisma } from '@prisma/client';
import type { CompanyContext } from '../../common/company-context/company-context';
import { OutboxService } from '../outbox/outbox.service';
import { diffRequestVersions, type RequestVersionDiff } from '../requests/request-version-diff';
import { ClaimsService } from './claims.service';
import { CLARIFICATION_SLA_EXTENSION_WORKING_DAYS, OPEN_CLAIM_STATUSES } from './claims.constants';

// e3: clientul vede si firma care a intrebat (numele firmei ii e deja vizibil pe pagina ofertelor)
export type ClientClarificationDto = ClarificationRequestDto & { companyName: string | null };

// e3: caseta „Cererea a fost modificata pe … — ce s-a schimbat” de pe fisa preluarii
export interface ClaimRequestEditDto {
  edit: (RequestVersionDiff & { editedAt: string }) | null;
}

// 4.11 — clarificare ceruta de firma catre client. Pune SLA pe pauza (slaPausedAt) si extinde
// deadline-ul cu +1 zi lucratoare; la raspunsul clientului SLA se reia.
@Injectable()
export class ClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    private readonly claims: ClaimsService,
    private readonly outbox: OutboxService,
  ) {}

  // e3: payload-ul comun al celor doua evenimente (contractul etapei 9). Titlul cererii si numele
  // firmei se completeaza la livrare din outbox (nu se salveaza in randul outbox).
  private static eventPayload(
    slot: { id: string; companyId: string; requestId: string; request: { title: string | null; clientUserId: string | null }; company: { name: string } },
    actorUserId: string,
  ): Record<string, unknown> {
    return {
      requestId: slot.requestId,
      requestTitle: slot.request.title ?? '',
      claimSlotId: slot.id,
      companyId: slot.companyId,
      companyName: slot.company.name,
      clientUserId: slot.request.clientUserId,
      actorUserId,
    };
  }

  private static async companyMemberIds(tx: Prisma.TransactionClient, companyId: string): Promise<string[]> {
    const members = await tx.companyMember.findMany({ where: { companyId }, select: { userId: true } });
    return members.map((m) => m.userId);
  }

  async request(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
    dto: RequestClarificationInput,
  ): Promise<ClarificationRequestDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: {
        request: { select: { deletedAt: true, title: true, clientUserId: true } },
        company: { select: { name: true } },
      },
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
    const newDeadline = this.calendar.addWorkingDays(base, CLARIFICATION_SLA_EXTENSION_WORKING_DAYS);
    const clarification = await runTx(this.prisma, 'write', async (tx) => {
      const c = await tx.clarificationRequest.create({
        data: { claimSlotId, requestedByUserId: actingUserId, questionText: dto.questionText },
      });
      await tx.claimSlot.update({
        where: { id: claimSlotId },
        data: { slaPausedAt: new Date(), slaDeadlineAt: newDeadline },
      });
      // e3: clientul afla de intrebare (clopotel + e-mail), atomic cu salvarea
      if (slot.request.clientUserId) {
        await this.outbox.record(tx, `clarification.asked:${c.id}`,
          'clarification.asked',
          ClarificationsService.eventPayload(slot, actingUserId),
          [slot.request.clientUserId],
        );
      }
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
      include: {
        claimSlot: {
          include: {
            request: { select: { clientUserId: true, title: true } },
            company: { select: { name: true } },
          },
        },
      },
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
    // Pasul 5 (audit 2026-08-23, F6): timpul NU curge in pauza — la raspuns, deadline-ul se
    // muta inainte cu durata pauzei si verificarea de breach se REprogrameaza. Inainte, un
    // raspuns venit dupa ce jobul vechi rulase no-op lasa slotul ACTIVE fara niciun ceas
    // (ratarea nu se mai aplica niciodata) sau, invers, breach-ul lovea nedrept imediat.
    const slot = clarification.claimSlot;
    const now = new Date();
    const shiftedDeadline =
      slot.status === 'ACTIVE' && slot.slaPausedAt && slot.slaDeadlineAt
        ? new Date(slot.slaDeadlineAt.getTime() + (now.getTime() - slot.slaPausedAt.getTime()))
        : null;
    const updated = await runTx(this.prisma, 'write', async (tx) => {
      const c = await tx.clarificationRequest.update({
        where: { id: clarificationId },
        data: { status: 'ANSWERED', answerText: dto.answerText, answeredAt: now },
      });
      await tx.claimSlot.update({
        where: { id: clarification.claimSlotId },
        data: { slaPausedAt: null, ...(shiftedDeadline ? { slaDeadlineAt: shiftedDeadline } : {}) },
      });
      // e3: firma afla raspunsul — toti membrii (cine primeste e-mail decide notificarile)
      await this.outbox.record(tx, `clarification.answered:${clarificationId}`,
        'clarification.answered',
        ClarificationsService.eventPayload(slot, userId),
        await ClarificationsService.companyMemberIds(tx, slot.companyId),
      );
      return c;
    });
    if (shiftedDeadline) {
      // jobId nou (include deadline-ul) → jobul vechi se auto-ignora pe deadline-ul mutat
      await this.claims.scheduleSlaBreach(clarification.claimSlotId, shiftedDeadline);
    }
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
  // e3: TOATE (si cele cu raspuns — istoricul „Intrebare / Raspunsul tau”), cu firma care a intrebat.
  async listForClientRequest(userId: string, requestId: string): Promise<ClientClarificationDto[]> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request || request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    const rows = await this.prisma.clarificationRequest.findMany({
      where: { claimSlot: { requestId } },
      orderBy: { createdAt: 'asc' },
      include: { claimSlot: { select: { company: { select: { name: true } } } } },
    });
    return rows.map((r) => ({ ...this.toDto(r), companyName: r.claimSlot?.company?.name ?? null }));
  }

  // e3: fisa preluarii — ce s-a schimbat la ultima editare a cererii, daca editarea a venit DUPA
  // preluarea acestei firme. Aceeasi garda ca listForClaim (doar firma detinatoare); doar pe
  // preluare deschisa (fisa inchisa e doar rezumat). Compara doar ce arata fisa (fara contacte /
  // strada) — vezi request-version-diff.ts.
  async editChangesForClaim(ctx: CompanyContext, claimSlotId: string): Promise<ClaimRequestEditDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: { request: { select: { deletedAt: true } } },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    if (slot.request.deletedAt !== null || !OPEN_CLAIM_STATUSES.includes(slot.status)) return { edit: null };
    const versions = await this.prisma.requestVersion.findMany({
      where: { requestId: slot.requestId },
      orderBy: { version: 'desc' },
      take: 2,
      select: { snapshot: true, createdAt: true },
    });
    if (versions.length < 2) return { edit: null };
    const [latest, previous] = versions;
    if (latest.createdAt.getTime() <= slot.createdAt.getTime()) return { edit: null };
    return {
      edit: { ...diffRequestVersions(previous.snapshot, latest.snapshot), editedAt: latest.createdAt.toISOString() },
    };
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
