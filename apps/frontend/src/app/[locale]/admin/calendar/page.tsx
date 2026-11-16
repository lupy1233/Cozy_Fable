'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAdminCalendar } from '@/hooks/use-admin';
import { todayInBucharest, useCalendarFormat } from './_components/calendar-utils';
import { DeadlineCheck } from './_components/deadline-check';
import { HolidaysSection } from './_components/holidays-section';
import { MonthView } from './_components/month-view';

// E-admin-platform-25: calendarul de lucru folosit la termenele firmelor (SLA, expirarea
// cererilor, retragerea ofertei). Sarbatorile fixe vin automat; aici se gestioneaza doar
// sarbatorile mobile si puntile (zi libera / zi lucratoare fortata). Termenele deja
// calculate nu se schimba.

export default function AdminCalendarPage() {
  const t = useTranslations('Admin');
  const today = todayInBucharest();
  const currentYear = Number(today.slice(0, 4));
  const years = [currentYear, currentYear + 1, currentYear + 2];
  const [year, setYear] = useState(currentYear);
  // luna la vedere (0 = ianuarie); porneste de la luna curenta
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const calendar = useAdminCalendar(year);
  const fmt = useCalendarFormat();

  // luna anterioara / urmatoare trece si in anul vecin, cat timp anul e printre cei disponibili
  const goPrev =
    month > 0
      ? () => setMonth(month - 1)
      : years.includes(year - 1)
        ? () => {
            setYear(year - 1);
            setMonth(11);
          }
        : undefined;
  const goNext =
    month < 11
      ? () => setMonth(month + 1)
      : years.includes(year + 1)
        ? () => {
            setYear(year + 1);
            setMonth(0);
          }
        : undefined;

  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <PageHeader
        title={t('calendar.title')}
        subtitle={<span className="block max-w-[720px]">{t('calendar.hint')}</span>}
        actions={
          <Field label={t('calendar.year')} className="min-w-[120px] gap-1">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-11">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      {calendar.data?.coverage
        .filter((c) => c.missing.length > 0)
        .map((c) => (
          <Alert
            key={c.year}
            tone="amber"
            role="alert"
            className="flex-wrap items-center"
            action={
              c.year !== year && years.includes(c.year) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0 border-amber bg-transparent text-amber hover:bg-amber/10"
                  onClick={() => setYear(c.year)}
                >
                  {t('calendar.goToYear', { year: c.year })}
                </Button>
              ) : undefined
            }
          >
            {t('calendar.coverageMissing', { year: c.year, dates: c.missing.map(fmt.full).join(', ') })}
          </Alert>
        ))}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {calendar.isLoading && (
            <>
              <SkeletonCard lines={6} />
              <SkeletonCard />
            </>
          )}
          {calendar.isError && <Alert tone="crimson">{t('calendar.apiErrors.INTERNAL_ERROR')}</Alert>}

          {calendar.data && (
            <>
              <MonthView
                year={year}
                month={month}
                today={today}
                holidays={calendar.data.holidays}
                fixedHolidays={calendar.data.fixedHolidays}
                onPrev={goPrev}
                onNext={goNext}
              />
              <HolidaysSection holidays={calendar.data.holidays} today={today} />
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:w-[340px] lg:shrink-0">
          <DeadlineCheck today={today} />

          {calendar.data && (
            <Card as="section" padding="none" aria-labelledby="calendar-fixed-title" className="flex flex-col gap-3 px-6 py-5">
              <h2 id="calendar-fixed-title" className="heading-section">
                {t('calendar.fixedTitle')}
              </h2>
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-x-4 gap-y-1.5 text-ui">
                {calendar.data.fixedHolidays.map((h) => (
                  <li key={h.date} className="flex gap-2">
                    <span className="w-[52px] shrink-0 font-mono text-xs text-muted-foreground">{fmt.dayMonth(h.date)}</span>
                    <span className="min-w-0">{h.name}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
