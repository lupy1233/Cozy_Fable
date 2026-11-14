import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ApiError } from '@/lib/api';
import { OfferBuilder } from './offer-builder';

// E-client-1: formularul de oferta al firmei — defalcarea pe camere blocheaza pretul pe suma,
// defalcarea partiala blocheaza trimiterea, erorile API se afiseaza localizat.
// Design 2026-11: unitatile stau langa campuri; termenul si garantia pleaca drept text cu unitate.
// a3 / a4 / g0-11 (etapa 4): rubricile structurate obligatorii (TVA, termen, garantie, bife),
// proiectarea obligatorie la cererile cu proiectare cu plata, varianta noua precompletata.
const state = vi.hoisted(() => ({
  createMutate: vi.fn(),
  createError: null as unknown,
  reviseMutate: vi.fn(),
  reviseError: null as unknown,
}));

vi.mock('@/hooks/use-quotes', () => {
  const stub = () => ({ mutate: vi.fn(), isPending: false, error: null });
  return {
    useCreateQuote: () => ({ mutate: state.createMutate, isPending: false, error: state.createError }),
    useReviseQuote: () => ({ mutate: state.reviseMutate, isPending: false, error: state.reviseError }),
    useExtraVersion: stub,
    useReoffer: stub,
  };
});

const ROOMS = [
  { id: 'r1', roomType: 'KITCHEN' },
  { id: 'r2', roomType: 'BEDROOM' },
];

function renderBuilder(rooms?: { id: string; roomType: string }[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OfferBuilder kind="create" claimSlotId="slot-1" includesPaidDesign={false} rooms={rooms} />
    </NextIntlClientProvider>,
  );
}

// m12: sumele sunt campuri de text (accepta virgula zecimala); termenul / garantia raman numerice
const priceInput = () => screen.getByRole('textbox', { name: en.Quotes.builder.price }) as HTMLInputElement;
const roomInputs = () =>
  ROOMS.map((r, i) =>
    screen.getByRole('textbox', {
      name: `${i + 1}. ${(en.Configurator.rooms.type as Record<string, string>)[r.roomType]}`,
    }),
  );
// oferta noua: butonul principal al fisei ("Send offer"), nu "Send"-ul generic al variantelor
const submitButton = () => screen.getByRole('button', { name: en.Quotes.builder.submitCreate });
const numberField = (name: string) => screen.getByRole('spinbutton', { name });
const fillDescription = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: en.Quotes.builder.description }), { target: { value } });
const B = en.Quotes.builder;
// rubricile obligatorii fara pret: TVA, termen, garantie, descriere
function fillRequired({ term = '8', warranty = '24', vat = B.vat.VAT_INCLUDED } = {}) {
  fireEvent.click(screen.getByRole('radio', { name: vat }));
  fireEvent.change(numberField(B.deliveryTerm), { target: { value: term } });
  fireEvent.change(numberField(B.warranty), { target: { value: warranty } });
  fillDescription('Oferta completa');
}

