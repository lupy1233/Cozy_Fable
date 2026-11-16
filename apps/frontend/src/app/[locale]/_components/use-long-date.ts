'use client';

import { useFormatter } from 'next-intl';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';

// review m10 (etapa 1): data in limba aplicatiei si ora Romaniei, cu luna in litere
// ("13 noiembrie 2028" / "November 13, 2028"), nu dupa limba browserului.
export function useLongDate(): (iso: string) => string {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'long', timeZone: APP_TIME_ZONE });
}
