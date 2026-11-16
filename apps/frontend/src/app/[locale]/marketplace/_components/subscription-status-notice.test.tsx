import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { CreditPackageDto, EntitlementsDto } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import { CreditPackagesSection } from '../wallet/_components/credit-packages-section';
import { SubscriptionStatusNotice } from './subscription-status-notice';

// h2 (2026-11-13): un singur mesaj de stare pentru firma fara abonament activ (cu data
// expirarii si soldul), iar pachetele de credite sunt oprite cu "Reactiveaza abonamentul".
const state = vi.hoisted(() => ({
  role: 'COMPANY_USER' as string,
  entitlements: undefined as unknown,
  wallet: undefined as unknown,
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ data: { role: state.role } }) }));
vi.mock('@/hooks/use-billing', () => ({
  useEntitlements: () => ({ data: state.entitlements, isSuccess: state.entitlements !== undefined }),
}));
vi.mock('@/hooks/use-marketplace', () => ({ useWallet: () => ({ data: state.wallet }) }));

const NO_PLAN: EntitlementsDto = {
  planId: null,
  planCode: null,
  nameRo: null,
  nameEn: null,
  isFree: false,
  isTrial: false,
  expiresAt: null,
  gatingDelayMinutes: null,
  features: { MARKETPLACE_ACCESS: { enabled: false, limit: null } },
  lastExpired: { planCode: 'GOLD', nameRo: 'Aur', nameEn: 'Gold', expiredAt: '2026-11-01T10:00:00.000Z' },
};

function renderRo(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SubscriptionStatusNotice (h2)', () => {
  beforeEach(() => {
    state.role = 'COMPANY_USER';
    state.entitlements = NO_PLAN;
    state.wallet = { companyId: 'c1', balance: 120, reserved: 20, available: 100 };
  });

  it('abonament expirat → planul, data, soldul si butonul spre reinnoire', () => {
    renderRo(<SubscriptionStatusNotice />);
    const notice = screen.getByTestId('subscription-status-notice');
    expect(notice).toHaveTextContent('Abonamentul Aur a expirat pe 1 noiembrie 2026.');
    expect(notice).toHaveTextContent(
      'Creditele tale (120) rămân în cont, dar le poți folosi doar după reactivare. Preluările în curs le poți termina.',
    );
    expect(screen.getByRole('link', { name: 'Reactivează abonamentul' })).toHaveAttribute(
      'href',
      '/marketplace/wallet#subscription',
    );
  });

  it('plan fara nume in baza de date (doar codul GOLD) → eticheta codului: „Abonamentul Gold”', () => {
    state.entitlements = {
      ...NO_PLAN,
      lastExpired: { planCode: 'GOLD', nameRo: null, nameEn: '  ', expiredAt: '2026-09-20T10:00:00.000Z' },
    };
    renderRo(<SubscriptionStatusNotice />);
    expect(screen.getByTestId('subscription-status-notice')).toHaveTextContent(
      'Abonamentul Gold a expirat pe 20 septembrie 2026.',
    );
  });

  it('cod de plan fara eticheta si fara nume → textul fara nume, corect gramatical (fara spatiu dublu)', () => {
    state.entitlements = {
      ...NO_PLAN,
      lastExpired: { planCode: 'TEST_FREE', nameRo: null, nameEn: null, expiredAt: '2026-09-20T10:00:00.000Z' },
    };
    renderRo(<SubscriptionStatusNotice />);
    const notice = screen.getByTestId('subscription-status-notice');
    expect(notice.textContent).toContain('Abonamentul a expirat pe 20 septembrie 2026.');
    expect(notice.textContent).not.toMatch(/ {2}/);
    expect(notice.textContent).not.toContain('TEST_FREE');
  });

  it('firma care n-a avut niciodata abonament → textul fara data', () => {
    state.entitlements = { ...NO_PLAN, lastExpired: null };
    renderRo(<SubscriptionStatusNotice />);
    expect(screen.getByTestId('subscription-status-notice')).toHaveTextContent('Firma ta nu are un abonament activ.');
  });

  it('abonament activ, alt rol sau date neincarcate → nimic', () => {
    state.entitlements = { ...NO_PLAN, planId: 'p1', planCode: 'GOLD', lastExpired: null };
    const { container, rerender } = renderRo(<SubscriptionStatusNotice />);
    expect(container).toBeEmptyDOMElement();

    state.entitlements = NO_PLAN;
    state.role = 'CLIENT';
    rerender(
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <SubscriptionStatusNotice />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();

    state.role = 'COMPANY_USER';
    state.wallet = undefined;
    rerender(
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <SubscriptionStatusNotice />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CreditPackagesSection fara abonament (h2-3)', () => {
  const PKG: CreditPackageDto = { id: 'pkg1', credits: 100, priceRon: 500, vatRate: 21, vatRon: 105, totalRon: 605 };

  it('pachetele sunt dezactivate, cu "Reactivează abonamentul" alaturi', () => {
    const onBuy = vi.fn();
    renderRo(
      <CreditPackagesSection
        pending={false}
        loaded
        packages={[PKG]}
        stripeEnabled
        noSubscription
        payDisabled={false}
        onBuy={onBuy}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cumpără pachetul de 100 credite' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Reactivează abonamentul' })).toHaveAttribute('href', '#subscription');
    expect(screen.getByText(/Pachetele de credite se pot cumpăra doar cu abonament activ/)).toBeInTheDocument();
  });

  it('cu abonament activ pachetele se pot cumpara', () => {
    renderRo(
      <CreditPackagesSection
        pending={false}
        loaded
        packages={[PKG]}
        stripeEnabled
        noSubscription={false}
        payDisabled={false}
        onBuy={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cumpără pachetul de 100 credite' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Reactivează abonamentul' })).not.toBeInTheDocument();
  });
});
