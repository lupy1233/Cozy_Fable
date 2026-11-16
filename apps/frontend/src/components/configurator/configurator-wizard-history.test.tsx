import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import type { RequestDto } from '@marketplace/shared';
import { readNavEntry } from '@/stores/configurator-history';
import { isInEditSession, leaveEditSession, useConfiguratorStore } from '@/stores/configurator-store';
import { ConfiguratorWizard } from './configurator-wizard';

// m1 (etapa 12): Back / Forward din browser prin wizard-ul real (pasii sunt simulati)
const hoisted = vi.hoisted(() => ({
  push: vi.fn(),
  reviewProps: null as null | { onPublished: (id: string) => void },
}));
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: hoisted.push, replace: vi.fn() }),
  Link: ({ children, href, onClick }: { children: ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));
vi.mock('./start-mode-step', () => ({ StartModeStep: () => <div>Ready to choose a start mode</div> }));
vi.mock('./details-step', () => ({ DetailsStep: () => <h2>Details step</h2>, detailsPassValidation: () => true }));
vi.mock('./review-step', () => ({
  ReviewStep: (props: NonNullable<typeof hoisted.reviewProps>) => {
    hoisted.reviewProps = props;
    return <div>Review step</div>;
  },
}));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({ data: undefined }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: { success: vi.fn() } }));
vi.mock('./room-cart-step', () => ({ RoomCartStep: () => <h2>Cart step</h2> }));
vi.mock('./cart-basket', () => ({ CartBasket: () => null }));
vi.mock('./room-flow-runner', () => ({ RoomFlowRunner: () => null }));
vi.mock('./uploads-step', () => ({ UploadsStep: () => <h2>Uploads step</h2> }));

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const draft = { id: 'draft', attachments: [], configuratorState: null };
const clients: QueryClient[] = [];
function mount(editId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<StrictMode><QueryClientProvider client={client}><NextIntlClientProvider locale="en" messages={en}><ConfiguratorWizard editId={editId} /></NextIntlClientProvider></QueryClientProvider></StrictMode>);
}
const popped = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true }));
async function browserBack() {
  const p = popped();
  await act(async () => {
    window.history.back();
    await p;
  });
}
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
function arrive(path: string) {
  window.history.pushState(null, '', '/ro/dashboard');
  window.history.pushState(null, '', path);
}

const room = (id: string) => ({ id, roomType: 'BATHROOM' as const, lengthM: 0, widthM: 0, heightM: 0, items: [], answers: {}, flowVersion: 1, needsDesignHelp: true });
function requestDto(overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id: 'req-1', status: 'IN_MARKETPLACE', title: 'Baie — Cluj', description: '', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null,
    deadlineBucket: null, includesPaidDesign: true, hasOwnProject: false, addressText: 'Str. 1', county: 'Cluj', city: 'Cluj', country: 'RO',
    lat: null, lng: null, sizing: null, preClaimEditsUsed: 0, postClaimEditsUsed: 0, publishedAt: null, expiresAt: null, repostUsed: false,
    createdAt: '2026-11-13T10:00:00.000Z', rooms: [room('5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b')], contactPreferences: [],
    attachments: [], inspirationPhotoIds: [], inspirationPhotos: [], configuratorState: null, ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useConfiguratorStore.getState().reset();
  hoisted.push.mockClear();
  hoisted.reviewProps = null;
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => {
  // demontat inainte sa se scoata stub-ul lui scrollTo
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  if (isInEditSession()) leaveEditSession();
});

