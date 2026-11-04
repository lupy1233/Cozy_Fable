import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ERROR_CODES,
  type AdminCalendarDto,
  type CalendarCheckDto,
  type CalendarHolidayDto,
  type CreateCalendarHolidayInput,
  type UpdateCalendarHolidayInput,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { CalendarSyncService } from '../../infra/calendar/calendar-sync.service';

// E-admin-platform-25: calendarul de lucru din admin (docs/02 §3.3 + Decizia 6).
// Tabelul business_calendar_holidays tine sarbatorile mobile si puntile admin (bidirectional:
// zi libera SAU zi lucratoare fortata). Sarbatorile fixe vin din date-holidays si sunt doar
// afisate. Termenele deja materializate (SLA, expirari, joburi) NU se recalculeaza.
const HORIZON_YEARS = 5;

type HolidayRow = { id: string; date: Date; name: string; isWorkingDay: boolean; createdAt: Date };

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// DATE in DB = miezul noptii UTC (cheia din cache foloseste componentele UTC).
function utcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function isRealDate(dateOnly: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;
  const d = utcMidnight(dateOnly);
  return Number.isFinite(d.getTime()) && toDateOnly(d) === dateOnly;
}

function invalidDate(message: string): BadRequestException {
  return new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message, details: [{ field: 'date' }] });
}

@Injectable()
export class AdminCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BusinessCalendarService,
    private readonly sync: CalendarSyncService,
  ) {}

  private toDto(r: HolidayRow): CalendarHolidayDto {
    return { id: r.id, date: toDateOnly(r.date), name: r.name, isWorkingDay: r.isWorkingDay, createdAt: r.createdAt.toISOString() };
  }

  private currentYear(): number {
    return Number(this.calendar.todayInBucharest().slice(0, 4));
  }

  // an implicit = anul curent (Bucuresti)
  async overview(requestedYear?: number): Promise<AdminCalendarDto> {
    const current = this.currentYear();
    const year = requestedYear ?? current;
    // doua citiri in paralel (fara tranzactie — latenta cross-region)
    const [rows, coverageRows] = await Promise.all([
      this.prisma.businessCalendarHoliday.findMany({
        where: { date: { gte: utcMidnight(`${year}-01-01`), lt: utcMidnight(`${year + 1}-01-01`) } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.businessCalendarHoliday.findMany({
        where: { date: { gte: utcMidnight(`${current}-01-01`), lt: utcMidnight(`${current + 2}-01-01`) } },
        select: { date: true },
      }),
    ]);
    // orice rand existent conteaza (si o zi lucratoare fortata e o alegere explicita a adminului)
    const rowDates = new Set(coverageRows.map((r) => toDateOnly(r.date)));
    const coverage = [current, current + 1].map((y) => {
      const expected = this.calendar.movableReference(y);
      return { year: y, expected, missing: expected.filter((d) => !rowDates.has(d)) };
    });
    return {
      year,
      holidays: rows.map((r) => this.toDto(r)),
      fixedHolidays: this.calendar.fixedHolidays(year),
      coverage,
    };
  }

  async create(dto: CreateCalendarHolidayInput): Promise<CalendarHolidayDto> {
    if (!isRealDate(dto.date)) throw invalidDate('Invalid date');
    // trecutul nu are efect (termenele sunt materializate); orizont: 31 dec anul curent + 5
    if (dto.date < this.calendar.todayInBucharest() || Number(dto.date.slice(0, 4)) > this.currentYear() + HORIZON_YEARS) {
      throw invalidDate('Date out of range');
    }
    let row: HolidayRow;
    try {
      row = await this.prisma.businessCalendarHoliday.create({
        data: { date: utcMidnight(dto.date), name: dto.name.trim(), isWorkingDay: dto.isWorkingDay },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.CALENDAR_DATE_EXISTS, message: 'Calendar date already exists' });
      }
      throw e;
    }
    await this.sync.notifyChanged();
    return this.toDto(row);
  }

  async update(id: string, dto: UpdateCalendarHolidayInput): Promise<CalendarHolidayDto> {
    const existing = await this.prisma.businessCalendarHoliday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Calendar day not found' });
    const row = await this.prisma.businessCalendarHoliday.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isWorkingDay !== undefined ? { isWorkingDay: dto.isWorkingDay } : {}),
      },
    });
    await this.sync.notifyChanged();
    return this.toDto(row);
  }

  async remove(id: string): Promise<{ id: string; ok: true; date: string; isWorkingDay: boolean }> {
    const existing = await this.prisma.businessCalendarHoliday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Calendar day not found' });
    await this.prisma.businessCalendarHoliday.delete({ where: { id } });
    await this.sync.notifyChanged();
    // data + tipul raman in snapshot-ul de audit (numele e text liber — exclus)
    return { id, ok: true, date: toDateOnly(existing.date), isWorkingDay: existing.isWorkingDay };
  }

  // Calculator read-only: termenul pentru o actiune facuta in ziua `from` (la pranz).
  check(from: string, workingDays: number): CalendarCheckDto {
    if (!isRealDate(from)) throw invalidDate('Invalid date');
    const at = this.calendar.deadlineFromDate(from, workingDays);
    return { from, workingDays, deadlineDate: this.calendar.todayInBucharest(at), deadlineAt: at.toISOString() };
  }
}
