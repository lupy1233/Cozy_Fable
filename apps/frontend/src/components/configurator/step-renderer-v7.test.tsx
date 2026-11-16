import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type AnswerValue, type DimensionGroupStep, type DimensionSlot, type QuestionStep, type RoomType } from '@marketplace/shared';
import { useState } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { screenTotalKnown } from './dimension-check';
import { roomIssue, roomScreens, validateStepIssue, type StepIssue } from './room-screens';
import { buildSummaryRows, type Translate } from './summary-rows';
import { createTranslator } from 'next-intl';
import { sortSlotsByLetter, StepRenderer } from './step-renderer';
import {
  registerToyFlow,
  TOY_HEIGHT_LABEL,
  TOY_ROOM,
  TOY_VERSION,
  TOY_WIDTH_LABEL,
  toyDimensions,
  toyFlow,
  unregisterToyFlow,
} from '@/test/flows-v7';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// Etapa 10 (formularul v7), pe un flux de test construit cu API-ul fundatiei (§4.1, §4.4):
// slotul optional cu valoare tipica, ordinea campurilor dupa litere, planse, ecranele de detalii.

const T = ro.Configurator;
const textOf = (key: string, messages: typeof ro = ro) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages.Configurator) as string;
const heightLabel = textOf(TOY_HEIGHT_LABEL);
const widthLabel = textOf(TOY_WIDTH_LABEL);

function renderStep(
  step: QuestionStep,
  opts: { answers?: AnswerMap; roomType?: RoomType; error?: StepIssue; locale?: 'ro' | 'en' } = {},
) {
  const onAnswers = vi.fn();
  function Harness() {
    const [answers, setAnswers] = useState<AnswerMap>(opts.answers ?? {});
    return (
      <StepRenderer
        step={step}
        answers={answers}
        roomType={opts.roomType ?? TOY_ROOM}
        error={opts.error}
        onChange={(value: AnswerValue) => {
          const next = { ...answers, [step.id]: value };
          setAnswers(next);
          onAnswers(next);
        }}
        onInfo={() => {}}
      />
    );
  }
  const locale = opts.locale ?? 'ro';
  const result = render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Harness />
    </NextIntlClientProvider>,
  );
  const last = () => ((onAnswers.mock.calls.at(-1)?.[0] as AnswerMap | undefined) ?? opts.answers ?? {});
  return { ...result, onAnswers, last };
}

const dimsStep = (slots: DimensionSlot[]): DimensionGroupStep => ({
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: 'flows.KITCHEN.dimensions.title',
  slots: () => slots,
});
const slot = (id: string, extra: Partial<DimensionSlot> = {}): DimensionSlot => ({
  id, labelKey: `flows.KITCHEN.dimensions.slots.${id}`, unit: 'm', min: 0.6, max: 6, ...extra,
});

