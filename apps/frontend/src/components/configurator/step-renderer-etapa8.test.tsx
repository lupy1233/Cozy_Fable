import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type AnswerValue, type PiecesStep, type QuestionStep, type RoomType } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { DIMENSION_UNIT_STORAGE_KEY } from '@/lib/dimension-unit';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { StepRenderer } from './step-renderer';
import { validateStepIssue, type StepIssue } from './room-screens';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

const T = ro.Configurator;
const laundryDims = getFlow('LAUNDRY', 1).steps.find((s) => s.id === 'dimensions') as QuestionStep;
const slotLabel = T.flows.LAUNDRY.dimensions.slots.runA;
const slotKey = (id: string) =>
  (laundryDims.type === 'dimension-group' ? laundryDims.slots({}) : []).find((s) => s.id === id)!.labelKey;
const textOf = (key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], T) as string;

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
        roomType={opts.roomType ?? 'LAUNDRY'}
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
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Harness />
    </NextIntlClientProvider>,
  );
  return { onAnswers, last: () => (onAnswers.mock.calls.at(-1)?.[0] as AnswerMap)[step.id] };
}

describe('etapa 8 — dimensiuni: mesaj per camp (39) si formatatorul unic (41)', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'cm' }));

  it('dupa "Continua", campul gol are "Completeaza {camp}" si contur rosu; rezumatul numara golurile', () => {
    const answers = { dimensions: { ceilingHeight: 2.6 } };
    renderStep(laundryDims, { answers, error: validateStepIssue(laundryDims, answers) });
    const input = screen.getByLabelText(slotLabel, { exact: false });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const msg = screen.getByText(`Completează ${slotLabel}.`);
    expect(input.getAttribute('aria-describedby')).toBe(msg.id);
    expect(screen.getByText('Un câmp necompletat.')).toBeInTheDocument();
    // campul completat ramane neatins
    const ceiling = screen.getByLabelText(textOf(slotKey('ceilingHeight')), { exact: false });
    expect(ceiling).not.toHaveAttribute('aria-invalid');
  });

  it('valoarea in afara intervalului arata intervalul formatat (virgula, cm), nu "completeaza"', () => {
    renderStep(laundryDims, { answers: { dimensions: { runA: 0.455, ceilingHeight: 2.6 } } });
    expect(screen.getByText('Valoarea trebuie să fie între 80–600 cm.')).toBeInTheDocument();
    expect(screen.queryByText(`Completează ${slotLabel}.`)).toBeNull();
    // legenda schitei, cu formatatorul unic
    expect(screen.getByText(/A = 45,5 cm/)).toBeInTheDocument();
  });

  it('in engleza intervalul si legenda au punct', () => {
    renderStep(laundryDims, { answers: { dimensions: { runA: 0.455, ceilingHeight: 2.6 } }, locale: 'en' });
    expect(screen.getByText(/A = 45.5 cm/)).toBeInTheDocument();
  });

  it('pe schita, cota in afara intervalului e marcata rosu; cea corecta nu', () => {
    renderStep(laundryDims, { answers: { dimensions: { runA: 9, ceilingHeight: 2.6 } } });
    expect(document.querySelector('[data-dimension-letter="A"]')).toHaveAttribute('data-invalid', 'true');
    expect(document.querySelector('[data-dimension-letter="H"]')).not.toHaveAttribute('data-invalid');
  });

  it('pe schita, cota goala e rosie doar dupa "Continua"', () => {
    const answers = { dimensions: { ceilingHeight: 2.6 } };
    renderStep(laundryDims, { answers });
    expect(document.querySelector('[data-dimension-letter="A"]')).not.toHaveAttribute('data-invalid');
    document.body.innerHTML = '';
    renderStep(laundryDims, { answers, error: validateStepIssue(laundryDims, answers) });
    expect(document.querySelector('[data-dimension-letter="A"]')).toHaveAttribute('data-invalid', 'true');
  });

  it('pe telefon (sub sm) cotele de pe schita au textul mai mare, prin atribute SVG', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes('max-width') })) as typeof window.matchMedia;
    try {
      renderStep(laundryDims, { answers: { dimensions: { runA: 2.4, ceilingHeight: 2.6 } } });
      const letter = document.querySelector('[data-dimension-letter="A"] text')!;
      expect(letter).toHaveAttribute('font-size', '17');
      expect(letter.getAttribute('class')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it('comutatorul de unitate tine minte alegerea si dupa publicare (D1)', async () => {
    window.localStorage.removeItem(DIMENSION_UNIT_STORAGE_KEY);
    renderStep(laundryDims);
    await userEvent.click(screen.getByRole('button', { name: 'm' }));
    expect(useConfiguratorStore.getState().dimensionUnit).toBe('m');
    expect(window.localStorage.getItem(DIMENSION_UNIT_STORAGE_KEY)).toBe('m');
  });
});

