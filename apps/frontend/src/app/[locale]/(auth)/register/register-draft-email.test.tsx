import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import RegisterPage from './page';
import { draftContactEmail } from './draft-email';

// m1 (etapa 12): e-mailul scris la contact nu se mai scrie a doua oara la inregistrare
let search = new URLSearchParams();
const registerMutate = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => search }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
const idle = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null, variables: undefined };
vi.mock('@/hooks/use-auth', () => ({
  useRegister: () => ({ ...idle, mutate: registerMutate }),
  useResendVerification: () => idle,
}));

const store = () => useConfiguratorStore.getState();
const mount = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <RegisterPage />
    </NextIntlClientProvider>,
  );
const emailField = () => screen.getByRole('textbox', { name: ro.Auth.email });

beforeEach(() => {
  localStorage.clear();
  store().reset();
  registerMutate.mockReset();
  search = new URLSearchParams();
});

describe('register opened from the Summary (m1)', () => {
  it('fills in the e-mail from the draft contact, never from the address', async () => {
    store().setDetails({ contactPreferences: [{ channel: 'PHONE', value: '+40722123456' }, { channel: 'EMAIL', value: ' ana@example.com ' }] });
    search = new URLSearchParams({ redirect: '/requests/new' });
    mount();
    await waitFor(() => expect(emailField()).toHaveValue('ana@example.com'));
    expect(window.location.href).not.toContain('ana');
    // omul il poate schimba
    await userEvent.clear(emailField());
    await userEvent.type(emailField(), 'alt@example.com');
    expect(emailField()).toHaveValue('alt@example.com');
  });

  it('nothing is filled in without the way back to the draft, or without an e-mail contact', async () => {
    store().setDetails({ contactPreferences: [{ channel: 'EMAIL', value: 'ana@example.com' }] });
    expect(draftContactEmail(null)).toBeNull();
    expect(draftContactEmail('/dashboard')).toBeNull();
    expect(draftContactEmail('/requests/new')).toBe('ana@example.com');
    store().setDetails({ contactPreferences: [{ channel: 'PHONE', value: '+40722123456' }, { channel: 'EMAIL', value: 'ana@' }] });
    expect(draftContactEmail('/requests/new')).toBeNull();

    search = new URLSearchParams();
    store().setDetails({ contactPreferences: [{ channel: 'EMAIL', value: 'ana@example.com' }] });
    mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(emailField()).toHaveValue('');
  });
});
