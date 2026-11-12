'use client';

import { SLA_WARNING_BEFORE_HOURS, type ClaimSlotDto } from '@marketplace/shared';
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

// Numaratoarea inversa din "Preluarile mele": timpul ramas in cele mai mari doua unitati
// nenule (zile + ore, ore + minute sau doar minute). Rotunjit in jos la minut — nu aratam
// mai mult timp decat a ramas — si minim 1 minut. Textul il compune apelantul (unitatile
// din Legal.firmRules.units).
export type TimeLeftUnit = { unit: 'day' | 'hour' | 'minute'; n: number };

const MINUTES_PER_DAY = 24 * 60;

export function timeLeftUnits(ms: number): TimeLeftUnit[] {
  const total = Math.max(1, Math.floor(ms / 60_000));
  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / 60);
  const minutes = total % 60;
  const pair: TimeLeftUnit[] =
    days > 0
      ? [
          { unit: 'day', n: days },
          { unit: 'hour', n: hours },
        ]
      : hours > 0
        ? [
            { unit: 'hour', n: hours },
            { unit: 'minute', n: minutes },
          ]
        : [{ unit: 'minute', n: minutes }];
  return pair.filter((p) => p.n > 0);
}

// Ordinea din "Preluarile mele" (urgentele sus). Lista de preluari nu are termenul de
// atribuire, deci urgenta se deduce doar din stare, responsabil si termenul SLA:
// 0 = activa fara responsabil (se anuleaza automat), 1 = activa cu termen SLA in curs,
// 2 = activa pe pauza / fara termen, 3 = oferta trimisa, 4 = inchisa.
type UrgencyClaim = Pick<
  ClaimSlotDto,
  'status' | 'assignedToUserId' | 'slaDeadlineAt' | 'slaPaused' | 'createdAt'
>;

export function claimUrgencyRank(c: UrgencyClaim): 0 | 1 | 2 | 3 | 4 {
  if (c.status === 'ACTIVE') {
    if (!c.assignedToUserId) return 0;
    return c.slaDeadlineAt && !c.slaPaused ? 1 : 2;
  }
  return c.status === 'OFFER_SENT' ? 3 : 4;
}

export function compareClaimUrgency(a: UrgencyClaim, b: UrgencyClaim): number {
  const rank = claimUrgencyRank(a);
  const diff = rank - claimUrgencyRank(b);
  if (diff !== 0) return diff;
  // fara responsabil: cea mai veche e cea mai aproape de anularea automata
  if (rank === 0) return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  // cu termen in curs: termenul cel mai apropiat intai
  if (rank === 1 && a.slaDeadlineAt && b.slaDeadlineAt) {
    return Date.parse(a.slaDeadlineAt) - Date.parse(b.slaDeadlineAt);
  }
  // restul: cele mai noi intai (ordinea in care vin din API)
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
