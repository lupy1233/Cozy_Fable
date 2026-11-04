import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CLIENT_CASE_REASONS,
  COMPANY_CASE_REASONS,
  ERROR_CODES,
  type AdminRequestDetailDto,
  type AdminRequestFilter,
  type AdminRequestListItemDto,
  type AdminRequestListPageDto,
  type AdminTimelineEntryDto,
  type DismissProjectCaseInput,
  type OpenProjectCaseInput,
  type ProjectCaseDto,
  type RespondProjectCaseInput,
} from '@marketplace/shared';
import { Prisma, type RequestProjectCase, type RequestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { CompanyContext } from '../../common/company-context/company-context';
import { OutboxService } from '../outbox/outbox.service';
import { PROJECT_ACTIVE_STATUSES, toDateOnly } from './project-deadlines';

type Tx = Prisma.TransactionClient;

export type ProjectCaseActor =
  | { kind: 'CLIENT'; userId: string }
  | { kind: 'COMPANY'; userId: string; ctx: CompanyContext };

const ADMIN_PAGE_SIZE = 20;
// plafon pentru filtrul "intarziate" (calculat in memorie pe ultima versiune acceptata)
const OVERDUE_SCAN_LIMIT = 1000;
const ACTIVE: RequestStatus[] = [...PROJECT_ACTIVE_STATUSES];

export function toProjectCaseDto(c: RequestProjectCase): ProjectCaseDto {
  return {
    id: c.id,
    requestId: c.requestId,
    claimSlotId: c.claimSlotId,
    openedBy: c.openedBy,
    reason: c.reason,
    note: c.note,
    status: c.status,
    response: c.response,
    responseNote: c.responseNote,
    respondedAt: c.respondedAt?.toISOString() ?? null,
    creditOutcome: c.creditOutcome,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

// E-admin-platform-3 — cazurile raportate pe un proiect acceptat (client SAU firma
// castigatoare), raspunsul celeilalte parti si citirile adminului (/admin/requests).
// NU misca bani si NU inchide proiectul: doar adminul inchide (ProjectClosureService),
// alegand explicit REFUND/CONSUME — politica automata e DECIZIE NECESARA (PO).
@Injectable()
export class ProjectCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly calendar: BusinessCalendarService,
  ) {}

  // --- client / firma ---

  async open(actor: ProjectCaseActor, requestId: string, dto: OpenProjectCaseInput): Promise<ProjectCaseDto> {
    const { request, winning } = await this.loadForActor(actor, requestId);
    const allowed: readonly string[] = actor.kind === 'CLIENT' ? CLIENT_CASE_REASONS : COMPANY_CASE_REASONS;
    if (!allowed.includes(dto.reason)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Reason not allowed for this party' });
    }
    if (!winning) throw ProjectCasesService.notClosable();
    try {
      return await runTx(this.prisma, 'write', async (tx) => {
        const locked = await tx.$queryRaw<{ status: RequestStatus; deleted_at: Date | null }[]>`
          SELECT status, deleted_at FROM requests WHERE id = ${requestId} FOR UPDATE`;
        const row = locked[0];
        if (!row || row.deleted_at !== null || !ACTIVE.includes(row.status)) throw ProjectCasesService.notClosable();
        const existing = await tx.requestProjectCase.findFirst({ where: { requestId, status: 'OPEN' }, select: { id: true } });
        if (existing) throw ProjectCasesService.alreadyOpen();
        const created = await tx.requestProjectCase.create({
          data: {
            requestId,
            claimSlotId: winning.claimSlotId,
            openedBy: actor.kind,
            openedByUserId: actor.userId,
            reason: dto.reason,
            note: dto.note?.trim() || null,
          },
        });
        const otherSide =
          actor.kind === 'CLIENT'
            ? await this.companyMemberIds(winning.companyId, tx)
            : request.clientUserId
              ? [request.clientUserId]
              : [];
        await this.outbox.record(tx, `project.case_opened:${created.id}`,
          'project.case_opened',
          {
            requestId,
            claimSlotId: winning.claimSlotId,
            companyId: winning.companyId,
            caseId: created.id,
            reason: dto.reason,
            openedBy: actor.kind,
            // destinatarul emailului cand raporteaza firma (id, nu date personale)
            clientUserId: request.clientUserId,
          },
          [...otherSide, ...(await this.adminIds(tx))],
        );
        return toProjectCaseDto(created);
      });
    } catch (e) {
      // backstop-ul SQL (index unic partial) la doua deschideri concurente
      if (isUniqueViolation(e)) throw ProjectCasesService.alreadyOpen();
      throw e;
    }
  }

  async respond(actor: ProjectCaseActor, requestId: string, dto: RespondProjectCaseInput): Promise<ProjectCaseDto> {
    const { request, winning } = await this.loadForActor(actor, requestId);
    // raspunde DOAR cealalta parte fata de cea care a deschis cazul
    const openedBy = actor.kind === 'CLIENT' ? 'COMPANY' : 'CLIENT';
    const open = await this.prisma.requestProjectCase.findFirst({
      where: { requestId, status: 'OPEN', openedBy },
      orderBy: { createdAt: 'desc' },
    });
    if (!open || !winning) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Project case not found' });
    }
    return runTx(this.prisma, 'write', async (tx) => {
      const res = await tx.requestProjectCase.updateMany({
        where: { id: open.id, status: 'OPEN', response: null },
        data: {
          response: dto.confirmCancel ? 'CONFIRMED_CANCEL' : 'CONTESTED',
          respondedByUserId: actor.userId,
          responseNote: dto.note?.trim() || null,
          respondedAt: new Date(),
        },
      });
      if (res.count === 0) throw ProjectCasesService.notOpen();
      const openerSide =
        open.openedBy === 'CLIENT'
          ? request.clientUserId
            ? [request.clientUserId]
            : []
          : await this.companyMemberIds(winning.companyId, tx);
      await this.outbox.record(tx, `project.case_responded:${open.id}`,
        'project.case_responded',
        {
          requestId,
          claimSlotId: open.claimSlotId,
          companyId: winning.companyId,
          caseId: open.id,
          confirmed: dto.confirmCancel,
        },
        [...openerSide, ...(await this.adminIds(tx))],
      );
      return toProjectCaseDto(await tx.requestProjectCase.findUniqueOrThrow({ where: { id: open.id } }));
    });
  }

  async getForClient(userId: string, requestId: string): Promise<ProjectCaseDto | null> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId }, select: { clientUserId: true } });
    if (!request || request.clientUserId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    const latest = await this.prisma.requestProjectCase.findFirst({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });
    return latest ? toProjectCaseDto(latest) : null;
  }

  // --- admin ---

  async dismiss(adminUserId: string, caseId: string, dto: DismissProjectCaseInput): Promise<ProjectCaseDto> {
    const existing = await this.prisma.requestProjectCase.findUnique({
      where: { id: caseId },
      include: { request: { select: { clientUserId: true } }, claimSlot: { select: { companyId: true } } },
    });
    if (!existing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Project case not found' });
    return runTx(this.prisma, 'write', async (tx) => {
      const res = await tx.requestProjectCase.updateMany({
        where: { id: caseId, status: 'OPEN' },
        data: { status: 'DISMISSED', resolvedByUserId: adminUserId, resolvedAt: new Date(), adminNote: dto.adminNote.trim() },
      });
      if (res.count === 0) throw ProjectCasesService.notOpen();
      const members = await this.companyMemberIds(existing.claimSlot.companyId, tx);
      await this.outbox.record(tx, `project.case_dismissed:${caseId}`,
        'project.case_dismissed',
        {
          requestId: existing.requestId,
          claimSlotId: existing.claimSlotId,
          companyId: existing.claimSlot.companyId,
          caseId,
        },
        [...members, ...(existing.request.clientUserId ? [existing.request.clientUserId] : [])],
      );
      return toProjectCaseDto(await tx.requestProjectCase.findUniqueOrThrow({ where: { id: caseId } }));
    });
  }

  async listAdmin(filter: AdminRequestFilter = 'accepted', page = 1): Promise<AdminRequestListPageDto> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const where: Prisma.RequestWhereInput =
      filter === 'openCases'
        ? { projectCases: { some: { status: 'OPEN' } } }
        : filter === 'all'
          ? { quotes: { some: { status: 'ACCEPTED' } } }
          : { status: { in: ACTIVE } };
    const include = {
      quotes: {
        where: { status: 'ACCEPTED' as const },
        take: 1,
        select: {
          acceptedAt: true,
          company: { select: { name: true } },
          versions: { orderBy: { version: 'desc' as const }, take: 1, select: { deliveryDate: true } },
        },
      },
      projectCases: { where: { status: 'OPEN' as const }, select: { id: true }, take: 1 },
    } satisfies Prisma.RequestInclude;
    const today = this.calendar.todayInBucharest();
    type Row = Prisma.RequestGetPayload<{ include: typeof include }>;
    let rows: Row[];
    let total: number;
    if (filter === 'overdue') {
      const all = await this.prisma.request.findMany({ where, include, orderBy: { updatedAt: 'desc' }, take: OVERDUE_SCAN_LIMIT });
      const overdue = all.filter((r) => this.isOverdue(r.status, toDateOnly(r.quotes[0]?.versions[0]?.deliveryDate), today));
      total = overdue.length;
      rows = overdue.slice((safePage - 1) * ADMIN_PAGE_SIZE, safePage * ADMIN_PAGE_SIZE);
    } else {
      [rows, total] = await Promise.all([
        this.prisma.request.findMany({
          where,
          include,
          orderBy: { updatedAt: 'desc' },
          skip: (safePage - 1) * ADMIN_PAGE_SIZE,
          take: ADMIN_PAGE_SIZE,
        }),
        this.prisma.request.count({ where }),
      ]);
    }
    const clientIds = [...new Set(rows.map((r) => r.clientUserId).filter((id): id is string => !!id))];
    const clients = clientIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [];
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const items: AdminRequestListItemDto[] = rows.map((r) => {
      const winner = r.quotes[0];
      const deliveryDate = toDateOnly(winner?.versions[0]?.deliveryDate);
      return {
        id: r.id,
        title: r.title ?? '',
        status: r.status,
        clientName: r.clientUserId ? (clientName.get(r.clientUserId) ?? null) : null,
        winnerCompanyName: winner?.company.name ?? null,
        acceptedAt: winner?.acceptedAt?.toISOString() ?? null,
        deliveryDate,
        overdue: this.isOverdue(r.status, deliveryDate, today),
        openCase: r.projectCases.length > 0,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
    return { items, page: safePage, pageSize: ADMIN_PAGE_SIZE, total };
  }

  async getAdminRequestDetail(requestId: string): Promise<AdminRequestDetailDto> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    const [client, slots, quotes, cases] = await Promise.all([
      request.clientUserId
        ? this.prisma.user.findUnique({ where: { id: request.clientUserId }, select: { id: true, name: true, email: true } })
        : null,
      this.prisma.claimSlot.findMany({
        where: { requestId },
        orderBy: { createdAt: 'asc' },
        include: { company: { select: { name: true } } },
      }),
      this.prisma.quote.findMany({
        where: { requestId },
        orderBy: { createdAt: 'asc' },
        include: {
          company: { select: { name: true } },
          versions: {
            orderBy: { version: 'asc' },
            select: { version: true, price: true, deliveryDate: true, deliveryTerm: true, validUntil: true, sentAt: true },
          },
        },
      }),
      this.prisma.requestProjectCase.findMany({ where: { requestId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const slotIds = slots.map((s) => s.id);
    const [movements, audits] = await Promise.all([
      slotIds.length
        ? this.prisma.creditTransaction.findMany({
            where: { claimSlotId: { in: slotIds } },
            orderBy: { createdAt: 'asc' },
            include: { company: { select: { name: true } } },
          })
        : Promise.resolve([]),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'request', entityId: requestId },
            ...(cases.length ? [{ entityType: 'project_case', entityId: { in: cases.map((c) => c.id) } }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { action: true, role: true, createdAt: true },
      }),
    ]);

    const winningQuote = quotes.find((q) => q.status === 'ACCEPTED') ?? null;
    const winnerLatest = winningQuote?.versions[winningQuote.versions.length - 1] ?? null;
    const deliveryDate = toDateOnly(winnerLatest?.deliveryDate);
    const today = this.calendar.todayInBucharest();

    const timeline: AdminTimelineEntryDto[] = [];
    const push = (
      at: Date | null | undefined,
      kind: AdminTimelineEntryDto['kind'],
      params: AdminTimelineEntryDto['params'] = {},
    ) => {
      if (at) timeline.push({ at: at.toISOString(), kind, params });
    };
    push(request.createdAt, 'REQUEST_CREATED');
    push(request.publishedAt, 'REQUEST_PUBLISHED');
    push(request.deliveredAt, 'DELIVERED');
    push(request.cancelledAt, 'PROJECT_CANCELLED');
    for (const s of slots) {
      push(s.createdAt, 'CLAIMED', { company: s.company.name });
      push(s.withdrawnAt, 'SLOT_CLOSED', { company: s.company.name, status: s.status });
    }
    for (const q of quotes) {
      for (const v of q.versions) push(v.sentAt, 'QUOTE_VERSION_SENT', { company: q.company.name, version: v.version });
      push(q.acceptedAt, 'QUOTE_ACCEPTED', { company: q.company.name });
    }
    for (const m of movements) {
      push(m.createdAt, 'CREDIT_MOVEMENT', { company: m.company.name, type: m.type, amount: m.amount, reason: m.reason });
    }
    for (const c of cases) {
      push(c.createdAt, 'CASE_OPENED', { openedBy: c.openedBy, reason: c.reason });
      push(c.respondedAt, 'CASE_RESPONDED', { response: c.response });
      push(c.resolvedAt, 'CASE_RESOLVED', { status: c.status, creditOutcome: c.creditOutcome });
    }
    for (const a of audits) push(a.createdAt, 'AUDIT', { action: a.action, role: a.role });
    timeline.sort((a, b) => a.at.localeCompare(b.at));

    return {
      id: request.id,
      title: request.title ?? '',
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      publishedAt: request.publishedAt?.toISOString() ?? null,
      deliveredAt: request.deliveredAt?.toISOString() ?? null,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      client: client ? { id: client.id, name: client.name, email: client.email } : null,
      winner: winningQuote
        ? { companyId: winningQuote.companyId, companyName: winningQuote.company.name, claimSlotId: winningQuote.claimSlotId }
        : null,
      deliveryDate,
      overdue: this.isOverdue(request.status, deliveryDate, today),
      slots: slots.map((s) => ({
        id: s.id,
        companyId: s.companyId,
        companyName: s.company.name,
        status: s.status,
        claimCostCreditsSnapshot: s.claimCostCreditsSnapshot,
        createdAt: s.createdAt.toISOString(),
        withdrawnAt: s.withdrawnAt?.toISOString() ?? null,
      })),
      quotes: quotes.map((q) => {
        const latest = q.versions[q.versions.length - 1];
        return {
          id: q.id,
          claimSlotId: q.claimSlotId,
          companyName: q.company.name,
          status: q.status,
          acceptedAt: q.acceptedAt?.toISOString() ?? null,
          price: latest ? Number(latest.price) : 0,
          currency: q.currency,
          deliveryDate: toDateOnly(latest?.deliveryDate),
          deliveryTerm: latest?.deliveryTerm ?? null,
          validUntil: latest ? latest.validUntil.toISOString() : q.createdAt.toISOString(),
        };
      }),
      creditMovements: movements.map((m) => ({
        id: m.id,
        companyName: m.company.name,
        type: m.type,
        amount: m.amount,
        reason: m.reason,
        claimSlotId: m.claimSlotId,
        createdAt: m.createdAt.toISOString(),
      })),
      cases: cases.map(toProjectCaseDto),
      timeline,
      closable: ACTIVE.includes(request.status) && request.deletedAt === null,
    };
  }

  // --- helpers ---

  private isOverdue(status: RequestStatus, deliveryDate: string | null, today: string): boolean {
    return !!deliveryDate && ACTIVE.includes(status) && deliveryDate < today;
  }

  // Ownership (IDOR → 404): clientul detine cererea; firma detine oferta ACCEPTED.
  // Firma: doar OWNER/MANAGER actioneaza (aceeasi regula ca markDelivered).
  private async loadForActor(actor: ProjectCaseActor, requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, clientUserId: true, status: true },
    });
    if (!request) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    const winning = await this.prisma.quote.findFirst({
      where: { requestId, status: 'ACCEPTED' },
      select: { claimSlotId: true, companyId: true },
    });
    if (actor.kind === 'CLIENT') {
      if (request.clientUserId !== actor.userId) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
      }
    } else {
      if (!winning || winning.companyId !== actor.ctx.companyId) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
      }
      if (actor.ctx.memberRole !== 'OWNER' && actor.ctx.memberRole !== 'MANAGER') {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Only the owner or a manager can report a project' });
      }
    }
    return { request, winning };
  }

  private async companyMemberIds(companyId: string, db: Tx): Promise<string[]> {
    const members = await db.companyMember.findMany({ where: { companyId }, select: { userId: true } });
    return members.map((m) => m.userId);
  }

  private async adminIds(db: Tx): Promise<string[]> {
    const admins = await db.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
    return admins.map((a) => a.id);
  }

  static notClosable(): HttpException {
    return new HttpException({ code: ERROR_CODES.PROJECT_NOT_CLOSABLE, message: 'Project is not open' }, 409);
  }

  private static alreadyOpen(): HttpException {
    return new HttpException({ code: ERROR_CODES.PROJECT_CASE_ALREADY_OPEN, message: 'A project case is already open' }, 409);
  }

  private static notOpen(): HttpException {
    return new HttpException({ code: ERROR_CODES.PROJECT_CASE_NOT_OPEN, message: 'Project case is not open' }, 409);
  }
}
