import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_PROJECT_DEADLINES } from '../../infra/queues/queues.module';
import { SettingsService } from '../../common/settings/settings.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
  SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
} from '../claims/claims.constants';
import {
  DELIVERY_OVERDUE_JOB,
  DELIVERY_REMINDER_JOB,
  PROJECT_ACTIVE_STATUSES,
  overdueAt,
  reminderDue,
  toDateOnly,
  type ProjectDeadlineJob,
} from './project-deadlines';

// E-admin-platform-3 — reminder de livrare (firma) + termen depasit (client + firma).
// Idempotent: re-verifica starea cererii, data de livrare a ofertei castigatoare si ceasul;
// cheia outbox determinista (cerere + data) face notificarea exact-o-data chiar daca jobul
// si sweep-ul de reconciliere ruleaza amandoi. Nu misca bani si nu schimba stari.
@Processor(QUEUE_PROJECT_DEADLINES)
export class ProjectDeadlinesProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectDeadlinesProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly calendar: BusinessCalendarService,
    private readonly settings: SettingsService,
  ) {
    super();
  }

  async process(job: Job<ProjectDeadlineJob>): Promise<void> {
    const { requestId, deliveryDate } = job.data;
    const kind = job.name === DELIVERY_OVERDUE_JOB ? 'overdue' : job.name === DELIVERY_REMINDER_JOB ? 'reminder' : null;
    if (!kind) return;
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true, deletedAt: true, clientUserId: true },
    });
    if (!request || request.deletedAt) return;
    if (!(PROJECT_ACTIVE_STATUSES as readonly string[]).includes(request.status)) return;
    const winning = await this.prisma.quote.findFirst({
      where: { requestId, status: 'ACCEPTED' },
      select: {
        claimSlotId: true,
        companyId: true,
        acceptedAt: true,
        versions: { orderBy: { version: 'desc' }, take: 1, select: { deliveryDate: true } },
      },
    });
    if (!winning || toDateOnly(winning.versions[0]?.deliveryDate) !== deliveryDate) return; // data schimbata / fara data
    const now = Date.now();
    if (kind === 'reminder') {
      const daysBefore = await this.settings.getInt(
        SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
        DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
      );
      if (!reminderDue(this.calendar, deliveryDate, daysBefore, winning.acceptedAt, now)) return;
    } else if (now < overdueAt(this.calendar, deliveryDate).getTime()) {
      return;
    }

    await runTx(this.prisma, 'write', async (tx) => {
      const members = await tx.companyMember.findMany({
        where: { companyId: winning.companyId },
        select: { userId: true },
      });
      const memberIds = members.map((m) => m.userId);
      if (kind === 'reminder') {
        await this.outbox.record(tx, `project.delivery_reminder:${requestId}:${deliveryDate}`,
          'project.delivery_reminder',
          { requestId, claimSlotId: winning.claimSlotId, companyId: winning.companyId, deliveryDate },
          memberIds,
        );
        return;
      }
      await this.outbox.record(tx, `project.overdue:${requestId}:${deliveryDate}`,
        'project.overdue',
        {
          requestId,
          claimSlotId: winning.claimSlotId,
          companyId: winning.companyId,
          deliveryDate,
          clientUserId: request.clientUserId,
        },
        [...memberIds, ...(request.clientUserId ? [request.clientUserId] : [])],
      );
    });
    this.logger.debug(`project ${requestId}: ${kind} pentru ${deliveryDate}`);
  }
}
