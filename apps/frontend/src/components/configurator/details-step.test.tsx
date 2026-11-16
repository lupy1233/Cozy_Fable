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
// b12: "pick-suggestion" = alegerea unei sugestii Google (strada + oras + judet, plus blocul tastat)
vi.mock('./address-autocomplete', () => ({
  AddressAutocomplete: ({ defaultValue, error, onText, onResolved }: {
    defaultValue: string;
    error?: string;
    onText: (t: string) => void;
    onResolved: (p: { addressText: string; county: string; city: string; addressDetails?: string }) => void;
  }) => (
    <>
      <input aria-label="address" defaultValue={defaultValue} onChange={(e) => onText(e.target.value)} />
      <button type="button" onClick={() => onResolved({ addressText: 'Strada Fabricii 5', county: 'București', city: 'București', addressDetails: 'bl. A2, ap. 14' })}>
        pick-suggestion
      </button>
      {error && <p>{error}</p>}
    </>
  ),
}));

const store = () => useConfiguratorStore.getState();
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

function mount(onBack = vi.fn(), onContinue = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DetailsStep onBack={onBack} onContinue={onContinue} />
    </NextIntlClientProvider>,
  );
  return { ...view, onBack, onContinue };
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

  // b11: estimarea nu mai pune bugetul din oficiu
  it('the account e-mail is saved too, without a loop; the estimate does not fill in a budget', async () => {
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' } };
    hoisted.estimate = { data: { minRon: 12000, maxRon: 20000 } };
    const writes = vi.fn();
    const unsubscribe = useConfiguratorStore.subscribe((s, prev) => { if (s.details !== prev.details) writes(); });
    mount();
    await wait(DETAILS_AUTOSAVE_MS * 3);
    unsubscribe();
    expect(store().details.contactPreferences?.[0]).toEqual({ channel: 'EMAIL', value: 'ana@demo.ro' });
    expect(store().details.budgetEstimateRon).toBeUndefined();
    expect(store().details.budgetRange).toBeUndefined();
    expect(store().details.budgetChosen).toBe(false);
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

// b11 (PO 2026-11-13): clientul alege o suma sau "Prefer sa nu spun"; nimic din oficiu
describe('DetailsStep — the budget is chosen by the client (b11)', () => {
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

  const slider = () => screen.getByRole('slider', { name: en.Requests.field.budgetRange });
  const undisclosed = () => screen.getByRole('checkbox', { name: en.Requests.budget.UNDISCLOSED });
  const toReview = () => screen.getByRole('button', { name: en.Configurator.nav.toReview });
  function fillRest() {
    fireEvent.change(screen.getByLabelText('address'), { target: { value: 'Str. Lunga 1' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.county }), { target: { value: 'Cluj' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.city }), { target: { value: 'Cluj-Napoca' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.contactValue }), { target: { value: 'ana@demo.ro' } });
  }
  const submit = async () => {
    await act(async () => {
      fireEvent.click(toReview());
    });
  };

  it('without a choice "Continue to summary" stays on the step and asks for one', async () => {
    hoisted.estimate = { data: { minRon: 24000, maxRon: 72000 } };
    const { onContinue } = mount();
    fillRest();
    // nicio suma pusa din oficiu
    expect(screen.getByTestId('budget-value')).toHaveTextContent(en.Requests.budgetChoose);
    expect(slider()).toHaveAttribute('data-unset', 'true');
    await submit();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(en.Requests.validation.budgetRequired);
    expect(store().details.budgetEstimateRon).toBeUndefined();
  });

  it('an amount chosen on the slider lets the client continue; the band is derived only internally', async () => {
    hoisted.estimate = { data: { minRon: 24000, maxRon: 72000 } };
    const { onContinue } = mount();
    fillRest();
    fireEvent.change(slider(), { target: { value: '30000' } });
    expect(screen.getByTestId('budget-value')).toHaveTextContent('30,000 lei');
    await submit();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(store().details).toMatchObject({ budgetEstimateRon: 30000, budgetRange: 'OVER_15K', budgetChosen: true });
  });

  it('the slider goes down to a third of the estimate, with a note below the estimate', () => {
    hoisted.estimate = { data: { minRon: 24000, maxRon: 72000 } };
    mount();
    expect(slider()).toHaveAttribute('min', '8000');
    expect(slider()).toHaveAttribute('max', '72000');
    fireEvent.change(slider(), { target: { value: '9000' } });
    expect(screen.getByRole('status')).toHaveTextContent(en.Requests.budgetBelowEstimateNote);
    fireEvent.change(slider(), { target: { value: '24000' } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('"I prefer not to share" is a valid choice; unticking it goes back to no choice', async () => {
    const { onContinue } = mount();
    fillRest();
    fireEvent.click(undisclosed());
    await submit();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(store().details).toMatchObject({ budgetRange: 'UNDISCLOSED', budgetChosen: true });
    fireEvent.click(undisclosed());
    expect(screen.getByTestId('budget-value')).toHaveTextContent(en.Requests.budgetChoose);
    await submit();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('"I need help" (no estimate): no default band, a fixed scale, the same rule', async () => {
    act(() => store().setStartMode('DESIGN_HELP'));
    const { onContinue } = mount();
    fillRest();
    expect(slider()).toHaveAttribute('min', '1000');
    expect(slider()).toHaveAttribute('max', '100000');
    expect(screen.getByText(en.Requests.budgetNoEstimateHint)).toBeInTheDocument();
    await wait(DETAILS_AUTOSAVE_MS + 100);
    expect(store().details.budgetRange).toBeUndefined();
    await submit();
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.change(slider(), { target: { value: '4000' } });
    await submit();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(store().details).toMatchObject({ budgetEstimateRon: 4000, budgetRange: 'UNDER_5K' });
  });

  it('an old draft with the budget filled in by the form asks for the choice again', async () => {
    act(() => store().loadSnapshot({ ...store().snapshot(), phase: 'details', details: { budgetRange: 'OVER_15K', budgetEstimateRon: 24000 } }));
    hoisted.estimate = { data: { minRon: 24000, maxRon: 72000 } };
    const { onContinue } = mount();
    fillRest();
    expect(screen.getByTestId('budget-value')).toHaveTextContent(en.Requests.budgetChoose);
    await submit();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('the chosen amount survives "Back" and coming back', () => {
    hoisted.estimate = { data: { minRon: 24000, maxRon: 72000 } };
    const { unmount } = mount();
    fireEvent.change(slider(), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.back }));
    unmount();
    mount();
    expect(screen.getByTestId('budget-value')).toHaveTextContent('12,000 lei');
    expect(slider()).not.toHaveAttribute('data-unset');
  });
});

// b12: campul separat "Bloc, scara, apartament" si orasul gol
describe('DetailsStep — address details (b12)', () => {
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

  const details = () => screen.getByRole('textbox', { name: en.Requests.field.addressDetails });
  const pick = () => fireEvent.click(screen.getByRole('button', { name: 'pick-suggestion' }));

  it('choosing a suggestion keeps what the client wrote in the apartment field', async () => {
    mount();
    fireEvent.change(details(), { target: { value: 'sc. 3, ap. 7' } });
    pick();
    expect(details()).toHaveValue('sc. 3, ap. 7');
    await wait(DETAILS_AUTOSAVE_MS + 100);
    expect(store().details).toMatchObject({ addressText: 'Strada Fabricii 5', city: 'București', addressDetails: 'sc. 3, ap. 7' });
  });

  it('an empty apartment field gets the block / apartment typed in the address', async () => {
    mount();
    pick();
    expect(details()).toHaveValue('bl. A2, ap. 14');
  });

  it('the field survives "Back" and coming back', () => {
    const { unmount } = mount();
    fireEvent.change(details(), { target: { value: 'ap. 9' } });
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.back }));
    unmount();
    mount();
    expect(details()).toHaveValue('ap. 9');
  });

  it('a city made only of spaces asks to fill in the city', async () => {
    const { onContinue } = mount();
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.city }), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.toReview }));
    });
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText(en.Requests.validation.cityRequired)).toBeInTheDocument();
  });
});

