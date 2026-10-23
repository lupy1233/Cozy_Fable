import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ApiError } from '@/lib/api';
import { OfferCard } from './offer-card';

// E-client-1: dialogul de acceptare arata exact ce accepta clientul (pret, proiectare, total,
// livrare, valabilitate), reciteste oferta la deschidere si trimite id-ul versiunii afisate.
const state = vi.hoisted(() => ({
  fresh: undefined as unknown,
  acceptError: null as unknown,
  acceptMutate: vi.fn(),
}));

vi.mock('@/hooks/use-quotes', () => {
  const stub = () => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() });
  return {
    useAcceptQuote: () => ({
      mutate: state.acceptMutate,
      isPending: false,
      error: state.acceptError,
      reset: vi.fn(),
    }),
    useClientQuote: () => ({ data: state.fresh, isFetching: false, isLoading: false, isError: false, error: null }),
    useCreateConsultationInvite: stub,
    useEndNegotiation: stub,
    useExtendValidity: stub,
    useRejectChange: stub,
    useRequestChange: stub,
    useRequestExtension: stub,
    useRespondConsultationInvite: stub,
    useWithdrawQuote: stub,
    useCreateQuote: stub,
    useReviseQuote: stub,
    useExtraVersion: stub,
    useReoffer: stub,
  };
});

const FUTURE = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

function version(over: Partial<QuoteVersionDto> = {}): QuoteVersionDto {
  const price = over.price ?? 10000;
  const designFee = over.designFee === undefined ? 1500 : over.designFee;
  const total = price + (designFee ?? 0);
  return {
    id: 'v1',
    version: 1,
    isExtra: false,
    price,
    designFee,
    currency: 'RON',
    priceRon: price,
    priceEur: price / 5,
    designFeeRon: designFee,
    designFeeEur: designFee != null ? designFee / 5 : null,
    total,
    totalRon: total,
    totalEur: total / 5,
    deliveryTerm: '6 săptămâni',
    deliveryDate: null,
    warranty: null,
    description: 'Bucătărie completă',
    validUntil: FUTURE,
    isExpired: false,
    validityExtensionsUsed: 0,
    extensionRequestedAt: null,
    createdByUserId: 'u-firm',
    sentAt: new Date().toISOString(),
    changeRequest: null,
    attachments: [],
    roomPrices: [],
    ...over,
  };
}

function quote(over: Partial<QuoteDto> = {}): QuoteDto {
  return {
    id: 'q1',
    claimSlotId: 's1',
    requestId: 'r1',
    companyId: 'c1',
    companyName: 'Firma A',
    currency: 'RON',
    status: 'SENT',
    extraVersionsCount: 0,
    versionsUsed: 1,
    versionLimitReached: false,
    eurRonRate: 5,
    versions: [version()],
    consultationInvites: [],
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    acceptedVersionId: null,
    ...over,
  };
}

function renderCard(q: QuoteDto) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OfferCard quote={q} mode="client" includesPaidDesign />
    </NextIntlClientProvider>,
  );
}

const NEW_VERSION = en.Quotes.acceptVersionChanged;

describe('OfferCard — dialogul de acceptare (E-client-1)', () => {
  beforeEach(() => {
    state.fresh = quote();
    state.acceptError = null;
    state.acceptMutate = vi.fn();
  });

  it('arata pretul, proiectarea, totalul, livrarea si valabilitatea; nu accepta la deschidere', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    const dialog = screen.getByRole('dialog', { name: 'Accept the offer from Firma A?' });
    const d = within(dialog);
    expect(d.getByText('Offer price')).toBeInTheDocument();
    expect(d.getByText('Design fee')).toBeInTheDocument();
    expect(d.getByText('Offer total')).toBeInTheDocument();
    // formatul sumelor e cel din restul fisei (ro-RO)
    expect(d.getByText(/11\.500,00 RON/)).toBeInTheDocument();
    expect(d.getByText('Delivery')).toBeInTheDocument();
    expect(d.getByText('6 săptămâni')).toBeInTheDocument();
    expect(d.getByText(/^Valid until /)).toBeInTheDocument();
    expect(d.getByText(en.Quotes.acceptConfirmVatHint)).toBeInTheDocument();
    expect(d.queryByText(NEW_VERSION)).not.toBeInTheDocument();
    expect(state.acceptMutate).not.toHaveBeenCalled();
  });

  it('confirmarea trimite id-ul versiunii afisate', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, accept the offer' }));
    expect(state.acceptMutate).toHaveBeenCalledTimes(1);
    expect(state.acceptMutate.mock.calls[0][0]).toEqual({ quoteId: 'q1', quoteVersionId: 'v1' });
  });

  it('Back inchide dialogul fara acceptare', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.acceptMutate).not.toHaveBeenCalled();
  });

  it('versiune noua trimisa de firma → anunt + noile conditii + trimite noul id', () => {
    state.fresh = quote({
      versions: [version(), version({ id: 'v2', version: 2, price: 9000, designFee: null })],
    });
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    const d = within(screen.getByRole('dialog'));
    expect(d.getByText(NEW_VERSION)).toBeInTheDocument();
    expect(d.getByText('Version 2')).toBeInTheDocument();
    expect(d.getAllByText(/9\.000,00 RON/).length).toBeGreaterThan(0);
    fireEvent.click(d.getByRole('button', { name: 'Yes, accept the offer' }));
    expect(state.acceptMutate.mock.calls[0][0]).toEqual({ quoteId: 'q1', quoteVersionId: 'v2' });
  });

  it('409 QUOTE_VERSION_CHANGED → mesajul de versiune noua o singura data', () => {
    state.acceptError = new ApiError('QUOTE_VERSION_CHANGED', 409, '');
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    const d = within(screen.getByRole('dialog'));
    expect(d.getAllByText(NEW_VERSION)).toHaveLength(1);
  });

  it('oferta EXPIRED: fara buton de acceptare (doar cererea de prelungire)', () => {
    renderCard(quote({ status: 'EXPIRED', versions: [version({ isExpired: true })] }));
    expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Quotes.requestExtension })).toBeInTheDocument();
  });

  it('cardul arata totalul ofertei cand exista proiectare', () => {
    renderCard(quote());
    expect(screen.getByText('Offer total')).toBeInTheDocument();
  });
});
