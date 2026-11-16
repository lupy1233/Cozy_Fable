import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_STATE_KEY, readNavEntry, resolvePosition, startConfiguratorHistory } from './configurator-history';
import { clearConfiguratorMemory, NAV_GEN_KEY_PREFIX, useConfiguratorStore } from './configurator-store';

// m1 (etapa 12): Back / Forward din browser in formular — pe istoricul real din jsdom
const store = useConfiguratorStore;
const flush = () => new Promise((r) => setTimeout(r, 0));
const popped = () =>
  new Promise<void>((resolve) => window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true }));
async function browserBack() {
  const p = popped();
  window.history.back();
  await p;
}
async function browserForward() {
  const p = popped();
  window.history.forward();
  await p;
}
async function until(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
}
const entry = () => readNavEntry(window.history.state);
const roomIds = () => store.getState().roomInstances.map((r) => r.localId);

let stop: (() => void) | null = null;

function draftOnCart() {
  store.getState().reset();
  store.getState().setStartMode('STANDARD');
  store.getState().addRoom('KITCHEN');
  store.getState().addRoom('BATHROOM');
  store.getState().setDetails({ city: 'Cluj', contactPreferences: [{ channel: 'EMAIL', value: 'ana@example.com' }] });
  store.getState().setPhase('cart');
}

// o pagina dinainte (alta adresa), apoi formularul
function arrive() {
  window.history.pushState(null, '', '/ro/dashboard');
  window.history.pushState(null, '', '/ro/requests/new');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  draftOnCart();
  arrive();
  stop = startConfiguratorHistory();
});
afterEach(() => {
  stop?.();
  stop = null;
});

describe('configurator history (m1)', () => {
  it('each screen is one history entry; browser Back / Forward move the form and keep the answers', async () => {
    const base = window.history.length;
    const [first] = roomIds();
    act(() => {
      // acelasi clic: camera + faza → o singura intrare
      store.getState().setActiveRoom(0);
      store.getState().setPhase('rooms');
    });
    await flush();
    expect(window.history.length).toBe(base + 1);
    act(() => store.getState().setStepIndex(1));
    await flush();
    expect(window.history.length).toBe(base + 2);

    await browserBack();
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeRoomIndex: 0, activeStepIndex: 0 });
    await browserBack();
    expect(store.getState().phase).toBe('cart');
    await browserForward();
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeStepIndex: 0 });
    expect(store.getState().roomInstances[0]!.localId).toBe(first);
    expect(store.getState().details.city).toBe('Cluj');
    // nicio intrare in plus din saltul inapoi / inainte
    expect(window.history.length).toBe(base + 2);
  });

  it('Back from the first screen leaves the page (no loop, the form stays where it was)', async () => {
    expect(entry()?.prev).toBeNull();
    await browserBack();
    expect(window.location.pathname).toBe('/ro/dashboard');
    expect(store.getState().phase).toBe('cart');
  });

  it('the in-page "Back" goes where the browser Back goes, without a new entry; "Continue" after it does not duplicate', async () => {
    const base = window.history.length;
    act(() => store.getState().setPhase('rooms'));
    await flush();
    expect(window.history.length).toBe(base + 1);
    // „Inapoi” din pagina: inapoi in istoric, nu o intrare noua
    const back = popped();
    act(() => store.getState().setPhase('cart'));
    await back;
    expect(window.history.length).toBe(base + 1);
    expect(entry()?.pos).toEqual({ phase: 'cart' });
    // „Continua” din nou: inainte in istoric
    const forward = popped();
    act(() => store.getState().setPhase('rooms'));
    await forward;
    expect(window.history.length).toBe(base + 1);
    expect(entry()?.pos.phase).toBe('rooms');
    // browser Back, apoi „Continua” → tot o singura intrare pe ecran
    await browserBack();
    expect(store.getState().phase).toBe('cart');
    const again = popped();
    act(() => store.getState().setPhase('rooms'));
    await again;
    expect(window.history.length).toBe(base + 1);
    // un ecran nou taie ce era inainte
    act(() => store.getState().setPhase('uploads'));
    await flush();
    expect(window.history.length).toBe(base + 2);
    await browserBack();
    expect(store.getState().phase).toBe('rooms');
  });

  it('a reload keeps the place, and Back still returns to the screen before', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    const before = window.history.length;
    // reincarcarea: aceeasi intrare, acelasi loc in ciorna (store-ul persistat)
    stop!();
    stop = startConfiguratorHistory();
    expect(window.history.length).toBe(before);
    expect(entry()?.pos).toEqual({ phase: 'uploads' });
    await browserBack();
    expect(store.getState().phase).toBe('rooms');
  });

  it('"Start a new one": Back does not lead into the discarded draft', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    act(() => store.getState().reset());
    await flush();
    expect(entry()?.prev).toBeNull();
    expect(store.getState().phase).toBe('start');
    window.history.back();
    await until(() => window.location.pathname === '/ro/dashboard');
    expect(window.location.pathname).toBe('/ro/dashboard');
    expect(store.getState().phase).toBe('start');
    expect(store.getState().roomInstances).toEqual([]);
  });

  it('a room removed meanwhile: Back opens the first room with questions and fixes the entry in place', async () => {
    const [, second] = roomIds();
    act(() => {
      store.getState().setActiveRoom(1);
      store.getState().setPhase('rooms');
    });
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    const length = window.history.length;
    act(() => store.getState().removeRoom(second!));
    await browserBack();
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeRoomIndex: 0, activeStepIndex: 0 });
    expect(entry()?.pos.room).toBe(store.getState().roomInstances[0]!.localId);
    expect(window.history.length).toBe(length);
  });

  it('keeps the address and the history free of personal data and of the draft token', async () => {
    store.getState().setToken('secret-token');
    act(() => store.getState().setPhase('details'));
    await flush();
    expect(window.location.pathname).toBe('/ro/requests/new');
    expect(window.location.search).toBe('');
    const saved = JSON.stringify(window.history.state[NAV_STATE_KEY]);
    expect(saved).not.toContain('Cluj');
    expect(saved).not.toContain('ana@example.com');
    expect(saved).not.toContain('secret-token');
  });
});

