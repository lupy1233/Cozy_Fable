import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type AnswerValue, type QuestionStep } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { StepRenderer } from './step-renderer';
import { validateStep } from './room-screens';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// b1: campul comun de dimensiuni din pasii camerelor accepta virgula
const step = getFlow('LAUNDRY').steps.find((s) => s.id === 'dimensions') as QuestionStep;

function Harness({ initial, onAnswers }: { initial?: AnswerValue; onAnswers: (a: AnswerMap) => void }) {
  const [answers, setAnswers] = useState<AnswerMap>(initial ? { dimensions: initial } : {});
  return (
    <StepRenderer
      step={step}
      answers={answers}
      roomType="LAUNDRY"
      onChange={(value) => {
        const next = { ...answers, dimensions: value };
        setAnswers(next);
        onAnswers(next);
      }}
      onInfo={() => {}}
    />
  );
}

function renderRo(initial?: AnswerValue, locale: 'ro' | 'en' = 'ro') {
  const onAnswers = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Harness initial={initial} onAnswers={onAnswers} />
    </NextIntlClientProvider>,
  );
  const messages = locale === 'ro' ? ro : en;
  const input = screen.getByLabelText(messages.Configurator.flows.LAUNDRY.dimensions.slots.runA, {
    exact: false,
  }) as HTMLInputElement;
  return { input, onAnswers };
}

const lastDims = (fn: ReturnType<typeof vi.fn>) =>
  (fn.mock.calls.at(-1)?.[0] as AnswerMap).dimensions as Record<string, number>;

describe('StepRenderer — dimensiuni cu virgula (b1)', () => {
  beforeEach(() => useConfiguratorStore.setState({ dimensionUnit: 'm' }));

  it('campul e text cu tastatura zecimala, nu type=number', () => {
    const { input } = renderRo();
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
  });

  it('"1,6" ramane 1,6 si se salveaza 1.6 m', async () => {
    const { input, onAnswers } = renderRo();
    await userEvent.type(input, '1,6');
    expect(input.value).toBe('1,6');
    expect(lastDims(onAnswers).runA).toBe(1.6);
    await userEvent.tab();
    expect(input.value).toBe('1,6');
  });

  it('"150,5" in cm ramane 150,5 si nu se transforma in maxim', async () => {
    useConfiguratorStore.setState({ dimensionUnit: 'cm' });
    const { input, onAnswers } = renderRo();
    await userEvent.type(input, '150,5');
    await userEvent.tab();
    expect(lastDims(onAnswers).runA).toBe(1.505);
    expect(input.value).toBe('150,5');
  });

  it('textul care nu e numar arata mesajul si goleste dimensiunea din raspuns (m7)', async () => {
    const { input, onAnswers } = renderRo();
    await userEvent.type(input, '1,2,3');
    expect(screen.getByText(ro.Configurator.validation.notANumber)).toBeVisible();
    // ce vede clientul e ce se trimite: nu ramane 1.2 de la "1,2"
    expect(lastDims(onAnswers).runA).toBeUndefined();
    await userEvent.tab();
    expect(input.value).toBe('1,2,3');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('"Continua" se opreste cat timp campul are text nevalid (m7)', async () => {
    const { input, onAnswers } = renderRo({ runA: 2.5, ceilingHeight: 2.6 });
    // valoarea veche valida trece de validarea pasului
    expect(validateStep(step, { dimensions: { runA: 2.5, ceilingHeight: 2.6 } })).toBeUndefined();
    await userEvent.type(input, 'x');
    expect(input.value).toBe('2,5x');
    const answers = onAnswers.mock.calls.at(-1)?.[0] as AnswerMap;
    expect((answers.dimensions as Record<string, number>).runA).toBeUndefined();
    // aceeasi validare pe care o foloseste goNext din room-flow-runner
    expect(validateStep(step, answers)).toBeDefined();
    expect(screen.getByText(ro.Configurator.validation.notANumber)).toBeVisible();
    // corectura readuce valoarea
    await userEvent.type(input, '{Backspace}');
    expect(lastDims(onAnswers).runA).toBe(2.5);
  });

  it('campul nu are atribut pattern (validarea nativa nu contrazice cititorul, m6)', () => {
    const { input } = renderRo();
    expect(input).not.toHaveAttribute('pattern');
  });

  it('o ciorna veche cu numere se afiseaza la fel (cu virgula in romana)', () => {
    const { input } = renderRo({ runA: 2.4, ceilingHeight: 2.6 });
    expect(input.value).toBe('2,4');
  });

  it('in engleza afiseaza punctul si accepta si virgula', async () => {
    const { input, onAnswers } = renderRo({ runA: 2.4 }, 'en');
    expect(input.value).toBe('2.4');
    await userEvent.clear(input);
    await userEvent.type(input, '1,6');
    expect(lastDims(onAnswers).runA).toBe(1.6);
    await userEvent.tab();
    expect(input.value).toBe('1.6');
  });

  it('golirea campului sterge valoarea din raspuns', async () => {
    const { input, onAnswers } = renderRo({ runA: 2.4 });
    await userEvent.clear(input);
    expect(lastDims(onAnswers).runA).toBeUndefined();
  });
});
