import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ROOM_TYPES } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { CartBasket } from './cart-basket';
import { CART_ART } from './cart-visual';
import { RoomCartStep } from './room-cart-step';

function show() {
  const onContinue = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <RoomCartStep onBack={() => {}} onContinue={onContinue} />
      <CartBasket />
    </NextIntlClientProvider>,
  );
  return { onContinue };
}

const tile = (roomType: string) => document.querySelector<HTMLElement>(`[data-cart-tile="${roomType}"]`)!;
const types = () => useConfiguratorStore.getState().roomInstances.map((r) => r.roomType);

describe('cosul de camere si piese', () => {
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setStartMode('STANDARD');
  });

  it('fiecare tip de camera sau piesa are o imagine in cos', () => {
    for (const roomType of ROOM_TYPES) expect(CART_ART[roomType], roomType).toBeDefined();
  });

  it('pozele din cos exista pe disc, iar piesele tapitate au redare, nu schita', () => {
    for (const roomType of ROOM_TYPES) {
      const art = CART_ART[roomType];
      if (art.kind === 'photo') expect(existsSync(join(process.cwd(), 'public', art.src)), art.src).toBe(true);
    }
    for (const roomType of ['PIECE_SOFA', 'PIECE_ARMCHAIR', 'PIECE_OTTOMAN'] as const) {
      expect(CART_ART[roomType].kind, roomType).toBe('photo');
    }
  });

  it('butonul "Adauga {tip}" e unic si adauga o singura camera (nu si prin cartonas)', () => {
    show();
    // un singur buton cu acest nume: testele e2e si cititoarele de ecran se bazeaza pe el
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Bucătărie' }));
    expect(types()).toEqual(['KITCHEN']);
    expect(tile('KITCHEN')).toHaveAttribute('data-selected');
    // dupa adaugare, acelasi nume il poarta "+" din pasul de cantitate
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Bucătărie' }));
    expect(types()).toEqual(['KITCHEN', 'KITCHEN']);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge Bucătărie' }));
    expect(types()).toEqual(['KITCHEN']);
  });

  it('click pe cartonas adauga doar cat timp tipul nu e in cos', () => {
    show();
    fireEvent.click(tile('BEDROOM'));
    fireEvent.click(tile('BEDROOM'));
    expect(types()).toEqual(['BEDROOM']);
  });

  it('cosul grupeaza camerele si piesele, cu cantitate si numar de sectiuni', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Dormitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Dormitor' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Piese individuale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Canapea' }));

    const basket = within(screen.getByRole('complementary', { name: 'Coșul cererii tale' }));
    expect(basket.getByText('2 camere · o piesă')).toBeInTheDocument();
    expect(basket.getByText('Dormitor')).toBeInTheDocument();
    expect(basket.getByText('Canapea')).toBeInTheDocument();
    expect(basket.getAllByText(/secțiun/).length).toBe(2);

    fireEvent.click(basket.getByRole('button', { name: 'Scoate Dormitor din coș' }));
    expect(types()).toEqual(['BEDROOM', 'PIECE_SOFA']);
  });

  it('"Alta piesa" intra o singura data si se poate elimina', () => {
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Piese individuale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă piese' }));
    expect(types()).toEqual(['PIECES']);
    expect(screen.queryByRole('button', { name: 'Adaugă piese' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elimină' }));
    expect(types()).toEqual([]);
  });

  it('nu se poate continua cu cosul gol', () => {
    const { onContinue } = show();
    const next = screen.getByRole('button', { name: ro.Configurator.nav.startQuestions });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Living' }));
    fireEvent.click(next);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
