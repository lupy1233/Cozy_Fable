import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { BudgetSlider } from './budget-slider';

type Props = Parameters<typeof BudgetSlider>[0];

function show(props: Partial<Props> = {}, locale: 'en' | 'ro' = 'en') {
  const onChooseRon = vi.fn();
  const onUndisclosed = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ro}>
      <BudgetSlider
        valueRon={null}
        undisclosed={false}
        estimate={{ minRon: 24000, maxRon: 72000 }}
        onChooseRon={onChooseRon}
        onUndisclosed={onUndisclosed}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onChooseRon, onUndisclosed, slider: screen.getByRole('slider') };
}

// b11 (PO 2026-11-13): glisorul porneste fara suma; clientul o alege
describe('BudgetSlider (b11)', () => {
  it('starts without an amount: "Choose the amount", no visible thumb', () => {
    const { slider } = show();
    expect(screen.getByTestId('budget-value')).toHaveTextContent(en.Requests.budgetChoose);
    expect(slider).toHaveAttribute('data-unset', 'true');
    expect(slider).toHaveAttribute('aria-valuetext', en.Requests.budgetChoose);
  });

  it('a click on the resting spot is a choice too', () => {
    const { slider, onChooseRon } = show();
    fireEvent.pointerUp(slider);
    expect(onChooseRon).toHaveBeenCalledWith(Number((slider as HTMLInputElement).value));
  });

  it('shows the chosen amount in lei, the estimate mark and no note at or above the estimate', () => {
    const { slider } = show({ valueRon: 30000 });
    expect(screen.getByTestId('budget-value')).toHaveTextContent('30,000 lei');
    expect(slider).not.toHaveAttribute('data-unset');
    expect(screen.getByText('Estimate: 24,000 lei')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('below the estimate: the warning note', () => {
    show({ valueRon: 8000 });
    expect(screen.getByRole('status')).toHaveTextContent(en.Requests.budgetBelowEstimateNote);
  });

  it('Romanian: the same "12.000 lei" format', () => {
    show({ valueRon: 12000 }, 'ro');
    expect(screen.getByTestId('budget-value')).toHaveTextContent('12.000 lei');
    expect(screen.getByRole('status')).toHaveTextContent(ro.Requests.budgetBelowEstimateNote);
  });

  it('"I prefer not to share" disables the slider and never sets an amount', () => {
    const { slider, onUndisclosed, onChooseRon } = show({ undisclosed: true });
    expect(slider).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: en.Requests.budget.UNDISCLOSED }));
    expect(onUndisclosed).toHaveBeenCalledWith(false);
    expect(onChooseRon).not.toHaveBeenCalled();
  });

  it('without an estimate: fixed scale, no note', () => {
    const { slider } = show({ estimate: null, valueRon: 2000 });
    expect(slider).toHaveAttribute('min', '1000');
    expect(slider).toHaveAttribute('max', '100000');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
