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
