import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { FirmRulesDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json';
import ro from '../../../../messages/ro.json';
import { ClaimDialogGraceLine, ClaimDialogRulesNote, ClaimPanelSlaRule } from './claim-penalty-text';

// i3 (etapa 12): panoul si dialogul de preluare spun punctele reale; cu 0 puncte nu pomenesc puncte;
// fara reguli (inca se incarca) ramane textul generic de azi.

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const rulesWith = (SLA_MISS: number, VOLUNTARY_WITHDRAWAL: number) =>
  ({
    withdrawals: { voluntaryGraceMinutes: 30, clientUnresponsiveHours: 48 },
    penalties: { windowDays: 180, companyThreshold: 15, suspensionMonths: 6, points: { SLA_MISS, VOLUNTARY_WITHDRAWAL } },
  }) as unknown as FirmRulesDto;

function show(rules: FirmRulesDto | null, locale: 'ro' | 'en' = 'ro') {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <div data-part="panel">
        <ClaimPanelSlaRule rules={rules} />
      </div>
      <div data-part="grace">
        <ClaimDialogGraceLine rules={rules} />
      </div>
      <div data-part="note">
        <ClaimDialogRulesNote rules={rules} />
      </div>
    </NextIntlClientProvider>,
  );
  const part = (p: string) => container.querySelector(`[data-part="${p}"]`)?.textContent ?? '';
  return { panel: part('panel'), grace: part('grace'), note: part('note') };
}

describe('frazele cu puncte din panoul si dialogul de preluare (i3)', () => {
  it('puncte > 0 → numarul real, cu pluralul corect', () => {
    const out = show(rulesWith(3, 1));
    expect(out.panel).toBe('Dacă nu trimiți oferta în termenul de răspuns, creditele se consumă și firma primește 3 puncte de penalizare.');
    expect(out.grace).toContain('după aceea creditele se consumă și firma primește 1 punct de penalizare.');
    expect(out.note).toContain('se consumă și firma primește 3 puncte de penalizare.');
  });

  it('0 puncte → nicio mentiune de puncte', () => {
    const out = show(rulesWith(0, 0));
    expect(out.panel).toBe('Dacă nu trimiți oferta în termenul de răspuns, creditele se consumă.');
    expect(out.grace).toBe('Te poți retrage gratuit în primele 30 de minute; după aceea creditele se consumă.');
    expect(out.note).toContain('Dacă nu trimiți oferta în termenul de răspuns, se consumă.');
    expect(`${out.panel}${out.grace}${out.note}`).not.toMatch(/puncte?\b|penalizare/);
  });

  it('m8: regulile inca se incarca (sau cererea a picat) → varianta neutra, fara puncte, fara rand de gratie', () => {
    const out = show(null);
    expect(out.panel).toBe(ro.Marketplace.claimPanel.ruleSlaNoPoints);
    expect(out.grace).toBe('');
    expect(out.note).toContain('Dacă nu trimiți oferta în termenul de răspuns, se consumă.');
    expect(`${out.panel}${out.grace}${out.note}`).not.toMatch(/puncte?\b|penalizare/);
    const outEn = show(null, 'en');
    expect(`${outEn.panel}${outEn.note}`).not.toMatch(/point|penalty/i);
  });

  it('EN: 0 puncte → fara „points”; 2 puncte → „2 penalty points”', () => {
    expect(show(rulesWith(0, 0), 'en').panel).toBe('If you do not send the offer within the response deadline, the credits are consumed.');
    const two = show(rulesWith(2, 0), 'en');
    expect(two.panel).toContain('the firm receives 2 penalty points.');
    expect(two.grace).toBe('You can withdraw for free within the first 30 minutes; after that the credits are consumed.');
  });
});