describe('configurator history — after review (m11–m14)', () => {
  it('m11: Forward stops on a screen that does not pass "Continue" and asks it to show its messages', async () => {
    let valid = true;
    const blocked = vi.fn();
    stop!();
    stop = startConfiguratorHistory({ canLeaveForward: () => valid, onForwardBlocked: blocked });
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setStepIndex(1));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    const length = window.history.length;
    await browserBack();
    await browserBack();
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeStepIndex: 0 });
    // omul goleste un raspuns obligatoriu pe ecranul 0, apoi Forward
    valid = false;
    window.history.forward();
    await until(() => blocked.mock.calls.length > 0 && entry()?.pos.step === 0);
    await flush();
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeStepIndex: 0 });
    expect(entry()?.pos).toMatchObject({ phase: 'rooms', step: 0 });
    expect(window.history.length).toBe(length);
    // dupa completare, Forward merge din nou
    valid = true;
    await browserForward();
    expect(store.getState().activeStepIndex).toBe(1);
  });

  it('m12: Forward onto a screen hidden meanwhile skips it, in the same direction', async () => {
    let screens = 3;
    stop!();
    stop = startConfiguratorHistory({ screenCount: () => screens });
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setStepIndex(1));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    await browserBack();
    await browserBack();
    expect(store.getState()).toMatchObject({ phase: 'rooms', activeStepIndex: 0 });
    // un raspuns schimbat ascunde ecranul 1: camera are acum un singur ecran
    screens = 1;
    const steps: number[] = [];
    const unsub = store.subscribe((s) => steps.push(s.activeStepIndex));
    window.history.forward();
    await until(() => store.getState().phase === 'uploads');
    unsub();
    expect(store.getState().phase).toBe('uploads');
    // ecranul 0 nu s-a aratat a doua oara ca „ecranul 1”
    expect(steps).not.toContain(1);
    // si inapoi: intrarea ascunsa se sare tot, pana la ecranul 0
    window.history.back();
    await until(() => store.getState().phase === 'rooms');
    await flush();
    expect(store.getState().activeStepIndex).toBe(0);
    expect(entry()?.pos).toMatchObject({ phase: 'rooms', step: 0 });
  });

  it('m13: if popstate does not come within 1 s, the safety net never takes a second step', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    try {
      // „Inapoi” din pagina: history.go(-1), dar popstate nu vine (pagina blocata)
      act(() => store.getState().setPhase('cart'));
      await flush();
      expect(go).toHaveBeenCalledTimes(1);
      await new Promise((r) => setTimeout(r, 1100));
      await flush();
      expect(go).toHaveBeenCalledTimes(1);
      expect(entry()?.pos).toEqual({ phase: 'cart' });
      expect(store.getState().phase).toBe('cart');
    } finally {
      go.mockRestore();
    }
  });

  it('m14: signing out removes the history generation from the tab', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    expect(Object.keys(sessionStorage).some((k) => k.startsWith(NAV_GEN_KEY_PREFIX))).toBe(true);
    stop!();
    stop = null;
    clearConfiguratorMemory();
    expect(Object.keys(sessionStorage).some((k) => k.startsWith(NAV_GEN_KEY_PREFIX))).toBe(false);
    // alt cont in aceeasi fila: intrarile vechi nu mai sunt „ale lui”
    draftOnCart();
    stop = startConfiguratorHistory();
    expect(entry()?.prev).toBeNull();
  });

  it('a Next navigation that wipes the entry state: the form rebuilds it, Back does not loop', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    window.history.replaceState({}, '');
    act(() => store.getState().setPhase('uploads'));
    await flush();
    expect(entry()).toMatchObject({ pos: { phase: 'uploads' }, prev: null });
    await browserBack();
    expect(store.getState().phase).toBe('cart');
  });

  it('"Continue" pressed again before popstate arrives: one entry per screen, ends where the person is', async () => {
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await flush();
    const length = window.history.length;
    const back = popped();
    act(() => store.getState().setPhase('rooms'));
    await flush();
    act(() => store.getState().setPhase('uploads'));
    await back;
    await until(() => entry()?.pos.phase === 'uploads');
    expect(store.getState().phase).toBe('uploads');
    expect(entry()?.pos.phase).toBe('uploads');
    expect(window.history.length).toBe(length);
  });
});

