import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { enterEditSession, leaveEditSession, useConfiguratorStore } from '@/stores/configurator-store';
import { DETAILS_AUTOSAVE_MS, DetailsStep } from './details-step';

const hoisted = vi.hoisted(() => ({
  me: { data: undefined as { email: string; role: string } | undefined },
  estimate: { data: undefined as { minRon: number; maxRon: number } | undefined },
}));
vi.mock('@/hooks/use-auth', () => ({ useMe: () => hoisted.me }));
vi.mock('@/hooks/use-requests', () => ({ useBudgetEstimate: () => hoisted.estimate }));
// Places nu exista in jsdom: un camp simplu cu aceleasi callback-uri
vi.mock('./address-autocomplete', () => ({
  AddressAutocomplete: ({ defaultValue, onText }: { defaultValue: string; onText: (t: string) => void }) => (
    <input aria-label="address" defaultValue={defaultValue} onChange={(e) => onText(e.target.value)} />
  ),
}));

const store = () => useConfiguratorStore.getState();
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

function mount(onBack = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DetailsStep onBack={onBack} onContinue={() => {}} />
    </NextIntlClientProvider>,
  );
  return { ...view, onBack };
}
const message = () => screen.getByRole('textbox', { name: en.Requests.field.message });

// b2: ce scrie clientul la "Date generale" ajunge in ciorna fara "Continua la sumar"
describe('DetailsStep — autosave into the draft (b2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store().reset();
    store().setStartMode('STANDARD');
    store().addRoom('KITCHEN');
    hoisted.me = { data: undefined };
    hoisted.estimate = { data: undefined };
  });
  afterEach(() => leaveEditSession());

  it('the message survives "Back" and coming back to the step', () => {
    const { onBack, unmount } = mount();
    fireEvent.change(message(), { target: { value: 'Vreau corpuri pana la tavan' } });
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(store().details.description).toBe('Vreau corpuri pana la tavan');
    unmount();
    mount();
    expect(message()).toHaveValue('Vreau corpuri pana la tavan');
  });

  it('saves on its own after a short pause, and the copy in the browser survives a reload', async () => {
    mount();
    fireEvent.change(message(), { target: { value: 'Text' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.city }), { target: { value: 'Cluj' } });
    fireEvent.change(screen.getByLabelText('address'), { target: { value: 'Str. Lunga 1' } });
    fireEvent.click(screen.getByRole('button', { name: en.Requests.deadline.ASAP }));
    expect(store().details.description).toBeUndefined();
    await wait(DETAILS_AUTOSAVE_MS + 100);
    const persisted = JSON.parse(localStorage.getItem('mm_configurator_v1')!).state.details;
    expect(persisted).toMatchObject({ description: 'Text', city: 'Cluj', addressText: 'Str. Lunga 1', deadlineBucket: 'ASAP' });
  });

  it('typing several times in a row writes the draft once', async () => {
    const writes = vi.fn();
    const unsubscribe = useConfiguratorStore.subscribe((s, prev) => { if (s.details !== prev.details) writes(); });
    mount();
    for (const value of ['a', 'ab', 'abc', 'abcd']) fireEvent.change(message(), { target: { value } });
    await wait(DETAILS_AUTOSAVE_MS + 100);
    unsubscribe();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(store().details.description).toBe('abcd');
  });

  it('the account e-mail and the budget from the estimate are saved too, without a loop', async () => {
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' } };
    hoisted.estimate = { data: { minRon: 12000, maxRon: 20000 } };
    const writes = vi.fn();
    const unsubscribe = useConfiguratorStore.subscribe((s, prev) => { if (s.details !== prev.details) writes(); });
    mount();
    await wait(DETAILS_AUTOSAVE_MS * 3);
    unsubscribe();
    expect(store().details.contactPreferences?.[0]).toEqual({ channel: 'EMAIL', value: 'ana@demo.ro' });
    expect(store().details.budgetEstimateRon).toBe(12000);
    expect(writes).toHaveBeenCalledTimes(1);
    // derivatele nu se scriu din formular (b8)
    expect('includesPaidDesign' in store().details).toBe(false);
  });

  it('while editing a published request it writes into the edit memory, not the new draft', () => {
    const before = localStorage.getItem('mm_configurator_v1');
    enterEditSession('req-1');
    store().loadSnapshot({ ...store().snapshot(), startMode: 'STANDARD', phase: 'details' });
    const { unmount } = mount();
    fireEvent.change(message(), { target: { value: 'Editare' } });
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.back }));
    expect(JSON.parse(sessionStorage.getItem('mm_configurator_edit_v1:req-1')!).state.details.description).toBe('Editare');
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    // ce era inca netrimis cand editarea s-a inchis nu ajunge in ciorna cererii noi
    fireEvent.change(message(), { target: { value: 'Netrimis' } });
    leaveEditSession();
    unmount();
    expect(store().details.description).toBeUndefined();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
  });
});

// M2: o salvare amanata nu scrie peste o ciorna golita intre timp
describe('DetailsStep — a pending save after the draft was cleared (M2)', () => {
  beforeEach(() => {
    localStorage.clear();
    store().reset();
    store().setStartMode('STANDARD');
    store().addRoom('KITCHEN');
    hoisted.me = { data: undefined };
    hoisted.estimate = { data: undefined };
  });

  it('logout or "Start a new one" under 400 ms after the last key: the old details do not reach the new draft', async () => {
    const { unmount } = mount();
    fireEvent.change(message(), { target: { value: 'Adresa clientului A' } });
    // golirea (deconectare / "Incepe una noua") vine inainte de salvarea amanata
    act(() => store().reset());
    await wait(DETAILS_AUTOSAVE_MS + 100);
    unmount();
    expect(store().details.description).toBeUndefined();
    const persisted = localStorage.getItem('mm_configurator_v1');
    expect(persisted === null || !persisted.includes('Adresa clientului A')).toBe(true);
  });
});
