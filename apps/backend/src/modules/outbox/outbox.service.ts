import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService, type DomainEvent } from '../../infra/event-bus/event-bus.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  constructor(private readonly prisma: PrismaService, private readonly events: EventBusService) {}

  async record(tx: Prisma.TransactionClient, eventKey: string, eventType: DomainEvent, payload: Record<string, unknown>, targetUserIds: string[]): Promise<void> {
    const { requestTitle, companyName, ...metadata } = payload;
    void requestTitle;
    void companyName;
    // Un singur INSERT ... ON CONFLICT DO NOTHING pe cheia unica a evenimentului
    // (upsert-ul cu update gol costa 3 round-trip-uri in tranzactia apelantului).
    await tx.domainEventOutbox.createMany({
      data: [{ eventKey, eventType, payload: metadata as Prisma.InputJsonValue, targetUserIds: [...new Set(targetUserIds)] }],
      skipDuplicates: true,
    });
  }

  async dispatchBatch(): Promise<void> {
    const now = new Date();
    const replayBefore = new Date(now.getTime() - 60_000);
    const eligible = {
      completedAt: null,
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
        { OR: [{ dispatchedAt: null }, { dispatchedAt: { lt: replayBefore } }] },
      ],
    };
    const candidates = await this.prisma.domainEventOutbox.findMany({
      where: eligible,
      orderBy: { createdAt: 'asc' }, take: 50,
    });
    let failed = false;
    for (const event of candidates) {
      // Rezervare conditionata: doi workeri nu livreaza simultan acelasi eveniment.
      const leaseUntil = new Date(Date.now() + 120_000);
      const claimed = await this.prisma.domainEventOutbox.updateMany({
        where: { id: event.id, ...eligible },
        data: { leaseUntil, attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      try {
        const payload = event.payload as Record<string, unknown>;
        const company = typeof payload.companyId === 'string'
          ? await this.prisma.company.findUnique({ where: { id: payload.companyId }, select: { name: true, status: true, rejectionReason: true } }) : null;
        const request = event.eventType !== 'request.status_changed' && typeof payload.requestId === 'string'
          ? await this.prisma.request.findUnique({ where: { id: payload.requestId }, select: { title: true } }) : null;
        if (event.targetUserIds.length > 0 || event.eventType === 'request.status_changed') {
          await this.events.publish(event.eventType as DomainEvent, { ...payload, ...(company ? { companyName: company.name } : {}), ...(event.eventType === 'company.rejected' && company?.status === 'REJECTED' ? { reason: company.rejectionReason } : {}), ...(request ? { requestTitle: request.title ?? '' } : {}) }, event.targetUserIds, event.id);
        }
        await this.prisma.domainEventOutbox.updateMany({ where: { id: event.id, leaseUntil }, data: { dispatchedAt: new Date(), ...(event.targetUserIds.length === 0 ? { completedAt: new Date() } : {}), leaseUntil: null, lastError: null } });
      } catch {
        failed = true;
        // Nu persistam mesajul extern: poate contine URL-uri semnate sau alte secrete.
        await this.prisma.domainEventOutbox.updateMany({ where: { id: event.id, leaseUntil }, data: { leaseUntil: null, lastError: 'DELIVERY_FAILED' } });
        this.logger.warn(`outbox delivery failed for ${event.id}`);
      }
    }
    if (failed) throw new Error('Outbox delivery incomplete');
  }
}