describe('etapa 8 — "Alta piesa": plafoane (39.4)', () => {
  const v1Step = getFlow('PIECES', 1).steps.find((s) => s.id === 'pieces') as PiecesStep;
  const v2Step: PiecesStep = { ...v1Step, rowVersion: 2 };
  const row = { name: 'Raft', material: 'PAL' as const, systems: ['MANER' as const], quantity: 1, description: '' };

  it.each([
    ['v1', v1Step],
    ['v2', v2Step],
  ])('%s: la %i piese butonul "Adauga piesa" e dezactivat, cu numarul permis', (_v, step) => {
    const full = Array.from({ length: step.maxPieces }, () => ({ ...row }));
    renderStep(step, { answers: { pieces: full as unknown as AnswerValue }, roomType: 'PIECES' });
    const add = screen.getByRole('button', { name: new RegExp(T.pieces.add) });
    expect(add).toBeDisabled();
    expect(screen.getByText(`Cel mult ${step.maxPieces} piese.`)).toBeInTheDocument();
  });

  it('sub plafon butonul merge', () => {
    renderStep(v2Step, { answers: { pieces: [row] as unknown as AnswerValue }, roomType: 'PIECES' });
    expect(screen.getByRole('button', { name: new RegExp(T.pieces.add) })).toBeEnabled();
    expect(screen.queryByText(/Cel mult \d+ piese/)).toBeNull();
  });

  it.each([
    ['v1', v1Step],
    ['v2', v2Step],
  ])('%s: cantitatea are max 999 si mesaj langa camp peste plafon', (_v, step) => {
    const { last } = renderStep(step, { answers: { pieces: [row] as unknown as AnswerValue }, roomType: 'PIECES' });
    const qty = screen.getByLabelText(T.pieces.quantity);
    expect(qty).toHaveAttribute('max', '999');
    fireEvent.change(qty, { target: { value: '1500' } });
    expect((last() as { quantity: number }[])[0]!.quantity).toBe(1500);
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Cel mult 999 bucăți.')).toBeInTheDocument();
    // "Continua" e oprit: aceeasi validare ca pe server
    expect(validateStepIssue(step, { pieces: last() })).toBeDefined();
  });

  it('v1: denumirea de 1 caracter da mesajul randului sus pe pas', () => {
    const answers = { pieces: [{ ...row, name: 'E' }] as unknown as AnswerValue };
    renderStep(v1Step, { answers, roomType: 'PIECES', error: validateStepIssue(v1Step, answers) });
    expect(screen.getByText('Piesa 1: denumirea e prea scurtă (cel puțin 2 caractere).')).toBeInTheDocument();
  });
});

describe('etapa 8 — cartonasele pe telefon (40.3)', () => {
  it('grila cartonaselor are doua coloane si sub sm; perechea Da / Nu la fel', () => {
    const material = getFlow('LAUNDRY', 1).steps.find((s) => s.type === 'single-choice') as QuestionStep;
    renderStep(material);
    const grid = document.querySelector('[data-choice-card]')!.parentElement!;
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).not.toContain('sm:grid-cols-2');
    expect(document.querySelector('[data-choice-card]')!.className).toMatch(/h-60 .*sm:h-72|sm:h-72/);
  });

  it('un string ca eroare (apelanti vechi) se afiseaza la fel', () => {
    const material = getFlow('LAUNDRY', 1).steps.find((s) => s.type === 'single-choice') as QuestionStep;
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <StepRenderer step={material} answers={{}} roomType="LAUNDRY" error="validation.chooseOne" onChange={() => {}} onInfo={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(T.validation.chooseOne)).toBeInTheDocument();
  });
});
