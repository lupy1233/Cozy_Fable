import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { RequestRoomDto } from '@marketplace/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { RoomSpecCard } from './room-spec-card';
import { registerToyFlow, TOY_ROOM, TOY_VERSION, unregisterToyFlow } from '@/test/flows-v7';

vi.mock('./piece3d/dynamic', () => ({ PieceViewer3dDialog: () => null }));

// Etapa 10 (E10-N21): un slot optional lasat gol apare pe fisa firmei ca
// "nespecificată de client (de obicei …)", mereu in cm; cererile vechi raman identice.

const SLOTS = ro.Configurator.flows;

function show(room: Partial<RequestRoomDto>, opts: { audience?: 'company' | 'client'; locale?: 'ro' | 'en' } = {}) {
  const full: RequestRoomDto = {
    id: 'r1', roomType: TOY_ROOM, lengthM: 2, widthM: 0.6, heightM: 2.6, items: [], answers: {},
    flowVersion: TOY_VERSION, needsDesignHelp: false, ...room,
  };
  const locale = opts.locale ?? 'ro';
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <RoomSpecCard room={full} index={1} audience={opts.audience} />
    </NextIntlClientProvider>,
  );
}

describe('RoomSpecCard — slot optional gol (etapa 10)', () => {
  beforeAll(registerToyFlow);
  afterAll(unregisterToyFlow);

  it('firma: "nespecificată de client (de obicei 240 cm)" dupa sloturile cu valoare', () => {
    const { container } = show({ answers: { dimensions: { wardrobeWidth: 2 } } });
    expect(container.textContent).toContain(
      `${SLOTS.BEDROOM.dimensions.slots.wardrobeWidth}: 200 cm · ${SLOTS.DRESSING.dimensions.slots.wardrobeHeight}: nespecificată de client (de obicei 240 cm)`,
    );
  });

  it('firma vede cm si in engleza (punct zecimal), chiar daca clientul a lucrat in m', () => {
    const { container } = show({ answers: { dimensions: { wardrobeWidth: 2.05 } } }, { locale: 'en' });
    expect(container.textContent).toContain('not given by the client (usually 240 cm)');
    expect(container.textContent).toContain('205 cm');
  });

  it('clientul isi vede propriul text, fara valoarea tipica', () => {
    const { container } = show({ answers: { dimensions: { wardrobeWidth: 2 } } }, { audience: 'client' });
    expect(container.textContent).toContain(`${SLOTS.DRESSING.dimensions.slots.wardrobeHeight}: Nu ai dat-o — o stabilești cu firma`);
    expect(container.textContent).not.toContain('nespecificată');
  });

  it('cu valoarea data: fara text de lipsa', () => {
    const { container } = show({ answers: { dimensions: { wardrobeWidth: 2, wardrobeHeight: 2.5 } } });
    expect(container.textContent).toContain(`${SLOTS.DRESSING.dimensions.slots.wardrobeHeight}: 250 cm`);
    expect(container.textContent).not.toContain('nespecificată');
  });

  it('cererea veche (dormitor v3) arata ca inainte: fara "nespecificată"', () => {
    const { container } = show({
      roomType: 'BEDROOM', flowVersion: 3,
      answers: { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 2, ceilingHeight: 2.6 } },
    });
    expect(container.textContent).toContain(`${SLOTS.BEDROOM.dimensions.slots.wardrobeWidth}: 200 cm`);
    expect(container.textContent).not.toContain('nespecificată');
  });
});
