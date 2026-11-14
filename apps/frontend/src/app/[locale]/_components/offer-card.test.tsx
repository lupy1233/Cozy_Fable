import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { ApiError } from '@/lib/api';
import { OfferCard } from './offer-card';

// E-client-1: dialogul de acceptare arata exact ce accepta clientul (pret, proiectare, total,
// livrare, valabilitate), reciteste oferta la deschidere si trimite id-ul versiunii afisate.
const state = vi.hoisted(() => ({
  fresh: undefined as unknown,
  acceptError: null as unknown,
  acceptMutate: vi.fn(),
  changeMutate: vi.fn(),
  declineMutate: vi.fn(),
  declineError: null as unknown,
  refreshQuotes: vi.fn(),
  respondMutate: vi.fn(),
  respondError: null as unknown,
  respondVariables: undefined as unknown,
}));

// fisa firmei: regulile firmei nu conteaza pentru oferta refuzata
vi.mock('@/hooks/use-legal', () => ({ useFirmRules: () => ({ data: undefined }), isFirmRules: () => false }));

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
    useRequestChange: () => ({ mutate: state.changeMutate, isPending: false, error: null, reset: vi.fn() }),
    useRequestExtension: stub,
    useRespondConsultationInvite: () => ({
      mutate: state.respondMutate,
      isPending: false,
      error: state.respondError,
      variables: state.respondVariables,
      reset: vi.fn(),
    }),
    useRefreshQuotes: () => state.refreshQuotes,
    useWithdrawQuote: stub,
    useDeclineQuote: () => ({ mutate: state.declineMutate, isPending: false, error: state.declineError, reset: vi.fn() }),
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
    // a3: varianta veche (fara rubrici structurate) — testele noi le completeaza
    vatMode: null,
    deliveryTermValue: null,
    deliveryTermUnit: null,
    warrantyMonths: null,
    includesTransport: null,
    includesAssembly: null,
    designIncludes: null,
    vatRatePercent: 21,
    priceWithVat: null,
    totalWithVat: null,
    deliveryWorkingDays: null,
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
    declinedAt: null,
    declineReason: null,
    declineNote: null,
    changeRequests: [],
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
// butonul din subsolul cardului care deschide dialogul de confirmare
const ACCEPT = en.Quotes.accept;

