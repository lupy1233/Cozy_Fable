import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type DimensionGroupStep, type RoomType } from '@marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { useConfiguratorStore, type ConfiguratorPhase, type RoomInstance } from '@/stores/configurator-store';
import { RequestSheet } from './review-rail';
import { screenIndexForStep } from './room-screens';

const PHASES: ConfiguratorPhase[] = ['start', 'cart', 'rooms', 'uploads', 'details', 'review'];
const T = ro.Configurator;

function room(roomType: RoomType, flowVersion: number, answers: AnswerMap, patch: Partial<RoomInstance> = {}): RoomInstance {
  return { localId: `${roomType}-${flowVersion}`, roomType, flowVersion, answers, completed: false, ...patch };
}

function setup(rooms: RoomInstance[], opts: { step?: string; hasOwnProject?: boolean; phase?: ConfiguratorPhase } = {}) {
  const hasOwnProject = opts.hasOwnProject ?? false;
  const stepIndex = opts.step ? screenIndexForStep(rooms[0], opts.step, hasOwnProject) : 0;
  useConfiguratorStore.setState({
    roomInstances: rooms,
    activeRoomIndex: 0,
    activeStepIndex: stepIndex,
    dimensionUnit: 'cm',
    details: { ...useConfiguratorStore.getState().details, hasOwnProject },
  });
}

function show(props: Partial<Parameters<typeof RequestSheet>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <RequestSheet phase="rooms" phaseOrder={PHASES} designHelp={false} {...props} />
    </NextIntlClientProvider>,
  );
}

const initial = useConfiguratorStore.getState();
afterEach(() => useConfiguratorStore.setState(initial, true));

describe('RequestSheet — valori de corectat (b10)', () => {
  it('marks a dimension outside the allowed range in red with "de corectat"', () => {
    const base: AnswerMap = { layout: 'LINEAR' };
    const step = getFlow('DRESSING', 4).steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
    const [first, second] = step.slots(base);
    setup([room('DRESSING', 4, { ...base, dimensions: { [first.id]: first.max + 1, [second.id]: second.min } })], { step: 'dimensions' });
    const { container } = show();
    const invalid = container.querySelectorAll('[data-sheet-invalid]');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].className).toContain('text-crimson');
    expect(invalid[0].textContent).toContain(T.sheet.toFix);
    expect(invalid[0].textContent).toMatch(/\d cm/);
  });
});

describe('RequestSheet — randuri (b10)', () => {
  it('hides unnamed "Other piece" rows (no stray commas)', () => {
    setup([room('PIECES', 1, { pieces: [{ name: '', quantity: 1, material: 'PAL', systems: [] }, { name: 'Masă', quantity: 1, material: 'PAL', systems: [] }] })], { step: 'pieces' });
    const { container } = show();
    const sheet = container.querySelector('aside') as HTMLElement;
    expect(within(sheet).getByText('Masă')).toBeVisible();
    expect(sheet.textContent).not.toMatch(/, Masă|Masă,/);
  });

  it('puts "Altul" and the client text on one row', () => {
    setup([room('DRESSING', 4, { layout: 'LINEAR', material: 'ALTUL', materialOther: 'sticlă' })], { step: 'material' });
    const { container } = show();
    expect(screen.getByText('Altul — sticlă')).toBeVisible();
    expect(container.textContent?.match(/sticlă/g)).toHaveLength(1);
  });

  it('uses the short labels for the rows and the section titles', () => {
    setup([room('KITCHEN', 4, { layout: 'STRAIGHT', hasIsland: false })], { step: 'layout' });
    const { container } = show();
    expect(container.textContent).toContain(T.flows.KITCHEN.layout.summaryLabel);
    expect(container.textContent).not.toContain(T.flows.KITCHEN.layout.title);
  });
});

describe('RequestSheet — numaratori si fisiere (b10)', () => {
  it('shows one labelled count: "N din M răspunsuri obligatorii"', () => {
    setup([room('KITCHEN', 4, { layout: 'STRAIGHT' })]);
    const { container } = show();
    expect(container.querySelector('[data-sheet-progress]')?.textContent).toMatch(/^\d+ din \d+ răspunsuri obligatorii$/);
    expect(container.textContent).not.toMatch(/\d+ \/ \d+/);
  });

  it('a folded room says "câteva întrebări" instead of a section count', () => {
    setup([room('KITCHEN', 4, {}), room('DRESSING', 4, {}, { localId: 'second' })]);
    show();
    expect(screen.getByText(T.sheet.someQuestions)).toBeVisible();
  });

  it('counts the uploaded files', () => {
    setup([room('KITCHEN', 4, {})]);
    const { container } = show({ filesCount: 3 });
    expect(container.querySelector('[data-sheet-files]')?.textContent).toBe('3 fișiere atașate');
  });

  it('with no files: "opțional", or "obligatoriu" with an own project', () => {
    setup([room('KITCHEN', 4, {})]);
    const a = show({ filesCount: 0 });
    expect(a.container.querySelector('[data-sheet-files]')?.textContent).toBe(T.sheet.optional);
    a.unmount();
    setup([room('KITCHEN', 4, {})], { hasOwnProject: true });
    const b = show({ filesCount: 0 });
    expect(b.container.querySelector('[data-sheet-files]')?.textContent).toBe(T.sheet.required);
  });
});

describe('RequestSheet — pliata pe telefon (j1)', () => {
  const realMatchMedia = window.matchMedia;
  const mockMedia = (matches: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  };
  beforeEach(() => setup([room('KITCHEN', 4, { layout: 'STRAIGHT' })]));
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('is closed by default on small screens, with the title and the count in the summary', () => {
    mockMedia(false);
    const { container } = show({ collapsible: true });
    const details = container.querySelector('[data-sheet-collapsible]') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const summary = details.querySelector('summary') as HTMLElement;
    expect(summary.textContent).toContain(T.sheet.title);
    expect(summary.textContent).toMatch(/răspunsuri obligatorii/);
    expect(summary.className).toContain('lg:hidden');
  });

  it('is always open from lg', () => {
    mockMedia(true);
    const { container } = show({ collapsible: true });
    expect((container.querySelector('[data-sheet-collapsible]') as HTMLDetailsElement).open).toBe(true);
  });

  it('without the prop, stays as before (no details)', () => {
    const { container } = show();
    expect(container.querySelector('[data-sheet-collapsible]')).toBeNull();
  });
});
