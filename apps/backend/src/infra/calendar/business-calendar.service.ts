import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import Holidays from 'date-holidays';
import { PrismaService } from '../prisma/prisma.service';
import { safeErrorSummary } from '../../common/logging/safe-error';

// Invarianta 3.3 + Decizia 6: calendar de business Europe/Bucharest; in DB salvam UTC.
// Weekend + sarbatori legale RO cu data FIXA din biblioteca date-holidays (tip 'public',
// fara regulile ortodoxe/Paste) + tabel business_calendar_holidays (sarbatori MOBILE
// Paste/Rusalii + override admin "punti", bidirectional), cache-uit in memorie per proces.
// Cache-ul se reincarca la boot, dupa modificari admin (CalendarSyncService, Redis pub/sub
// catre celalalt slot blue/green) si periodic la 10 minute.
const TZ = 'Europe/Bucharest';

// Regulile mobile din date-holidays ('orthodox -2', 'orthodox 1', 'orthodox 50'...) NU se
// folosesc la calcul (Decizia 6: bibliotecile pot gresi Pastele ortodox) — doar ca referinta.
const MOVABLE_RULE = /orthodox|easter/i;
const DAY_MS = 86_400_000;

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
  private readonly hd = new Holidays('RO');
  // sarbatori fixe per an: cheie `m-d` (neumplut) -> nume
  private readonly fixedByYear = new Map<number, Map<string, string>>();
  // anul pentru care am avertizat deja ca lipsesc sarbatorile mobile (o data per proces/an)
  private warnedYear: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh().catch((e) => this.logger.warn(`holiday cache load failed: ${safeErrorSummary(e)}`));
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

    // plasa de siguranta: sarbatorile mobile ale anului urmator trebuie sa existe in tabel
    const nextYear = Number(this.todayInBucharest().slice(0, 4)) + 1;
    const missing = this.movableReference(nextYear).filter((d) => !next.has(BusinessCalendarService.cacheKey(d)));
    if (missing.length && this.warnedYear !== nextYear) {
      this.logger.warn(`sarbatori mobile lipsa pentru ${nextYear}: ${missing.join(', ')}`);
      this.warnedYear = nextYear;
    }
  }

  // Cheia din cache (`y-m-d` neumplut) pentru o data YYYY-MM-DD.
  private static cacheKey(dateOnly: string): string {
    const p = BusinessCalendarService.parseDateOnly(dateOnly);
    return `${p.year}-${p.month}-${p.day}`;
  }

  private static formatParts(p: BucharestParts): string {
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  // Sarbatorile legale fixe ale unui an (din date-holidays), cu durata expandata:
  // Anul Nou e o singura regula '01-01 P2DT' care acopera 1-2 ianuarie.
  private fixedFor(year: number): Map<string, string> {
    const cached = this.fixedByYear.get(year);
    if (cached) return cached;
    const map = new Map<string, string>();
    for (const h of this.hd.getHolidays(year) || []) {
      if (h.type !== 'public' || MOVABLE_RULE.test(h.rule)) continue;
      const days = Math.max(1, Math.round((h.end.getTime() - h.start.getTime()) / DAY_MS));
      let p = BusinessCalendarService.parseDateOnly(h.date.slice(0, 10));
      for (let i = 0; i < days; i++) {
        if (p.year === year) map.set(`${p.month}-${p.day}`, h.name);
        p = this.addCalendarDay(p);
      }
    }
    this.fixedByYear.set(year, map);
    return map;
  }

  // Sarbatorile fixe ale anului (YYYY-MM-DD, sortate) — afisate in admin.
  fixedHolidays(year: number): { date: string; name: string }[] {
    return [...this.fixedFor(year).entries()]
      .map(([md, name]) => {
        const [month, day] = md.split('-').map(Number);
        return { date: BusinessCalendarService.formatParts({ year, month, day }), name };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Referinta pentru sarbatorile mobile (Vinerea Mare, a doua zi de Paste/Rusalii) dupa
  // date-holidays: doar zilele lucratoare (Pastele/Rusaliile de duminica nu conteaza).
  // Folosit DOAR pentru avertizarea de acoperire si verificari — nu la calcul.
  movableReference(year: number): string[] {
    const out = new Set<string>();
    for (const h of this.hd.getHolidays(year) || []) {
      if (h.type !== 'public' || !MOVABLE_RULE.test(h.rule)) continue;
      const date = h.date.slice(0, 10);
      const wd = this.weekday(BusinessCalendarService.parseDateOnly(date));
      if (wd !== 0 && wd !== 6) out.add(date);
    }
    return [...out].sort();
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
    return !this.fixedFor(p.year).has(`${p.month}-${p.day}`);
  }

  // Zi lucratoare pentru o data calendaristica YYYY-MM-DD (admin / verificari).
  isWorkingDate(dateOnly: string): boolean {
    return this.isWorkingDay(BusinessCalendarService.parseDateOnly(dateOnly));
  }

  private addCalendarDay(p: BucharestParts): BucharestParts {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
    d.setUTCDate(d.getUTCDate() + 1);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  private subtractCalendarDay(p: BucharestParts): BucharestParts {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
    d.setUTCDate(d.getUTCDate() - 1);
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
    // formatToParts nu expune milisecundele — le scoatem si din referinta,
    // altfel offsetul iese cu pana la 999ms mai mic si sfarsitul zilei
    // aluneca DUPA miezul noptii (bug prins de teste, Q6)
    const refMs = Math.floor(date.getTime() / 1000) * 1000;
    return asUtc - refMs;
  }

  // Instant UTC pentru ora de perete 23:59:59.999 Bucuresti a unei date.
  private endOfDayUtc(p: BucharestParts): Date {
    const wall = Date.UTC(p.year, p.month - 1, p.day, 23, 59, 59, 999);
    let result = wall - this.tzOffsetMs(new Date(wall));
    // o rafinare pentru zilele cu schimbare DST
    result = wall - this.tzOffsetMs(new Date(result));
    return new Date(result);
  }

  // E-admin-platform-3 — ora de perete Bucuresti (hour:00:00.000) a unei date calendaristice
  // YYYY-MM-DD, ca instant UTC (aceeasi rafinare DST ca endOfDayUtc). Folosit de reminderul
  // de livrare (09:00 Bucuresti).
  bucharestWallClock(dateOnly: string, hour: number): Date {
    const p = BusinessCalendarService.parseDateOnly(dateOnly);
    const wall = Date.UTC(p.year, p.month - 1, p.day, hour, 0, 0, 0);
    let result = wall - this.tzOffsetMs(new Date(wall));
    result = wall - this.tzOffsetMs(new Date(result));
    return new Date(result);
  }

  // Ultimul instant (23:59:59.999 Bucuresti) al unei date calendaristice YYYY-MM-DD.
  endOfBucharestDate(dateOnly: string): Date {
    return this.endOfDayUtc(BusinessCalendarService.parseDateOnly(dateOnly));
  }

  // Data calendaristica curenta in Bucuresti (YYYY-MM-DD).
  todayInBucharest(now: Date = new Date()): string {
    const p = this.toBucharestParts(now);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  private static parseDateOnly(dateOnly: string): BucharestParts {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (!m) throw new Error(`invalid date-only value: ${dateOnly}`);
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
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

  // Termenul pentru o actiune facuta la pranz (Bucuresti) intr-o data YYYY-MM-DD —
  // calculatorul read-only din admin (acelasi algoritm ca SLA/expirare).
  deadlineFromDate(dateOnly: string, workingDays: number): Date {
    return this.addWorkingDays(this.bucharestWallClock(dateOnly, 12), workingDays);
  }

  // E-admin-platform-44 — data YYYY-MM-DD (Bucuresti) a zilei lucratoare aflate cu `workingDays`
  // zile lucratoare INAINTEA zilei lui `until`; 0 = ziua lui `until`.
  workingDateBefore(until: Date, workingDays: number): string {
    let p = this.toBucharestParts(until);
    let counted = 0;
    while (counted < workingDays) {
      p = this.subtractCalendarDay(p);
      if (this.isWorkingDay(p)) counted++;
    }
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
}