describe('OfferCard — dialogul de acceptare (E-client-1)', () => {
  beforeEach(() => {
    state.fresh = quote();
    state.acceptError = null;
    state.acceptMutate = vi.fn();
    state.changeMutate = vi.fn();
  });

  it('arata pretul, proiectarea, totalul, livrarea si valabilitatea; nu accepta la deschidere', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    const dialog = screen.getByRole('dialog', { name: 'Accept the offer from Firma A?' });
    const d = within(dialog);
    expect(d.getByText(en.Quotes.furnitureEstimate)).toBeInTheDocument();
    expect(d.getByText('Design fee')).toBeInTheDocument();
    expect(d.getByText('Offer total')).toBeInTheDocument();
    // sumele in formatul limbii aplicatiei, moneda romaneasca scrisa "lei" (ca la etapa 3)
    expect(d.getByText(/11,500.00 lei/)).toBeInTheDocument();
    expect(d.getByText('Delivery')).toBeInTheDocument();
    expect(d.getByText('6 săptămâni')).toBeInTheDocument();
    expect(d.getByText(/^Valid until /)).toBeInTheDocument();
    expect(d.getByText(en.Quotes.acceptConfirmVatHint)).toBeInTheDocument();
    expect(d.queryByText(NEW_VERSION)).not.toBeInTheDocument();
    expect(state.acceptMutate).not.toHaveBeenCalled();
  });

  it('confirmarea trimite id-ul versiunii afisate', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, accept the offer' }));
    expect(state.acceptMutate).toHaveBeenCalledTimes(1);
    expect(state.acceptMutate.mock.calls[0][0]).toEqual({ quoteId: 'q1', quoteVersionId: 'v1' });
  });

  it('Back inchide dialogul fara acceptare', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.acceptMutate).not.toHaveBeenCalled();
  });

  it('versiune noua trimisa de firma → anunt + noile conditii + trimite noul id', () => {
    state.fresh = quote({
      versions: [version(), version({ id: 'v2', version: 2, price: 9000, designFee: null })],
    });
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    const d = within(screen.getByRole('dialog'));
    expect(d.getByText(NEW_VERSION)).toBeInTheDocument();
    expect(d.getByText('Version 2')).toBeInTheDocument();
    expect(d.getAllByText(/9,000.00 lei/).length).toBeGreaterThan(0);
    fireEvent.click(d.getByRole('button', { name: 'Yes, accept the offer' }));
    expect(state.acceptMutate.mock.calls[0][0]).toEqual({ quoteId: 'q1', quoteVersionId: 'v2' });
  });

  it('409 QUOTE_VERSION_CHANGED → mesajul de versiune noua o singura data', () => {
    state.acceptError = new ApiError('QUOTE_VERSION_CHANGED', 409, '');
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    const d = within(screen.getByRole('dialog'));
    expect(d.getAllByText(NEW_VERSION)).toHaveLength(1);
  });

  it('oferta EXPIRED: fara buton de acceptare (doar cererea de prelungire)', () => {
    renderCard(quote({ status: 'EXPIRED', versions: [version({ isExpired: true })] }));
    expect(screen.queryByRole('button', { name: ACCEPT })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Quotes.requestExtension })).toBeInTheDocument();
  });

  it('oferta retrasa: fara actiuni de acceptare sau modificare', () => {
    renderCard(quote({ status: 'WITHDRAWN' }));
    expect(screen.queryByRole('button', { name: ACCEPT })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.Quotes.requestChange })).not.toBeInTheDocument();
  });

  it('cardul arata totalul ofertei cand exista proiectare', () => {
    renderCard(quote());
    expect(screen.getByText('Offer total')).toBeInTheDocument();
    // g0-11: mobilierul (estimare) si proiectarea apar separat deasupra totalului
    expect(screen.getByText(en.Quotes.furnitureEstimate)).toBeInTheDocument();
    expect(screen.getByText(/11,500.00 lei/)).toBeInTheDocument();
  });

  it('cardul arata totalul ofertei si fara proiectare, fara subtotal separat', () => {
    renderCard(quote({ versions: [version({ designFee: null })] }));
    expect(screen.getByText('Offer total')).toBeInTheDocument();
    expect(screen.getByText(/10,000.00 lei/)).toBeInTheDocument();
    expect(screen.queryByText(en.Quotes.furnitureEstimate)).not.toBeInTheDocument();
  });
});

describe('OfferCard — cererea de modificare', () => {
  beforeEach(() => {
    state.acceptMutate = vi.fn();
    state.changeMutate = vi.fn();
  });

  it('formularul se deschide din buton si trimite textul pe ultima versiune', () => {
    renderCard(quote());
    // inchis la inceput: campul apare abia dupa click pe "Request a change"
    expect(screen.queryByLabelText(en.Quotes.changePlaceholder)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.Quotes.requestChange }));
    const field = screen.getByLabelText(en.Quotes.changePlaceholder);
    const send = screen.getByRole('button', { name: 'Send change request' });
    // sub 3 caractere nu se trimite
    expect(send).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Alt blat' } });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(state.changeMutate).toHaveBeenCalledTimes(1);
    expect(state.changeMutate.mock.calls[0][0]).toEqual({ quoteVersionId: 'v1', requestedText: 'Alt blat' });
    expect(state.acceptMutate).not.toHaveBeenCalled();
  });

  it('cu o modificare in asteptare nu se poate cere alta', () => {
    renderCard(
      quote({
        versions: [
          version({
            changeRequest: {
              id: 'cr1',
              quoteVersionId: 'v1',
              requestedText: 'Alt blat',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              respondedAt: null,
            },
          }),
        ],
      }),
    );
    expect(screen.queryByRole('button', { name: en.Quotes.requestChange })).not.toBeInTheDocument();
    expect(screen.getByText(en.Quotes.awaitingFirm)).toBeInTheDocument();
  });
});

