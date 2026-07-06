'use client';

import { useTranslations } from 'next-intl';

// Timp relativ umanizat: sub 60 min → minute; sub 24h → ore; sub 30 zile → zile;
// apoi luni. Inlocuieste afisarile de tip "35000 min ago" din marketplace.
export function useRelativeTime() {
  const t = useTranslations('Common.relativeTime');
  return (value: string | Date) => {
    const then = typeof value === 'string' ? new Date(value).getTime() : value.getTime();
    const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
    if (mins < 60) return t('minutes', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('hours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('days', { count: days });
    return t('months', { count: Math.floor(days / 30) });
  };
}