describe('wizard and the browser history (m1)', () => {
  function draftOn(phase: 'uploads' | 'review') {
    localStorage.setItem('mm_draft_token', 'tok');
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    useConfiguratorStore.getState().setDetails({ city: 'Cluj' });
    useConfiguratorStore.getState().setPhase(phase);
  }

  it('opening the form adds no entry (StrictMode); Back returns a screen, then leaves the page', async () => {
    draftOn('uploads');
    vi.stubGlobal('fetch', vi.fn(async () => response(draft)));
    arrive('/ro/requests/new');
    const before = window.history.length;
    mount();
    await screen.findByText('Uploads step');
    await userEvent.keyboard('{Escape}'); // dialogul „Continui?”
    expect(window.history.length).toBe(before);
    act(() => useConfiguratorStore.getState().setPhase('details'));
    await screen.findByText('Details step');
    await flush();
    expect(window.history.length).toBe(before + 1);
    await browserBack();
    expect(await screen.findByText('Uploads step')).toBeInTheDocument();
    await browserBack();
    expect(window.location.pathname).toBe('/ro/dashboard');
    expect(useConfiguratorStore.getState().phase).toBe('uploads');
  });

  it('"Start a new one" in the resume dialog: Back does not go into the discarded draft', async () => {
    draftOn('uploads');
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => (init?.method === 'POST' ? response({ draftToken: 'fresh' }) : response(draft))));
    arrive('/ro/requests/new');
    mount();
    await screen.findByText(en.Configurator.resume.title);
    act(() => useConfiguratorStore.getState().setPhase('details'));
    await flush();
    await userEvent.click(screen.getByRole('button', { name: en.Configurator.resume.startFresh }));
    await screen.findByText('Ready to choose a start mode');
    expect(readNavEntry(window.history.state)).toMatchObject({ pos: { phase: 'start' }, prev: null });
    await act(async () => {
      window.history.back();
      await waitFor(() => expect(window.location.pathname).toBe('/ro/dashboard'));
    });
    expect(useConfiguratorStore.getState().phase).toBe('start');
    expect(useConfiguratorStore.getState().roomInstances).toEqual([]);
  });

  it('editing a published request: its own history; Back returns a screen, then back to the previous page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    arrive('/ro/requests/req-1/edit');
    const before = window.history.length;
    mount('req-1');
    await screen.findByText('Cart step');
    expect(isInEditSession()).toBe(true);
    expect(window.history.length).toBe(before);
    act(() => useConfiguratorStore.getState().setPhase('uploads'));
    await screen.findByText('Uploads step');
    await flush();
    expect(window.history.length).toBe(before + 1);
    // generatia editarii e separata de a ciornei noi
    expect(sessionStorage.getItem('mm_configurator_nav_v1:edit:req-1')).not.toBeNull();
    await browserBack();
    expect(await screen.findByText('Cart step')).toBeInTheDocument();
    expect(isInEditSession()).toBe(true);
    await browserBack();
    expect(window.location.pathname).toBe('/ro/dashboard');
  });

  it('m15: Back from the browser and the in-page buttons put the focus on the new screen title', async () => {
    draftOn('uploads');
    vi.stubGlobal('fetch', vi.fn(async () => response(draft)));
    arrive('/ro/requests/new');
    mount();
    await screen.findByText('Uploads step');
    await userEvent.keyboard('{Escape}');
    // la incarcare focusul nu se muta
    expect(document.activeElement).toBe(document.body);
    act(() => useConfiguratorStore.getState().setPhase('details'));
    const details = await screen.findByRole('heading', { name: 'Details step' });
    await waitFor(() => expect(document.activeElement).toBe(details));
    expect(details).toHaveAttribute('tabindex', '-1');
    await flush();
    await browserBack();
    const uploads = await screen.findByRole('heading', { name: 'Uploads step' });
    await waitFor(() => expect(document.activeElement).toBe(uploads));
  });

  it('m16: an open dialog closes on Back instead of staying over the new screen', async () => {
    draftOn('uploads');
    vi.stubGlobal('fetch', vi.fn(async () => response(draft)));
    arrive('/ro/requests/new');
    mount();
    await screen.findByText(en.Configurator.resume.title);
    // ecran nou cu dialogul deschis (dialogul „Ai o cerere inceputa”)
    act(() => useConfiguratorStore.getState().setPhase('details'));
    await flush();
    expect(screen.getByText(en.Configurator.resume.title)).toBeInTheDocument();
    await browserBack();
    await waitFor(() => expect(screen.queryByText(en.Configurator.resume.title)).not.toBeInTheDocument());
    expect(await screen.findByText('Uploads step')).toBeInTheDocument();
    // inchiderea = „Continua” (ciorna ramane)
    expect(useConfiguratorStore.getState().roomInstances).toHaveLength(1);
  });

  it('Back from the request page after publishing (several old entries): an empty form, then the page before', async () => {
    localStorage.setItem('mm_draft_token', 'tok');
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    useConfiguratorStore.getState().setPhase('cart');
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => (init?.method === 'POST' ? response({ draftToken: 'fresh' }) : response(draft))));
    arrive('/ro/requests/new');
    const view = mount();
    await screen.findByText('Cart step');
    await userEvent.keyboard('{Escape}');
    for (const phase of ['uploads', 'details', 'review'] as const) {
      act(() => useConfiguratorStore.getState().setPhase(phase));
      await flush();
    }
    await screen.findByText('Review step');
    act(() => hoisted.reviewProps!.onPublished('req-9'));
    // Next navigheaza la pagina cererii
    window.history.pushState({}, '', '/ro/requests/req-9');
    view.unmount();
    expect(useConfiguratorStore.getState().phase).toBe('start');
    // Back de pe pagina cererii: formularul se monteaza pe intrarea veche (Sumar)
    await act(async () => {
      const p = popped();
      window.history.back();
      await p;
    });
    expect(window.location.pathname).toBe('/ro/requests/new');
    mount();
    await screen.findByText('Ready to choose a start mode');
    expect(readNavEntry(window.history.state)).toMatchObject({ pos: { phase: 'start' }, prev: null });
    // al doilea Back trece peste cele 3 intrari vechi, direct la pagina dinainte
    await act(async () => {
      window.history.back();
      await waitFor(() => expect(window.location.pathname).toBe('/ro/dashboard'));
    });
    expect(useConfiguratorStore.getState().phase).toBe('start');
    expect(useConfiguratorStore.getState().roomInstances).toEqual([]);
  });

  it('after publishing, the form entries left in history no longer lead into the request', async () => {
    draftOn('review');
    vi.stubGlobal('fetch', vi.fn(async () => response(draft)));
    arrive('/ro/requests/new');
    mount();
    await screen.findByText('Review step');
    await flush();
    expect(sessionStorage.getItem('mm_configurator_nav_v1:new')).not.toBeNull();
    act(() => hoisted.reviewProps!.onPublished('req-9'));
    expect(sessionStorage.getItem('mm_configurator_nav_v1:new')).toBeNull();
    expect(hoisted.push).toHaveBeenCalledWith('/requests/req-9');
  });
});
