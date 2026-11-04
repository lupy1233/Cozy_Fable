'use client';

import { SLA_WARNING_BEFORE_HOURS } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';

// E-company-13: termenele SLA se afiseaza mereu in ora Romaniei (Europe/Bucharest), indiferent
// de fusul browserului — aceeasi ora ca in emailuri si in regulile de business (4.11).
export const APP_TIME_ZONE = 'Europe/Bucharest';

const HOUR_MS = 60 * 60 * 1000;

// RUNNING = mai e timp; SOON = ultimele SLA_WARNING_BEFORE_HOURS ore (acelasi prag ca emailul);
// GRACE = termen trecut, gratia inca in curs; BREACHED = si gratia a trecut (sau lipseste).
export type SlaPhase = 'RUNNING' | 'SOON' | 'GRACE' | 'BREACHED';

export function slaPhase(deadlineIso: string, breachAtIso: string | null, now: number): SlaPhase {
  const deadline = Date.parse(deadlineIso);
  if (now < deadline - SLA_WARNING_BEFORE_HOURS * HOUR_MS) return 'RUNNING';
  if (now < deadline) return 'SOON';
  if (breachAtIso && now < Date.parse(breachAtIso)) return 'GRACE';
  return 'BREACHED';
}

export const slaPhaseClass: Record<SlaPhase, string> = {
  RUNNING: 'text-muted-foreground',
  SOON: 'text-amber',
  GRACE: 'text-crimson',
  BREACHED: 'text-crimson',
};

// Data termenului, formatata in ora Bucurestiului (ex. "1 oct. 2026, 00:30").
export function useSlaDateFormat(): (iso: string) => string {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short', timeZone: APP_TIME_ZONE });
}

// Durata ramasa, rotunjita in sus: >= 1h → ore, altfel minute (minim 1).
export function useDurationLeft(): (ms: number) => string {
  const t = useTranslations('Common.duration');
  return (ms: number) => {
    if (ms >= HOUR_MS) return t('hours', { count: Math.ceil(ms / HOUR_MS) });
    return t('minutes', { count: Math.max(1, Math.ceil(ms / 60_000)) });
  };
}
