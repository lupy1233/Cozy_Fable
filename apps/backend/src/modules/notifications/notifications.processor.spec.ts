import type { Job } from 'bullmq';
import { NotificationsProcessor } from './notifications.processor';
import type { NotificationsService } from './notifications.service';
import type { NotificationEmailsService } from './notification-emails.service';

describe('notification retry', () => {
  it('does not resend a delivered recipient when another recipient fails', async () => {
    const delivered = new Set<string>();
    const notifications = {
      createForUsers: jest.fn(),
      completeEvent: jest.fn(),
      pendingEmailRecipients: jest.fn(async () => ['first', 'second'].filter((id) => !delivered.has(id))),
      markEmailDelivered: jest.fn(async (_event: string, id: string) => { delivered.add(id); }),
    };
    const emails = { sendForEvent: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValue(undefined), sendBillingContactCopy: jest.fn() };
    const processor = new NotificationsProcessor(notifications as unknown as NotificationsService, emails as unknown as NotificationEmailsService);
    const job = { name: 'payment.confirmed', data: { __eventId: 'event-1', __targets: ['first', 'second'], orderId: 'order-1' } } as unknown as Job<Record<string, unknown>>;
    await expect(processor.process(job)).rejects.toThrow('SMTP down');
    await processor.process(job);
    expect(emails.sendForEvent.mock.calls.map((call) => call[1])).toEqual([['first'], ['second'], ['second']]);
    expect(notifications.createForUsers).toHaveBeenCalledWith(['first', 'second'], 'payment.confirmed', { orderId: 'order-1' }, 'event-1');
    expect(delivered.size).toBe(2);
    // E-company-24: copia contabilului o singura data, dupa emailurile membrilor, inainte de completeEvent
    expect(emails.sendBillingContactCopy).toHaveBeenCalledTimes(1);
    expect(emails.sendBillingContactCopy).toHaveBeenCalledWith('event-1', 'payment.confirmed', { orderId: 'order-1' });
    expect(emails.sendBillingContactCopy.mock.invocationCallOrder[0]).toBeLessThan(notifications.completeEvent.mock.invocationCallOrder[0]);
  });

  it('SMTP failure on the billing contact copy fails the job before completeEvent', async () => {
    const notifications = {
      createForUsers: jest.fn(),
      completeEvent: jest.fn(),
      pendingEmailRecipients: jest.fn(async () => []),
      markEmailDelivered: jest.fn(),
    };
    const emails = { sendForEvent: jest.fn(), sendBillingContactCopy: jest.fn().mockRejectedValueOnce(new Error('SMTP down')) };
    const processor = new NotificationsProcessor(notifications as unknown as NotificationsService, emails as unknown as NotificationEmailsService);
    const job = { name: 'payment.transfer_instructions', data: { __eventId: 'event-2', __targets: ['owner'], orderId: 'o2' } } as unknown as Job<Record<string, unknown>>;
    await expect(processor.process(job)).rejects.toThrow('SMTP down');
    expect(notifications.completeEvent).not.toHaveBeenCalled();
  });
});

// g1 (etapa 9): cel care a facut actiunea nu primeste nici clopotel, nici e-mail (un singur loc)
describe('actorUserId scos din destinatari', () => {
  function build(pending: (eventId: string, ids: string[]) => string[] = (_e, ids) => ids) {
    const notifications = {
      createForUsers: jest.fn(),
      completeEvent: jest.fn(),
      pendingEmailRecipients: jest.fn(async (eventId: string, ids: string[]) => pending(eventId, ids)),
      markEmailDelivered: jest.fn(),
    };
    const emails = { sendForEvent: jest.fn(), sendBillingContactCopy: jest.fn() };
    const processor = new NotificationsProcessor(notifications as unknown as NotificationsService, emails as unknown as NotificationEmailsService);
    return { processor, notifications, emails };
  }

  it('mesajul propriu: autorul (clientul) nu primeste clopotel si nici e-mail; ceilalti da', async () => {
    const { processor, notifications, emails } = build();
    const job = { name: 'message.created', data: { __eventId: 'e1', __targets: ['m1', 'm2', 'u-client'], senderUserId: 'u-client', actorUserId: 'u-client' } } as unknown as Job<Record<string, unknown>>;
    await processor.process(job);
    expect(notifications.createForUsers).toHaveBeenCalledWith(['m1', 'm2'], 'message.created', expect.objectContaining({ actorUserId: 'u-client' }), 'e1');
    expect(notifications.pendingEmailRecipients).toHaveBeenCalledWith('e1', ['m1', 'm2']);
    expect(emails.sendForEvent.mock.calls.map((c) => c[1])).toEqual([['m1'], ['m2']]);
    expect(notifications.completeEvent).toHaveBeenCalledWith('e1');
  });

  it('acceptarea proprie: clientul care a acceptat nu primeste nimic', async () => {
    const { processor, notifications } = build();
    const job = { name: 'quote.accepted', data: { __eventId: 'e2', __targets: ['u-client', 'm1'], actorUserId: 'u-client' } } as unknown as Job<Record<string, unknown>>;
    await processor.process(job);
    expect(notifications.createForUsers.mock.calls[0][0]).toEqual(['m1']);
  });

  it('singura tinta e autorul → nimic persistat, evenimentul se inchide', async () => {
    const { processor, notifications, emails } = build();
    const job = { name: 'clarification.asked', data: { __eventId: 'e3', __targets: ['m1'], actorUserId: 'm1' } } as unknown as Job<Record<string, unknown>>;
    await processor.process(job);
    expect(notifications.createForUsers).toHaveBeenCalledWith([], 'clarification.asked', expect.anything(), 'e3');
    expect(emails.sendForEvent).not.toHaveBeenCalled();
    expect(notifications.completeEvent).toHaveBeenCalledWith('e3');
  });

  it('fara eventId (cale veche): e-mailul primeste lista fara autor', async () => {
    const { processor, emails } = build();
    const job = { name: 'delivery.confirmed', data: { __targets: ['m1', 'u-client'], actorUserId: 'u-client' } } as unknown as Job<Record<string, unknown>>;
    await processor.process(job);
    expect(emails.sendForEvent).toHaveBeenCalledWith('delivery.confirmed', ['m1'], expect.anything());
  });
});
