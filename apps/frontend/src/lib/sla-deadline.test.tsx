import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import ro from '../messages/ro.json';
import {
  claimUrgencyRank,
  compareClaimUrgency,
  slaPhase,
  slaPhaseClass,
  timeLeftUnits,
  useDurationLeft,
  useSlaDateFormat,
} from './sla-deadline';

// E-company-13: fazele termenului SLA, data in ora Bucurestiului si durata ramasa a gratiei.
const NOW = new Date('2026-09-30T10:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(NOW + ms).toISOString();

function wrap(locale: 'en' | 'ro', timeZone: string) {
  const messages = locale === 'en' ? en : ro;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return Wrapper;
}

describe('slaPhase', () => {
  it('RUNNING peste 24h, SOON in ultimele 24h, GRACE dupa termen, BREACHED dupa gratie', () => {
    const deadline = iso(0);
    const breachAt = iso(12 * HOUR);
    expect(slaPhase(deadline, breachAt, NOW - 25 * HOUR)).toBe('RUNNING');
    expect(slaPhase(deadline, breachAt, NOW - 24 * HOUR)).toBe('SOON');
    expect(slaPhase(deadline, breachAt, NOW - 1)).toBe('SOON');
    expect(slaPhase(deadline, breachAt, NOW)).toBe('GRACE');
    expect(slaPhase(deadline, breachAt, NOW + 12 * HOUR - 1)).toBe('GRACE');
    expect(slaPhase(deadline, breachAt, NOW + 12 * HOUR)).toBe('BREACHED');
  });

  it('fara breachAt (SLA pe pauza / lista) termenul trecut e direct BREACHED', () => {
    expect(slaPhase(iso(0), null, NOW + 1)).toBe('BREACHED');
  });

  it('culori: gri, chihlimbar, apoi rosu', () => {
    expect(slaPhaseClass.RUNNING).toBe('text-muted-foreground');
    expect(slaPhaseClass.SOON).toBe('text-amber');
    expect(slaPhaseClass.GRACE).toBe('text-crimson');
    expect(slaPhaseClass.BREACHED).toBe('text-crimson');
  });
});

describe('useSlaDateFormat', () => {
  // 21:30Z = 00:30 in Bucuresti (EEST, UTC+3) a doua zi
  const value = '2026-09-30T21:30:00Z';

  it('RO: ora Bucurestiului, chiar daca providerul are alt fus', () => {
    for (const tz of ['UTC', 'America/New_York', 'Europe/Bucharest']) {
      const fmt = renderHook(() => useSlaDateFormat(), { wrapper: wrap('ro', tz) }).result.current;
      const out = fmt(value);
      expect(out).toMatch(/^1 oct\. 2026/);
      expect(out).toContain('00:30');
    }
  });

  it('EN: ora Bucurestiului, chiar daca providerul are alt fus', () => {
    for (const tz of ['UTC', 'Asia/Tokyo']) {
      const fmt = renderHook(() => useSlaDateFormat(), { wrapper: wrap('en', tz) }).result.current;
      const out = fmt(value);
      expect(out).toMatch(/^Oct 1, 2026/);
      expect(out).toMatch(/12:30\sAM/);
    }
  });
});

describe('useDurationLeft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('RO: plural corect (ore / de ore / de minute), rotunjit in sus', () => {
    const left = renderHook(() => useDurationLeft(), { wrapper: wrap('ro', 'Europe/Bucharest') }).result.current;
    expect(left(10 * HOUR)).toBe('10 ore');
    expect(left(9 * HOUR + 1)).toBe('10 ore');
    expect(left(20 * HOUR)).toBe('20 de ore');
    expect(left(HOUR)).toBe('o oră');
    expect(left(45 * 60_000)).toBe('45 de minute');
    expect(left(5 * 60_000)).toBe('5 minute');
    expect(left(1_000)).toBe('un minut');
    expect(left(0)).toBe('un minut');
  });

  it('EN', () => {
    const left = renderHook(() => useDurationLeft(), { wrapper: wrap('en', 'Europe/Bucharest') }).result.current;
    expect(left(10 * HOUR)).toBe('10 hours');
    expect(left(HOUR)).toBe('1 hour');
    expect(left(30 * 60_000)).toBe('30 minutes');
    expect(left(60_000)).toBe('1 minute');
  });
});

