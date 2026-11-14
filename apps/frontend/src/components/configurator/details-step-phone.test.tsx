import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { DetailsStep, looksLikePhone } from './details-step';

// m1 (etapa 12): un numar de telefon in campul de email → schimba canalul pe „Telefon”
vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-requests', () => ({ useBudgetEstimate: () => ({ data: undefined }) }));
vi.mock('./address-autocomplete', () => ({ AddressAutocomplete: () => null }));

const store = () => useConfiguratorStore.getState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store().reset();
  store().setStartMode('STANDARD');
  store().addRoom('KITCHEN');
});

async function submitWithEmail(value: string, locale: 'ro' | 'en') {
  const messages = locale === 'ro' ? ro : en;
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DetailsStep onBack={vi.fn()} onContinue={vi.fn()} />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: messages.Requests.field.contactValue }), { target: { value } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: messages.Configurator.nav.toReview }));
  });
}

describe('DetailsStep — a phone number on the e-mail channel (m1)', () => {
  it('says to switch the channel to Phone (RO + EN)', async () => {
    await submitWithEmail('0722 123 456', 'ro');
    expect(screen.getByText(ro.Requests.validation.contactEmailIsPhone)).toBeInTheDocument();
    expect(ro.Requests.validation.contactEmailIsPhone).toContain(`„${ro.Requests.contactChannel.PHONE}”`);
  });

  it('in English too', async () => {
    await submitWithEmail('+40 722 123 456', 'en');
    expect(screen.getByText(en.Requests.validation.contactEmailIsPhone)).toBeInTheDocument();
    expect(en.Requests.validation.contactEmailIsPhone).toContain(en.Requests.contactChannel.PHONE);
  });

  it('a wrong e-mail keeps its own message', async () => {
    await submitWithEmail('ana@', 'en');
    expect(screen.getByText(en.Requests.validation.contactEmailInvalid)).toBeInTheDocument();
    expect(screen.queryByText(en.Requests.validation.contactEmailIsPhone)).not.toBeInTheDocument();
  });

  it('recognises phone numbers, not e-mails or short numbers', () => {
    expect(looksLikePhone('0722123456')).toBe(true);
    expect(looksLikePhone('(0264) 123-456')).toBe(true);
    expect(looksLikePhone('ana@0722123456.ro')).toBe(false);
    expect(looksLikePhone('12345')).toBe(false);
    expect(looksLikePhone('ana.popescu')).toBe(false);
  });
});
