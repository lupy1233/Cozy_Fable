import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { CURRENT_FLOW_VERSION, type AnswerMap, type RoomType } from '@marketplace/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { DIMENSION_UNIT_STORAGE_KEY } from '@/lib/dimension-unit';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { RoomFlowRunner } from './room-flow-runner';
import { roomScreens } from './room-screens';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

const T = ro.Configurator;

beforeAll(() => {
  // jsdom nu are scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

function setRoom(roomType: RoomType, answers: AnswerMap = {}, screenOf?: (room: RoomInstance) => number) {
  const room: RoomInstance = {
    localId: '11111111-1111-4111-8111-111111111111',
    roomType,
    flowVersion: CURRENT_FLOW_VERSION[roomType],
    answers,
    completed: false,
  };
  useConfiguratorStore.setState({
    roomInstances: [room],
    activeRoomIndex: 0,
    activeStepIndex: screenOf ? screenOf(room) : 0,
  });
  return room;
}

function renderRunner() {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <RoomFlowRunner uploadTarget={{ kind: 'draft' } as never} onExitToCart={() => {}} onAllDone={() => {}} />
    </NextIntlClientProvider>,
  );
}

const counter = () => document.querySelector('[data-screen-counter]')!.textContent;

describe('RoomFlowRunner — unitatea din ciorna devine preferinta (m2, D1)', () => {
  it('formularul pornit cu "m" din ciorna scrie preferinta; o singura scriere, fara bucla', () => {
    window.localStorage.removeItem(DIMENSION_UNIT_STORAGE_KEY);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useConfiguratorStore.setState({ dimensionUnit: 'm' });
    setRoom('LAUNDRY');
    const { rerender } = renderRunner();
    expect(window.localStorage.getItem(DIMENSION_UNIT_STORAGE_KEY)).toBe('m');
    rerender(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <RoomFlowRunner uploadTarget={{ kind: 'draft' } as never} onExitToCart={() => {}} onAllDone={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(setItem.mock.calls.filter(([k]) => k === DIMENSION_UNIT_STORAGE_KEY)).toHaveLength(1);
  });

  it('aceeasi unitate ca preferinta: nu scrie nimic', () => {
    window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'cm');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useConfiguratorStore.setState({ dimensionUnit: 'cm' });
    setRoom('LAUNDRY');
    renderRunner();
    expect(setItem.mock.calls.filter(([k]) => k === DIMENSION_UNIT_STORAGE_KEY)).toHaveLength(0);
  });
});

describe('RoomFlowRunner — contorul de ecrane (38.5)', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));

  it('dormitorul: "Ecranul 1" fara total si fara bara pana la alegerea pieselor', () => {
    setRoom('BEDROOM');
    renderRunner();
    expect(counter()).toBe('Ecranul 1');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d\d\/\d\d/);
  });

  it('bucataria: totalul e cunoscut de la inceput — "Ecranul 1 din N" + bara', () => {
    const room = setRoom('KITCHEN');
    renderRunner();
    const total = roomScreens(room, false).length;
    expect(counter()).toBe(`Ecranul 1 din ${total}`);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(total));
  });
});

describe('RoomFlowRunner — "Continua" pe dimensiuni goale (39.1) si bara de jos (40.2)', () => {
  const dimsScreen = (room: RoomInstance) => roomScreens(room, false).findIndex((s) => s.some((q) => q.type === 'dimension-group'));

  it('mesaj per camp, rezumat cu numarul golurilor si focus pe primul camp gol', async () => {
    setRoom('LAUNDRY', {}, dimsScreen);
    renderRunner();
    expect(useConfiguratorStore.getState().activeStepIndex).toBeGreaterThanOrEqual(0);
    await userEvent.click(screen.getByRole('button', { name: T.nav.next }));
    const invalid = document.querySelectorAll('[aria-invalid="true"]');
    expect(invalid.length).toBeGreaterThanOrEqual(2);
    expect(document.activeElement).toBe(invalid[0]);
    expect(screen.getAllByText(/^Completează câmpul „.+”\.$/).length).toBe(invalid.length);
    expect(screen.getByText(`${invalid.length} câmpuri necompletate.`)).toBeInTheDocument();
    // a ramas pe acelasi ecran
    expect(useConfiguratorStore.getState().activeStepIndex).toBe(dimsScreen(useConfiguratorStore.getState().roomInstances[0]!));
  });

  it('completarea unui camp scoate doar marcajul lui; celelalte raman', async () => {
    setRoom('LAUNDRY', {}, dimsScreen);
    renderRunner();
    await userEvent.click(screen.getByRole('button', { name: T.nav.next }));
    const before = document.querySelectorAll('[aria-invalid="true"]').length;
    const first = document.querySelector<HTMLInputElement>('[aria-invalid="true"]')!;
    await act(async () => {
      await userEvent.type(first, '250');
    });
    expect(first).not.toHaveAttribute('aria-invalid');
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(before - 1);
  });

  it('butoanele stau in bara lipita (ultimul copil al ecranului), un singur "Continua"', () => {
    setRoom('LAUNDRY');
    const { container } = renderRunner();
    const bar = container.querySelector('[data-sticky-action-bar]')!;
    expect(bar).not.toBeNull();
    expect(bar.parentElement!.lastElementChild).toBe(bar);
    expect(screen.getAllByRole('button', { name: T.nav.next })).toHaveLength(1);
    expect(bar).toContainElement(screen.getByRole('button', { name: T.nav.next }));
    expect(bar).toContainElement(screen.getByRole('button', { name: T.nav.back }));
  });
});
