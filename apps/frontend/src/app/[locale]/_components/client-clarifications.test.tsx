import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';

// e3 (etapa 9): clientul vede intrebarile in asteptare SI istoricul „Intrebare / Raspunsul tau”.

const hoisted = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/use-claims-lifecycle', () => ({
  useClientClarifications: () => ({ data: hoisted.data }),
  useAnswerClarification: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ClientClarifications } from './client-clarifications';

function renderList(data: unknown[]) {
  hoisted.data = data;
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <ClientClarifications requestId="req-1" />
    </NextIntlClientProvider>,
  );
}

const pending = {
  id: 'p1',
  claimSlotId: 's1',
  questionText: 'Ce înălțime are tavanul?',
  answerText: null,
  status: 'PENDING',
  answeredAt: null,
  createdAt: '2026-11-12T08:00:00.000Z',
  companyName: 'Mobila Unicat',
};
const answered = {
  id: 'a1',
  claimSlotId: 's2',
  questionText: 'Pereții sunt drepți?',
  answerText: 'Da, sunt drepți.',
  status: 'ANSWERED',
  answeredAt: '2026-11-11T10:00:00.000Z',
  createdAt: '2026-11-10T10:00:00.000Z',
  companyName: 'B Design',
};

describe('ClientClarifications (e3)', () => {
  it('fara intrebari → nimic', () => {
    const { container } = renderList([]);
    expect(container.textContent).toBe('');
  });

  it('in asteptare + cu raspuns: formularul de raspuns si istoricul cu firma si data', () => {
    renderList([answered, pending]);
    expect(screen.getByRole('heading', { name: ro.Lifecycle.clientClarificationsTitle })).toBeTruthy();
    expect(screen.getByText('Ce înălțime are tavanul?')).toBeTruthy();
    expect(screen.getByRole('button', { name: ro.Lifecycle.sendAnswer })).toBeTruthy();
    expect(screen.getByText('Mobila Unicat a întrebat pe 12 noiembrie 2026')).toBeTruthy();

    expect(screen.getByRole('heading', { name: ro.Lifecycle.clarificationHistory.title })).toBeTruthy();
    expect(screen.getByText('B Design a întrebat pe 10 noiembrie 2026')).toBeTruthy();
    expect(screen.getByText('Pereții sunt drepți?')).toBeTruthy();
    expect(screen.getByText('Da, sunt drepți.')).toBeTruthy();
    expect(screen.getByText('Ai răspuns pe 11 noiembrie 2026')).toBeTruthy();
    // un singur formular de raspuns (doar pentru intrebarea in asteptare)
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('doar cu raspuns: blocul nu dispare dupa raspuns, ramane istoricul', () => {
    renderList([answered]);
    expect(screen.queryByRole('heading', { name: ro.Lifecycle.clientClarificationsTitle })).toBeNull();
    expect(screen.getByRole('heading', { name: ro.Lifecycle.clarificationHistory.title })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
