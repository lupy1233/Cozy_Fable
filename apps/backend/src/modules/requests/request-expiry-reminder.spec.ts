import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { RequestExpirationProcessor } from './request-expiration.processor';
import {
  REQUEST_EXPIRY_REMINDER_JOB,
  requestExpiryReminderAt,
  scheduleRequestExpiryReminder,
} from './request-expiry-reminder';

// E-admin-platform-44 — 4.4: reminder catre client dupa 3 zile lucratoare fara preluare.

/* eslint-disable @typescript-eslint/no-explicit-any */
function realCalendar(): BusinessCalendarService {
  const prisma = { businessCalendarHoliday: { findMany: jest.fn().mockResolvedValue([]) } } as any;
  return new BusinessCalendarService(prisma as PrismaService);
}

describe('requestExpiryReminderAt', () => {
  it('publicare luni 5 oct 2026 → expira sfarsitul lui 12 oct → reminder vineri 9 oct 09:00 Bucuresti', () => {
    const calendar = realCalendar();
    const publishedAt = new Date('2026-10-05T08:00:00Z');
    const expiresAt = calendar.addWorkingDays(publishedAt, 5);
    expect(calendar.todayInBucharest(expiresAt)).toBe('2026-10-12');
    expect(requestExpiryReminderAt(calendar, expiresAt).toISOString()).toBe('2026-10-09T06:00:00.000Z');
  });

  it('programarea: jobId determinist, delay pana la reminder, nimic dupa expirare', async () => {
    const calendar = realCalendar();
    const expiresAt = calendar.endOfBucharestDate('2026-10-12');
    const now = Date.parse('2026-10-05T08:00:00Z');
    const queue: any = { add: jest.fn().mockResolvedValue(undefined) };
    await scheduleRequestExpiryReminder(queue, calendar, 'r1', expiresAt, now);
    expect(queue.add).toHaveBeenCalledWith(
      REQUEST_EXPIRY_REMINDER_JOB,
      { requestId: 'r1', expiresAt: expiresAt.toISOString(), remindAt: '2026-10-09T06:00:00.000Z' },
      expect.objectContaining({
        jobId: `req-rem-r1-${expiresAt.getTime()}`,
        delay: Date.parse('2026-10-09T06:00:00.000Z') - now,
      }),
    );
    queue.add.mockClear();
    await scheduleRequestExpiryReminder(queue, calendar, 'r1', expiresAt, expiresAt.getTime() + 1);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('eroarea Redis nu se propaga (sweep-ul e plasa)', async () => {
    const calendar = realCalendar();
    const queue: any = { add: jest.fn().mockRejectedValue(new Error('redis down')) };
    await expect(
      scheduleRequestExpiryReminder(queue, calendar, 'r1', calendar.endOfBucharestDate('2026-10-12'), Date.parse('2026-10-05T08:00:00Z')),
    ).resolves.toBeUndefined();
  });
});

describe('RequestExpirationProcessor — remind-expiry', () => {
  const hour = 60 * 60 * 1000;

  function harness(request: Record<string, unknown> | null) {
    const tx: any = { request: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const prisma: any = {
      request: { findUnique: jest.fn().mockResolvedValue(request) },
      $transaction: jest.fn((run) => run(tx)),
    };
    const outbox: any = { record: jest.fn() };
    return { tx, prisma, outbox, worker: new RequestExpirationProcessor(prisma, outbox) };
  }

  function job(expiresAt: Date, remindAt: Date, name = REQUEST_EXPIRY_REMINDER_JOB) {
    return { name, data: { requestId: 'r1', expiresAt: expiresAt.toISOString(), remindAt: remindAt.toISOString() } } as any;
  }

  it('happy path: request.expiry_reminder catre client, cheie cu termenul', async () => {
    const expiresAt = new Date(Date.now() + 6 * hour);
    const h = harness({ status: 'IN_MARKETPLACE', deletedAt: null, expiresAt, clientUserId: 'client' });
    await h.worker.process(job(expiresAt, new Date(Date.now() - hour)));
    expect(h.outbox.record).toHaveBeenCalledWith(
      h.tx,
      `request.expiry_reminder:r1:${expiresAt.getTime()}`,
      'request.expiry_reminder',
      { requestId: 'r1', expiresAt: expiresAt.toISOString(), clientUserId: 'client' },
      ['client'],
    );
    expect(h.tx.request.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['cerere preluata (CLAIMED_PARTIAL)', { status: 'CLAIMED_PARTIAL' }, 0, -1],
    ['cerere stearsa', { deletedAt: new Date() }, 0, -1],
    ['termen mutat (repost)', {}, hour, -1],
    ['inainte de momentul reminderului', {}, 0, 1],
  ])('no-op: %s', async (_label, override, shiftExpiry, remindSign) => {
    const expiresAt = new Date(Date.now() + 6 * hour);
    const h = harness({ status: 'IN_MARKETPLACE', deletedAt: null, expiresAt, clientUserId: 'client', ...override });
    const scheduledExpiry = new Date(expiresAt.getTime() + (shiftExpiry as number));
    await h.worker.process(job(scheduledExpiry, new Date(Date.now() + (remindSign as number) * hour)));
    expect(h.outbox.record).not.toHaveBeenCalled();
  });

  it('no-op dupa expirare', async () => {
    const expiresAt = new Date(Date.now() - 1000);
    const h = harness({ status: 'IN_MARKETPLACE', deletedAt: null, expiresAt, clientUserId: 'client' });
    await h.worker.process(job(expiresAt, new Date(Date.now() - hour)));
    expect(h.outbox.record).not.toHaveBeenCalled();
  });

  it("jobul 'expire' expira in continuare cererea", async () => {
    const expiresAt = new Date(Date.now() - 1000);
    const h = harness({ status: 'IN_MARKETPLACE', deletedAt: null, expiresAt, clientUserId: 'client' });
    await h.worker.process({ name: 'expire', data: { requestId: 'r1' } } as any);
    expect(h.tx.request.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
    expect(h.outbox.record).toHaveBeenCalledWith(h.tx, `request.expired:r1:${expiresAt.getTime()}`, 'request.expired', { requestId: 'r1' }, ['client']);
  });
});
