import { BusinessCalendarService } from './business-calendar.service';
import type { PrismaService } from '../prisma/prisma.service';

// Invarianta 3.3: SLA in zile lucratoare Europe/Bucharest (weekend + sarbatori
// fixe + override-uri din business_calendar_holidays).

function makeService(holidays: Array<{ date: Date; isWorkingDay: boolean }> = []) {
  const prisma = {
    businessCalendarHoliday: { findMany: jest.fn().mockResolvedValue(holidays) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return new BusinessCalendarService(prisma as PrismaService);
}

// componentele de data Bucuresti ale unui instant (pentru asertii lizibile)
function bucharestDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

describe('BusinessCalendarService.addWorkingDays', () => {
  it('sare weekendul: vineri + 1 zi lucratoare = luni', () => {
    const service = makeService();
    // vineri 10 iulie 2026, 10:00 Bucuresti (07:00 UTC vara)
    const friday = new Date('2026-07-10T07:00:00Z');
    const deadline = service.addWorkingDays(friday, 1);
    expect(bucharestDate(deadline)).toBe('2026-07-13'); // luni
  });

  it('5 zile lucratoare din luni = lunea urmatoare', () => {
    const service = makeService();
    const monday = new Date('2026-07-06T07:00:00Z');
    const deadline = service.addWorkingDays(monday, 5);
    expect(bucharestDate(deadline)).toBe('2026-07-13');
  });

  it('sare sarbatoarea legala fixa (1 Decembrie)', () => {
    const service = makeService();
    // luni 30 noiembrie 2026 e Sf. Andrei (sarbatoare) — pornim de vineri 27
    const friday = new Date('2026-11-27T08:00:00Z');
    // +1 zi lucratoare: sambata/duminica sar, luni 30 = sarbatoare, marti 1 dec = sarbatoare
    const deadline = service.addWorkingDays(friday, 1);
    expect(bucharestDate(deadline)).toBe('2026-12-02'); // miercuri
  });

  it('override-ul admin poate face o sarbatoare zi lucratoare (punte inversa)', async () => {
    // 1 dec 2026 fortat ca zi lucratoare prin business_calendar_holidays
    const service = makeService([
      { date: new Date(Date.UTC(2026, 11, 1)), isWorkingDay: true },
      // si 30 nov ramane sarbatoare (fixa) — nu are nevoie de override
    ]);
    await service.refresh();
    const friday = new Date('2026-11-27T08:00:00Z');
    const deadline = service.addWorkingDays(friday, 1);
    expect(bucharestDate(deadline)).toBe('2026-12-01');
  });

  it('deadline-ul este sfarsitul zilei (23:59) ora Bucurestiului', () => {
    const service = makeService();
    const monday = new Date('2026-07-06T07:00:00Z');
    const deadline = service.addWorkingDays(monday, 1);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(deadline);
    expect(time).toBe('23:59');
  });
});
