import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import { SessionHintProvider } from '@/lib/session-hint-context';
import type { SessionRole } from '@/lib/session-hint';
import { AppHeader } from './app-header';

const apiMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: (...args: unknown[]) => apiMock(...args) };
});

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  usePathname: () => '/marketplace',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// componentele grele (socket, limba, cont) nu sunt subiectul testului
vi.mock('./notification-bell', () => ({
  NotificationBell: () => <div data-testid="bell" />,
  BellPlaceholder: () => <div data-testid="bell-placeholder" />,
}));
vi.mock('./lang-switch', () => ({ LangSwitch: () => <div /> }));
vi.mock('./account-menu', () => ({ AccountMenu: ({ role }: { role: string }) => <div data-testid="account">{role}</div> }));

function renderHeader(hint: SessionRole | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <SessionHintProvider initialRole={hint}>
          <AppHeader />
        </SessionHintProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('AppHeader — header randat din indiciul de sesiune', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('cu indiciu COMPANY_USER si useMe pending: linkurile rolului + placeholder de clopotel', () => {
    apiMock.mockReturnValue(new Promise(() => {})); // /auth/me nu raspunde inca
    renderHeader('COMPANY_USER');
    // nav-ul apare si in meniul mobil, asa ca acceptam mai multe aparitii
    expect(screen.getAllByRole('link', { name: 'Marketplace' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Portofel' }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('bell-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('bell')).toBeNull();
    expect(screen.getByTestId('account')).toHaveTextContent('COMPANY_USER');
  });

  it('fara indiciu si pending: fara linkuri, fara meniu de cont', () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    renderHeader(null);
    expect(screen.queryByRole('link', { name: 'Marketplace' })).toBeNull();
    expect(screen.queryByTestId('account')).toBeNull();
    expect(screen.queryByTestId('bell-placeholder')).toBeNull();
  });

  it('useMe in eroare: fara linkuri chiar cu indiciu', async () => {
    apiMock.mockResolvedValue({ user: null }); // fetchMe → 401 local
    renderHeader('COMPANY_USER');
    await vi.waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Marketplace' })).toBeNull();
    });
    expect(screen.queryByTestId('account')).toBeNull();
  });
});