// ===== etapa 4: rubrici structurate (a3), variante (a4), refuz (a4), proiectare (g0-11) =====
const Q = en.Quotes;
const pending = (over: Record<string, unknown> = {}) => ({
  id: 'cr1',
  quoteVersionId: 'v1',
  requestedText: 'Alt blat, mai ieftin',
  status: 'PENDING' as const,
  createdAt: new Date().toISOString(),
  respondedAt: null,
  ...over,
});
const structured = {
  vatMode: 'VAT_EXCLUDED',
  vatRatePercent: 21,
  priceWithVat: 12100,
  totalWithVat: 13915,
  deliveryTermValue: 6,
  deliveryTermUnit: 'WEEKS',
  deliveryWorkingDays: 30,
  warrantyMonths: 24,
  includesTransport: true,
  includesAssembly: false,
  designIncludes: 'Masuratori si randari 3D',
};

describe('OfferCard — rubricile structurate (a3) si proiectarea (g0-11)', () => {
  beforeEach(() => {
    state.acceptMutate = vi.fn();
  });

  it('arata TVA, ce e inclus, termenul si garantia din rubrici; dialogul nu mai cere sa intrebi de TVA', () => {
    const v = version({ price: 10000, designFee: 1500, ...structured } as Partial<QuoteVersionDto>);
    state.fresh = quote({ versions: [v] });
    renderCard(quote({ versions: [v] }));
    expect(screen.getByText('Excludes VAT · with VAT (21%): 13,915.00 lei')).toBeInTheDocument();
    expect(screen.getByText('Transport included · Installation not included')).toBeInTheDocument();
    expect(screen.getByText('6 weeks')).toBeInTheDocument();
    expect(screen.getByText('24 months')).toBeInTheDocument();
    // g0-11: ce include proiectarea, separat, si mobilierul ca estimare
    expect(screen.getByText('Masuratori si randari 3D')).toBeInTheDocument();
    expect(screen.getByText(Q.designEstimateNote)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ACCEPT }));
    const d = within(screen.getByRole('dialog'));
    expect(d.getByText('Excludes VAT · with VAT (21%): 13,915.00 lei')).toBeInTheDocument();
    expect(d.getByText('24 months')).toBeInTheDocument();
    expect(d.queryByText(Q.acceptConfirmVatHint)).not.toBeInTheDocument();
    expect(d.getByText(Q.acceptConfirmPaymentHint)).toBeInTheDocument();
  });

  it('oferta veche (fara rubrici) ramane cu textul liber, fara calcule', () => {
    renderCard(quote({ versions: [version({ warranty: '2 ani' })] }));
    expect(screen.getByText('6 săptămâni')).toBeInTheDocument();
    expect(screen.getByText('2 ani')).toBeInTheDocument();
    expect(screen.queryByText(Q.builder.vat.label)).not.toBeInTheDocument();
    expect(screen.queryByText(Q.builder.included.label)).not.toBeInTheDocument();
  });
});

