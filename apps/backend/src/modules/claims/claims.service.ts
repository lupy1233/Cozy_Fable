import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ERROR_CODES,
  type AssignClaimInput,
  type ClaimSlotDto,
  type CreateClaimInput,
} from '@marketplace/shared';
import { Prisma, type ClaimSlot, type ProjectSize, type RequestStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { SettingsService } from '../../common/settings/settings.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_CLAIM_ASSIGN, QUEUE_SLA_BREACH } from '../../infra/queues/queues.module';
import type { CompanyContext } from '../../common/company-context/company-context';
import { CreditsService } from '../billing/credits.service';
import {
  ASSIGN_DEADLINE_MS,
  CLAIMABLE_STATUSES,
  CLAIM_TX_TIMEOUT_MS,
  OCCUPYING_CLAIM_STATUSES,
  SLA_DAYS,
  SLA_GRACE_MS,
} from './claims.constants';
import { haversineKm, recomputeRequestStatusAfterClaimChange } from './claims.helpers';
import type { ClaimAssignJob } from './claim-assign.processor';
import type { SlaBreachJob } from './sla-breach.processor';

interface LockedRequest {
  id: string;
  status: RequestStatus;
  lat: number | null;
  lng: number | null;
  project_size: ProjectSize | null;
  project_score: number | null;
  credit_cost: number | null;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: SettingsService,
    private readonly eventBus: EventBusService,
    private readonly calendar: BusinessCalendarService,
    @InjectQueue(QUEUE_CLAIM_ASSIGN) private readonly assignQueue: Queue<ClaimAssignJob>,
    @InjectQueue(QUEUE_SLA_BREACH) private readonly slaQueue: Queue<SlaBreachJob>,
  ) {}

  // Programeaza (sau reprogrameaza) verificarea de ratare SLA la deadline + grace (12h).
  // jobId include deadline-ul ca timestamp → reprogramarea (clarificare) adauga un job nou,
  // iar cel vechi se auto-ignora in procesor (verifica deadline-ul curent al slotului).
  async scheduleSlaBreach(claimSlotId: string, slaDeadlineAt: Date): Promise<void> {
    const delay = Math.max(0, slaDeadlineAt.getTime() + SLA_GRACE_MS - Date.now());
    await this.slaQueue.add(
      'breach',
      { claimSlotId },
      { delay, jobId: `sla-${claimSlotId}-${slaDeadlineAt.getTime()}`, removeOnComplete: true },
    );
  }

  // Claim tranzactional (invarianta 3.1): Serializable + SELECT FOR UPDATE pe requests.
  async create(
    ctx: CompanyContext,
    actingUserId: string,
    dto: CreateClaimInput,
  ): Promise<ClaimSlotDto> {
    if (ctx.memberRole === 'EMPLOYEE_MANAGED') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Managed employees cannot claim',
      });
    }
    const maxClaims = await this.settings.getInt('max_claims_per_request', 3);
    const assignToUserId = dto.assignToUserId ?? null;

    if (assignToUserId) {
      const member = await this.prisma.companyMember.findUnique({
        where: { userId: assignToUserId },
      });
      if (!member || member.companyId !== ctx.companyId) {
        throw new NotFoundException({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Assignee is not a member of your company',
        });
      }
    }

    let createdId: string;
    let chatThreadId: string;
    try {
      const res = await this.prisma.$transaction(
        async (tx) => {
          // 1. Lock pe request
          // NB: coloana reala e size_score (map Prisma) → aliasata la project_score.
          // id e TEXT (String @id), nu uuid → fara cast ::uuid (altfel text = uuid fail).
          const locked = await tx.$queryRaw<LockedRequest[]>`
            SELECT id, status, lat, lng, project_size, size_score AS project_score, credit_cost
            FROM requests WHERE id = ${dto.requestId} FOR UPDATE`;
          const req = locked[0];
          if (!req) {
            throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
          }
          // 2. Status claimabil
          if (!CLAIMABLE_STATUSES.includes(req.status)) {
            throw new HttpException(
              { code: ERROR_CODES.CLAIM_NOT_ALLOWED, message: 'Request is not claimable' },
              409,
            );
          }
          if (
            req.project_size === null ||
            req.project_score === null ||
            req.credit_cost === null ||
            req.lat === null ||
            req.lng === null
          ) {
            throw new HttpException(
              { code: ERROR_CODES.CLAIM_NOT_ALLOWED, message: 'Request is not fully published' },
              409,
            );
          }
          // 3. Sloturi ocupate < max
          const occupied = await tx.claimSlot.count({
            where: { requestId: req.id, status: { in: OCCUPYING_CLAIM_STATUSES } },
          });
          if (occupied >= maxClaims) {
            throw new HttpException(
              { code: ERROR_CODES.CLAIM_SLOTS_FULL, message: 'No claim slots left' },
              409,
            );
          }
          // 4a. Firma neexclusa (4.11)
          const excluded = await tx.requestCompanyExclusion.findUnique({
            where: { requestId_companyId: { requestId: req.id, companyId: ctx.companyId } },
          });
          if (excluded) {
            throw new ForbiddenException({
              code: ERROR_CODES.COMPANY_EXCLUDED_FROM_REQUEST,
              message: 'Company excluded from this request',
            });
          }
          // 4b. Firma nu a dat deja claim ocupant
          const own = await tx.claimSlot.findFirst({
            where: {
              requestId: req.id,
              companyId: ctx.companyId,
              status: { in: OCCUPYING_CLAIM_STATUSES },
            },
          });
          if (own) {
            throw new HttpException(
              { code: ERROR_CODES.CLAIM_ALREADY_EXISTS, message: 'Company already claimed' },
              409,
            );
          }
          // 4c. Arie de acoperire (4.8) — cel putin o locatie cu Haversine <= coverage_radius_km
          await this.assertCoverage(tx, ctx.companyId, req.lat, req.lng);
          // 4d. Regula 1-claim-activ-fara-oferta / cap manager (4.9)
          await this.assertAssignmentRules(tx, ctx, actingUserId, assignToUserId);

          // 5. Creeaza slot + chat + rezerva credite + update status
          // SLA materializat la claim (4.11): zile lucratoare per marime (3/3/5).
          const slaDeadlineAt = this.calendar.addWorkingDays(
            new Date(),
            SLA_DAYS[req.project_size],
          );
          const slot = await tx.claimSlot.create({
            data: {
              requestId: req.id,
              companyId: ctx.companyId,
              claimedByUserId: actingUserId,
              assignedToUserId: assignToUserId,
              status: 'ACTIVE',
              projectSizeSnapshot: req.project_size,
              projectScoreSnapshot: req.project_score,
              claimCostCreditsSnapshot: req.credit_cost,
              slaDeadlineAt,
              assignDeadlineAt: assignToUserId
                ? null
                : new Date(Date.now() + ASSIGN_DEADLINE_MS),
            },
          });
          const thread = await tx.chatThread.create({ data: { claimSlotId: slot.id } });
          await this.credits.reserve(
            ctx.companyId,
            req.credit_cost,
            'CLAIM_RESERVE',
            slot.id,
            tx,
          );
          await recomputeRequestStatusAfterClaimChange(tx, req.id, maxClaims);

          return { slot, threadId: thread.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: CLAIM_TX_TIMEOUT_MS },
      );
      createdId = res.slot.id;
      chatThreadId = res.threadId;

      // 6. Job auto-cancel la +1h daca neatribuit (4.9)
      if (!assignToUserId) {
        await this.assignQueue.add(
          'assign-deadline',
          { claimSlotId: createdId },
          { delay: ASSIGN_DEADLINE_MS, jobId: `claim-assign-${createdId}`, removeOnComplete: true },
        );
      }
      // 6b. Job verificare ratare SLA la deadline + grace (4.11)
      if (res.slot.slaDeadlineAt) {
        await this.scheduleSlaBreach(createdId, res.slot.slaDeadlineAt);
      }
      // Notificare TINTITA (client + membrii firmei): clientul afla ca un atelier
      // i-a preluat cererea — inceputul parcursului per firma (iteme 4+5).
      // Broadcast-ul anterior nu persista nicio notificare.
      const [display, members] = await Promise.all([
        this.prisma.request.findUnique({
          where: { id: dto.requestId },
          select: { title: true, clientUserId: true },
        }),
        this.prisma.companyMember.findMany({
          where: { companyId: ctx.companyId },
          select: { userId: true },
        }),
      ]);
      const company = await this.prisma.company.findUnique({
        where: { id: ctx.companyId },
        select: { name: true },
      });
      const claimTargets = members.map((m) => m.userId);
      if (display?.clientUserId) claimTargets.push(display.clientUserId);
      await this.eventBus.publish(
        'claim.created',
        {
          claimSlotId: createdId,
          requestId: dto.requestId,
          companyId: ctx.companyId,
          requestTitle: display?.title ?? '',
          companyName: company?.name ?? '',
        },
        claimTargets,
      );
      await this.eventBus.publish('request.status_changed', { requestId: dto.requestId });

      return this.toDto(res.slot, chatThreadId);
    } catch (e) {
      throw this.mapUniqueViolation(e, actingUserId, assignToUserId);
    }
  }

  // Reatribuire claim existent (manager/owner) catre alt membru.
  async assign(
    ctx: CompanyContext,
    claimSlotId: string,
    dto: AssignClaimInput,
  ): Promise<ClaimSlotDto> {
    if (ctx.memberRole !== 'OWNER' && ctx.memberRole !== 'MANAGER') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only owner or manager can assign',
      });
    }
    const member = await this.prisma.companyMember.findUnique({
      where: { userId: dto.assignToUserId },
    });
    if (!member || member.companyId !== ctx.companyId) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Assignee is not a member of your company',
      });
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const slot = await tx.claimSlot.findUnique({ where: { id: claimSlotId } });
        if (!slot || slot.companyId !== ctx.companyId) {
          throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
        }
        if (slot.status !== 'ACTIVE') {
          throw new HttpException(
            { code: ERROR_CODES.CLAIM_NOT_ALLOWED, message: 'Claim is not active' },
            409,
          );
        }
        // 1-claim-activ pe noul assignee
        const busy = await tx.claimSlot.findFirst({
          where: {
            assignedToUserId: dto.assignToUserId,
            status: 'ACTIVE',
            quoteId: null,
            id: { not: claimSlotId },
          },
        });
        if (busy) {
          throw new HttpException(
            {
              code: ERROR_CODES.ASSIGNED_USER_HAS_ACTIVE_CLAIM,
              message: 'Assignee already has an active claim without offer',
            },
            409,
          );
        }
        return tx.claimSlot.update({
          where: { id: claimSlotId },
          data: { assignedToUserId: dto.assignToUserId, assignDeadlineAt: null },
        });
      });
      const thread = await this.prisma.chatThread.findUnique({
        where: { claimSlotId: updated.id },
      });
      return this.toDto(updated, thread?.id ?? '');
    } catch (e) {
      throw this.mapUniqueViolation(e, undefined, dto.assignToUserId);
    }
  }

  async listMine(companyId: string): Promise<ClaimSlotDto[]> {
    const slots = await this.prisma.claimSlot.findMany({
      where: { companyId },
      include: {
        chatThread: true,
        request: { select: { title: true } },
        claimedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return slots.map((s) => ({
      ...this.toDto(s, s.chatThread?.id ?? ''),
      requestTitle: s.request?.title ?? null,
      claimedByName: s.claimedBy?.name ?? null,
      assignedToName: s.assignedTo?.name ?? null,
    }));
  }

  // --- helpers ---

  private async assertCoverage(
    tx: Prisma.TransactionClient,
    companyId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const locations = await tx.companyLocation.findMany({ where: { companyId } });
    const covered = locations.some((l) => haversineKm(lat, lng, l.lat, l.lng) <= l.coverageRadiusKm);
    if (!covered) {
      throw new ForbiddenException({
        code: ERROR_CODES.OUT_OF_COVERAGE_AREA,
        message: 'Request is outside your coverage area',
      });
    }
  }

  private async assertAssignmentRules(
    tx: Prisma.TransactionClient,
    ctx: CompanyContext,
    actingUserId: string,
    assignToUserId: string | null,
  ): Promise<void> {
    if (assignToUserId) {
      const busy = await tx.claimSlot.findFirst({
        where: { assignedToUserId: assignToUserId, status: 'ACTIVE', quoteId: null },
      });
      if (busy) {
        const code =
          assignToUserId === actingUserId
            ? ERROR_CODES.ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS
            : ERROR_CODES.ASSIGNED_USER_HAS_ACTIVE_CLAIM;
        throw new HttpException({ code, message: 'Assignee already has an active claim' }, 409);
      }
      return;
    }
    // Claim neatribuit: cap manager (4.9). count(unassigned active by actor)+1 <= workers liberi.
    const members = await tx.companyMember.findMany({ where: { companyId: ctx.companyId } });
    const busyAssignees = await tx.claimSlot.findMany({
      where: {
        companyId: ctx.companyId,
        status: 'ACTIVE',
        quoteId: null,
        assignedToUserId: { not: null },
      },
      select: { assignedToUserId: true },
    });
    const busySet = new Set(busyAssignees.map((b) => b.assignedToUserId));
    const workersFree = members.filter((m) => !busySet.has(m.userId)).length;
    const unassignedByActor = await tx.claimSlot.count({
      where: {
        claimedByUserId: actingUserId,
        status: 'ACTIVE',
        assignedToUserId: null,
      },
    });
    if (unassignedByActor + 1 > workersFree) {
      throw new HttpException(
        {
          code: ERROR_CODES.MANAGER_UNASSIGNED_CAP_REACHED,
          message: 'Too many unassigned claims for available workers',
        },
        409,
      );
    }
  }

  // Backstop pentru index-urile partiale unice (race conditions sub Serializable).
  private mapUniqueViolation(
    e: unknown,
    actingUserId?: string,
    assignToUserId?: string | null,
  ): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = String((e.meta as { target?: string })?.target ?? '');
      if (target.includes('one_active_unoffered_per_assignee')) {
        const code =
          assignToUserId && assignToUserId === actingUserId
            ? ERROR_CODES.ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS
            : ERROR_CODES.ASSIGNED_USER_HAS_ACTIVE_CLAIM;
        return new HttpException({ code, message: 'Assignee already has an active claim' }, 409);
      }
      if (target.includes('one_active_per_company_per_request')) {
        return new HttpException(
          { code: ERROR_CODES.CLAIM_ALREADY_EXISTS, message: 'Company already claimed' },
          409,
        );
      }
    }
    return e;
  }

  private toDto(slot: ClaimSlot, chatThreadId: string): ClaimSlotDto {
    return {
      id: slot.id,
      requestId: slot.requestId,
      companyId: slot.companyId,
      claimedByUserId: slot.claimedByUserId,
      assignedToUserId: slot.assignedToUserId,
      status: slot.status,
      projectSizeSnapshot: slot.projectSizeSnapshot,
      projectScoreSnapshot: slot.projectScoreSnapshot,
      claimCostCreditsSnapshot: slot.claimCostCreditsSnapshot,
      chatThreadId,
      slaDeadlineAt: slot.slaDeadlineAt?.toISOString() ?? null,
      slaPaused: slot.slaPausedAt !== null,
      createdAt: slot.createdAt.toISOString(),
    };
  }
}
