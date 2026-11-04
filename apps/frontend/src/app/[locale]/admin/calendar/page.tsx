'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import type { CalendarHolidayDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardSection } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import {
  useAdminCalendar,
  useCalendarCheck,
  useCreateHoliday,
  useDeleteHoliday,
  useUpdateHoliday,
} from '@/hooks/use-admin';
import { ApiError } from '@/lib/api';

// E-admin-platform-25: calendarul de lucru folosit la termenele firmelor (SLA, expirarea
// cererilor, retragerea ofertei). Sarbatorile fixe vin automat; aici se gestioneaza doar
// sarbatorile mobile si puntile (zi libera / zi lucratoare fortata). Termenele deja
// calculate nu se schimba.

const inp =
  'rounded-md border border-border-2 bg-surface px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground';

function todayInBucharest(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
}

function useFormatDate() {
  const locale = useLocale();
  return (dateOnly: string) =>
    new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
}

function useErrorMessage() {
  const t = useTranslations('Admin.calendar');
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };
}

export default function AdminCalendarPage() {
  const t = useTranslations('Admin');
  const today = todayInBucharest();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const calendar = useAdminCalendar(year);
  const fmt = useFormatDate();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.hint')}
        actions={
          <label className="flex items-center gap-2 text-sm">
            {t('calendar.year')}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inp}>
              {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {calendar.data?.coverage
        .filter((c) => c.missing.length > 0)
        .map((c) => (
          <Alert key={c.year} tone="amber">
            {t('calendar.coverageMissing', { year: c.year, dates: c.missing.map(fmt).join(', ') })}
          </Alert>
        ))}

      <DeadlineCheck today={today} />

      {calendar.isLoading && (
        <div className="flex flex-col gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {calendar.isError && <Alert tone="crimson">{t('calendar.apiErrors.INTERNAL_ERROR')}</Alert>}

      {calendar.data && (
        <>
          <CardSection title={t('calendar.overridesTitle')}>
            {calendar.data.holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('calendar.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">{t('calendar.date')}</th>
                      <th className="py-2 pr-3 font-medium">{t('calendar.name')}</th>
                      <th className="py-2 pr-3 font-medium">{t('calendar.type')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {calendar.data.holidays.map((h) => (
                      <HolidayRow key={h.id} h={h} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <AddHolidayForm today={today} />
          </CardSection>

          <CardSection title={t('calendar.fixedTitle')}>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {calendar.data.fixedHolidays.map((h) => (
                <li key={h.date} className="flex gap-3">
                  <span className="w-44 shrink-0 text-muted-foreground">{fmt(h.date)}</span>
                  <span>{h.name}</span>
                </li>
              ))}
            </ul>
          </CardSection>
        </>
      )}
    </div>
  );
}

function HolidayRow({ h }: { h: CalendarHolidayDto }) {
  const t = useTranslations('Admin.calendar');
  const fmt = useFormatDate();
  const errorMessage = useErrorMessage();
  const update = useUpdateHoliday();
  const remove = useDeleteHoliday();
  const [confirm, setConfirm] = useState(false);

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-2 pr-3 whitespace-nowrap">{fmt(h.date)}</td>
      <td className="py-2 pr-3">{h.name}</td>
      <td className="py-2 pr-3">
        <select
          aria-label={t('type')}
          value={h.isWorkingDay ? 'working' : 'holiday'}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate(
              { id: h.id, isWorkingDay: e.target.value === 'working' },
              { onSuccess: () => toast.success(t('saved')), onError: (err) => toast.error(errorMessage(err)) },
            )
          }
          className={inp}
        >
          <option value="holiday">{t('typeHoliday')}</option>
          <option value="working">{t('typeWorking')}</option>
        </select>
      </td>
      <td className="py-2 text-right">
        <Button variant="outline" size="sm" onClick={() => setConfirm(true)} disabled={remove.isPending}>
          {t('remove')}
        </Button>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('remove')}</DialogTitle>
              <DialogDescription>{t('confirmRemove', { date: fmt(h.date), name: h.name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(h.id, {
                    onSuccess: () => {
                      setConfirm(false);
                      toast.success(t('removed'));
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                {t('remove')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}

function AddHolidayForm({ today }: { today: string }) {
  const t = useTranslations('Admin.calendar');
  const errorMessage = useErrorMessage();
  const create = useCreateHoliday();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'holiday' | 'working'>('holiday');
  const maxDate = `${Number(today.slice(0, 4)) + 5}-12-31`;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && name.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      { date, name: name.trim(), isWorkingDay: type === 'working' },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setDate('');
          setName('');
          setType('holiday');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3 text-sm">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('date')}
        <input type="date" required min={today} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
        {t('name')}
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inp} min-w-48`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('type')}
        <select value={type} onChange={(e) => setType(e.target.value as 'holiday' | 'working')} className={inp}>
          <option value="holiday">{t('typeHoliday')}</option>
          <option value="working">{t('typeWorking')}</option>
        </select>
      </label>
      <Button type="submit" size="sm" disabled={!valid || create.isPending}>
        {t('add')}
      </Button>
    </form>
  );
}

// Calculatorul de termene: preluare facuta azi, cu 3 (S/M) si 5 (L) zile lucratoare.
function DeadlineCheck({ today }: { today: string }) {
  const t = useTranslations('Admin.calendar');
  const fmt = useFormatDate();
  const three = useCalendarCheck(today, 3);
  const five = useCalendarCheck(today, 5);
  return (
    <CardSection title={t('checkTitle')}>
      <p className="text-xs text-muted-foreground">{t('checkHint', { date: fmt(today) })}</p>
      {[
        { days: 3, q: three },
        { days: 5, q: five },
      ].map(({ days, q }) => (
        <p key={days} className="text-sm">
          {q.data ? t('checkRow', { days, date: fmt(q.data.deadlineDate) }) : q.isError ? t('apiErrors.INTERNAL_ERROR') : <Skeleton className="inline-block h-4 w-40 align-middle" />}
        </p>
      ))}
    </CardSection>
  );
}