describe('etapa 10 — slotul de dimensiune optional (§4.2)', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));

  it('eticheta are "(opțional)" si indiciul "de obicei 240 cm"; slotul obligatoriu nu', () => {
    renderStep(toyDimensions);
    const height = screen.getByLabelText(heightLabel, { exact: false });
    const hint = document.getElementById(height.getAttribute('aria-describedby')!)!;
    expect(hint.textContent).toBe('de obicei 240 cm · 180–320 cm');
    expect(document.querySelectorAll('[data-optional-tag]')).toHaveLength(1);
    expect(document.querySelector('[data-optional-tag]')?.textContent).toBe(`(${T.dimensions.optionalTag})`);
    const width = screen.getByLabelText(widthLabel, { exact: false });
    expect(document.getElementById(width.getAttribute('aria-describedby')!)!.textContent).toBe('60–600 cm');
  });

  it('indiciul urmeaza unitatea aleasa: 2,4 m in romana, 2.4 m in engleza', () => {
    useConfiguratorStore.setState({ dimensionUnit: 'm' });
    renderStep(toyDimensions);
    expect(document.querySelector('[data-typical-hint]')?.textContent).toMatch(/^de obicei 2,4 m · /);
    document.body.innerHTML = '';
    renderStep(toyDimensions, { locale: 'en' });
    expect(document.querySelector('[data-typical-hint]')?.textContent).toMatch(/^usually 2.4 m · /);
  });

  it('slot optional gol → ecran valid, fara mesaj, campul nu e rosu', () => {
    const answers: AnswerMap = { dimensions: { wardrobeWidth: 2 } };
    expect(validateStepIssue(toyDimensions, answers)).toBeUndefined();
    renderStep(toyDimensions, { answers, error: validateStepIssue(toyDimensions, answers) });
    expect(screen.getByLabelText(heightLabel, { exact: false })).not.toHaveAttribute('aria-invalid');
    expect(document.querySelector('[data-step-error]')).toBeNull();
    expect(screen.queryByText(/Completează/)).toBeNull();
  });

  it('obligatoriul gol tot cere "Completeaza"; optionalul gol nu e numarat', () => {
    const answers: AnswerMap = { dimensions: {} };
    const issue = validateStepIssue(toyDimensions, answers)!;
    expect(issue).toMatchObject({ key: 'validation.dimensionsMissing', values: { count: 1 } });
    expect(Object.keys(issue.fields!)).toEqual(['wardrobeWidth']);
    renderStep(toyDimensions, { answers, error: issue });
    expect(screen.getByLabelText(widthLabel, { exact: false })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(heightLabel, { exact: false })).not.toHaveAttribute('aria-invalid');
  });

  it('slot optional cu valoare in afara intervalului → mesajul de interval', () => {
    const answers: AnswerMap = { dimensions: { wardrobeWidth: 2, wardrobeHeight: 3.5 } };
    const issue = validateStepIssue(toyDimensions, answers)!;
    expect(issue.key).toBe('validation.dimensionOutOfRange');
    expect(issue.fields).toEqual({ wardrobeHeight: { key: 'validation.dimensionRange' } });
    renderStep(toyDimensions, { answers, error: issue });
    expect(screen.getByText('Valoarea trebuie să fie între 180–320 cm.')).toBeInTheDocument();
    expect(screen.getByLabelText(heightLabel, { exact: false })).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('etapa 10 — ordinea campurilor dupa litere (§8)', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));

  it('sortSlotsByLetter: A, B, C…, H1, H2…, H la final, apoi cele fara litera in ordinea fluxului', () => {
    const slots = ['x', 'h', 'b', 'h2', 'y', 'a', 'h1', 'c'].map((id) => ({ id }));
    const letters = { h: 'H', b: 'B', h2: 'H2', a: 'A', h1: 'H1', c: 'C' };
    expect(sortSlotsByLetter(slots, letters).map((s) => s.id)).toEqual(['a', 'b', 'c', 'h1', 'h2', 'h', 'x', 'y']);
  });

  it('bucataria: campurile urmeaza literele de pe plansa, nu ordinea din flux; raspunsul ramane obiect', () => {
    const step = dimsStep([slot('ceilingHeight', { min: 2, max: 4, labelKey: 'common.slots.ceilingHeight' }), slot('runB'), slot('runA')]);
    renderStep(step, { roomType: 'KITCHEN', answers: { layout: 'L_SHAPE' } });
    const labels = screen.getAllByRole('textbox').map((input) => document.querySelector(`label[for="${input.id}"]`)?.textContent);
    expect(labels).toEqual([`A${T.flows.KITCHEN.dimensions.slots.runA}`, `B${T.flows.KITCHEN.dimensions.slots.runB}`, `H${T.common.slots.ceilingHeight}`]);
  });

  it('dormitorul nou: latimea dulapului (A) inaintea inaltimii lui (H1), care isi pastreaza litera si fara valoare', () => {
    renderStep(toyDimensions, { answers: { piecesNeeded: ['WARDROBE'] } });
    const labels = screen.getAllByRole('textbox').map((input) => document.querySelector(`label[for="${input.id}"]`)?.textContent);
    expect(labels).toEqual([`A${widthLabel}`, `H1${heightLabel}(${T.dimensions.optionalTag})`]);
    expect(document.querySelector('[data-dimension-letter="H1"]')).not.toBeNull();
  });
});

