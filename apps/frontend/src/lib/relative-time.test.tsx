import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import ro from '../messages/ro.json';
import { useRelativeTime } from './relative-time';

// E-client-1: termenele din viitor (SLA, anulare automata) → "in X", nu "chiar acum";
// pana la 60 s in viitor ramane "acum" (decalaj de ceas client/server).
const NOW = new Date('2026-09-30T10:00:00Z');
const MIN = 60_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function hook(locale: 'en' | 'ro') {
  const messages = locale === 'en' ? en : ro;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Bucharest">
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useRelativeTime(), { wrapper }).result.current;
}

describe('useRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('EN: trecut si viitor', () => {
    const rel = hook('en');
    expect(rel(at(-5 * MIN))).toBe('5 min ago');
    expect(rel(at(45 * MIN))).toBe('in 45 min');
    expect(rel(at(3 * 24 * 60 * MIN))).toBe('in 3 days');
    expect(rel(at(30_000))).toBe('just now');
    expect(rel(at(-2 * 60 * MIN))).toBe('2 hours ago');
    expect(rel(at(2 * 60 * MIN + 5 * MIN))).toBe('in 2 hours');
    expect(rel(at(45 * 24 * 60 * MIN))).toBe('in 1 month');
  });

  it('RO: forme de plural corecte', () => {
    const rel = hook('ro');
    // E-company-13: de la 20 incolo "de" (în 42 de min), sub 20 fara (în 19 min)
    expect(rel(at(45 * MIN))).toBe('în 45 de min');
    expect(rel(at(42 * MIN + 30_000))).toBe('în 42 de min');
    expect(rel(at(19 * MIN + 30_000))).toBe('în 19 min');
    expect(rel(at(-42 * MIN))).toBe('acum 42 de min');
    expect(rel(at(20 * 24 * 60 * MIN))).toBe('în 20 de zile');
    expect(rel(at(3 * 24 * 60 * MIN))).toBe('în 3 zile');
    expect(rel(at(-5 * MIN))).toBe('acum 5 min');
    expect(rel(new Date(NOW.getTime() + 24 * 60 * MIN + MIN))).toBe('într-o zi');
  });
});