// b9 + j1 (etapa 8): "Completeaza ..." la campuri goale, contorul mesajului, bara de jos
describe('DetailsStep — validation messages, message counter, bottom bar (etapa 8)', () => {
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

  const V = en.Requests.validation;
  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.Configurator.nav.toReview }));
    });
  };

  it('empty fields ask to be filled in, not "too short"', async () => {
    const { onContinue } = mount();
    await submit();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText(V.addressRequired)).toBeInTheDocument();
    expect(screen.getByText(V.countyRequired)).toBeInTheDocument();
    expect(screen.getByText(V.cityRequired)).toBeInTheDocument();
    expect(screen.getByText(V.contactRequired)).toBeInTheDocument();
    for (const tooShort of [V.addressTooShort, V.countyTooShort, V.cityTooShort, V.contactEmailInvalid]) {
      expect(screen.queryByText(tooShort)).not.toBeInTheDocument();
    }
  });

  it('1–2 characters still say "too short"; a wrong e-mail says it is not valid', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('address'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.county }), { target: { value: 'C' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.city }), { target: { value: 'C' } });
    fireEvent.change(screen.getByRole('textbox', { name: en.Requests.field.contactValue }), { target: { value: 'ana@' } });
    await submit();
    expect(screen.getByText(V.addressTooShort)).toBeInTheDocument();
    expect(screen.getByText(V.countyTooShort)).toBeInTheDocument();
    expect(screen.getByText(V.cityTooShort)).toBeInTheDocument();
    expect(screen.getByText(V.contactEmailInvalid)).toBeInTheDocument();
    expect(screen.queryByText(V.addressRequired)).not.toBeInTheDocument();
    expect(screen.queryByText(V.contactRequired)).not.toBeInTheDocument();
  });

  it('the message for companies has a 5,000 limit and a live counter', () => {
    mount();
    expect(message()).toHaveAttribute('maxLength', '5000');
    expect(screen.getByText('0 / 5,000 characters')).toBeInTheDocument();
    fireEvent.change(message(), { target: { value: 'Salut' } });
    expect(screen.getByText('5 / 5,000 characters')).toBeInTheDocument();
    expect(message()).toHaveAttribute('aria-describedby', 'details-message-counter');
    expect(screen.getByText(en.Requests.messageHint)).toBeInTheDocument();
  });

  it('"Back" and "Continue to summary" sit in the sticky bar, the last element of the form', () => {
    const { container } = mount();
    const bar = container.querySelector('[data-sticky-action-bar]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.parentElement?.tagName).toBe('FORM');
    expect(bar.parentElement?.lastElementChild).toBe(bar);
    expect(bar).toContainElement(screen.getByRole('button', { name: en.Configurator.nav.back }));
    expect(bar).toContainElement(screen.getByRole('button', { name: en.Configurator.nav.toReview }));
  });
});