describe('etapa 10 — planse', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));

  it('dressing walk-in cu trei laturi: plansa walk-in cu A / B / C', () => {
    const step = dimsStep([slot('runA'), slot('runB'), slot('runC'), slot('wardrobeHeight', { min: 2, max: 3.2 })]);
    renderStep(step, { roomType: 'DRESSING', answers: { layout: 'WALK_IN' } });
    const fig = document.querySelector('[data-dimension-figure="walk-in"]')!;
    expect(fig).not.toBeNull();
    expect([...fig.querySelectorAll('[data-dimension-letter]')].map((n) => n.getAttribute('data-dimension-letter'))).toEqual(['A', 'B', 'C', 'H']);
  });

  it('dressing walk-in pe versiunile vechi (doua laturi) ramane cu plansa de azi', () => {
    const step = getFlow('DRESSING', 4).steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
    renderStep(step, { roomType: 'DRESSING', answers: { layout: 'WALK_IN' } });
    expect(document.querySelector('[data-dimension-figure="walk-in"]')).toBeNull();
    expect(document.querySelector('[data-dimension-letter="C"]')).toBeNull();
    expect(document.querySelector('[data-dimension-letter="B"]')).not.toBeNull();
  });

  it('dormitor (si pe versiunea de azi): patul ca silueta fara litera si noptierele pereche', () => {
    const step = getFlow('BEDROOM', 3).steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
    renderStep(step, { roomType: 'BEDROOM', answers: { piecesNeeded: ['WARDROBE', 'BED_FRAME', 'NIGHTSTANDS'] } });
    expect(document.querySelectorAll('[data-figure-extra="bed"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-figure-extra="nightstand"]')).toHaveLength(1);
    // doar sloturile au litere: dulap A, noptiera B (+ tavanul H)
    const letters = [...document.querySelectorAll('[data-dimension-letter]')].map((n) => n.getAttribute('data-dimension-letter'));
    expect(letters.filter((l) => l !== 'H')).toEqual(['A', 'B']);
  });

  it('dormitor fara pat: fara silueta de pat', () => {
    const step = getFlow('BEDROOM', 3).steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
    renderStep(step, { roomType: 'BEDROOM', answers: { piecesNeeded: ['WARDROBE'] } });
    expect(document.querySelector('[data-figure-extra]')).toBeNull();
  });
});

describe('etapa 10 — ecranele cu detailSteps (§4.4) in numaratoare', () => {
  beforeAll(registerToyFlow);
  afterAll(unregisterToyFlow);
  const room = (answers: AnswerMap): RoomInstance => ({ localId: 'r1', roomType: TOY_ROOM, flowVersion: TOY_VERSION, answers, completed: false });

  it('piece:<VALUE>:details e un ecran propriu, numarat in "Ecranul N din M"', () => {
    const screens = roomScreens(room({}), false);
    expect(screens.map((s) => s.map((step) => step.id))).toEqual([
      ['start'],
      ['materialWardrobe', 'openingWardrobe'],
      ['wardrobeInterior'],
      ['dimensions'],
    ]);
    expect(screenTotalKnown(screens, toyFlow.steps, {})).toBe(true);
    // textul contorului (room-flow-runner): "Ecranul 3 din 4"
    expect(T.nav.screenOf.replace('{current}', '3').replace('{total}', String(screens.length))).toBe('Ecranul 3 din 4');
  });

  it('proiectul propriu sare dimensiunile, ecranul de detalii ramane', () => {
    expect(roomScreens(room({}), true).map((s) => s[0]!.id)).toEqual(['start', 'materialWardrobe', 'wardrobeInterior']);
  });
});

