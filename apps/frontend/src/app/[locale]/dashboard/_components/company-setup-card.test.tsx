import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { CompanySetupDto, EntitlementsDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import en from '../../../../messages/en.json';
import { CompanySetupCard, TrialNotice, TrialSentence } from './company-setup-card';

// h1 (etapa 11): cardul „Pregătește-ți firma” de pe panou + fraza despre proba gratuită.

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
const state = vi.hoisted(() => ({ company: undefined as unknown, entitlements: undefined as unknown }));
vi.mock('@/hooks/use-billing', () => ({ useEntitlements: () => ({ data: state.entitlements }) }));
vi.mock('@/hooks/use-company', () => ({ useMyCompany: () => ({ data: state.company }) }));

function renderIn(ui: React.ReactNode, locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );
}

const SETUP: CompanySetupDto = {
  steps: [
    { key: 'PORTFOLIO', done: true, optional: false },
    { key: 'LOCATIONS', done: true, optional: false },
    { key: 'BILLING_EMAIL', done: false, optional: false },
    { key: 'TEAM', done: false, optional: true },
    { key: 'OFFER_PERMISSIONS', done: false, optional: true },
  ],
  requiredDone: 2,
  requiredTotal: 3,
  complete: false,
};

describe('CompanySetupCard', () => {
  it('arata titlul, progresul de la server si fiecare pas cu legatura spre sectiunea lui', () => {
    renderIn(<CompanySetupCard setup={SETUP} />);
    const card = screen.getByRole('region', { name: 'Pregătește-ți firma' });
    expect(within(card).getByText('2 din 3')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    const links = within(card).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/company#portfolio',
      '/company#locations',
      '/company#profile',
      '/company#team',
      '/company#permissions',
    ]);
    // pasul facut → „Vezi”, cel nefacut → „Deschide”
    expect(links[0]).toHaveTextContent('Vezi');
    expect(links[2]).toHaveTextContent('Deschide');
    // echipa si permisiunile: legaturi optionale, fara bifa (revizuire m1)
    expect(within(card).getAllByText('opțional')).toHaveLength(2);
    expect(links[4]).toHaveTextContent('Deschide');
    expect(within(card).getByText('Completează e-mailul de facturare')).toBeInTheDocument();
  });

  it('cand pasii obligatorii sunt facuti, cardul dispare', () => {
    const { container } = renderIn(
      <CompanySetupCard setup={{ ...SETUP, requiredDone: 3, complete: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('fara pasi (angajat → setup null) nu apare nimic', () => {
    const { container } = renderIn(<CompanySetupCard setup={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const TRIAL: EntitlementsDto = {
  planId: 'p1',
  planCode: 'GOLD',
  nameRo: null,
  nameEn: null,
  isFree: false,
  isTrial: true,
  expiresAt: '2026-12-14T22:30:00.000Z',
  gatingDelayMinutes: 30,
  features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } },
  lastExpired: null,
};

describe('TrialSentence', () => {
  it('proba activa: pana cand tine (ora Romaniei) si ca nu se reinnoieste automat', () => {
    renderIn(<TrialSentence entitlements={TRIAL} />);
    const note = screen.getByTestId('trial-sentence');
    // 22:30 UTC pe 14 decembrie = 00:30 pe 15 decembrie la Bucuresti (UTC+2 iarna)
    expect(note).toHaveTextContent('planul Gold e gratuit până pe 15 decembrie 2026');
    expect(note).toHaveTextContent('nu se reînnoiește automat');
    expect(within(note).getByRole('link', { name: 'Vezi planurile' })).toHaveAttribute(
      'href',
      '/marketplace/wallet#subscription',
    );
  });

  it('in engleza, data dupa limba aplicatiei', () => {
    renderIn(<TrialSentence entitlements={TRIAL} />, 'en');
    expect(screen.getByTestId('trial-sentence')).toHaveTextContent('free until December 15, 2026');
  });

  it('abonament platit (fara proba) sau fara abonament → nicio fraza', () => {
    const paid = renderIn(<TrialSentence entitlements={{ ...TRIAL, isTrial: false }} />);
    expect(paid.container).toBeEmptyDOMElement();
    paid.unmount();
    const none = renderIn(
      <TrialSentence entitlements={{ ...TRIAL, planId: null, planCode: null, isTrial: false, expiresAt: null }} />,
    );
    expect(none.container).toBeEmptyDOMElement();
    none.unmount();
    expect(renderIn(<TrialSentence entitlements={undefined} />).container).toBeEmptyDOMElement();
  });
});

// revizuire m4: fraza trimite la alegerea unui plan → doar proprietarul / managerul o vad
describe('TrialNotice', () => {
  it('manager (BILLING_MANAGE) cu firma in proba → fraza', () => {
    state.company = { myRole: 'MANAGER', permissions: ['BILLING_MANAGE', 'MEMBERS_MANAGE'] };
    state.entitlements = TRIAL;
    renderIn(<TrialNotice />);
    expect(screen.getByTestId('trial-sentence')).toBeInTheDocument();
  });

  it('angajat in aceeasi firma in proba → nimic in plus', () => {
    state.company = { myRole: 'EMPLOYEE_TRUSTED', permissions: ['CLAIMS_CREATE'] };
    state.entitlements = TRIAL;
    const { container } = renderIn(<TrialNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});
