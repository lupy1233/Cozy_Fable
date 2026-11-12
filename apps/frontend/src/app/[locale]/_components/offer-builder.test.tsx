import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ApiError } from '@/lib/api';
import { OfferBuilder } from './offer-builder';

// E-client-1: formularul de oferta al firmei — defalcarea pe camere blocheaza pretul pe suma,
// defalcarea partiala blocheaza trimiterea, erorile API se afiseaza localizat.
// Design 2026-11: unitatile stau langa campuri; termenul si garantia pleaca drept text cu unitate.
const state = vi.hoisted(() => ({ createMutate: vi.fn(), createError: null as unknown }));

vi.mock('@/hooks/use-quotes', () => {
  const stub = () => ({ mutate: vi.fn(), isPending: false, error: null });
  return {
    useCreateQuote: () => ({ mutate: state.createMutate, isPending: false, error: state.createError }),
    useReviseQuote: stub,
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

const priceInput = () => screen.getByRole('spinbutton', { name: en.Quotes.builder.price }) as HTMLInputElement;
const roomInputs = () =>
  ROOMS.map((r, i) =>
    screen.getByRole('spinbutton', {
      name: `${i + 1}. ${(en.Configurator.rooms.type as Record<string, string>)[r.roomType]}`,
    }),
  );
// oferta noua: butonul principal al fisei ("Send offer"), nu "Send"-ul generic al variantelor
const submitButton = () => screen.getByRole('button', { name: en.Quotes.builder.submitCreate });
const numberField = (name: string) => screen.getByRole('spinbutton', { name });
const fillDescription = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: en.Quotes.builder.description }), { target: { value } });

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
    fillDescription('Oferta completa');
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
    expect(input.deliveryTerm).toBeUndefined();
    expect(input.warranty).toBeUndefined();
    expect(input.validityDays).toBeUndefined();
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

  it('termenul, garantia si valabilitatea se trimit cu unitatea lor', async () => {
    renderBuilder();
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    fireEvent.change(numberField(en.Quotes.builder.deliveryTerm), { target: { value: '8' } });
    fireEvent.change(numberField(en.Quotes.builder.warranty), { target: { value: '12' } });
    fireEvent.change(numberField(en.Quotes.builder.validity), { target: { value: '21' } });
    fillDescription('Oferta completa');
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    expect(state.createMutate.mock.calls[0][0]).toMatchObject({
      price: 5000,
      currency: 'RON',
      deliveryTerm: '8 weeks',
      warranty: '12 months',
      validityDays: 21,
    });
  });

  it('termenul in zile lucratoare se trimite cu unitatea aleasa', async () => {
    renderBuilder();
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    fireEvent.change(numberField(en.Quotes.builder.deliveryTerm), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('combobox', { name: en.Quotes.builder.termUnitLabel }), {
      target: { value: 'WORKING_DAYS' },
    });
    fillDescription('Oferta completa');
    fireEvent.click(submitButton());
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    expect(state.createMutate.mock.calls[0][0]).toMatchObject({ deliveryTerm: '10 working days' });
  });

  it('eroare API → mesaj localizat', () => {
    state.createError = new ApiError('QUOTE_ALREADY_SENT', 409, '');
    renderBuilder();
    expect(screen.getByText(en.Quotes.apiErrors.QUOTE_ALREADY_SENT)).toBeInTheDocument();
  });
});