describe('resolvePosition', () => {
  const rooms = [
    { localId: 'a', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: false, needsDesignHelp: true },
    { localId: 'b', roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: false },
  ] as never;
  it('follows the same safety nets as the wizard', () => {
    expect(resolvePosition({ phase: 'review' }, { startMode: null, roomInstances: rooms })).toEqual({ phase: 'start' });
    expect(resolvePosition({ phase: 'rooms', room: 'b', step: 2 }, { startMode: 'DESIGN_HELP', roomInstances: rooms })).toEqual({ phase: 'uploads' });
    expect(resolvePosition({ phase: 'rooms', room: 'b', step: 2 }, { startMode: 'STANDARD', roomInstances: rooms })).toEqual({ phase: 'rooms', activeRoomIndex: 1, activeStepIndex: 2 });
    // camera bifata „am nevoie de ajutor” → prima camera cu intrebari
    expect(resolvePosition({ phase: 'rooms', room: 'a', step: 3 }, { startMode: 'STANDARD', roomInstances: rooms })).toEqual({ phase: 'rooms', activeRoomIndex: 1, activeStepIndex: 0 });
    expect(resolvePosition({ phase: 'rooms', room: 'x' }, { startMode: 'STANDARD', roomInstances: [] })).toEqual({ phase: 'cart' });
  });
});
