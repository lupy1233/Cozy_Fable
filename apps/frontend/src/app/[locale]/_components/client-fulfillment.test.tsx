import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';
import { ClientFulfillment } from './client-fulfillment';

// e2 (plan reparatii 2026-11-13): recenzia pleaca doar cu stele alese si dupa rezumat;
// "Confirma livrarea" cere dialog cu varianta "Am o problema"; dupa finalizare clientul
// poate raporta o problema in fereastra de garantie.

const confirmMutate = vi.fn();
const reviewMutate = vi.fn();
const caseMutate = vi.fn();
const warrantyMutate = vi.fn();
const mutation = (mutate: ReturnType<typeof vi.fn>) => ({ mutate, reset: vi.fn(), isPending: false, error: null });
let projectCase: unknown = null;
let warranty: unknown = null;
let fulfillment: unknown = null;

vi.mock('@/hooks/use-fulfillment', () => ({
  useClientFulfillment: () => ({ data: fulfillment, isPending: false }),
  useConfirmDelivery: () => mutation(confirmMutate),
  useCreateReview: () => mutation(reviewMutate),
  useOpenProjectCase: () => mutation(caseMutate),
  useOpenWarrantyCase: () => mutation(warrantyMutate),
  useRespondProjectCase: () => mutation(vi.fn()),
  useProjectCase: () => ({ data: projectCase, isPending: false }),
  useReview: () => ({ data: null, isPending: false }),
  useWarrantyWindow: () => ({ data: warranty, isPending: false }),
}));

function renderIt(status: string) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <ClientFulfillment requestId="r1" status={status} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  projectCase = null;
  warranty = null;
  fulfillment = null;
});

