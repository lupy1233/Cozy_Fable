import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
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
  | 'withdrawal.reminder'
  // L1 notificari tintite (audit 2026-08-23): fiecare moment vizibil utilizatorului are tip
  // distinct + targetUserIds — NU refolosi request.status_changed generic (broadcastul se
  // arunca la persistare). Vezi IMPACT eveniment nou in Codex.
  | 'company.approved'
  | 'company.rejected'
  | 'company.suspended'
  | 'penalty.applied'
  | 'delivery.marked'
  | 'delivery.confirmed'
  | 'review.created'
  | 'request.expired'
  | 'withdrawal.decided'
  | 'payment.confirmed'
  | 'subscription.expiring'
  // Pasul 5 (audit 2026-08-23): iesiri din fundaturi + notificari admin
  | 'delivery.autocompleted'
  | 'company.unsuspended'
  | 'company.submitted'
  | 'payment.pending'
  | 'dispute.opened'
  // Pasul 6 (audit 2026-08-23): moderare + blocari
  | 'dispute.decided'
  // E-admin-platform-3: proiect acceptat blocat / anulat, termene de livrare, oferte expirate
  | 'project.case_opened'
  | 'project.case_responded'
  | 'project.case_dismissed'
  | 'project.cancelled'
  | 'project.delivery_reminder'
  | 'project.overdue'
  | 'quote.expired'
  | 'quote.expired_closed'
  | 'quote.extension_requested'
  // E-admin-platform-44: termene apropiate
  | 'request.expiry_reminder'
  | 'claim.assign_warning'
  // E-admin-platform-15: verificarea zilnica ledger vs portofel a gasit neconcordante (admini)
  | 'credits.ledger_mismatch'
  // E-company-24: plata prin transfer bancar — date de plata + proforma, reminder, anulare
  // automata (OWNER/MANAGER) si "Am platit" (admini)
  | 'payment.transfer_instructions'
  | 'payment.transfer_reminder'
  | 'payment.auto_cancelled'
  | 'payment.marked_paid';

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
  // Lipsa => no-op privat; doar request.status_changed poate fi public.
  async publish(
    event: DomainEvent,
    payload: Record<string, unknown>,
    targetUserIds?: string[],
    eventId: string = randomUUID(),
  ): Promise<void> {
    const unique = targetUserIds && targetUserIds.length > 0 ? [...new Set(targetUserIds)] : null;
    // Singurul eveniment public este invalidarea listei de cereri. Lipsa
    // destinatarilor unui eveniment privat nu acorda drept de broadcast.
    if (!unique && event !== 'request.status_changed') return;
    await this.gateway.publishToActiveSessions(event, payload, unique);
    // __targets calatoreste in job ca procesorul de notificari sa stie destinatarii (Sprint 9).
    const jobPayload = { ...payload, ...(unique ? { __targets: unique } : {}), ...(eventId ? { __eventId: eventId } : {}) };
    const job = await this.notificationsQueue.add(event, jobPayload, {
      ...(eventId ? { jobId: `event-${eventId}` } : {}),
      removeOnComplete: 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    // Intentul DB ramane incomplet pana la finalizarea consumatorului; replay-ul
    // poate relua si un job care si-a epuizat anterior incercarile automate.
    if (await job.getState() === 'failed') await job.retry();
    this.logger.debug(`published ${event}`);
  }

  // Semnal de sesiune (3.13): la login nou pe alt device, socketul vechi
  // primeste auth_expired. Nu e eveniment de domeniu — nu intra in coada.
  emitAuthExpired(userId: string): void {
    this.gateway.server?.to(`user:${userId}`).emit('auth_expired');
    this.gateway.server?.in(`user:${userId}`).disconnectSockets(true);
  }
}
