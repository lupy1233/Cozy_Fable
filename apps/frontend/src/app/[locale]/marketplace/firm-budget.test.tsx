import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { useBudgetFormat } from '@/hooks/use-budget-format';
import { FirmBudgetValue } from './firm-budget';
import { MIN_BUDGET_DEBOUNCE_MS, MinBudgetFilter } from './min-budget-filter';

type Budget = { budgetRange: string; budgetEstimateRon?: number | null; budgetDeclared?: boolean };

function Row({ budget, estimateMinRon }: { budget: Budget; estimateMinRon?: number | null }) {
  const { firmLabel } = useBudgetFormat();
  return (
    <dl>
      <dt>{firmLabel(budget)}</dt>
      <dd>
        <FirmBudgetValue budget={budget} estimateMinRon={estimateMinRon} />
      </dd>
    </dl>
  );
}

function show(budget: Budget, estimateMinRon?: number | null, locale: 'en' | 'ro' = 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ro}>
      <Row budget={budget} estimateMinRon={estimateMinRon} />
    </NextIntlClientProvider>,
  );
}

// b11 (PO 2026-11-13): firma vede suma aleasa, cu eticheta potrivita, fara trepte
describe('firm budget row (b11)', () => {
  it('an amount chosen by the client: "Budget stated by the client" + the same lei format', () => {
    show({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true });
    expect(screen.getByText(en.Requests.budgetView.declaredLabel)).toBeInTheDocument();
    expect(screen.getByText('12,000 lei')).toBeInTheDocument();
    expect(screen.queryByText(en.Requests.budget.FROM_5K_TO_15K)).not.toBeInTheDocument();
  });

  // M2 (coordonator): suma nedeclarata a unei cereri vechi nu se arata firmei
  it('an old request (amount not stated by the client): "Budget not stated", no amount, no estimate', () => {
    show({ budgetRange: 'OVER_15K', budgetEstimateRon: 33000, budgetDeclared: false }, 50000);
    expect(screen.getByText(en.Requests.field.budgetRange)).toBeInTheDocument();
    expect(screen.getByText(en.Requests.budgetView.undisclosed)).toBeInTheDocument();
    expect(screen.queryByText(/33,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(en.Requests.budgetView.declaredLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(en.Requests.budgetView.belowEstimate)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(en.Requests.budgetView.estimateLabel))).not.toBeInTheDocument();
  });

  it('no amount: "Budget not stated", no estimate', () => {
    show({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: null }, 25000);
    expect(screen.getByText(en.Requests.budgetView.undisclosed)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(en.Requests.budgetView.estimateLabel))).not.toBeInTheDocument();
  });

  it('below the estimate: the firm sees it, with the estimate labelled "Estimate from answers"', () => {
    show({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 9000, budgetDeclared: true }, 25000);
    expect(screen.getByText(en.Requests.budgetView.belowEstimate)).toBeInTheDocument();
    expect(screen.getByText(`${en.Requests.budgetView.estimateLabel}: 25,000 lei`)).toBeInTheDocument();
  });

  it('Romanian: "12.000 lei", no warning at or above the estimate', () => {
    show({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true }, 12000, 'ro');
    expect(screen.getByText('12.000 lei')).toBeInTheDocument();
    expect(screen.queryByText(ro.Requests.budgetView.belowEstimate)).not.toBeInTheDocument();
  });
});

describe('marketplace minimum budget slider (b11-3)', () => {
  afterEach(() => vi.useRealTimers());

  it('updates the label at once and sends the value after a short pause', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MinBudgetFilter value={0} onChange={onChange} />
      </NextIntlClientProvider>,
    );
    const slider = screen.getByRole('slider', { name: new RegExp(en.Marketplace.minBudget) });
    expect(slider).toHaveAttribute('aria-valuetext', en.Marketplace.minBudgetAny);
    fireEvent.change(slider, { target: { value: '10000' } });
    fireEvent.change(slider, { target: { value: '15000' } });
    expect(slider).toHaveAttribute('aria-valuetext', 'from 15,000 lei');
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(MIN_BUDGET_DEBOUNCE_MS + 10));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(15000);
  });
});