describe('OfferCard — variantele si cererile de modificare (a4)', () => {
  it('arata v1 si v2 cu diferentele, iar cererea ramane vizibila dupa raspuns', () => {
    const v1 = version({ changeRequest: pending({ status: 'FULFILLED', respondedAt: new Date().toISOString() }) });
    const v2 = version({ id: 'v2', version: 2, price: 9000, designFee: 1500, description: 'Blat compact' });
    renderCard(quote({ versions: [v1, v2] }));
    const history = within(screen.getByRole('region', { name: Q.history.title }));
    expect(history.getByText('Version 1')).toBeInTheDocument();
    expect(history.getByText(/Version 2/)).toBeInTheDocument();
    expect(history.getByText('Total: 11,500.00 lei → 10,500.00 lei (−1,000.00 lei)')).toBeInTheDocument();
    expect(history.getByText(Q.history.diff.description)).toBeInTheDocument();
    // cererea apare la varianta pe care s-a cerut si la cea care i-a raspuns
    expect(history.getAllByText(/Alt blat, mai ieftin/)).toHaveLength(2);
    expect(history.getByText('The company replied with version 2.')).toBeInTheDocument();
    // fara alerta de "modificare in asteptare"
    expect(screen.queryByText(Q.awaitingFirm)).not.toBeInTheDocument();
  });

  it('varianta 2 in alta moneda: suma in euro si schimbarea de moneda', () => {
    const v1 = version({ designFee: null });
    const v2 = version({
      id: 'v2',
      version: 2,
      designFee: null,
      price: 2000,
      currency: 'EUR',
      priceRon: 10000,
      priceEur: 2000,
      total: 2000,
      totalRon: 10000,
      totalEur: 2000,
    });
    renderCard(quote({ versions: [v1, v2] }));
    expect(screen.getAllByText('2,000.00 EUR').length).toBeGreaterThan(0);
    expect(screen.getByText('Total: 10,000.00 lei → 2,000.00 EUR (different currency)')).toBeInTheDocument();
  });

  it('cererea in asteptare apare si in istoric, cu starea ei', () => {
    renderCard(quote({ versions: [version({ changeRequest: pending() })] }));
    const history = within(screen.getByRole('region', { name: Q.history.title }));
    expect(history.getByText(Q.history.changePending)).toBeInTheDocument();
  });

  it('istoricul complet din server (changeRequests): cererea refuzata si cea indeplinita, fiecare la varianta ei', () => {
    const v1 = version();
    const v2 = version({ id: 'v2', version: 2, price: 9500 });
    renderCard(
      quote({
        versions: [v1, v2],
        changeRequests: [
          { ...pending({ id: 'a', requestedText: 'Fara vitrina', status: 'REJECTED' }), requestedOnVersion: 1, answeredByVersion: null },
          { ...pending({ id: 'b', requestedText: 'Blat din cuart', status: 'FULFILLED' }), requestedOnVersion: 1, answeredByVersion: 2 },
        ],
      }),
    );
    const history = within(screen.getByRole('region', { name: Q.history.title }));
    expect(history.getByText(/Fara vitrina/)).toBeInTheDocument();
    expect(history.getByText(Q.history.changeRejected)).toBeInTheDocument();
    expect(history.getAllByText(/Blat din cuart/)).toHaveLength(2);
    expect(history.getByText('The company replied with version 2.')).toBeInTheDocument();
  });
});

