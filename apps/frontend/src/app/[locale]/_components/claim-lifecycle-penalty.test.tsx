import { render } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import type { ClaimWithdrawalPreviewDto, FirmRulesDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { WithdrawConsequences, withdrawOutcomeHint } from './claim-lifecycle-panel';

// i3 (etapa 12): retragerea dupa perioada de gratie nu pomeneste puncte cand regula are 0 puncte.

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const CLAIMED_AT = '2026-11-14T10:00:00.000Z';

const preview = (lateWithdrawalPoints: number) =>
  ({
    claimCostCredits: 4,
    graceEndsAt: '2026-11-14T10:30:00.000Z',
    blockedCode: null,
    offerWillBeWithdrawn: false,
    penalty: { lateWithdrawalPoints, activePoints: 2, threshold: 15, suspensionMonths: 6 },
  }) as unknown as ClaimWithdrawalPreviewDto;

function consequences(points: number, locale: 'ro' | 'en' = 'ro') {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <WithdrawConsequences
        reason="VOLUNTARY_NO_REASON"
        outcome="CONSUME_AND_PENALTY"
        preview={preview(points)}
        fallbackCredits={4}
        offerSent={false}
        claimedAt={CLAIMED_AT}
        loading={false}
        failed={false}
        withinGrace={false}
        fmtTime={(iso) => iso}
      />
    </NextIntlClientProvider>,
  );
  return container.textContent ?? '';
}

const rulesWith = (VOLUNTARY_WITHDRAWAL: number) =>
  ({
    withdrawals: { voluntaryGraceMinutes: 30, clientUnresponsiveHours: 48 },
    penalties: { points: { SLA_MISS: 3, VOLUNTARY_WITHDRAWAL } },
  }) as unknown as FirmRulesDto;

function Hint({ rules }: { rules: FirmRulesDto }) {
  const t = useTranslations('Lifecycle');
  const tu = useTranslations('Legal.firmRules.units');
  return <p>{withdrawOutcomeHint(t, tu, rules, 'VOLUNTARY_NO_REASON', false)}</p>;
}

function hint(points: number, locale: 'ro' | 'en' = 'ro') {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Hint rules={rulesWith(points)} />
    </NextIntlClientProvider>,
  );
  return container.textContent ?? '';
}

describe('dialogul de retragere a preluarii: puncte doar cand exista (i3)', () => {
  it('puncte > 0 → linia de cost si textul cu puncte (ca azi)', () => {
    const text = consequences(2);
    expect(text).toContain('-4 credite, +2 puncte');
    expect(text).toContain('creditele rezervate se consumă definitiv și firma primește puncte de penalizare.');
  });

  it('0 puncte → fara „+0 puncte” si fara pomenirea punctelor', () => {
    const text = consequences(0);
    expect(text).toContain('-4 credite');
    expect(text).not.toContain('+0');
    expect(text).toContain('Au trecut peste 30 de minute de la preluare: creditele rezervate se consumă definitiv.');
    expect(text).not.toContain('primește puncte de penalizare');
  });

  it('EN, 0 puncte → fara „points” in consecinta', () => {
    const text = consequences(0, 'en');
    expect(text).toContain('the reserved credits are consumed for good.');
    expect(text).not.toContain('receives penalty points');
  });
});

describe('indiciul pentru motivul ales (withdrawOutcomeHint, i3)', () => {
  it('retragere voluntara dupa gratie cu puncte → numarul de puncte', () => {
    expect(hint(1)).toBe('Au trecut peste 30 de minute de la preluare: creditele se consumă și firma primește 1 punct de penalizare.');
  });

  it('retragere voluntara dupa gratie cu 0 puncte → doar consumul creditelor (RO + EN)', () => {
    expect(hint(0)).toBe('Au trecut peste 30 de minute de la preluare: creditele se consumă.');
    expect(hint(0, 'en')).toBe('More than 30 minutes have passed since the claim: the credits are consumed.');
  });
});
