import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@marketplace/shared';
import { AdminCalendarService } from './admin-calendar.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { MOVABLE_HOLIDAYS } from '../../infra/calendar/movable-holidays';
import type { CalendarSyncService } from '../../infra/calendar/calendar-sync.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

// E-admin-platform-25: CRUD calendar de lucru + calculator de termene (admin).
const ID = '11111111-1111-4111-8111-111111111111';

function makeService(opts: { today?: string; rows?: Array<{ date: Date; isWorkingDay: boolean }> } = {}) {
  const prisma = {
    businessCalendarHoliday: {
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: { date: Date; name: string; isWorkingDay: boolean } }) =>
        Promise.resolve({ id: ID, createdAt: new Date('2026-09-30T10:00:00Z'), ...args.data }),
      ),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const calendar = new BusinessCalendarService(prisma as unknown as PrismaService);
  if (opts.today) jest.spyOn(calendar, 'todayInBucharest').mockImplementation((now?: Date) => (now ? BusinessCalendarService.prototype.todayInBucharest.call(calendar, now) : opts.today as string));
  const sync = { notifyChanged: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminCalendarService(prisma as unknown as PrismaService, calendar, sync as unknown as CalendarSyncService);
  return { service, prisma, sync, calendar };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

describe('AdminCalendarService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create scrie data la miezul noptii UTC si anunta sincronizarea o data', async () => {
    const { service, prisma, sync } = makeService({ today: '2026-09-30' });
    const dto = await service.create({ date: '2026-10-02', name: '  Punte test ', isWorkingDay: false });
    expect(prisma.businessCalendarHoliday.create).toHaveBeenCalledWith({
      data: { date: new Date('2026-10-02T00:00:00.000Z'), name: 'Punte test', isWorkingDay: false },
    });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    expect(dto).toMatchObject({ id: ID, date: '2026-10-02', name: 'Punte test', isWorkingDay: false });
  });

  it('data existenta (P2002) → 409 CALENDAR_DATE_EXISTS fara sincronizare', async () => {
    const { service, prisma, sync } = makeService({ today: '2026-09-30' });
    prisma.businessCalendarHoliday.create.mockRejectedValueOnce(p2002());
    const err = await service.create({ date: '2026-10-02', name: 'Punte', isWorkingDay: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: ERROR_CODES.CALENDAR_DATE_EXISTS });
    expect(sync.notifyChanged).not.toHaveBeenCalled();
  });

  it.each([
    ['2026-09-29', 'in trecut'],
    ['2026-02-30', 'data inexistenta'],
    ['2032-01-02', 'dincolo de orizontul de 5 ani'],
  ])('%s (%s) → 400', async (date) => {
    const { service, prisma } = makeService({ today: '2026-09-30' });
    await expect(service.create({ date, name: 'Punte', isWorkingDay: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.businessCalendarHoliday.create).not.toHaveBeenCalled();
  });

  it('azi si 31 dec anul curent + 5 sunt acceptate', async () => {
    const { service } = makeService({ today: '2026-09-30' });
    await expect(service.create({ date: '2026-09-30', name: 'Azi', isWorkingDay: false })).resolves.toBeDefined();
    await expect(service.create({ date: '2031-12-31', name: 'Orizont', isWorkingDay: false })).resolves.toBeDefined();
  });

  it('update / delete pe id necunoscut → 404 fara sincronizare', async () => {
    const { service, sync } = makeService();
    await expect(service.update(ID, { isWorkingDay: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(sync.notifyChanged).not.toHaveBeenCalled();
  });

  it('update si delete reusite anunta sincronizarea', async () => {
    const { service, prisma, sync } = makeService();
    const row = { id: ID, date: new Date('2026-10-02T00:00:00.000Z'), name: 'Punte', isWorkingDay: false, createdAt: new Date() };
    prisma.businessCalendarHoliday.findUnique.mockResolvedValue(row);
    prisma.businessCalendarHoliday.update.mockResolvedValue({ ...row, isWorkingDay: true });
    const updated = await service.update(ID, { isWorkingDay: true });
    expect(prisma.businessCalendarHoliday.update).toHaveBeenCalledWith({ where: { id: ID }, data: { isWorkingDay: true } });
    expect(updated.isWorkingDay).toBe(true);
    const removed = await service.remove(ID);
    expect(removed).toEqual({ id: ID, ok: true, date: '2026-10-02', isWorkingDay: false });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it('overview: acoperirea listeaza sarbatorile mobile lipsa din anul urmator', async () => {
    const rows = MOVABLE_HOLIDAYS.filter((h) => Number(h.date.slice(0, 4)) <= 2028).map((h) => ({
      id: h.date,
      date: new Date(`${h.date}T00:00:00.000Z`),
      name: h.name,
      isWorkingDay: false,
      createdAt: new Date(),
    }));
    const { service } = makeService({ today: '2028-06-15', rows });
    const overview = await service.overview();
    expect(overview.year).toBe(2028);
    expect(overview.coverage).toEqual([
      { year: 2028, expected: ['2028-04-14', '2028-04-17', '2028-06-05'], missing: [] },
      { year: 2029, expected: ['2029-04-06', '2029-04-09', '2029-05-28'], missing: ['2029-04-06', '2029-04-09', '2029-05-28'] },
    ]);
    expect(overview.fixedHolidays.map((h) => h.date)).toContain('2028-01-06');
    expect(overview.fixedHolidays.map((h) => h.date)).toContain('2028-01-07');
  });

  it('check: claim luni 5 ian 2026 + 3 zile lucratoare = 12 ian; + 5 = 14 ian', () => {
    const { service } = makeService();
    expect(service.check('2026-01-05', 3)).toMatchObject({ from: '2026-01-05', workingDays: 3, deadlineDate: '2026-01-12', deadlineAt: '2026-01-12T21:59:59.999Z' });
    expect(service.check('2026-01-05', 5).deadlineDate).toBe('2026-01-14');
  });

  it('check pe o data inexistenta → 400', () => {
    const { service } = makeService();
    expect(() => service.check('2026-02-30', 1)).toThrow(BadRequestException);
  });
});
