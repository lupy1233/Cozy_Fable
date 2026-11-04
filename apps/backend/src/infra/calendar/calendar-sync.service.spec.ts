import type Redis from 'ioredis';
import { CALENDAR_CHANNEL, CalendarSyncService } from './calendar-sync.service';
import type { BusinessCalendarService } from './business-calendar.service';

// E-admin-platform-25: sincronizarea cache-ului de sarbatori intre procese (blue/green).
function setup() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const sub: { on: jest.Mock; subscribe: jest.Mock; quit: jest.Mock } = {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void): unknown => {
      handlers[event] = handler;
      return sub;
    }),
    subscribe: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  const redis = { duplicate: jest.fn(() => sub), publish: jest.fn().mockResolvedValue(1) };
  const calendar = { refresh: jest.fn().mockResolvedValue(undefined) };
  const service = new CalendarSyncService(calendar as unknown as BusinessCalendarService, redis as unknown as Redis);
  return { service, sub, redis, calendar, handlers };
}

describe('CalendarSyncService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('notifyChanged reincarca local si apoi publica pe canal', async () => {
    const { service, redis, calendar } = setup();
    await service.notifyChanged();
    expect(calendar.refresh).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledWith(CALENDAR_CHANNEL, expect.any(String));
    expect(calendar.refresh.mock.invocationCallOrder[0]).toBeLessThan(redis.publish.mock.invocationCallOrder[0]);
  });

  it('se aboneaza la canal si reincarca doar pentru mesajele calendarului', async () => {
    const { service, sub, calendar, handlers } = setup();
    service.onModuleInit();
    expect(sub.subscribe).toHaveBeenCalledWith(CALENDAR_CHANNEL);
    handlers.message('alt:canal', 'x');
    expect(calendar.refresh).not.toHaveBeenCalled();
    handlers.message(CALENDAR_CHANNEL, '123');
    expect(calendar.refresh).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });

  it('un publish esuat nu arunca (doar warn)', async () => {
    const { service, redis } = setup();
    redis.publish.mockRejectedValueOnce(new Error('down'));
    await expect(service.notifyChanged()).resolves.toBeUndefined();
  });

  it('un refresh esuat nu arunca', async () => {
    const { service, calendar } = setup();
    calendar.refresh.mockRejectedValueOnce(new Error('db down'));
    await expect(service.notifyChanged()).resolves.toBeUndefined();
  });

  it('reincarcarea periodica ruleaza la 10 minute', async () => {
    const { service, calendar } = setup();
    service.onModuleInit();
    jest.advanceTimersByTime(10 * 60_000 - 1);
    expect(calendar.refresh).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(calendar.refresh).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });

  it('onModuleDestroy opreste intervalul si inchide abonatul', async () => {
    const { service, sub, calendar } = setup();
    service.onModuleInit();
    await service.onModuleDestroy();
    expect(sub.quit).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30 * 60_000);
    expect(calendar.refresh).not.toHaveBeenCalled();
  });

  it('abonarea esuata nu blocheaza pornirea', async () => {
    const { service, sub } = setup();
    sub.subscribe.mockRejectedValueOnce(new Error('redis down'));
    expect(() => service.onModuleInit()).not.toThrow();
    await service.onModuleDestroy();
  });
});