describe('etapa 10 — revizuire M1: text nevalid intr-un camp de dimensiune', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));
  beforeAll(registerToyFlow);
  afterAll(unregisterToyFlow);
  const tRo = createTranslator({ locale: 'ro', messages: ro, namespace: 'Configurator' } as never) as unknown as Translate;
  const type = (label: string, text: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value: text } });
  const dims = (a: AnswerMap) => a.dimensions as Record<string, number | null>;

  it.each(['abc', '12,,5'])('optional + "%s" → null in raspuns, pasul nu trece, Sumarul nu spune "Nu ai dat-o"', (text) => {
    const { last } = renderStep(toyDimensions, { answers: { dimensions: { wardrobeWidth: 2 } } });
    type(heightLabel, text);
    const answers = last();
    expect(dims(answers)).toEqual({ wardrobeWidth: 2, wardrobeHeight: null });
    expect(screen.getByText(T.validation.notANumber)).toBeInTheDocument();
    // "Continua": pasul se opreste, campul e marcat gresit (nu "necompletat")
    const issue = validateStepIssue(toyDimensions, answers)!;
    expect(issue).toMatchObject({ key: 'validation.answerInvalid', fields: { wardrobeHeight: { key: 'validation.notANumber' } } });
    // publicarea (aceeasi validare ca serverul) nu trece
    const other = { start: 'A', materialWardrobe: 'A', openingWardrobe: 'A' };
    const r: RoomInstance = { localId: 'r1', roomType: TOY_ROOM, flowVersion: TOY_VERSION, answers: { ...other, ...answers }, completed: false };
    // martor: acelasi raspuns cu inaltimea lasata goala se publica
    expect(roomIssue({ ...r, answers: { ...other, dimensions: { wardrobeWidth: 2 } } }, { ownProject: false })).toBeNull();
    expect(roomIssue(r, { ownProject: false })).toMatchObject({ stepId: 'dimensions', messageKey: 'validation.dimensionOutOfRange' });
    const rows = buildSummaryRows({ roomType: TOY_ROOM, answers, flowVersion: TOY_VERSION }, tRo, { unit: 'cm', locale: 'ro' });
    expect(rows.map((row) => row.value)).not.toContain(T.dimensions.notGiven);
  });

  it('dupa "Continua" campul optional cu text nevalid e rosu, cu "Scrie un numar"; focusul il poate gasi (aria-invalid)', () => {
    const answers: AnswerMap = { dimensions: { wardrobeHeight: null } as never };
    const issue = validateStepIssue(toyDimensions, answers)!;
    // obligatoriul gol e numarat ca necompletat; optionalul gresit nu intra in numar
    expect(issue).toMatchObject({ key: 'validation.dimensionsMissing', values: { count: 1 } });
    renderStep(toyDimensions, { answers, error: issue });
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.map((i) => i.getAttribute('aria-invalid'))).toEqual(['true', 'true']);
    // primul camp gresit in DOM = latimea (A), apoi inaltimea (H1)
    expect(document.querySelector('[aria-invalid="true"]')).toBe(screen.getByLabelText(widthLabel, { exact: false }));
    expect(screen.getByText(T.validation.notANumber)).toBeInTheDocument();
  });

  it('optional: valoare valida → numar; stearsa dupa ce fusese salvata → cheia dispare (gol = "Nu ai dat-o")', () => {
    const { last } = renderStep(toyDimensions, { answers: { dimensions: { wardrobeWidth: 2 } } });
    type(heightLabel, '250');
    expect(dims(last())).toEqual({ wardrobeWidth: 2, wardrobeHeight: 2.5 });
    type(heightLabel, '');
    expect(dims(last())).toEqual({ wardrobeWidth: 2 });
    expect(validateStepIssue(toyDimensions, last())).toBeUndefined();
    // text nevalid, apoi sters → tot gol, nu null
    type(heightLabel, 'abc');
    type(heightLabel, '');
    expect(dims(last())).toEqual({ wardrobeWidth: 2 });
  });

  it.each(['abc', '12,,5', ''])('obligatoriu + "%s" → cheia se sterge, ca in etapa 8 ("Completeaza")', (text) => {
    const { last } = renderStep(toyDimensions, { answers: { dimensions: { wardrobeWidth: 2 } } });
    type(widthLabel, text);
    expect(dims(last())).toEqual({});
    expect(validateStepIssue(toyDimensions, last())).toMatchObject({ key: 'validation.dimensionsMissing', values: { count: 1 }, fields: { wardrobeWidth: { key: 'validation.fillField' } } });
  });

  it('obligatoriu: valoare valida → numar', () => {
    const { last } = renderStep(toyDimensions);
    type(widthLabel, '245,5');
    expect(dims(last())).toEqual({ wardrobeWidth: 2.455 });
  });
});
