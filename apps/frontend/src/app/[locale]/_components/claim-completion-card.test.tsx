import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import { ApiError } from '@/lib/api';
import {
  canEditExecutionStages,
  ClaimCompletionCard,
  DeliverProjectButton,
  ExecutionStagesPanel,
  FirmProjectBadge,
  FirmProjectStatus,
  firmProjectState,
} from './claim-completion-card';

// e2 pasul 4: fisa firmei arata "Livrare confirmata" + recenzia primita; raportul clientului.
let data: unknown = null;
const hook = vi.fn();
const deliverMutate = vi.fn();
const stageMutate = vi.fn();
let stageError: unknown = null;
let rules: unknown = null;
let deliverError: unknown = null;
vi.mock('@/hooks/use-fulfillment', () => ({
  useCompanyCompletion: (...args: unknown[]) => {
    hook(...args);
    return { data, isPending: false };
  },
  useMarkDelivered: () => ({ mutate: deliverMutate, reset: vi.fn(), isPending: false, isSuccess: false, error: deliverError }),
  useSetExecutionStage: () => ({
    mutate: stageMutate,
    reset: vi.fn(),
    isPending: false,
    error: stageError,
    variables: undefined,
  }),
}));
vi.mock('@/hooks/use-legal', () => ({
  useFirmRules: () => ({ data: rules }),
  isFirmRules: (d: unknown) => !!d,
}));

function wrap(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {node}
    </NextIntlClientProvider>,
  );
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const STAGES = [
  { stage: 'MEASUREMENTS', done: true, completedAt: '2026-11-10T10:00:00Z', completedByName: 'Ion Pop' },
  { stage: 'CONTRACT', done: false, completedAt: null, completedByName: null },
  { stage: 'PRODUCTION', done: false, completedAt: null, completedByName: null },
  { stage: 'INSTALLATION', done: false, completedAt: null, completedByName: null },
];
function completion(over: Record<string, unknown>) {
  return {
    requestId: 'r1',
    requestStatus: 'ACCEPTED',
    deliveredAt: null,
    completedAt: null,
    review: null,
    openCase: null,
    clientTextsHidden: false,
    acceptedAt: '2026-11-01T10:00:00Z',
    earliestDeliveryAt: null,
    autoCompleteAt: null,
    stages: STAGES,
    ...over,
  };
}

function renderIt(requestStatus: string) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <ClaimCompletionCard requestId="r1" requestStatus={requestStatus} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  data = null;
  stageError = null;
  rules = null;
  deliverError = null;
  hook.mockClear();
  deliverMutate.mockClear();
  stageMutate.mockClear();
});

// e1 (etapa 5): pe castigator starea proiectului, nu „Ofertă trimisă”
describe('fisa firmei — starea proiectului (e1)', () => {
  it('starea cererii → starea proiectului', () => {
    expect(firmProjectState('ACCEPTED')).toBe('accepted');
    expect(firmProjectState('IN_EXECUTION')).toBe('accepted');
    expect(firmProjectState('DELIVERED_BY_COMPANY')).toBe('delivered');
    expect(firmProjectState('COMPLETED')).toBe('completed');
    expect(firmProjectState('DISPUTED')).toBe('completed');
    expect(firmProjectState('CANCELLED')).toBeNull();
    expect(firmProjectState('NEGOTIATION')).toBeNull();
  });

  it.each([
    ['accepted', 'Acceptată'],
    ['delivered', 'Livrată — așteaptă clientul'],
    ['completed', 'Finalizată'],
  ] as const)('insigna %s', (state, label) => {
    const { container } = wrap(<FirmProjectBadge state={state} />);
    expect(container.textContent).toBe(label);
    expect(container.textContent).not.toMatch(/Ofert/);
  });

  it('acceptata: data acceptarii + de cand se poate marca livrarea', () => {
    data = completion({ acceptedAt: '2026-11-01T10:00:00Z', earliestDeliveryAt: iso(3 * DAY) });
    const { container } = wrap(<FirmProjectStatus requestId="r1" state="accepted" />);
    expect(screen.getByText('Ofertă acceptată')).toBeTruthy();
    expect(screen.getByText('Acceptată pe 1 noiembrie 2026')).toBeTruthy();
    expect(screen.getByText(/Poți marca livrarea începând cu/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Oferta a fost trimisă/);
  });

  it('livrata: asteapta clientul + data finalizarii automate', () => {
    data = completion({ requestStatus: 'DELIVERED_BY_COMPANY', autoCompleteAt: '2026-11-24T10:00:00Z' });
    wrap(<FirmProjectStatus requestId="r1" state="delivered" />);
    expect(screen.getByText('Livrată — așteaptă confirmarea clientului')).toBeTruthy();
    expect(screen.getByText(/se finalizează automat pe 24 noiembrie 2026/)).toBeTruthy();
  });

  it('finalizata: data finalizarii', () => {
    data = completion({ requestStatus: 'COMPLETED', completedAt: '2026-11-20T10:00:00Z' });
    wrap(<FirmProjectStatus requestId="r1" state="completed" />);
    expect(screen.getByText('Finalizată')).toBeTruthy();
    expect(screen.getByText('Finalizată pe 20 noiembrie 2026')).toBeTruthy();
  });
});

describe('„Marchează ca livrată” (e1-3)', () => {
  it('inainte de earliestDeliveryAt: buton dezactivat, cu data SI ora (ora Romaniei) — m1', () => {
    // 13:42 UTC = 15:42 la Bucuresti; serverul deblocheaza la minut
    data = completion({ earliestDeliveryAt: '2099-11-21T13:42:00Z' });
    wrap(<DeliverProjectButton requestId="r1" />);
    expect(screen.getByRole('button', { name: 'Marchează ca livrată' })).toBeDisabled();
    expect(screen.getByText(/Poți marca livrarea începând cu 21 noiembrie 2099.*15:42/)).toBeTruthy();
  });

  it('eroarea DELIVERY_TOO_EARLY arata data si ora din details — m1', () => {
    data = completion({ earliestDeliveryAt: null });
    deliverError = new ApiError('DELIVERY_TOO_EARLY', 409, 'too early', { earliestDeliveryAt: '2099-11-21T13:42:00Z' });
    wrap(<DeliverProjectButton requestId="r1" />);
    expect(screen.getByRole('alert').textContent).toMatch(/începând cu 21 noiembrie 2099.*15:42/);
  });

  it('dupa earliestDeliveryAt: activ; dialogul spune cand se finalizeaza automat', async () => {
    data = completion({ earliestDeliveryAt: iso(-DAY) });
    rules = { delivery: { autoCompleteDays: 14 } };
    wrap(<DeliverProjectButton requestId="r1" />);
    const btn = screen.getByRole('button', { name: 'Marchează ca livrată' });
    expect(btn).toBeEnabled();
    expect(screen.queryByText(/Poți marca livrarea începând cu/)).toBeNull();
    await userEvent.click(btn);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/se finalizează automat pe \d{1,2} \p{L}+ \d{4}/u)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Da, am livrat' }));
    expect(deliverMutate).toHaveBeenCalledWith('r1', expect.anything());
  });

  it('fara prag (setarea 0 → earliestDeliveryAt null): activ', () => {
    data = completion({ earliestDeliveryAt: null });
    wrap(<DeliverProjectButton requestId="r1" />);
    expect(screen.getByRole('button', { name: 'Marchează ca livrată' })).toBeEnabled();
  });
});