// e1-1 / e1-2: contactul persoanei responsabile, datele firmei si etapele — doar ce trimite serverul
describe('ClientFulfillment — dupa acceptare (e1)', () => {
  const stages = [
    { stage: 'MEASUREMENTS', done: true, completedAt: '2026-11-10T10:00:00Z', completedByName: 'Ion Pop' },
    { stage: 'CONTRACT', done: false, completedAt: null, completedByName: null },
    { stage: 'PRODUCTION', done: false, completedAt: null, completedByName: null },
    { stage: 'INSTALLATION', done: false, completedAt: null, completedByName: null },
  ];
  const full = {
    requestId: 'r1',
    acceptedAt: '2026-11-01T10:00:00Z',
    deliveredAt: null,
    completedAt: null,
    autoCompleteAt: null,
    company: { name: 'Mobila Bună SRL', cui: 'RO123456', addressText: 'Str. Lemnului 3', city: 'Cluj-Napoca', county: 'Cluj' },
    contact: { name: 'Ion Pop', email: 'ion@firma.ro', phone: '+40722000111' },
    stages,
  };

  it('arata persoana responsabila (mailto / tel), firma (CUI, adresa) si etapele cu data', () => {
    fulfillment = full;
    renderIt('ACCEPTED');
    expect(screen.getByText('Ion Pop')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ion@firma.ro' }).getAttribute('href')).toBe('mailto:ion@firma.ro');
    expect(screen.getByRole('link', { name: '+40722000111' }).getAttribute('href')).toBe('tel:+40722000111');
    expect(screen.getByText('Mobila Bună SRL')).toBeTruthy();
    expect(screen.getByText('CUI RO123456')).toBeTruthy();
    expect(screen.getByText('Str. Lemnului 3, Cluj-Napoca, Cluj')).toBeTruthy();
    expect(screen.getByText('Măsurători')).toBeTruthy();
    expect(screen.getByText('Bifată pe 10 noiembrie 2026')).toBeTruthy();
    expect(screen.getAllByText('Încă nebifată')).toHaveLength(3);
    // clientul doar vede etapele
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('fara telefon: nu apare legatura tel:', () => {
    fulfillment = { ...full, contact: { ...full.contact, phone: null } };
    renderIt('IN_EXECUTION');
    expect(screen.queryByRole('link', { name: /^\+40/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'ion@firma.ro' })).toBeTruthy();
  });

  it('fara oferta acceptata (company / contact null, stages []) → nimic din ele', () => {
    fulfillment = { ...full, acceptedAt: null, company: null, contact: null, stages: [] };
    renderIt('ACCEPTED');
    expect(screen.queryByText('Cu cine vorbești')).toBeNull();
    expect(screen.queryByText('Cum avansează proiectul')).toBeNull();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });

  // m2 (revizie e5): dupa finalizare contactul ramane (garantie) — aratam ce trimite serverul
  it.each(['COMPLETED', 'DISPUTED'])('%s: contactul si firma trimise de server raman vizibile', (status) => {
    fulfillment = { ...full, completedAt: '2026-11-20T10:00:00Z' };
    renderIt(status);
    expect(screen.getByText('Cu cine vorbești')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ion@firma.ro' }).getAttribute('href')).toBe('mailto:ion@firma.ro');
    expect(screen.getByText('CUI RO123456')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('COMPLETED fara date de la server → fara card de contact', () => {
    fulfillment = { ...full, company: null, contact: null, stages: [] };
    renderIt('COMPLETED');
    expect(screen.queryByText('Cu cine vorbești')).toBeNull();
  });

  it('livrata: data finalizarii automate + contactul raman vizibile', () => {
    fulfillment = { ...full, deliveredAt: '2026-11-12T10:00:00Z', autoCompleteAt: '2026-11-26T10:00:00Z' };
    renderIt('DELIVERED_BY_COMPANY');
    expect(screen.getByText(/se finalizează automat pe 26 noiembrie 2026/)).toBeTruthy();
    expect(screen.getByText('Cu cine vorbești')).toBeTruthy();
  });
});

describe('ClientFulfillment — recenzia (e2 pasul 1)', () => {
  it('nota porneste goala: butonul e inactiv fara stele, apoi cere rezumatul inainte de trimitere', async () => {
    renderIt('COMPLETED');
    const send = screen.getByRole('button', { name: 'Trimite recenzia' });
    expect(send).toBeDisabled();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Acordă 4 din 5 stele' }));
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(reviewMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Trimiți nota 4 din 5 — nu se mai poate schimba.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Da, trimite recenzia' }));
    expect(reviewMutate).toHaveBeenCalledWith({ rating: 4, comment: undefined });
  });

  it('sub 3 stele rezumatul arata si avertismentul de disputa', async () => {
    renderIt('COMPLETED');
    await userEvent.click(screen.getByRole('button', { name: 'Acordă 2 din 5 stele' }));
    await userEvent.click(screen.getByRole('button', { name: 'Trimite recenzia' }));
    expect(screen.getByText('Trimiți nota 2 din 5 — nu se mai poate schimba.')).toBeTruthy();
    expect(screen.getByText(/deschide automat o dispută/)).toBeTruthy();
  });
});

describe('ClientFulfillment — confirmarea livrarii (e2 pasii 2-3)', () => {
  it('"Confirmă livrarea" deschide un dialog; confirmarea pleaca doar din dialog', async () => {
    renderIt('DELIVERED_BY_COMPANY');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă livrarea' }));
    expect(confirmMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Am o problemă' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Am verificat, confirm livrarea' }));
    expect(confirmMutate).toHaveBeenCalledWith('r1', expect.anything());
  });

  it('"Am o problemă" trimite raportul de proiect (motiv OTHER + nota), fara confirmare', async () => {
    renderIt('DELIVERED_BY_COMPANY');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă livrarea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Am o problemă' }));
    const submit = screen.getByRole('button', { name: 'Trimite raportul' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'Lipsește un raft');
    await userEvent.click(submit);
    expect(caseMutate).toHaveBeenCalledWith({ reason: 'OTHER', note: 'Lipsește un raft' }, expect.anything());
    expect(confirmMutate).not.toHaveBeenCalled();
  });

  it('cu raport deschis: mesajul despre finalizarea automata oprita', () => {
    projectCase = { status: 'OPEN', reason: 'OTHER', openedBy: 'CLIENT', createdAt: '2026-11-10T10:00:00Z' };
    renderIt('DELIVERED_BY_COMPANY');
    expect(screen.getByText(/comanda nu se finalizează automat/)).toBeTruthy();
  });
});

describe('ClientFulfillment — raportare in garantie (e2-2)', () => {
  it('in fereastra: "Raportează o problemă" → nota → confirmare → trimitere', async () => {
    warranty = { completedAt: '2026-11-01T10:00:00Z', months: 24, endsAt: '2028-11-01T10:00:00Z', open: true };
    renderIt('COMPLETED');
    await userEvent.click(screen.getByRole('button', { name: 'Raportează o problemă' }));
    await userEvent.type(screen.getByRole('textbox', { name: /Descrie problema/ }), 'Ușa s-a lăsat');
    await userEvent.click(screen.getByRole('button', { name: 'Trimite raportul' }));
    expect(warrantyMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Trimite raportul' }));
    expect(warrantyMutate).toHaveBeenCalledWith({ note: 'Ușa s-a lăsat' }, expect.anything());
  });

  it('dupa fereastra: fara buton, cu data de sfarsit', () => {
    warranty = { completedAt: '2024-01-01T10:00:00Z', months: 24, endsAt: '2026-01-01T10:00:00Z', open: false };
    renderIt('COMPLETED');
    expect(screen.queryByRole('button', { name: 'Raportează o problemă' })).toBeNull();
    expect(screen.getByText(/s-a încheiat pe/)).toBeTruthy();
  });

  it('raport in garantie deschis: confirmarea primirii', () => {
    warranty = { completedAt: '2026-11-01T10:00:00Z', months: 24, endsAt: '2028-11-01T10:00:00Z', open: true };
    projectCase = { status: 'OPEN', reason: 'WARRANTY_CLAIM', openedBy: 'CLIENT', createdAt: '2026-11-12T10:00:00Z' };
    renderIt('COMPLETED');
    expect(screen.queryByRole('button', { name: 'Raportează o problemă' })).toBeNull();
    expect(screen.getByText(/Ai raportat o problemă pe/)).toBeTruthy();
  });
});

// review m10: data dupa limba aplicatiei si ora Romaniei, cu luna in litere
describe('ClientFulfillment — formatul datei (m10)', () => {
  it('RO: "13 noiembrie 2028", calculat in ora Romaniei (23:30 UTC = a doua zi la Bucuresti)', () => {
    warranty = { completedAt: '2026-11-12T23:30:00Z', months: 24, endsAt: '2028-11-12T23:30:00Z', open: true };
    renderIt('COMPLETED');
    expect(screen.getByText(/până pe 13 noiembrie 2028/)).toBeTruthy();
  });

  it('EN: "November 13, 2028"', () => {
    warranty = { completedAt: '2026-11-13T10:00:00Z', months: 24, endsAt: '2028-11-13T10:00:00Z', open: true };
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Bucharest">
        <ClientFulfillment requestId="r1" status="COMPLETED" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/until November 13, 2028/)).toBeTruthy();
  });
});