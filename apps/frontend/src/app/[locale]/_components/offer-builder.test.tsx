import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ApiError } from '@/lib/api';
import { OfferBuilder } from './offer-builder';

// E-client-1: formularul de oferta al firmei — defalcarea pe camere blocheaza pretul pe suma,
// defalcarea partiala blocheaza trimiterea, erorile API se afiseaza localizat.
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

describe('OfferBuilder (create)', () => {
  beforeEach(() => {
    state.createMutate = vi.fn();
    state.createError = null;
  });

  it('o singura camera cu pret → trimiterea blocata + mesajul de defalcare partiala', () => {
    renderBuilder(ROOMS);
    fireEvent.change(roomInputs()[0], { target: { value: '1200.5' } });
    expect(screen.getByText(en.Quotes.builder.roomPricesPartial)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Quotes.builder.submit })).toBeDisabled();
  });

  it('toate camerele cu pret → pretul devine suma si e readOnly', () => {
    renderBuilder(ROOMS);
    const [a, b] = roomInputs();
    fireEvent.change(a, { target: { value: '1200.5' } });
    fireEvent.change(b, { target: { value: '800' } });
    expect(priceInput().readOnly).toBe(true);
    expect(priceInput().value).toBe('2000.5');
    expect(screen.getByRole('button', { name: en.Quotes.builder.submit })).toBeEnabled();
  });

  it('trimite pretul total, defalcarea si slotul', async () => {
    renderBuilder(ROOMS);
    const [a, b] = roomInputs();
    fireEvent.change(a, { target: { value: '1200.5' } });
    fireEvent.change(b, { target: { value: '800' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Quotes.builder.description }), {
      target: { value: 'Oferta completa' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.Quotes.builder.submit }));
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1));
    const input = state.createMutate.mock.calls[0][0];
    expect(input).toMatchObject({ price: 2000.5, claimSlotId: 'slot-1', description: 'Oferta completa' });
    expect(input.roomPrices).toHaveLength(2);
    expect(input.roomPrices).toEqual([
      { requestRoomId: 'r1', price: 1200.5 },
      { requestRoomId: 'r2', price: 800 },
    ]);
  });

  it('fara camere → pretul se editeaza liber', () => {
    renderBuilder();
    expect(priceInput().readOnly).toBe(false);
    fireEvent.change(priceInput(), { target: { value: '5000' } });
    expect(priceInput().value).toBe('5000');
  });

  it('eroare API → mesaj localizat', () => {
    state.createError = new ApiError('QUOTE_ALREADY_SENT', 409, '');
    renderBuilder();
    expect(screen.getByText(en.Quotes.apiErrors.QUOTE_ALREADY_SENT)).toBeInTheDocument();
  });
});
