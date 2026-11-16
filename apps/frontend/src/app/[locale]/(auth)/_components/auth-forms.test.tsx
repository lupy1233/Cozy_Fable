import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import ChangePasswordPage from '../change-password/page';
import ForgotPasswordPage from '../forgot-password/page';
import LoginPage from '../login/page';
import RegisterPage from '../register/page';
import ResetPasswordPage from '../reset-password/page';
import { verifyLoginHref } from './verify-login-href';

// f1: formularele de cont au method="post" si butonul de trimitere dezactivat pana la
// hidratare; intoarcerea dupa login trece prin safeRedirect. b4: returnTo la inregistrare.

const push = vi.fn();
const loginMutate = vi.fn();
const registerMutate = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn(), push }),
}));

const idle = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null, variables: undefined };

vi.mock('@/hooks/use-auth', () => ({
  useLogin: () => ({ ...idle, mutate: loginMutate }),
  useRegister: () => ({ ...idle, mutate: registerMutate }),
  useForgotPassword: () => idle,
  useResetPassword: () => idle,
  useChangePassword: () => idle,
  useResendVerification: () => idle,
  useMe: () => ({ isPending: false, isError: false, data: { id: 'u1', role: 'CLIENT' } }),
}));

function wrap(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>
  );
}

// randarea de pe server (inainte de hidratare): efectele nu ruleaza
function serverDom(ui: ReactElement): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToString(wrap(ui));
  return host;
}

const PAGES: Array<[string, () => ReactElement]> = [
  ['login', () => <LoginPage />],
  ['register', () => <RegisterPage />],
  ['forgot-password', () => <ForgotPasswordPage />],
  ['reset-password', () => <ResetPasswordPage />],
  ['change-password', () => <ChangePasswordPage />],
];

beforeEach(() => {
  push.mockReset();
  loginMutate.mockReset();
  registerMutate.mockReset();
  search = new URLSearchParams();
});

describe('formularele de cont (f1)', () => {
  it.each(PAGES)('%s: method="post" si butonul dezactivat inainte de hidratare', (name, page) => {
    if (name === 'reset-password') search = new URLSearchParams({ token: 'a'.repeat(64) });
    const dom = serverDom(page());
    const form = dom.querySelector('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('method')).toBe('post');
    const submit = dom.querySelector('button[type="submit"]');
    expect(submit).not.toBeNull();
    expect(submit!.hasAttribute('disabled')).toBe(true);
  });

  it('login: dupa montare butonul devine activ', () => {
    render(wrap(<LoginPage />));
    expect(screen.getByRole('button', { name: 'Intră în cont' })).toBeEnabled();
  });
});

async function submitLogin() {
  loginMutate.mockImplementation((_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
  render(wrap(<LoginPage />));
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ana@example.com');
  await userEvent.type(screen.getByLabelText('Parolă'), 'Parola123');
  await userEvent.click(screen.getByRole('button', { name: 'Intră în cont' }));
}

describe('intoarcerea dupa login (f1)', () => {
  it('?redirect=//example.com → /dashboard; linkul spre inregistrare nu o mai poarta', async () => {
    search = new URLSearchParams({ redirect: '//example.com' });
    await submitLogin();
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(screen.getByRole('link', { name: 'Înregistrează-te' })).toHaveAttribute('href', '/register');
  });

  it('?redirect=/requests/new → inapoi la formular', async () => {
    search = new URLSearchParams({ redirect: '/requests/new' });
    await submitLogin();
    expect(push).toHaveBeenCalledWith('/requests/new');
  });

  // f4: „Vezi oferta” / „Deschide lucrarea” din e-mail, deschise fara sesiune → exact pagina din link
  it.each(['/requests/r1/offers', '/marketplace/claims/c1?tab=chat'])('?redirect=%s → exact pagina din link', async (back) => {
    search = new URLSearchParams({ redirect: back, reason: 'expired' });
    await submitLogin();
    expect(push).toHaveBeenCalledWith(back);
  });
});

describe('inregistrare cu intoarcere (b4)', () => {
  async function submitRegister() {
    render(wrap(<RegisterPage />));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nume' }), 'Ana Pop');
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ana@example.com');
    await userEvent.type(screen.getByLabelText(/^Parolă/), 'Parola123');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Creează cont' }));
  }

  it('trimite returnTo=/requests/new venit din Sumar', async () => {
    search = new URLSearchParams({ redirect: '/requests/new' });
    await submitRegister();
    expect(registerMutate).toHaveBeenCalledWith(expect.objectContaining({ returnTo: '/requests/new' }));
  });

  it('o intoarcere externa nu se trimite', async () => {
    search = new URLSearchParams({ redirect: 'https://evil.com' });
    await submitRegister();
    expect(registerMutate).toHaveBeenCalledTimes(1);
    expect(registerMutate.mock.calls[0][0]).not.toHaveProperty('returnTo');
  });
});

describe('verifyLoginHref (b4)', () => {
  it('intoarcerea din link → /login?redirect=/requests/new', () => {
    expect(verifyLoginHref('/requests/new', false)).toBe('/login?redirect=%2Frequests%2Fnew');
  });

  it('intoarcere respinsa + ciorna locala → formularul', () => {
    expect(verifyLoginHref('//evil.com', true)).toBe('/login?redirect=%2Frequests%2Fnew');
  });

  it('fara intoarcere si fara ciorna → /login', () => {
    expect(verifyLoginHref(null, false)).toBe('/login');
    expect(verifyLoginHref('https://evil.com', false)).toBe('/login');
  });
});
