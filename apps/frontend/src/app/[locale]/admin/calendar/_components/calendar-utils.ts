'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';

export function todayInBucharest(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Formatarea datelor calendaristice (YYYY-MM-DD) fara decalaj de fus: pranzul UTC al zilei.
export function useCalendarFormat() {
  const locale = useLocale();
  const tag = locale === 'en' ? 'en-GB' : 'ro-RO';
  const at = (dateOnly: string) => new Date(`${dateOnly}T12:00:00Z`);
  // 1 ianuarie 2024 a fost luni → sapte zile la rand, de luni pana duminica
  const weekday = (index: number, width: 'short' | 'long') =>
    new Date(Date.UTC(2024, 0, 1 + index, 12)).toLocaleDateString(tag, { weekday: width, timeZone: 'UTC' });
  return {
    /** vin., 10 aprilie 2026 */
    full: (dateOnly: string) =>
      at(dateOnly).toLocaleDateString(tag, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    /** vin., 13 nov. */
    short: (dateOnly: string) =>
      at(dateOnly).toLocaleDateString(tag, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    /** 1 ian. */
    dayMonth: (dateOnly: string) => at(dateOnly).toLocaleDateString(tag, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    /** Decembrie 2026 */
    monthYear: (year: number, month: number) =>
      capitalize(new Date(Date.UTC(year, month, 1, 12)).toLocaleDateString(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' })),
    /** Lu, Ma, Mi … (luni = 0) + numele intreg pentru cititoarele de ecran */
    weekdays: () =>
      Array.from({ length: 7 }, (_, i) => ({
        short: capitalize(weekday(i, 'short').replace('.', '').slice(0, 2)),
        long: weekday(i, 'long'),
      })),
  };
}

export function useCalendarError() {
  const t = useTranslations('Admin.calendar');
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
