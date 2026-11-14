import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { AgreementCard } from './agreement-card';

// e7: „Acordul vostru” — date in limba aplicatiei si ora Romaniei, sume cu „lei” ca pe cardul
// ofertei (nu „11/14/2026” si „RON” dupa limba browserului).

function version(over: Partial<QuoteVersionDto> = {}): QuoteVersionDto {
  return {
    id: 'v1', version: 1, isExtra: false, price: 8840, designFee: null, currency: 'RON',
    priceRon: 8840, priceEur: 1776.88, designFeeRon: null, designFeeEur: null, total: 8840, totalRon: 8840,
    totalEur: 1776.88, deliveryTerm: null, deliveryDate: '2026-12-20', warranty: null, description: 'x',
    validUntil: '2026-12-01T10:00:00.000Z', isExpired: false, validityExtensionsUsed: 0, extensionRequestedAt: null,
    createdByUserId: 'u', sentAt: '2026-11-10T10:00:00.000Z', changeRequest: null, attachments: [], roomPrices: [],
    vatMode: null, deliveryTermValue: null, deliveryTermUnit: null, warrantyMonths: null, includesTransport: null,
    includesAssembly: null, designIncludes: null, vatRatePercent: 21, priceWithVat: null, totalWithVat: null,
    deliveryWorkingDays: null, ...over,
  } as QuoteVersionDto;
}

function quote(over: Partial<QuoteDto> = {}): QuoteDto {
  return {
    id: 'q1', claimSlotId: 's1', requestId: 'r1', companyId: 'c1', companyName: 'Firma A', currency: 'RON',
    status: 'ACCEPTED', extraVersionsCount: 0, versionsUsed: 1, versionLimitReached: false, eurRonRate: 4.975,
    versions: [version()], consultationInvites: [], createdAt: '2026-11-10T10:00:00.000Z',
    // 22:30 UTC pe 13 nov = 14 nov, 00:30 in Bucuresti
    acceptedAt: '2026-11-13T22:30:00.000Z', acceptedVersionId: 'v1', declinedAt: null, declineReason: null,
    declineNote: null, changeRequests: [], ...over,
  } as QuoteDto;
}

function show(locale: 'ro' | 'en', q: QuoteDto = quote()) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <AgreementCard quote={q} requestStatus="ACCEPTED" mode="client" />
    </NextIntlClientProvider>,
  );
}

describe('AgreementCard — formatul datelor si al sumelor (e7)', () => {
  it('ro: data acordului in ora Romaniei, cu luna in litere; sumele cu „lei” si virgula', () => {
    show('ro');
    expect(screen.getByText('14 noiembrie 2026')).toBeInTheDocument();
    expect(screen.getByText('20 decembrie 2026')).toBeInTheDocument();
    expect(screen.getByText('8.840,00 lei')).toBeInTheDocument();
    expect(screen.getByText('≈ 1.776,88 EUR')).toBeInTheDocument();
    expect(screen.queryByText(/RON/)).not.toBeInTheDocument();
    expect(screen.queryByText(/11\/14\/2026/)).not.toBeInTheDocument();
  });

  it('en: aceleasi valori in formatul englez', () => {
    show('en');
    expect(screen.getByText('November 14, 2026')).toBeInTheDocument();
    expect(screen.getByText('8,840.00 lei')).toBeInTheDocument();
  });

  it('oferta in euro: suma principala in EUR, echivalentul in lei', () => {
    show('ro', quote({ currency: 'EUR', versions: [version({ currency: 'EUR', price: 2000, priceEur: 2000, priceRon: 9950 })] }));
    expect(screen.getByText('2.000,00 EUR')).toBeInTheDocument();
    expect(screen.getByText('≈ 9.950,00 lei')).toBeInTheDocument();
  });
});
