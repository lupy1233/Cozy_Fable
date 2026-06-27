import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Invarianta 3.3: calendar de business Europe/Bucharest; in DB salvam UTC.
// Weekend + sarbatori legale RO cu data fixa + tabel business_calendar_holidays
// (sarbatori mobile Paste/Rusalii + override admin "punti"), cache-uit in memorie (Sprint 7).
const TZ = 'Europe/Bucharest';

// Sarbatori legale RO cu data fixa (luna-zi, 1-indexat).
const FIXED_HOLIDAYS = new Set<string>([
  '1-1', // Anul Nou
  '1-2',
  '1-24', // Unirea Principatelor
  '5-1', // Ziua Muncii
  '6-1', // Ziua Copilului
  '8-15', // Adormirea Maicii Domnului
  '11-30', // Sf. Andrei
  '12-1', // Ziua Nationala
  '12-25', // Craciun
  '12-26',
]);

interface BucharestParts {
  year: number;
  month: number; // 1-12
  day: number;
}

@Injectable()
export class BusinessCalendarService implements OnModuleInit {
  private readonly logger = new Logger(BusinessCalendarService.name);
  // Override-uri din business_calendar_holidays: cheie `y-m-d` → isWorkingDay.
  private overrides = new Map<string, boolean>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh().catch((e) => this.logger.warn(`holiday cache load failed: ${e}`));
  }

  // Reincarca cache-ul de sarbatori (apelat la boot + dupa modificari admin).
  async refresh(): Promise<void> {
    const rows = await this.prisma.businessCalendarHoliday.findMany();
    const next = new Map<string, boolean>();
    for (const r of rows) {
      const d = r.date;
      next.set(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`, r.isWorkingDay);
    }
    this.overrides = next;
  }

  // Componentele de data (an/luna/zi) ale unui instant in fusul Bucuresti.
  private toBucharestParts(date: Date): BucharestParts {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
  }

  // Ziua saptamanii (0=duminica..6=sambata) pentru o data calendaristica Bucuresti.
  private weekday(p: BucharestParts): number {
    // Folosim prânzul UTC ca sa evitam ambiguitatile de offset la calcul weekday.
    return new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay();
  }

  private isWorkingDay(p: BucharestParts): boolean {
    // Override admin / sarbatori mobile au prioritate (poate forta si o zi lucratoare — punti).
    const override = this.overrides.get(`${p.year}-${p.month}-${p.day}`);
    if (override !== undefined) return override;
    const wd = this.weekday(p);
    if (wd === 0 || wd === 6) return false;
    return !FIXED_HOLIDAYS.has(`${p.month}-${p.day}`);
  }

  private addCalendarDay(p: BucharestParts): BucharestParts {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
    d.setUTCDate(d.getUTCDate() + 1);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  // Offset-ul Bucuresti (ms) la un instant dat — gestioneaza EET/EEST.
  private tzOffsetMs(date: Date): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - date.getTime();
  }

  // Instant UTC pentru ora de perete 23:59:59.999 Bucuresti a unei date.
  private endOfDayUtc(p: BucharestParts): Date {
    const wall = Date.UTC(p.year, p.month - 1, p.day, 23, 59, 59, 999);
    let result = wall - this.tzOffsetMs(new Date(wall));
    // o rafinare pentru zilele cu schimbare DST
    result = wall - this.tzOffsetMs(new Date(result));
    return new Date(result);
  }

  // Sfarsitul celei de-a N-a zile lucratoare dupa `from` (deadline expirare).
  // Ex: publicare luni → 5 zile lucratoare → sfarsitul lui luni urmatoare.
  addWorkingDays(from: Date, workingDays: number): Date {
    let p = this.toBucharestParts(from);
    let counted = 0;
    while (counted < workingDays) {
      p = this.addCalendarDay(p);
      if (this.isWorkingDay(p)) counted++;
    }
    return this.endOfDayUtc(p);
  }
}
