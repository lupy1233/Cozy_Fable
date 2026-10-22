import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { ConfiguratorWizard } from './configurator-wizard';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./start-mode-step', () => ({ StartModeStep: () => <div>Ready to choose a start mode</div> }));
vi.mock('./details-step', () => ({ DetailsStep: () => null }));
vi.mock('./review-step', () => ({ ReviewStep: () => null }));
vi.mock('./room-cart-step', () => ({ RoomCartStep: () => null }));
vi.mock('./room-flow-runner', () => ({ RoomFlowRunner: () => null }));
vi.mock('./uploads-step', () => ({ UploadsStep: () => null }));

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unavailable = () => response({ error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } }, 503);
const draft = { id: 'draft', attachments: [], configuratorState: null };
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<StrictMode><QueryClientProvider client={client}><NextIntlClientProvider locale="en" messages={en}><ConfiguratorWizard /></NextIntlClientProvider></QueryClientProvider></StrictMode>);
}

describe('anonymous draft bootstrap recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); });

  it('shows an actionable failure without a POST loop and retries on request', async () => {
    let posts = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST'
      ? ++posts === 1 ? unavailable() : response({ draftToken: 'new-draft' })
      : response(draft)));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(en.Configurator.bootstrap.description);
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Cluj' }));
    expect(posts).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: en.Configurator.bootstrap.retry }));
    await screen.findByText('Ready to choose a start mode');
    expect(posts).toBe(2);
    expect(localStorage.getItem('mm_draft_token')).toBe('new-draft');
  });

  it('keeps local answers when replacing an expired token fails and is retried', async () => {
    localStorage.setItem('mm_draft_token', 'expired');
    useConfiguratorStore.getState().addRoomWithAnswers('KITCHEN', { layout: 'L_SHAPE' });
    let posts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'POST') return ++posts === 1 ? unavailable() : response({ draftToken: 'replacement' });
      if (String(url).endsWith('/expired')) return response({ error: { code: 'NOT_FOUND', message: 'Expired' } }, 404);
      return response(draft);
    }));
    mount();
    await screen.findByRole('alert');
    expect(useConfiguratorStore.getState().roomInstances[0].answers.layout).toBe('L_SHAPE');
    await userEvent.click(screen.getByRole('button', { name: en.Configurator.bootstrap.retry }));
    await waitFor(() => expect(localStorage.getItem('mm_draft_token')).toBe('replacement'));
    expect(useConfiguratorStore.getState().roomInstances[0].answers.layout).toBe('L_SHAPE');
    expect(posts).toBe(2);
  });

  it('does not sync or replace a draft until its failed initial GET is retried', async () => {
    localStorage.setItem('mm_draft_token', 'existing');
    let gets = 0;
    const fetch = vi.fn(async (_url, init) => {
      expect(init?.method ?? 'GET').toBe('GET');
      return ++gets === 1 ? unavailable() : response(draft);
    });
    vi.stubGlobal('fetch', fetch);
    mount();
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: en.Configurator.bootstrap.retry }));
    await screen.findByText('Ready to choose a start mode');
    expect(gets).toBe(2);
    expect(localStorage.getItem('mm_draft_token')).toBe('existing');
  });
});
