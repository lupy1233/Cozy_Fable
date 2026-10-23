import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminRequestDetailDto,
  type CloseProjectInput,
  type CreditSettlementReason,
} from '@marketplace/shared';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_PROJECT_DEADLINES } from '../../infra/queues/queues.module';
import { ClaimSettlementService, type SettlementCreditOutcome } from '../billing/claim-settlement.service';
import { OutboxService } from '../outbox/outbox.service';
import { SETTLEMENT_REASON } from '../claims/claims.constants';
import { ProjectCasesService } from './project-cases.service';
import { removeProjectDeadlineJobs, toDateOnly, type ProjectDeadlineJob } from './project-deadlines';

// motivul din ledger pe rezultatul ales de admin (literal tipat, nu template string)
const PROJECT_CANCELLED_CREDIT_REASON: Record<SettlementCreditOutcome, CreditSettlementReason> = {
  REFUND: 'PROJECT_CANCELLED_REFUND',
  CONSUME: 'PROJECT_CANCELLED_CONSUME',
};

// E-admin-platform-3 — iesirea din fundatura "proiect acceptat blocat": DOAR adminul inchide
// proiectul (ACCEPTED/IN_EXECUTION → CANCELLED), alegand EXPLICIT ce se intampla cu creditele
// rezervate ale castigatorului (REFUND sau CONSUME, fara valoare implicita) + nota obligatorie.
// Tranzitia conditionata a cererii e biletul: dublu-click / doi admini → al doilea primeste
// 409 PROJECT_NOT_CLOSABLE, iar creditele se deconteaza o singura data (ClaimSettlementService.settle).
@Injectable()
export class ProjectClosureService {
  private readonly logger = new Logger(ProjectClosureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: ClaimSettlementService,
    private readonly outbox: OutboxService,
    private readonly cases: ProjectCasesService,
    @InjectQueue(QUEUE_PROJECT_DEADLINES) private readonly deadlinesQueue: Queue<ProjectDeadlineJob>,
  ) {}

  async closeAcceptedProject(
    adminUserId: string,
    requestId: string,
    dto: CloseProjectInput,
  ): Promise<AdminRequestDetailDto> {
    const exists = await this.prisma.request.findUnique({ where: { id: requestId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });

    const { deliveryDate } = await runTx(this.prisma, 'claim', async (tx) => {
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
      const now = new Date();
      const changed = await tx.request.updateMany({
        where: { id: requestId, status: { in: ['ACCEPTED', 'IN_EXECUTION'] }, deletedAt: null },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      if (changed.count === 0) throw ProjectCasesService.notClosable();
      const request = await tx.request.findUniqueOrThrow({
        where: { id: requestId },
        select: { clientUserId: true },
      });

      const winning = await tx.quote.findFirst({
        where: { requestId, status: 'ACCEPTED' },
        select: {
          claimSlotId: true,
          companyId: true,
          versions: { orderBy: { version: 'desc' }, take: 1, select: { deliveryDate: true } },
        },
      });
      let settled = false;
      let refunded = false;
      if (winning) {
        // oferta ACCEPTED ramane istoric; slotul castigator se inchide o singura data
        const res = await this.settlement.settle(tx, {
          claimSlotId: winning.claimSlotId,
          from: ['OFFER_SENT'],
          to: 'CANCELLED_PROJECT',
          outcome: dto.creditOutcome,
          reason: PROJECT_CANCELLED_CREDIT_REASON[dto.creditOutcome],
          quotes: 'WITHDRAWN',
        });
        settled = res.settled;
        refunded = res.settled && res.refunded;
        if (!res.settled) {
          // anomalie (slotul castigator nu mai era OFFER_SENT): cererea se inchide, banii nu
          this.logger.warn(`project close ${requestId}: winner slot ${winning.claimSlotId} not open, no credit movement`);
        }
      }

      await tx.requestProjectCase.updateMany({
        where: { requestId, status: 'OPEN' },
        data: {
          status: 'CLOSED_PROJECT_CANCELLED',
          resolvedByUserId: adminUserId,
          resolvedAt: now,
          creditOutcome: dto.creditOutcome,
          adminNote: dto.adminNote.trim(),
        },
      });

      if (winning && settled) {
        const members = await tx.companyMember.findMany({
          where: { companyId: winning.companyId },
          select: { userId: true },
        });
        await this.outbox.record(tx, `claim.withdrawn:${winning.claimSlotId}:${SETTLEMENT_REASON.PROJECT_CANCELLED}`,
          'claim.withdrawn',
          {
            claimSlotId: winning.claimSlotId,
            requestId,
            reason: SETTLEMENT_REASON.PROJECT_CANCELLED,
            refunded,
          },
          members.map((m) => m.userId),
        );
      }
      if (request.clientUserId) {
        await this.outbox.record(tx, `project.cancelled:${requestId}`,
          'project.cancelled',
          {
            requestId,
            claimSlotId: winning?.claimSlotId ?? null,
            companyId: winning?.companyId ?? null,
            clientUserId: request.clientUserId,
          },
          [request.clientUserId],
        );
      }
      await this.outbox.record(tx, `request.cancelled:${requestId}`, 'request.status_changed', { requestId, status: 'CANCELLED' }, []);
      return { deliveryDate: toDateOnly(winning?.versions[0]?.deliveryDate) };
    });

    // best-effort: procesorul de termene e oricum no-op pe CANCELLED
    if (deliveryDate) await removeProjectDeadlineJobs(this.deadlinesQueue, requestId, deliveryDate);
    return this.cases.getAdminRequestDetail(requestId);
  }
}
