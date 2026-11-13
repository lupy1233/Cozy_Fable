import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import { ClaimCompletionCard } from './claim-completion-card';

// e2 pasul 4: fisa firmei arata "Livrare confirmata" + recenzia primita; raportul clientului.
let data: unknown = null;
const hook = vi.fn();
vi.mock('@/hooks/use-fulfillment', () => ({
  useCompanyCompletion: (...args: unknown[]) => {
    hook(...args);
    return { data, isPending: false };
  },
}));

function renderIt(requestStatus: string) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <ClaimCompletionCard requestId="r1" requestStatus={requestStatus} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  data = null;
  hook.mockClear();
});

describe('ClaimCompletionCard', () => {
  it('proiect in lucru → nimic, fara cerere', () => {
    const { container } = renderIt('ACCEPTED');
    expect(container.textContent).toBe('');
    expect(hook).toHaveBeenCalledWith('r1', false);
  });

  it('finalizat: "Livrare confirmată" + recenzia primita', () => {
    data = {
      requestId: 'r1',
      requestStatus: 'COMPLETED',
      deliveredAt: '2026-10-20T10:00:00Z',
      completedAt: '2026-11-01T10:00:00Z',
      review: { rating: 4, comment: 'Foarte bine', disputed: false, createdAt: '2026-11-02T10:00:00Z' },
      openCase: null,
      clientTextsHidden: false,
    };
    renderIt('COMPLETED');
    expect(screen.getByText('Livrare confirmată')).toBeTruthy();
    expect(screen.getByText(/Foarte bine/)).toBeTruthy();
    expect(screen.getByText('★★★★☆')).toBeTruthy();
    // m10: limba aplicatiei, luna in litere
    expect(screen.getByText('Comanda a fost finalizată pe 1 noiembrie 2026.')).toBeTruthy();
  });

  it('finalizat fara recenzie + reclamatie in garantie deschisa', () => {
    data = {
      requestId: 'r1',
      requestStatus: 'COMPLETED',
      deliveredAt: null,
      completedAt: null,
      review: null,
      openCase: { reason: 'WARRANTY_CLAIM', note: 'Ușa s-a lăsat', createdAt: '2026-11-12T10:00:00Z' },
      clientTextsHidden: false,
    };
    renderIt('COMPLETED');
    expect(screen.getByText('Clientul nu a lăsat încă o recenzie.')).toBeTruthy();
    expect(screen.getByText(/a raportat o problemă în garanție/)).toBeTruthy();
    expect(screen.getByText(/Ușa s-a lăsat/)).toBeTruthy();
  });

  it('livrata cu raport deschis → anunta ca finalizarea automata e oprita', () => {
    data = {
      requestId: 'r1',
      requestStatus: 'DELIVERED_BY_COMPANY',
      deliveredAt: '2026-11-10T10:00:00Z',
      completedAt: null,
      review: null,
      openCase: { reason: 'OTHER', note: null, createdAt: '2026-11-11T10:00:00Z' },
      clientTextsHidden: false,
    };
    renderIt('DELIVERED_BY_COMPANY');
    expect(screen.getByText(/nu se finalizează automat/)).toBeTruthy();
  });
});