describe('OfferBuilder (create)', () => {
  beforeEach(() => {
    state.createMutate = vi.fn();
    state.createError = null;
  });

  it('o singura camera cu pret → trimiterea blocata + mesajul de defalcare partiala', () => {
    renderBuilder(ROOMS);
    fireEvent.change(roomInputs()[0], { target: { value: '1200.5' } });
    expect(screen.getByText(en.Quotes.builder.roomPricesPartial)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('toate camerele cu pret → pretul devine suma si e readOnly', () => {
    renderBuilder(ROOMS);
    const [a, b] = roomInputs();
    fireEvent.change(a, { target: { value: '1200.5' } });
    fireEvent.change(b, { target: { value: '800' } });
    expect(priceInput().readOnly).toBe(true);
    expect(priceInput().value).toBe('2000.5');
    expect(submitButton()).toBeEnabled();
  });

  it('trimite pretul total, defalcarea si slotul', async () => {
    renderBuilder(ROOMS);
    const [a, b] = roomInputs();
    fireEvent.change(a, { target: { value: '1200.5' } });
    fireEvent.change(b, { target: { value: '800' } });
    fillRequired();
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    const input = state.createMutate.mock.calls[0][0];
    expect(input).toMatchObject({ price: 2000.5, claimSlotId: 'slot-1', description: 'Oferta completa' });
    expect(input.roomPrices).toHaveLength(2);
    expect(input.roomPrices).toEqual([
      { requestRoomId: 'r1', price: 1200.5 },
      { requestRoomId: 'r2', price: 800 },
    ]);
    // campurile optionale lasate goale nu pleaca deloc
    expect(input.validityDays).toBeUndefined();
    expect(input.deliveryDate).toBeUndefined();
    // fara cerere cu proiectare: nimic despre proiectare
    expect(input).not.toHaveProperty('designFee');
    expect(input).not.toHaveProperty('designIncludes');
  });

  it('fara camere → pretul se editeaza liber', () => {
    renderBuilder();
    expect(priceInput().readOnly).toBe(false);
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    expect(priceInput().value).toBe('5000');
  });

  it('unitatile stau langa campuri: moneda la preturi, luni la garantie, zile la valabilitate', () => {
    renderBuilder(ROOMS);
    expect(priceInput()).toHaveAccessibleDescription(en.Quotes.builder.unit.RON);
    for (const room of roomInputs()) {
      expect(room).toHaveAccessibleDescription(en.Quotes.builder.unit.RON);
    }
    expect(numberField(en.Quotes.builder.warranty)).toHaveAccessibleDescription(en.Quotes.builder.unitMonths);
    expect(numberField(en.Quotes.builder.validity)).toHaveAccessibleDescription(en.Quotes.builder.unitDays);
    // moneda aleasa schimba unitatea de langa sume
    fireEvent.change(screen.getByRole('combobox', { name: en.Quotes.builder.currency }), {
      target: { value: 'EUR' },
    });
    expect(priceInput()).toHaveAccessibleDescription(en.Quotes.builder.unit.EUR);
  });

  it('a3: termenul (numar + unitate), garantia in luni, TVA si bifele pleaca separat, fara textele libere', async () => {
    renderBuilder();
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    fillRequired({ term: '8', warranty: '12', vat: B.vat.VAT_EXCLUDED });
    fireEvent.click(screen.getByRole('checkbox', { name: B.included.transport }));
    fireEvent.change(numberField(B.validity), { target: { value: '21' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    const input = state.createMutate.mock.calls[0][0];
    expect(input).toMatchObject({
      price: 5000,
      currency: 'RON',
      vatMode: 'VAT_EXCLUDED',
      deliveryTermValue: 8,
      deliveryTermUnit: 'WEEKS',
      warrantyMonths: 12,
      includesTransport: true,
      includesAssembly: false,
      validityDays: 21,
    });
    expect(input).not.toHaveProperty('deliveryTerm');
    expect(input).not.toHaveProperty('warranty');
  });

  it('termenul in zile lucratoare se trimite cu unitatea aleasa', async () => {
    renderBuilder();
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    fillRequired({ term: '10' });
    fireEvent.change(screen.getByRole('combobox', { name: B.termUnitLabel }), {
      target: { value: 'WORKING_DAYS' },
    });
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    expect(state.createMutate.mock.calls[0][0]).toMatchObject({ deliveryTermValue: 10, deliveryTermUnit: 'WORKING_DAYS' });
  });

  it('a3: fara TVA, termen sau garantie oferta nu pleaca si fiecare rubrica spune ce lipseste', async () => {
    renderBuilder();
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    fillDescription('Oferta completa');
    fireEvent.click(submitButton());
    expect(await screen.findByText(en.Quotes.validation.vatRequired)).toBeInTheDocument();
    // termenul si garantia: numar intreg intre 1 si plafonul serverului
    expect(screen.getByText('Enter a whole number from 1 to 520.')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number from 1 to 600.')).toBeInTheDocument();
    expect(state.createMutate).not.toHaveBeenCalled();
  });

  it('indemnul despre TVA nu mai e in descriere', () => {
    renderBuilder();
    expect(screen.getByText(B.descriptionHint)).toBeInTheDocument();
    expect(B.descriptionHint).not.toMatch(/VAT/);
  });

  it('eroare API → mesaj localizat', () => {
    state.createError = new ApiError('QUOTE_ALREADY_SENT', 409, '');
    renderBuilder();
    expect(screen.getByText(en.Quotes.apiErrors.QUOTE_ALREADY_SENT)).toBeInTheDocument();
  });
});

describe('OfferBuilder — proiectarea cu plata (g0-11)', () => {
  beforeEach(() => {
    state.createMutate = vi.fn();
    state.createError = null;
  });

  const renderPaid = () =>
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferBuilder kind="create" claimSlotId="slot-1" includesPaidDesign />
      </NextIntlClientProvider>,
    );
  const furniturePrice = () => screen.getByRole('textbox', { name: B.priceFurnitureEstimate });

  it('pretul proiectarii si "ce include" sunt obligatorii; mobilierul e o estimare', async () => {
    renderPaid();
    expect(screen.getByText(B.design.note)).toBeInTheDocument();
    fireEvent.change(furniturePrice(), { target: { value: '20000' } });
    fillRequired();
    fireEvent.click(submitButton());
    expect(await screen.findByText(/^Enter the design price/)).toBeInTheDocument();
    expect(screen.getByText(en.Quotes.validation.designIncludesRequired)).toBeInTheDocument();
    expect(state.createMutate).not.toHaveBeenCalled();
  });

  it('trimite proiectarea separat de pretul mobilierului', async () => {
    renderPaid();
    fireEvent.change(furniturePrice(), { target: { value: '20000' } });
    fireEvent.change(screen.getByRole('textbox', { name: B.designFee }), { target: { value: '1500' } });
    fireEvent.change(screen.getByRole('textbox', { name: B.design.includes }), {
      target: { value: 'Masuratori, randari 3D, doua runde de modificari' },
    });
    fillRequired();
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    expect(state.createMutate.mock.calls[0][0]).toMatchObject({
      price: 20000,
      designFee: 1500,
      designIncludes: 'Masuratori, randari 3D, doua runde de modificari',
    });
  });
});

describe('OfferBuilder — varianta noua (a4)', () => {
  beforeEach(() => {
    state.reviseMutate = vi.fn();
  });

  const previous = {
    id: 'v1',
    version: 1,
    isExtra: false,
    price: 9000,
    designFee: null,
    currency: 'RON',
    priceRon: 9000,
    priceEur: 1800,
    designFeeRon: null,
    designFeeEur: null,
    total: 9000,
    totalRon: 9000,
    totalEur: 1800,
    deliveryTerm: '6 săptămâni',
    deliveryDate: null,
    warranty: '24 luni',
    description: 'Bucatarie completa',
    validUntil: new Date(Date.now() + 864e6).toISOString(),
    isExpired: false,
    validityExtensionsUsed: 0,
    extensionRequestedAt: null,
    createdByUserId: 'u1',
    sentAt: new Date().toISOString(),
    changeRequest: null,
    attachments: [],
    roomPrices: [],
    vatMode: 'NOT_VAT_PAYER',
    deliveryTermValue: 6,
    deliveryTermUnit: 'WEEKS',
    warrantyMonths: 24,
    includesTransport: true,
    includesAssembly: true,
  } as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ui = (prev: any = previous, rooms?: { id: string; roomType: string }[], locale = 'en') => (
    <NextIntlClientProvider locale={locale} messages={en}>
      <OfferBuilder
        kind="revise"
        quoteId="q1"
        changeRequestId="cr1"
        includesPaidDesign={false}
        currency="RON"
        rooms={rooms}
        previous={prev}
      />
    </NextIntlClientProvider>
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderRevise = (prev: any = previous, rooms?: { id: string; roomType: string }[]) => render(ui(prev, rooms));
  const currencySelect = () => screen.getByRole('combobox', { name: B.currency });
  const sendButton = () => screen.getByRole('button', { name: B.submit });

  it('M2: schimbarea DOAR a monedei nu trimite aceeasi suma in alta moneda', async () => {
    renderRevise();
    fireEvent.change(currencySelect(), { target: { value: 'EUR' } });
    // avertismentul apare langa pret
    expect(screen.getByText('You changed the currency. Amounts are not converted: enter the price in euro.')).toBeInTheDocument();
    fireEvent.click(sendButton());
    expect(
      await screen.findByText('This is the same amount as in version 1, but the currency changed. Enter the amount in euro.'),
    ).toBeInTheDocument();
    expect(state.reviseMutate).not.toHaveBeenCalled();
  });

  it('M2: aceeasi regula pe preturile pe camere', async () => {
    renderRevise(
      {
        ...previous,
        price: 2000,
        roomPrices: [
          { requestRoomId: 'r1', roomType: 'KITCHEN', price: 1200 },
          { requestRoomId: 'r2', roomType: 'BEDROOM', price: 800 },
        ],
      },
      ROOMS,
    );
    fireEvent.change(currencySelect(), { target: { value: 'EUR' } });
    // doar prima camera primeste o suma noua; a doua ramane 800
    fireEvent.change(roomInputs()[0], { target: { value: '240' } });
    fireEvent.click(sendButton());
    expect(await screen.findAllByText(/same amount as in version 1/)).toHaveLength(1);
    expect(state.reviseMutate).not.toHaveBeenCalled();
  });

  it('M2: in aceeasi moneda, sumele neschimbate pleaca fara oprire', async () => {
    renderRevise();
    fireEvent.click(sendButton());
    await waitFor(() => expect(state.reviseMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Amounts are not converted/)).not.toBeInTheDocument();
  });

  it('M1: eroarea de permisiuni numeste campurile din details.fields', () => {
    state.reviseError = new ApiError('OFFER_FIELD_NOT_EDITABLE', 403, '', { fields: ['DELIVERY_DATE', 'WARRANTY'] });
    renderRevise();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are not allowed to change: Delivery date, Warranty. Leave these fields as they were',
    );
    state.reviseError = null;
  });

  it('m10: eticheta "completat din varianta N" ramane cea de la deschidere', () => {
    const { rerender } = renderRevise();
    rerender(ui({ ...previous, id: 'v2', version: 2, price: 9500 }));
    expect(screen.getByText(B.prefilledFrom.replace('{n}', '1'))).toBeInTheDocument();
    expect(priceInput().value).toBe('9000');
  });

  it('m8 / m12: plafoanele serverului au mesaj pe camp; suma accepta virgula zecimala', async () => {
    renderRevise();
    expect(screen.getByRole('form', { name: B.reviseTitle })).toHaveAttribute('novalidate');
    fireEvent.change(numberField(B.warranty), { target: { value: '601' } });
    fireEvent.change(priceInput(), { target: { value: '100000001' } });
    fireEvent.click(sendButton());
    expect(await screen.findByText('Enter a whole number from 1 to 600.')).toBeInTheDocument();
    expect(screen.getByText(/^Enter an amount greater than zero, at most 100,000,000/)).toBeInTheDocument();
    expect(state.reviseMutate).not.toHaveBeenCalled();
    fireEvent.change(numberField(B.warranty), { target: { value: '24' } });
    fireEvent.change(priceInput(), { target: { value: '9250,5' } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(state.reviseMutate).toHaveBeenCalledTimes(1));
    expect(state.reviseMutate.mock.calls[0][0]).toMatchObject({ price: 9250.5 });
  });

  it('porneste precompletata din ultima varianta', () => {
    renderRevise();
    expect(screen.getByText(B.prefilledFrom.replace('{n}', '1'))).toBeInTheDocument();
    expect(priceInput().value).toBe('9000');
    expect(numberField(B.deliveryTerm)).toHaveValue(6);
    expect(numberField(B.warranty)).toHaveValue(24);
    expect(screen.getByRole('radio', { name: B.vat.NOT_VAT_PAYER })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: B.included.transport })).toBeChecked();
    expect(screen.getByRole('textbox', { name: B.description })).toHaveValue('Bucatarie completa');
  });

  it('moneda e a variantei: varianta noua poate trece in euro', async () => {
    renderRevise();
    fireEvent.change(screen.getByRole('combobox', { name: B.currency }), { target: { value: 'EUR' } });
    expect(priceInput()).toHaveAccessibleDescription(B.unit.EUR);
    fireEvent.change(priceInput(), { target: { value: '1700' } });
    fireEvent.click(screen.getByRole('button', { name: B.submit }));
    await waitFor(() => expect(state.reviseMutate).toHaveBeenCalledTimes(1));
    expect(state.reviseMutate.mock.calls[0][0]).toMatchObject({
      changeRequestId: 'cr1',
      price: 1700,
      currency: 'EUR',
      vatMode: 'NOT_VAT_PAYER',
      deliveryTermValue: 6,
      warrantyMonths: 24,
      includesTransport: true,
      includesAssembly: true,
    });
  });
});
