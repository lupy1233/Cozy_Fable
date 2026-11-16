import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider, useFormatter } from 'next-intl';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// configuratia de cerere se citeste direct: rutarea (next/navigation) si getRequestConfig sunt simulate
vi.mock('../i18n/routing', () => ({ routing: { locales: ['ro', 'en'], defaultLocale: 'ro' } }));
vi.mock('next-intl/server', () => ({ getRequestConfig: <T,>(fn: T) => fn }));
import en from '../messages/en.json';
import ro from '../messages/ro.json';
import { APP_TIME_ZONE } from './app-time-zone';
import { APP_TIME_ZONE as FROM_SLA } from './sla-deadline';

// g2 (revizuire m6): fusul global al next-intl = ora Romaniei. Un format.dateTime FARA timeZone
// explicit iese in ora Romaniei si cand procesul (browserul / serverul) e in alt fus.

const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  // Node reciteste TZ la schimbare: simulam un browser / server la New York
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

function Stamp({ iso }: { iso: string }) {
  const format = useFormatter();
  // exact forma din claim-lifecycle-panel / bank-transfer-panel: fara timeZone
  return <p>{format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' })}</p>;
}

// providerul ca in app/[locale]/layout.tsx
function show(locale: 'ro' | 'en', iso: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone={APP_TIME_ZONE}>
      <Stamp iso={iso} />
    </NextIntlClientProvider>,
  );
}

describe('fusul global al aplicatiei (m6)', () => {
  it('constanta e una singura (sla-deadline o re-exporta)', () => {
    expect(APP_TIME_ZONE).toBe('Europe/Bucharest');
    expect(FROM_SLA).toBe(APP_TIME_ZONE);
  });

  it('procesul ruleaza chiar in alt fus (preconditia testului)', () => {
    expect(new Date('2026-09-30T21:30:00Z').getHours()).toBe(17);
  });

  it('ro: 21:30 UTC pe 30 sept. = „1 oct. 2026, 00:30” (nu 17:30 la New York)', () => {
    show('ro', '2026-09-30T21:30:00Z');
    const text = screen.getByText(/2026/).textContent ?? '';
    expect(text).toMatch(/^1 oct\. 2026/);
    expect(text).toContain('00:30');
  });

  it('en: aceeasi ora a Romaniei in formatul englez', () => {
    show('en', '2026-09-30T21:30:00Z');
    const text = screen.getByText(/2026/).textContent ?? '';
    expect(text).toMatch(/^Oct 1, 2026/);
    expect(text).toMatch(/12:30\sAM/);
  });

  it('i18n/request.ts da fusul Romaniei pe server', async () => {
    const mod = await import('../i18n/request');
    const config = await (mod.default as unknown as (p: { requestLocale: Promise<string> }) => Promise<{ timeZone?: string }>)({
      requestLocale: Promise.resolve('ro'),
    });
    expect(config.timeZone).toBe(APP_TIME_ZONE);
  });
});
