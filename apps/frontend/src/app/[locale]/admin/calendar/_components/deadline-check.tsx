'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarCheck } from '@/hooks/use-admin';
import { useCalendarFormat } from './calendar-utils';

// Calculatorul de termene: preluare facuta azi, cu 3 (S/M) si 5 (L) zile lucratoare.
export function DeadlineCheck({ today }: { today: string }) {
  const t = useTranslations('Admin.calendar');
  const fmt = useCalendarFormat();
  const three = useCalendarCheck(today, 3);
  const five = useCalendarCheck(today, 5);
  return (
    <Card as="section" padding="none" aria-labelledby="calendar-check-title" className="flex flex-col gap-3 border-brass px-6 py-5">
      <h2 id="calendar-check-title" className="heading-section">
        {t('checkTitle')}
      </h2>
      <p className="text-ui text-muted-foreground">{t('checkHint', { date: fmt.full(today) })}</p>
      {[
        { days: 3, q: three },
        { days: 5, q: five },
      ].map(({ days, q }) => (
        <div key={days} className="flex items-center justify-between gap-2.5 rounded-lg bg-surface-2 px-3.5 py-3 text-sm">
          <span>{t('checkDays', { days })}</span>
          {q.data ? (
            <span className="font-mono font-medium">
              <span aria-hidden>→ </span>
              {fmt.short(q.data.deadlineDate)}
            </span>
          ) : q.isError ? (
            <span className="text-xs text-crimson">{t('apiErrors.INTERNAL_ERROR')}</span>
          ) : (
            <Skeleton className="h-4 w-24" />
          )}
        </div>
      ))}
    </Card>
  );
}