describe('OfferCard — refuzul ofertei (a4)', () => {
  beforeEach(() => {
    state.declineMutate = vi.fn();
    state.declineError = null;
  });

  it('un clic deschide dialogul cu consecintele; refuzul pleaca doar la confirmare, cu motivul si textul', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: Q.decline.open }));
    const d = within(screen.getByRole('dialog', { name: 'Decline the offer from Firma A?' }));
    expect(d.getByText(/Declining is final/)).toBeInTheDocument();
    // nimic despre credite
    expect(d.queryByText(/credit/i)).not.toBeInTheDocument();
    expect(state.declineMutate).not.toHaveBeenCalled();
    fireEvent.click(d.getByRole('radio', { name: Q.declineReasons.PRICE }));
    fireEvent.change(d.getByLabelText(Q.decline.noteLabel), { target: { value: '  Prea scump pentru noi  ' } });
    fireEvent.click(d.getByRole('button', { name: Q.decline.confirm }));
    expect(state.declineMutate).toHaveBeenCalledTimes(1);
    expect(state.declineMutate.mock.calls[0][0]).toEqual({
      quoteId: 'q1',
      reason: 'PRICE',
      note: 'Prea scump pentru noi',
    });
  });

  it('fara motiv: refuzul pleaca fara reason si note', () => {
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: Q.decline.open }));
    fireEvent.click(screen.getByRole('button', { name: Q.decline.confirm }));
    expect(state.declineMutate.mock.calls[0][0]).toEqual({ quoteId: 'q1', reason: undefined, note: undefined });
  });

  it('409 QUOTE_NOT_DECLINABLE are text', () => {
    state.declineError = new ApiError('QUOTE_NOT_DECLINABLE', 409, '');
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: Q.decline.open }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
      Q.apiErrors.QUOTE_NOT_DECLINABLE,
    );
  });

  const declined = () =>
    quote({
      status: 'DECLINED',
      declinedAt: '2026-11-13T10:00:00.000Z',
      declineReason: 'DELIVERY_TERM',
      declineNote: 'Avem nevoie mai repede',
    } as unknown as Partial<QuoteDto>);

  it('clientul vede oferta refuzata, fara butoane de actiune', () => {
    renderCard(declined());
    expect(screen.getByText(/· Declined/)).toBeInTheDocument();
    expect(screen.getByText('You declined this offer on November 13, 2026.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACCEPT })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: Q.requestChange })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: Q.decline.open })).not.toBeInTheDocument();
  });

  it('firma vede refuzul cu motivul si textul clientului (si pe rezumatul unei preluari inchise)', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferCard quote={declined()} mode="company" includesPaidDesign={false} readOnly />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('The client declined the offer on November 13, 2026.')).toBeInTheDocument();
    expect(screen.getByText(Q.declineReasons.DELIVERY_TERM)).toBeInTheDocument();
    expect(screen.getByText('“Avem nevoie mai repede”')).toBeInTheDocument();
  });
});

// ===== revizuirea etapei 4: M3, m1, m2, m3, m4, m11, 12 =====
const invite = (over: Record<string, unknown> = {}) => ({
  id: 'inv1',
  quoteId: 'q1',
  companyId: 'c1',
  locationAddress: 'Str. Lemnului 3',
  proposedDatetime: '2026-11-20T10:00:00.000Z',
  alternativeDatetimes: null,
  status: 'PENDING_CLIENT' as const,
  clientResponseText: null,
  expiresAt: '2026-11-19T10:00:00.000Z',
  respondedAt: null,
  createdAt: '2026-11-13T10:00:00.000Z',
  ...over,
});
const declinedQuote = (over: Partial<QuoteDto> = {}) =>
  quote({ status: 'DECLINED', declinedAt: '2026-11-13T10:00:00.000Z', ...over });

