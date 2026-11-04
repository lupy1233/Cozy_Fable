import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { LegalAcceptanceGate } from './legal-acceptance-gate';

// E-admin-platform-2: dialogul blocant apare doar cand needsLegalAcceptance=true si nu pe /terms, /privacy.
const state = vi.hoisted(() => ({ user: null as unknown, pathname: '/dashboard' }));

vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({ data: state.user }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-legal', () => ({
  useAcceptLegal: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LegalAcceptanceGate />
    </NextIntlClientProvider>,
  );
}

describe('LegalAcceptanceGate', () => {
  beforeEach(() => {
    state.user = { id: 'u1', role: 'CLIENT', needsLegalAcceptance: true };
    state.pathname = '/dashboard';
  });

  it('afiseaza dialogul blocant fara buton de inchidere cand versiunea e depasita', () => {
    renderGate();
    expect(screen.getByRole('dialog', { name: 'We have updated our Terms and Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I accept the Terms and acknowledge the Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('nu apare cand userul a acceptat versiunea curenta sau nu e autentificat', () => {
    state.user = { id: 'u1', role: 'CLIENT', needsLegalAcceptance: false };
    const { unmount } = renderGate();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    state.user = undefined;
    renderGate();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nu apare pe /terms si /privacy', () => {
    state.pathname = '/terms';
    const { unmount } = renderGate();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    state.pathname = '/privacy';
    renderGate();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
