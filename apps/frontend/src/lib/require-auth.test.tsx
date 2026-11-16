import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ro from '@/messages/ro.json';
import { RoleOnlyScreen, useRequireAuth } from './require-auth';
import { resetSessionLostForTests } from './session-lost';
import type { SessionRole } from './session-hint';

// f4: garda comuna — fara sesiune → login cu intoarcere; rol gresit → ecranul de acces.
const state = vi.hoisted(() => ({
  me: { isPending: false, isError: false, data: undefined as unknown },
  replace: (() => {}) as (href: string) => void,
  logoutMutate: (() => {}) as (v: unknown, o: { onSettled: () => void }) => void,
}));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => state.me,
  useLogout: () => ({ mutate: state.logoutMutate, isPending: false }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: (href: string) => state.replace(href), push: vi.fn() }),
}));

function Page({ role }: { role?: SessionRole }) {
  const auth = useRequireAuth(role);
  if (auth.status === 'loading') return <p>schelet</p>;
  if (auth.status === 'wrongRole') return <RoleOnlyScreen role={role!} />;
  return <p>continut</p>;
}

function renderAt(path: string, role?: SessionRole) {
  window.history.replaceState(null, '', `/ro${path}`);
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <Page role={role} />
    </NextIntlClientProvider>,
  );
}

describe('useRequireAuth / RoleOnlyScreen (f4)', () => {
  let replace: Mock<(href: string) => void>;
  beforeEach(() => {
    resetSessionLostForTests();
    replace = vi.fn<(href: string) => void>();
    state.replace = replace;
    state.me = { isPending: false, isError: false, data: undefined };
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('fara sesiune: schelet, apoi /login?redirect=<pagina+query> (fara „sesiunea a expirat” pentru vizitator)', () => {
    state.me = { isPending: false, isError: true, data: undefined };
    renderAt('/requests/r1/offers?firm=c2', 'CLIENT');
    expect(screen.getByText('schelet')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login?redirect=%2Frequests%2Fr1%2Foffers%3Ffirm%3Dc2');
  });

  it('cat „cine sunt eu” se incarca: schelet, fara redirect', () => {
    state.me = { isPending: true, isError: false, data: undefined };
    renderAt('/marketplace/claims/c1', 'COMPANY_USER');
    expect(screen.getByText('schelet')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('rolul potrivit (sau fara rol cerut): continutul', () => {
    state.me = { isPending: false, isError: false, data: { id: 'u1', role: 'CLIENT' } };
    renderAt('/requests/r1/offers', 'CLIENT');
    expect(screen.getByText('continut')).toBeInTheDocument();
    cleanup();
    renderAt('/dashboard');
    expect(screen.getByText('continut')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('rol gresit: ecranul „Pagina e doar pentru clienți”, cu Panou, fara salt tacut', () => {
    state.me = { isPending: false, isError: false, data: { id: 'u2', role: 'COMPANY_USER' } };
    renderAt('/requests/r1/offers', 'CLIENT');
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Access.onlyFor.CLIENT);
    expect(screen.getByRole('link', { name: ro.Access.toDashboard })).toHaveAttribute('href', '/dashboard');
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['COMPANY_USER', 'CLIENT', ro.Access.onlyFor.COMPANY_USER],
    ['ADMIN', 'COMPANY_USER', ro.Access.onlyFor.ADMIN],
  ] as const)('pagina pentru %s, cont %s: titlul potrivit', (pageRole, userRole, title) => {
    state.me = { isPending: false, isError: false, data: { id: 'u3', role: userRole } };
    renderAt('/x', pageRole);
    expect(screen.getByRole('alert')).toHaveTextContent(title);
  });

  it('„Intră cu alt cont”: iesire din cont, apoi login cu intoarcere pe aceeasi pagina', () => {
    state.me = { isPending: false, isError: false, data: { id: 'u2', role: 'COMPANY_USER' } };
    const mutate = vi.fn((_v: unknown, o: { onSettled: () => void }) => o.onSettled());
    state.logoutMutate = mutate;
    renderAt('/requests/r1/offers', 'CLIENT');
    act(() => fireEvent.click(screen.getByRole('button', { name: ro.Access.switchAccount })));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login?redirect=%2Frequests%2Fr1%2Foffers');
  });
});
