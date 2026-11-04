import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { BusinessCalendarService } from './business-calendar.service';
import { MOVABLE_HOLIDAYS, MOVABLE_HOLIDAYS_LAST_YEAR } from './movable-holidays';
import { SLA_DAYS } from '../../modules/claims/claims.constants';
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

// E-admin-platform-3: termenele de livrare (reminder 09:00 / depasire dupa 23:59:59.999)
// calculate in ora de perete Bucuresti, inclusiv in zilele cu schimbare DST.
describe('BusinessCalendarService — ora de perete Bucuresti', () => {
  const service = makeService();

  it('09:00 Bucuresti iarna = 07:00 UTC, vara = 06:00 UTC', () => {
    expect(service.bucharestWallClock('2026-01-15', 9).toISOString()).toBe('2026-01-15T07:00:00.000Z');
    expect(service.bucharestWallClock('2026-07-15', 9).toISOString()).toBe('2026-07-15T06:00:00.000Z');
  });

  it('ziua trecerii la ora de vara (29 martie 2026): 09:00 EEST = 06:00 UTC', () => {
    expect(service.bucharestWallClock('2026-03-28', 9).toISOString()).toBe('2026-03-28T07:00:00.000Z');
    expect(service.bucharestWallClock('2026-03-29', 9).toISOString()).toBe('2026-03-29T06:00:00.000Z');
  });

  it('sfarsitul zilei in ziua trecerii la ora de iarna (25 octombrie 2026) = 21:59:59.999 UTC', () => {
    expect(service.endOfBucharestDate('2026-10-24').toISOString()).toBe('2026-10-24T20:59:59.999Z');
    expect(service.endOfBucharestDate('2026-10-25').toISOString()).toBe('2026-10-25T21:59:59.999Z');
  });

  it('todayInBucharest foloseste data locala (dupa miezul noptii Bucuresti = ziua urmatoare)', () => {
    // 22:30 UTC vara = 01:30 Bucuresti a doua zi
    expect(service.todayInBucharest(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
    expect(service.todayInBucharest(new Date('2026-07-10T20:30:00Z'))).toBe('2026-07-10');
  });

  it('refuza valori care nu sunt YYYY-MM-DD', () => {
    expect(() => service.bucharestWallClock('2026-7-1', 9)).toThrow();
  });
});

// E-admin-platform-44: ziua lucratoare cu N zile lucratoare inaintea unui termen
// (reminderul de expirare a cererii).
describe('BusinessCalendarService.workingDateBefore', () => {
  const service = makeService();

  it('luni 12 oct 2026 (sfarsitul zilei), 1 zi lucratoare inainte = vineri 9 oct', () => {
    const mondayEnd = service.endOfBucharestDate('2026-10-12');
    expect(service.workingDateBefore(mondayEnd, 1)).toBe('2026-10-09');
  });

  it('sare Craciunul (25-26 dec) si weekendul: luni 28 dec 2026, 1 zi = joi 24 dec', () => {
    const mondayEnd = service.endOfBucharestDate('2026-12-28');
    expect(service.workingDateBefore(mondayEnd, 1)).toBe('2026-12-24');
  });

  it('0 zile = ziua termenului insusi (in ora Bucurestiului)', () => {
    const mondayEnd = service.endOfBucharestDate('2026-10-12');
    expect(service.workingDateBefore(mondayEnd, 0)).toBe('2026-10-12');
  });
});

// ===== E-admin-platform-25: toate sarbatorile legale RO in termenele firmelor =====
// Fixe din date-holidays (Decizia 6), mobile DOAR din business_calendar_holidays.

async function withMovable(extra: Array<{ date: Date; isWorkingDay: boolean }> = []) {
  const rows = MOVABLE_HOLIDAYS.map((h) => ({ date: new Date(`${h.date}T00:00:00.000Z`), isWorkingDay: false }));
  const service = makeService([...rows, ...extra]);
  await service.refresh();
  return service;
}

// Lista legala (Codul muncii art. 139, sarbatori cu data fixa), verificata in spec ca un
// upgrade al bibliotecii sa nu schimbe datele pe tacute.
const STATUTORY_FIXED = ['1-1', '1-2', '1-6', '1-7', '1-24', '5-1', '6-1', '8-15', '11-30', '12-1', '12-25', '12-26'];

describe('BusinessCalendarService — sarbatori legale fixe (date-holidays)', () => {
  const service = makeService();
  const years = [2026, 2027, 2028, 2029, 2030];

  it.each(years)('%i: lista fixa este exact cea legala', (year) => {
    const monthDays = service.fixedHolidays(year).map((h) => {
      expect(h.date.startsWith(`${year}-`)).toBe(true);
      const [, m, d] = h.date.split('-').map(Number);
      return `${m}-${d}`;
    });
    expect(new Set(monthDays)).toEqual(new Set(STATUTORY_FIXED));
    expect(monthDays).toHaveLength(STATUTORY_FIXED.length);
  });

  it.each(years)('%i: fiecare sarbatoare fixa nu e zi lucratoare', (year) => {
    for (const md of STATUTORY_FIXED) {
      const [m, d] = md.split('-').map(Number);
      const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      expect(service.isWorkingDate(date)).toBe(false);
    }
  });

  it('o zi obisnuita din timpul saptamanii ramane lucratoare', () => {
    expect(service.isWorkingDate('2026-01-08')).toBe(true);
    expect(service.isWorkingDate('2026-01-10')).toBe(false); // sambata
  });
});

describe('BusinessCalendarService — SLA la preluare (acceptanta)', () => {
  const service = makeService();
  // luni 5 ianuarie 2026, 10:00 Bucuresti (08:00 UTC iarna)
  const claimAt = new Date('2026-01-05T08:00:00Z');

  it.each([
    ['SMALL', '2026-01-12'],
    ['MEDIUM', '2026-01-12'],
    ['LARGE', '2026-01-14'],
  ] as const)('%s: 6 si 7 ianuarie nu se numara -> %s', (size, expected) => {
    const deadline = service.addWorkingDays(claimAt, SLA_DAYS[size]);
    expect(bucharestDate(deadline)).toBe(expected);
  });

  it('SMALL se termina la 23:59:59.999 Bucuresti (21:59:59.999Z iarna)', () => {
    expect(service.addWorkingDays(claimAt, SLA_DAYS.SMALL).toISOString()).toBe('2026-01-12T21:59:59.999Z');
  });

  it('miercuri 31 dec 2025 + 1 = luni 5 ian 2026 (1-2 ianuarie + weekend)', () => {
    expect(bucharestDate(service.addWorkingDays(new Date('2025-12-31T10:00:00Z'), 1))).toBe('2026-01-05');
  });
});

describe('BusinessCalendarService — sarbatori mobile (doar din tabel)', () => {
  it.each([
    ['2026-04-09T09:00:00Z', '2026-04-14'], // joi -> Vinerea Mare + weekend + a doua zi de Paste
    ['2026-05-29T09:00:00Z', '2026-06-02'], // vineri -> weekend + a doua zi de Rusalii / 1 iunie
    ['2029-04-05T09:00:00Z', '2029-04-10'], // joi -> Vinerea Mare 2029 + weekend + a doua zi de Paste
  ])('%s + 1 zi lucratoare = %s', async (from, expected) => {
    const service = await withMovable();
    expect(bucharestDate(service.addWorkingDays(new Date(from), 1))).toBe(expected);
  });

  it('fara randuri in tabel, Vinerea Mare NU e sarbatoare (biblioteca nu e folosita la calcul)', () => {
    const service = makeService();
    expect(bucharestDate(service.addWorkingDays(new Date('2026-04-09T09:00:00Z'), 1))).toBe('2026-04-10');
  });
});

describe('BusinessCalendarService — ora de iarna/vara in termene', () => {
  const service = makeService();

  it('vineri 27 mar 2026 + 1 = luni 30 mar, sfarsit EEST 20:59:59.999Z', () => {
    expect(service.addWorkingDays(new Date('2026-03-27T09:00:00Z'), 1).toISOString()).toBe('2026-03-30T20:59:59.999Z');
  });

  it('vineri 23 oct 2026 + 1 = luni 26 oct, sfarsit EET 21:59:59.999Z', () => {
    expect(service.addWorkingDays(new Date('2026-10-23T09:00:00Z'), 1).toISOString()).toBe('2026-10-26T21:59:59.999Z');
  });

  it('endOfBucharestDate iarna = 21:59:59.999Z', () => {
    expect(service.endOfBucharestDate('2026-01-15').toISOString()).toBe('2026-01-15T21:59:59.999Z');
  });

  it('start imediat dupa miezul noptii local (dum. 29 mar 00:30) + 1 = luni 30 mar', () => {
    expect(bucharestDate(service.addWorkingDays(new Date('2026-03-28T22:30:00Z'), 1))).toBe('2026-03-30');
  });
});

describe('BusinessCalendarService — punti admin', () => {
  it('vineri 14 aug 2026 punte libera: joi 13 + 1 = luni 17 (15 aug + weekend)', async () => {
    const service = await withMovable([{ date: new Date('2026-08-14T00:00:00.000Z'), isWorkingDay: false }]);
    expect(bucharestDate(service.addWorkingDays(new Date('2026-08-13T09:00:00Z'), 1))).toBe('2026-08-17');
  });

  it('fara punte: joi 13 aug + 1 = vineri 14 aug', async () => {
    const service = await withMovable();
    expect(bucharestDate(service.addWorkingDays(new Date('2026-08-13T09:00:00Z'), 1))).toBe('2026-08-14');
  });

  it('sambata 3 oct 2026 fortata lucratoare: vineri 2 + 1 = sambata 3', async () => {
    const service = await withMovable([{ date: new Date('2026-10-03T00:00:00.000Z'), isWorkingDay: true }]);
    expect(bucharestDate(service.addWorkingDays(new Date('2026-10-02T09:00:00Z'), 1))).toBe('2026-10-03');
  });

  it('deadlineFromDate foloseste acelasi algoritm (calculatorul din admin)', async () => {
    const service = await withMovable();
    expect(service.todayInBucharest(service.deadlineFromDate('2026-01-05', 3))).toBe('2026-01-12');
    expect(service.todayInBucharest(service.deadlineFromDate('2026-01-05', 5))).toBe('2026-01-14');
  });
});

describe('Sarbatori mobile — orizont si migrare', () => {
  const service = makeService();

  it('exista sarbatori mobile pentru anul urmator', () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    const covered = MOVABLE_HOLIDAYS.some((h) => h.date.startsWith(`${nextYear}-`));
    if (!covered) throw new Error('adauga sarbatorile mobile pentru anul urmator (movable-holidays.ts + migrare)');
    expect(covered).toBe(true);
    expect(MOVABLE_HOLIDAYS_LAST_YEAR).toBeGreaterThanOrEqual(nextYear);
  });

  it('datele din movable-holidays.ts coincid cu referinta date-holidays (orthodox -2 / 1 / 50)', () => {
    const years = [...new Set(MOVABLE_HOLIDAYS.map((h) => Number(h.date.slice(0, 4))))];
    expect(Math.max(...years)).toBe(MOVABLE_HOLIDAYS_LAST_YEAR);
    for (const year of years) {
      const ours = MOVABLE_HOLIDAYS.filter((h) => h.date.startsWith(`${year}-`))
        .map((h) => h.date)
        .sort();
      expect(ours).toEqual(service.movableReference(year));
    }
  });

  it('migrarea de date contine fiecare sarbatoare mobila', () => {
    const dir = join(__dirname, '../../../prisma/migrations');
    const folder = readdirSync(dir).find((name) => /_business_calendar_movable_/.test(name));
    expect(folder).toBeDefined();
    const sql = readFileSync(join(dir, folder as string, 'migration.sql'), 'utf8');
    for (const h of MOVABLE_HOLIDAYS) expect(sql).toContain(`DATE '${h.date}'`);
    expect(sql).toMatch(/ON CONFLICT \("date"\) DO NOTHING/);
  });
});

describe('BusinessCalendarService — avertizare sarbatori mobile lipsa', () => {
  afterEach(() => jest.restoreAllMocks());

  it('avertizeaza o singura data cand anul urmator nu are randuri', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const rows = MOVABLE_HOLIDAYS.filter((h) => Number(h.date.slice(0, 4)) <= 2028).map((h) => ({
      date: new Date(`${h.date}T00:00:00.000Z`),
      isWorkingDay: false,
    }));
    const service = makeService(rows);
    jest.spyOn(service, 'todayInBucharest').mockReturnValue('2028-06-15');
    await service.refresh();
    await service.refresh();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('2029');
  });

  it('nu avertizeaza cand anul urmator e acoperit', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = await withMovable();
    jest.spyOn(service, 'todayInBucharest').mockReturnValue('2028-06-15');
    await service.refresh();
    expect(warn).not.toHaveBeenCalled();
  });
});
