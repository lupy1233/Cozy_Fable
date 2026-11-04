'use client';

import { useTranslations } from 'next-intl';

// Timp relativ umanizat: sub 60 min → minute; sub 24h → ore; sub 30 zile → zile;
// apoi luni. Inlocuieste afisarile de tip "35000 min ago" din marketplace.
// E-client-1: si viitorul (termene SLA / anulare automata → "in 3 zile", nu "chiar acum");
// pana la 60 s in viitor = "acum" (decalaj de ceas client/server pe createdAt).
export function useRelativeTime() {
  const t = useTranslations('Common.relativeTime');
  return (value: string | Date) => {
    const then = typeof value === 'string' ? new Date(value).getTime() : value.getTime();
    const ahead = then - Date.now();
    if (ahead > 60_000) {
      const m = Math.floor(ahead / 60_000);
      if (m < 60) return t('inMinutes', { count: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t('inHours', { count: h });
      const d = Math.floor(h / 24);
      if (d < 30) return t('inDays', { count: d });
      return t('inMonths', { count: Math.floor(d / 30) });
    }
    const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
    if (mins < 60) return t('minutes', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('hours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('days', { count: days });
    return t('months', { count: Math.floor(days / 30) });
  };
}
