import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { FIRM_DECIDES, NO_FRONTS, type RequestItemDto, type RequestRoomDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { RoomSpecCard } from './room-spec-card';

vi.mock('./piece3d/dynamic', () => ({ PieceViewer3dDialog: () => null }));

// Etapa 6 (DESIGN §6.2): fisa firmei arata "Recomandarea firmei" acolo unde clientul a ales
// "Nu stiu — vreau recomandarea firmei". Re-derivat din raspunsuri cu firmRecommendations
// (aceeasi functie ca pe server) — aici pe "Alta piesa" v2, singurul flux al valului 2 deja scris.
const T = ro.Configurator;

function show(room: Partial<RequestRoomDto>) {
  const full: RequestRoomDto = {
    id: 'r1', roomType: 'PIECES', lengthM: 1, widthM: 0.6, heightM: 2.6, items: [], answers: {},
    flowVersion: 2, needsDesignHelp: false, ...room,
  };
  return render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <RoomSpecCard room={full} index={1} />
    </NextIntlClientProvider>,
  );
}

const item = (patch: Partial<RequestItemDto>): RequestItemDto => ({
  id: 'i1', name: 'Etajeră', material: 'ALTUL', systems: [], description: null, quantity: 1, ...patch,
});

describe('RoomSpecCard — recomandarea firmei (etapa 6)', () => {
  it('shows "Recomandarea firmei" instead of "Altul", and the opening badge when there are no systems', () => {
    const { container } = show({
      answers: {
        pieces: [
          { name: 'Etajeră', material: 'ALTUL', materialChoice: FIRM_DECIDES, systems: [], openingChoice: FIRM_DECIDES, quantity: 1 },
        ],
      },
      items: [item({})],
    });
    expect(screen.getByText(T.roomSpec.firmRecommendation)).toBeVisible();
    expect(screen.getByText(T.roomSpec.firmRecommendationOpening)).toBeVisible();
    expect(screen.queryByText(T.common.materials.ALTUL.label)).toBeNull();
    expect(container.querySelectorAll('[data-firm-recommendation]')).toHaveLength(2);
  });

  it('matches by piece name, whatever the item order; only the marked piece gets the badge', () => {
    const { container } = show({
      answers: {
        pieces: [
          { name: 'Comodă', material: 'PAL', systems: ['MANER'], quantity: 1 },
          { name: 'Etajeră', material: 'ALTUL', materialChoice: FIRM_DECIDES, systems: [], openingChoice: NO_FRONTS, quantity: 1 },
        ],
      },
      items: [item({ id: 'i2' }), item({ id: 'i1', name: 'Comodă', material: 'PAL', systems: ['MANER'] })],
    });
    expect(container.querySelector('[data-firm-recommendation="material"]')).not.toBeNull();
    // "Fara usi sau sertare" nu e recomandarea firmei la deschidere
    expect(container.querySelector('[data-firm-recommendation="opening"]')).toBeNull();
    expect(screen.getByText(T.common.materials.PAL.label)).toBeVisible();
  });

  it('a client who chose "Altul" from the list still sees "Altul"', () => {
    show({
      answers: { pieces: [{ name: 'Etajeră', material: 'ALTUL', systems: ['PUSH'], quantity: 1, description: 'Sticlă' }] },
      items: [item({ systems: ['PUSH'] })],
    });
    expect(screen.getByText(T.common.materials.ALTUL.label)).toBeVisible();
    expect(screen.queryByText(T.roomSpec.firmRecommendation)).toBeNull();
  });

  it('an old request (version 1) looks exactly as today', () => {
    const { container } = show({
      flowVersion: 1,
      answers: { pieces: [{ name: 'Etajeră', material: 'ALTUL', systems: [], quantity: 1 }] },
      items: [item({})],
    });
    expect(screen.getByText(T.common.materials.ALTUL.label)).toBeVisible();
    expect(container.querySelector('[data-firm-recommendation]')).toBeNull();
  });

  it('a design-help room shows no badges (no pieces are listed)', () => {
    const { container } = show({
      needsDesignHelp: true,
      answers: { pieces: [{ name: 'Etajeră', material: 'ALTUL', materialChoice: FIRM_DECIDES, systems: [], openingChoice: FIRM_DECIDES, quantity: 1 }] },
      items: [item({})],
    });
    expect(container.querySelector('[data-firm-recommendation]')).toBeNull();
  });
});