// Numaratoarea inversa din "Preluarile mele": cele mai mari doua unitati nenule.
describe('timeLeftUnits', () => {
  const MIN = 60_000;

  it('peste o zi: zile + ore (minutele se pierd)', () => {
    expect(timeLeftUnits(28 * HOUR)).toEqual([
      { unit: 'day', n: 1 },
      { unit: 'hour', n: 4 },
    ]);
    expect(timeLeftUnits(28 * HOUR + 59 * MIN)).toEqual([
      { unit: 'day', n: 1 },
      { unit: 'hour', n: 4 },
    ]);
  });

  it('unitatea a doua lipseste cand e zero', () => {
    expect(timeLeftUnits(24 * HOUR)).toEqual([{ unit: 'day', n: 1 }]);
    expect(timeLeftUnits(48 * HOUR + 30 * MIN)).toEqual([{ unit: 'day', n: 2 }]);
    expect(timeLeftUnits(HOUR)).toEqual([{ unit: 'hour', n: 1 }]);
  });

  it('sub o zi: ore + minute; sub o ora: minute', () => {
    expect(timeLeftUnits(3 * HOUR + 20 * MIN)).toEqual([
      { unit: 'hour', n: 3 },
      { unit: 'minute', n: 20 },
    ]);
    expect(timeLeftUnits(42 * MIN + 59_000)).toEqual([{ unit: 'minute', n: 42 }]);
  });

  it('rotunjit in jos la minut, dar niciodata sub un minut', () => {
    expect(timeLeftUnits(30_000)).toEqual([{ unit: 'minute', n: 1 }]);
    expect(timeLeftUnits(0)).toEqual([{ unit: 'minute', n: 1 }]);
    expect(timeLeftUnits(-5 * MIN)).toEqual([{ unit: 'minute', n: 1 }]);
  });
});

// Ordinea din "Preluarile mele": urgentele sus.
describe('compareClaimUrgency', () => {
  const claim = (
    id: string,
    over: Partial<Parameters<typeof claimUrgencyRank>[0]>,
  ): Parameters<typeof claimUrgencyRank>[0] & { id: string } => ({
    id,
    status: 'ACTIVE',
    assignedToUserId: 'u1',
    slaDeadlineAt: null,
    slaPaused: false,
    createdAt: iso(-HOUR),
    ...over,
  });

  it('rangul: fara responsabil, cu termen, pe pauza, oferta trimisa, inchisa', () => {
    expect(claimUrgencyRank(claim('a', { assignedToUserId: null, slaDeadlineAt: iso(HOUR) }))).toBe(0);
    expect(claimUrgencyRank(claim('b', { slaDeadlineAt: iso(HOUR) }))).toBe(1);
    expect(claimUrgencyRank(claim('c', { slaDeadlineAt: iso(HOUR), slaPaused: true }))).toBe(2);
    expect(claimUrgencyRank(claim('d', {}))).toBe(2);
    expect(claimUrgencyRank(claim('e', { status: 'OFFER_SENT' }))).toBe(3);
    expect(claimUrgencyRank(claim('f', { status: 'COMPLETED' }))).toBe(4);
    expect(claimUrgencyRank(claim('g', { status: 'SLA_EXPIRED', assignedToUserId: null }))).toBe(4);
  });

  it('sorteaza: neatribuita cea mai veche, apoi termenul cel mai apropiat, apoi cele mai noi', () => {
    const rows = [
      claim('closed-old', { status: 'SLA_EXPIRED', createdAt: iso(-30 * 24 * HOUR) }),
      claim('sent', { status: 'OFFER_SENT', createdAt: iso(-4 * 24 * HOUR) }),
      claim('sla-30h', { slaDeadlineAt: iso(30 * HOUR), createdAt: iso(-2 * HOUR) }),
      claim('unassigned-new', { assignedToUserId: null, createdAt: iso(-10 * 60_000) }),
      claim('paused', { slaDeadlineAt: iso(2 * HOUR), slaPaused: true }),
      claim('closed-new', { status: 'COMPLETED', createdAt: iso(-24 * HOUR) }),
      claim('sla-5h', { slaDeadlineAt: iso(5 * HOUR), createdAt: iso(-3 * 24 * HOUR) }),
      claim('unassigned-old', { assignedToUserId: null, createdAt: iso(-50 * 60_000) }),
    ];
    expect([...rows].sort(compareClaimUrgency).map((r) => r.id)).toEqual([
      'unassigned-old',
      'unassigned-new',
      'sla-5h',
      'sla-30h',
      'paused',
      'sent',
      'closed-new',
      'closed-old',
    ]);
  });
});
