import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NOTIFICATIONS } from '../queues/queues.module';
import { EventsGateway } from './events.gateway';

export type DomainEvent =
  | 'claim.created'
  | 'claim.withdrawn'
  | 'quote.created'
  | 'quote.updated'
  | 'quote.accepted'
  | 'message.created'
  | 'request.status_changed'
  | 'sla.expiring_soon'
  | 'withdrawal.reminder';

// Invarianta 3.5: TOATE evenimentele trec prin publish() —
// emite pe Socket.IO si pune in coada de notificari. Controllerele nu emit direct.
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly gateway: EventsGateway,
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  // targetUserIds: daca e dat, evenimentul se emite DOAR catre camerele `user:{id}` ale
  // participantilor (chat/oferte sunt private — invarianta 3.5 + confidentialitate 4.14).
  // Lipsa => broadcast (ex: request.status_changed catre marketplace).
  async publish(
    event: DomainEvent,
    payload: Record<string, unknown>,
    targetUserIds?: string[],
  ): Promise<void> {
    const unique = targetUserIds && targetUserIds.length > 0 ? [...new Set(targetUserIds)] : null;
    if (unique) {
      for (const userId of unique) {
        this.gateway.server?.to(`user:${userId}`).emit(event, payload);
      }
    } else {
      this.gateway.server?.emit(event, payload);
    }
    // __targets calatoreste in job ca procesorul de notificari sa stie destinatarii (Sprint 9).
    const jobPayload = unique ? { ...payload, __targets: unique } : payload;
    await this.notificationsQueue.add(event, jobPayload, {
      removeOnComplete: 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    this.logger.debug(`published ${event}`);
  }

  // Semnal de sesiune (3.13): la login nou pe alt device, socketul vechi
  // primeste auth_expired. Nu e eveniment de domeniu — nu intra in coada.
  emitAuthExpired(userId: string): void {
    this.gateway.server?.to(`user:${userId}`).emit('auth_expired');
  }
}
