import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../messages/ro.json';
import { QueryState } from './query-state';

function renderState(props: Partial<React.ComponentProps<typeof QueryState>> = {}) {
  const onRetry = vi.fn();
  const utils = render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <QueryState pending onRetry={onRetry} skeleton={<div>skeleton</div>} {...props}>
        <div>continut</div>
      </QueryState>
    </NextIntlClientProvider>,
  );
  return { ...utils, onRetry };
}

describe('QueryState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pending → skeleton, apoi dupa 15 s mesajul de incarcare lenta + Reincearca', () => {
    const { onRetry } = renderState();
    expect(screen.getByText('skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Încărcarea durează mai mult decât de obicei')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByText('Încărcarea durează mai mult decât de obicei')).toBeInTheDocument();
    expect(screen.queryByText('skeleton')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // dupa Reincearca revine skeletonul
    expect(screen.getByText('skeleton')).toBeInTheDocument();
  });

  it('eroare → LoadError cu Reincearca', () => {
    const { onRetry } = renderState({ pending: false, error: new Error('boom') });
    expect(screen.getByText('Nu am putut încărca datele')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('eroare + errorFallback → foloseste fallback-ul', () => {
    renderState({ pending: false, error: new Error('x'), errorFallback: <div>blocaj</div> });
    expect(screen.getByText('blocaj')).toBeInTheDocument();
    expect(screen.queryByText('Nu am putut încărca datele')).toBeNull();
  });

  it('nepending si fara eroare → children', () => {
    renderState({ pending: false });
    expect(screen.getByText('continut')).toBeInTheDocument();
  });
});
