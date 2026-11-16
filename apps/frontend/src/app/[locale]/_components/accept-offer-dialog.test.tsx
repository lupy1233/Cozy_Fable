import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { AcceptSummary } from './accept-offer-dialog';

// g2 (etapa 12): rezumatul din dialogul de acceptare — „Valabilă până la” si data livrarii in
// limba aplicatiei si ora Romaniei, nu „11/26/2026” dupa limba / fusul browserului.

function version(over: Partial<QuoteVersionDto> = {}): QuoteVersionDto {
  return {
    id: 'v1', version: 1, isExtra: false, price: 8840, designFee: null, currency: 'RON',
    priceRon: 8840, priceEur: 1776.88, designFeeRon: null, designFeeEur: null, total: 8840, totalRon: 8840,
    totalEur: 1776.88, deliveryTerm: null, deliveryDate: '2026-12-20', warranty: null, description: 'x',
    // 22:30 UTC pe 25 nov = 26 nov, 00:30 in Bucuresti (in UTC ar fi inca 25)
    validUntil: '2026-11-25T22:30:00.000Z', isExpired: false, validityExtensionsUsed: 0, extensionRequestedAt: null,
    createdByUserId: 'u', sentAt: '2026-11-10T10:00:00.000Z', changeRequest: null, attachments: [], roomPrices: [],
    vatMode: null, deliveryTermValue: null, deliveryTermUnit: null, warrantyMonths: null, includesTransport: null,
    includesAssembly: null, designIncludes: null, vatRatePercent: 21, priceWithVat: null, totalWithVat: null,
    deliveryWorkingDays: null, ...over,
  } as QuoteVersionDto;
}

const QUOTE = { id: 'q1', companyName: 'Firma A' } as QuoteDto;

function show(locale: 'ro' | 'en', v: QuoteVersionDto = version(), timeZone = 'UTC') {
  return render(
    // providerul are intentionat alt fus decat Romania: data trebuie sa ramana cea din Bucuresti
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone={timeZone}>
      <AcceptSummary quote={QUOTE} version={v} />
    </NextIntlClientProvider>,
  );
}

describe('AcceptSummary — formatul datelor (g2)', () => {
  it('ro: „Valabilă până la 26 noiembrie 2026”, nu 11/26/2026', () => {
    show('ro');
    expect(screen.getByText('Valabilă până la 26 noiembrie 2026')).toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();
  });

  it('en: formatul englezesc al aplicatiei', () => {
    show('en');
    expect(screen.getByText('Valid until November 26, 2026')).toBeInTheDocument();
  });

  it('data livrarii „doar zi” nu sare o zi, oricare ar fi fusul providerului', () => {
    for (const tz of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Europe/Bucharest']) {
      const { unmount } = show('ro', version({ deliveryDate: '2026-11-26' }), tz);
      expect(screen.getByText('până la 26 noiembrie 2026')).toBeInTheDocument();
      unmount();
    }
  });
});
