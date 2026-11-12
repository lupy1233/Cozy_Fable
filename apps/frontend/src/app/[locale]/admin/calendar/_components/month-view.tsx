'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CalendarHolidayDto } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { pad2, useCalendarFormat } from './calendar-utils';

type DayKind = 'holiday' | 'forced' | 'weekend' | 'working';

interface DayCell {
  date: string;
  day: number;
  kind: DayKind;
  note: string | null;
}

// Aceeasi ordine ca la calculul termenelor (business-calendar.service): ziua adaugata de admin
// are prioritate (poate forta si o zi lucratoare), apoi weekendul, apoi sarbatoarea legala fixa.
function buildMonth(
  year: number,
  month: number,
  holidays: CalendarHolidayDto[],
  fixedHolidays: { date: string; name: string }[],
): { offset: number; cells: DayCell[] } {
  const overrides = new Map(holidays.map((h) => [h.date, h]));
  const fixed = new Map(fixedHolidays.map((h) => [h.date, h.name]));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // luni = 0 … duminica = 6
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells: DayCell[] = [];
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const weekend = (offset + day - 1) % 7 >= 5;
    const override = overrides.get(date);
    let kind: DayKind = 'working';
    let note: string | null = null;
    if (override) {
      kind = override.isWorkingDay ? 'forced' : 'holiday';
      note = override.name;
    } else if (weekend) {
      kind = 'weekend';
    } else if (fixed.has(date)) {
      kind = 'holiday';
      note = fixed.get(date) ?? null;
    }
    cells.push({ date, day, kind, note });
  }
  return { offset, cells };
}

const CELL: Record<DayKind, string> = {
  holiday: 'bg-walnut-soft font-semibold text-walnut-deep',
  forced: 'border border-dashed border-muted-2 bg-surface text-foreground',
  weekend: 'bg-surface-3 text-muted-foreground',
  working: 'bg-surface text-foreground',
};

// Luna la vedere: zilele libere, weekendurile si zilele lucratoare fortate, din datele anului ales.
export function MonthView({
  year,
  month,
  today,
  holidays,
  fixedHolidays,
  onPrev,
  onNext,
}: {
  year: number;
  /** 0 = ianuarie */
  month: number;
  today: string;
  holidays: CalendarHolidayDto[];
  fixedHolidays: { date: string; name: string }[];
  /** undefined = nu exista luna anterioara / urmatoare in anii disponibili */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const t = useTranslations('Admin.calendar');
  const fmt = useCalendarFormat();
  const { offset, cells } = buildMonth(year, month, holidays, fixedHolidays);
  const hasForced = holidays.some((h) => h.isWorkingDay);
  const kindLabel: Record<DayKind, string> = {
    holiday: t('legend.holiday'),
    forced: t('legend.forced'),
    weekend: t('legend.weekend'),
    working: t('legend.working'),
  };

  return (
    <Card as="section" padding="none" aria-labelledby="calendar-month-title" className="flex flex-col gap-3.5 px-6 pb-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="calendar-month-title" className="heading-section" aria-live="polite">
          {fmt.monthYear(year, month)}
        </h2>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11" disabled={!onPrev} onClick={onPrev} aria-label={t('prevMonth')}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11" disabled={!onNext} onClick={onNext} aria-label={t('nextMonth')}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {fmt.weekdays().map((w) => (
          <div key={w.long} className="label py-1 text-center">
            <span aria-hidden>{w.short}</span>
            <span className="sr-only">{w.long}</span>
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} aria-hidden />
        ))}
        {cells.map((c) => (
          <div
            key={c.date}
            title={c.note ?? undefined}
            className={cn(
              'min-h-[52px] min-w-0 rounded-md px-2 py-1.5 font-mono text-ui',
              CELL[c.kind],
              c.date === today && 'ring-1 ring-inset ring-foreground',
            )}
          >
            {c.day}
            <span className="sr-only">
              {' '}
              {kindLabel[c.kind]}
              {c.date === today ? `, ${t('today')}` : ''}
            </span>
            {c.note && <div className="break-words font-sans text-micro font-medium leading-tight">{c.note}</div>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm border border-walnut bg-walnut-soft" />
          {kindLabel.holiday}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-surface-3" />
          {kindLabel.weekend}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm border border-border bg-surface" />
          {kindLabel.working}
        </span>
        {hasForced && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-dashed border-muted-2 bg-surface" />
            {kindLabel.forced}
          </span>
        )}
      </div>
    </Card>
  );
}