describe('OfferCard — dupa revizuire', () => {
  beforeEach(() => {
    state.respondMutate = vi.fn();
    state.respondError = null;
    state.respondVariables = undefined;
    state.declineMutate = vi.fn();
    state.declineError = null;
    state.refreshQuotes = vi.fn();
  });

  it('M3: butoanele invitatiei apar doar pe oferta trimisa si neexpirata', () => {
    const { unmount } = renderCard(quote({ consultationInvites: [invite()] }));
    expect(screen.getByRole('button', { name: Q.inviteAccept })).toBeInTheDocument();
    unmount();
    renderCard(declinedQuote({ consultationInvites: [invite()] }));
    expect(screen.queryByRole('button', { name: Q.inviteAccept })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: Q.inviteDecline })).not.toBeInTheDocument();
  });

  it('M3: invitatie pe o oferta trimisa dar trecuta de valabilitate → fara butoane', () => {
    renderCard(quote({ consultationInvites: [invite()], versions: [version({ isExpired: true })] }));
    expect(screen.queryByRole('button', { name: Q.inviteAccept })).not.toBeInTheDocument();
  });

  it('M3: eroarea raspunsului la invitatie apare langa butoane', () => {
    state.respondError = new ApiError('CONSULTATION_INVITE_EXPIRED', 409, '');
    state.respondVariables = { inviteId: 'inv1', accept: true };
    renderCard(quote({ consultationInvites: [invite()] }));
    expect(screen.getByRole('alert')).toHaveTextContent(Q.apiErrors.CONSULTATION_INVITE_EXPIRED);
  });

  it('m1: cererea in asteptare pe oferta refuzata nu mai e "fara raspuns de la firma"', () => {
    renderCard(declinedQuote({ versions: [version({ changeRequest: pending() })] }));
    const history = within(screen.getByRole('region', { name: Q.history.title }));
    expect(history.getByText(Q.history.changeClosed)).toBeInTheDocument();
    expect(history.queryByText(Q.history.changePending)).not.toBeInTheDocument();
  });

  it('m1: cererea inchisa de server la refuz (REJECTED odata cu refuzul) nu apare ca refuz al firmei', () => {
    renderCard(
      declinedQuote({
        changeRequests: [
          {
            ...pending({ status: 'REJECTED', respondedAt: '2026-11-13T10:00:00.500Z' }),
            requestedOnVersion: 1,
            answeredByVersion: null,
          },
        ],
      }),
    );
    const history = within(screen.getByRole('region', { name: Q.history.title }));
    expect(history.getByText(Q.history.changeClosed)).toBeInTheDocument();
    expect(history.queryByText(Q.history.changeRejected)).not.toBeInTheDocument();
  });

  it('m2: firma nu vede "Valabila pana la" pe oferta refuzata', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferCard quote={declinedQuote()} mode="company" includesPaidDesign={false} readOnly />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(/^Valid until /)).not.toBeInTheDocument();
  });

  it('m3: varianta veche (text) si cea noua (rubrici) cu acelasi termen si garantie → fara schimbari false', () => {
    const v1 = version({ deliveryTerm: '6 săptămâni', warranty: '24 luni' });
    const v2 = version({
      id: 'v2',
      version: 2,
      deliveryTerm: '6 săptămâni',
      warranty: '24 de luni',
      deliveryTermValue: 6,
      deliveryTermUnit: 'WEEKS',
      warrantyMonths: 24,
    });
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <OfferCard quote={quote({ versions: [v1, v2] })} mode="client" includesPaidDesign />
      </NextIntlClientProvider>,
    );
    const history = within(screen.getByRole('region', { name: ro.Quotes.history.title }));
    expect(history.queryByText(/^Termen:/)).not.toBeInTheDocument();
    expect(history.queryByText(/^Garanție:/)).not.toBeInTheDocument();
    expect(history.getByText('Aceleași condiții ca versiunea 1.')).toBeInTheDocument();
  });

  it('m4: dupa refuz, clientul nu citeste o promisiune despre "celelalte oferte"', () => {
    renderCard(declinedQuote());
    expect(screen.getByText(Q.declined.clientNext)).toBeInTheDocument();
    expect(Q.declined.clientNext).not.toMatch(/other offers/);
  });

  it('m11 / 12: refuzul pe o oferta expirata intre timp — dialogul ramane deschis cu eroarea, reimprospatare la inchidere', () => {
    state.declineError = new ApiError('QUOTE_EXPIRED', 409, '');
    renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: Q.decline.open }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(Q.apiErrors.QUOTE_EXPIRED);
    // fara o noua incercare
    expect(within(dialog).getByRole('button', { name: Q.decline.confirm })).toBeDisabled();
    expect(state.refreshQuotes).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: Q.decline.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.refreshQuotes).toHaveBeenCalledTimes(1);
  });

  it('m11: dupa un refuz reusit focusul ajunge pe anuntul de refuz', () => {
    state.declineMutate = vi.fn((_input, opts: { onSuccess?: () => void }) => opts.onSuccess?.());
    const { rerender } = renderCard(quote());
    fireEvent.click(screen.getByRole('button', { name: Q.decline.open }));
    fireEvent.click(screen.getByRole('button', { name: Q.decline.confirm }));
    // lista se reimprospateaza: oferta vine DECLINED
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferCard quote={declinedQuote()} mode="client" includesPaidDesign />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('You declined this offer on November 13, 2026.').closest('[tabindex="-1"]')).toHaveFocus();
  });
});
