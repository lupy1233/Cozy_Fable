import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import { AccountMenu } from './account-menu';

const logoutMutate = vi.fn();
const useMyCompany = vi.fn();

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({
    data: { id: 'u1', name: 'Ion Popescu', email: 'ion@firma.ro', role: 'COMPANY_USER' },
  }),
  useLogout: () => ({ mutate: logoutMutate, isPending: false }),
}));

vi.mock('@/hooks/use-company', () => ({
  useMyCompany: (enabled?: boolean) => useMyCompany(enabled),
}));

vi.mock('@/lib/session-cleanup', () => ({
  hasUnpublishedLocalDraft: () => false,
}));

function renderMenu(role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN') {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <AccountMenu role={role} />
    </NextIntlClientProvider>,
  );
}

describe('AccountMenu', () => {
  beforeEach(() => {
    logoutMutate.mockReset();
    useMyCompany.mockReset();
  });

  it('firma: arata numele, emailul, numele firmei si rolul', async () => {
    useMyCompany.mockReturnValue({ data: { name: 'A Mobila Premium' } });
    renderMenu('COMPANY_USER');
    await userEvent.click(screen.getByRole('button', { name: 'Meniul contului' }));

    expect(await screen.findByText('Ion Popescu')).toBeInTheDocument();
    expect(screen.getByText('ion@firma.ro')).toBeInTheDocument();
    expect(screen.getByText('A Mobila Premium')).toBeInTheDocument();
    expect(screen.getAllByText('Utilizator firmă').length).toBeGreaterThan(0);
    expect(useMyCompany).toHaveBeenCalledWith(true);
  });

  it('client: useMyCompany e dezactivat si nu exista rand de firma', async () => {
    useMyCompany.mockReturnValue({ data: { name: 'A Mobila Premium' } });
    renderMenu('CLIENT');
    await userEvent.click(screen.getByRole('button', { name: 'Meniul contului' }));

    expect(await screen.findByText('Ion Popescu')).toBeInTheDocument();
    expect(useMyCompany).toHaveBeenCalledWith(false);
    expect(screen.queryByText('A Mobila Premium')).toBeNull();
  });

  it('Deconectare apeleaza logout.mutate', async () => {
    useMyCompany.mockReturnValue({ data: undefined });
    renderMenu('ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Meniul contului' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Deconectare' }));
    expect(logoutMutate).toHaveBeenCalledTimes(1);
  });
});