describe('„Ce urmează” pentru firma — etapele (e1-2)', () => {
  // aceeasi regula ca serverul: fisa completa si nu angajat limitat pe preluarea altcuiva
  it('cine poate bifa: oglinda accesului la fisa de lucru', () => {
    // OWNER / MANAGER / angajat de incredere (neatribuit) / atribuit → fara motiv de ascundere
    expect(canEditExecutionStages({ visibility: 'FULL', clientHiddenReason: null })).toBe(true);
    // fereastra de dezvaluire sau retentia nu tin de dreptul de lucru
    expect(canEditExecutionStages({ visibility: 'FULL', clientHiddenReason: 'REVEAL_PENDING' })).toBe(true);
    // imagine veche fara visibility = FULL
    expect(canEditExecutionStages({ clientHiddenReason: null })).toBe(true);
    // angajat limitat pe preluarea unui coleg
    expect(canEditExecutionStages({ visibility: 'FULL', clientHiddenReason: 'NOT_ASSIGNED_TO_YOU' })).toBe(false);
    expect(canEditExecutionStages({ visibility: 'REDACTED', clientHiddenReason: null })).toBe(false);
  });

  it('cu drept de bifare: bifa trimite etapa; arata data si cine a bifat', async () => {
    data = completion({});
    wrap(<ExecutionStagesPanel requestId="r1" requestStatus="ACCEPTED" canEdit />);
    expect(screen.getByText('Bifată pe 10 noiembrie 2026 de Ion Pop')).toBeTruthy();
    const contract = screen.getByRole('checkbox', { name: /Contract/ });
    expect(contract).toBeEnabled();
    await userEvent.click(contract);
    expect(stageMutate).toHaveBeenCalledWith({ stage: 'CONTRACT', done: true });
    await userEvent.click(screen.getByRole('checkbox', { name: /Măsurători/ }));
    expect(stageMutate).toHaveBeenCalledWith({ stage: 'MEASUREMENTS', done: false });
  });

  it('fara drept: doar de citit, cu explicatie', () => {
    data = completion({});
    wrap(<ExecutionStagesPanel requestId="r1" requestStatus="ACCEPTED" canEdit={false} />);
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByText(/angajații de încredere sau persoana care lucrează/)).toBeTruthy();
  });

  it('eroare de permisiune → mesaj clar', () => {
    data = completion({});
    stageError = new ApiError('FORBIDDEN', 403, 'forbidden');
    wrap(<ExecutionStagesPanel requestId="r1" requestStatus="ACCEPTED" canEdit />);
    expect(screen.getByRole('alert').textContent).toMatch(/Nu poți bifa etapele/);
  });

  it('proiect finalizat → panoul nu apare, fara cerere', () => {
    data = completion({ requestStatus: 'COMPLETED' });
    const { container } = wrap(<ExecutionStagesPanel requestId="r1" requestStatus="COMPLETED" canEdit />);
    expect(container.textContent).toBe('');
    expect(hook).toHaveBeenCalledWith('r1', false);
  });
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
