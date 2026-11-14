import { StrictMode, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import type { RequestDto } from '@marketplace/shared';
import { discardPendingEditSession, EDIT_RESUME_WINDOW_MS, leaveEditSession, useConfiguratorStore } from '@/stores/configurator-store';
import { buildSnapshotFromRequest, ConfiguratorWizard, startModeFromRequest } from './configurator-wizard';

// Link: antetul modului editare ("Inapoi la cerere") il importa din acelasi modul
const hoisted = vi.hoisted(() => ({
  push: vi.fn(),
  toastSuccess: vi.fn(),
  me: { data: undefined as { role: string; email: string } | undefined },
  reviewProps: null as null | { onPublished: (id: string) => void; onPublishingChange?: (busy: boolean) => void },
}));
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: hoisted.push, replace: vi.fn() }),
  Link: ({ children, href, onClick }: { children: ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));
vi.mock('./start-mode-step', () => ({ StartModeStep: () => <div>Ready to choose a start mode</div> }));
vi.mock('./details-step', () => ({ DetailsStep: () => null }));
vi.mock('./review-step', () => ({
  ReviewStep: (props: NonNullable<typeof hoisted.reviewProps>) => {
    hoisted.reviewProps = props;
    return <div>Review step</div>;
  },
}));
// sesiunea: fara cont, cu exceptia testelor f2 (fara cereri /auth/me in numaratoarea fetch-urilor)
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => hoisted.me,
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: { success: hoisted.toastSuccess } }));
vi.mock('./room-cart-step', () => ({ RoomCartStep: () => null }));
vi.mock('./cart-basket', () => ({ CartBasket: () => null }));
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

  it('does not resume an abandoned edit stored on the server draft by older builds', async () => {
    localStorage.setItem('mm_draft_token', 'existing');
    const stale = { phase: 'cart', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0, details: { city: 'Iași' }, inspirationPhotoIds: [], updatedAt: 1,
      roomInstances: [{ localId: '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b', roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: true }] };
    vi.stubGlobal('fetch', vi.fn(async () => response({ ...draft, configuratorState: stale })));
    mount();
    await screen.findByText('Ready to choose a start mode');
    expect(useConfiguratorStore.getState().roomInstances).toEqual([]);
    expect(screen.queryByText(en.Configurator.resume.title)).not.toBeInTheDocument();
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

// b8: editarea unei cereri publicate
const room = (id: string, needsDesignHelp: boolean, answers: Record<string, unknown> | null = {}) => ({
  id, roomType: 'BATHROOM' as const, lengthM: 0, widthM: 0, heightM: 0, items: [], answers, flowVersion: 1, needsDesignHelp,
});
function requestDto(overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id: 'req-1', status: 'IN_MARKETPLACE', title: 'Baie — Cluj', description: '', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null,
    deadlineBucket: null, includesPaidDesign: true, hasOwnProject: false, addressText: 'Str. 1', county: 'Cluj', city: 'Cluj', country: 'RO',
    lat: null, lng: null, sizing: null, preClaimEditsUsed: 0, postClaimEditsUsed: 0, publishedAt: null, expiresAt: null, repostUsed: false,
    createdAt: '2026-11-13T10:00:00.000Z', rooms: [room('5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b', true)], contactPreferences: [],
    attachments: [], inspirationPhotoIds: [], inspirationPhotos: [], configuratorState: null, ...overrides,
  };
}

describe('start mode of a published request (contract b8 §5)', () => {
  it('reads the mode from the request instead of guessing it', () => {
    expect(startModeFromRequest(requestDto())).toBe('DESIGN_HELP');
    expect(startModeFromRequest(requestDto({ rooms: [room('a', true), room('b', false, { layout: 'X' })] }))).toBe('STANDARD');
    expect(startModeFromRequest(requestDto({ hasOwnProject: true, rooms: [room('a', false)] }))).toBe('OWN_PROJECT');
  });

  it('keeps flagged rooms (without answers) so an "I need help" request can be saved again', () => {
    const snap = buildSnapshotFromRequest(requestDto({ rooms: [room('a', true, null), room('legacy', false, null)] }));
    expect(snap.startMode).toBe('DESIGN_HELP');
    expect(snap.roomInstances.map((r) => [r.localId, r.needsDesignHelp])).toEqual([['a', true]]);
    expect('includesPaidDesign' in snap.details).toBe(false);
  });

  // d3 (PO d3-2): lungimea aproximativa revine la editare, doar cu "Am deja un proiect"
  it('brings back the approximate length of an own-project room', () => {
    const own = buildSnapshotFromRequest(requestDto({ hasOwnProject: true, rooms: [{ ...room('a', false), approxLengthM: 6.5 }] }));
    expect(own.roomInstances[0].approxLengthM).toBe(6.5);
    const standard = buildSnapshotFromRequest(requestDto({ rooms: [{ ...room('a', false, { layout: 'X' }), approxLengthM: 6.5 }] }));
    expect(standard.roomInstances[0].approxLengthM).toBeUndefined();
  });
});

// b11: la editare, suma aleasa de client ramane aleasa; cea dintr-o cerere veche se cere din nou
describe('editing a published request: the budget choice (b11)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConfiguratorStore.getState().reset();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); leaveEditSession(); });

  it('an amount stated by the client (budgetDeclared) stays chosen', () => {
    useConfiguratorStore.getState().loadSnapshot(buildSnapshotFromRequest(requestDto({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true })));
    expect(useConfiguratorStore.getState().details).toMatchObject({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetChosen: true });
  });

  it('an old request (budgetDeclared false) asks for the choice again', () => {
    useConfiguratorStore.getState().loadSnapshot(buildSnapshotFromRequest(requestDto({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000, budgetDeclared: false })));
    expect(useConfiguratorStore.getState().details.budgetRange).toBeUndefined();
    expect(useConfiguratorStore.getState().details.budgetEstimateRon).toBeUndefined();
    // "Prefer sa nu spun" era mereu o alegere a clientului
    useConfiguratorStore.getState().loadSnapshot(buildSnapshotFromRequest(requestDto({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: null, budgetDeclared: false })));
    expect(useConfiguratorStore.getState().details.budgetRange).toBe('UNDISCLOSED');
  });

  it('through the wizard: the edit opens with the declared amount, or without a budget for an old request', async () => {
    const mountEdit = () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      clients.push(client);
      return render(<QueryClientProvider client={client}><NextIntlClientProvider locale="en" messages={en}><ConfiguratorWizard editId="req-1" /></NextIntlClientProvider></QueryClientProvider>);
    };
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true }))));
    const first = mountEdit();
    await waitFor(() => expect(useConfiguratorStore.getState().startMode).toBe('DESIGN_HELP'));
    expect(useConfiguratorStore.getState().details.budgetEstimateRon).toBe(12000);
    first.unmount();
    leaveEditSession();
    sessionStorage.clear();

    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000, budgetDeclared: false }))));
    const second = mountEdit();
    await waitFor(() => expect(useConfiguratorStore.getState().startMode).toBe('DESIGN_HELP'));
    expect(useConfiguratorStore.getState().details.budgetEstimateRon).toBeUndefined();
    expect(useConfiguratorStore.getState().details.city).toBe('Cluj');
    // demontat inainte de curatenie (altfel scrollTo ruleaza dupa ce stub-ul a fost scos)
    second.unmount();
  });
});

describe('edit mode memory (b8 step 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConfiguratorStore.getState().reset();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); });

  it('an abandoned edit leaves the new draft untouched, and passed phases are clickable', async () => {
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    const before = localStorage.getItem('mm_configurator_v1');
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    const view = render(<StrictMode><QueryClientProvider client={client}><NextIntlClientProvider locale="en" messages={en}><ConfiguratorWizard editId="req-1" /></NextIntlClientProvider></QueryClientProvider></StrictMode>);
    const back = await screen.findByRole('button', { name: en.Configurator.phaseGoTo.replace('{phase}', en.Configurator.phases.start) });
    expect(useConfiguratorStore.getState().startMode).toBe('DESIGN_HELP');
    expect(useConfiguratorStore.getState().roomInstances[0].needsDesignHelp).toBe(true);
    await userEvent.click(back);
    expect(await screen.findByText('Ready to choose a start mode')).toBeVisible();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    view.unmount();
    // iesirea fara salvare readuce pe loc ciorna cererii noi; editarea se arunca dupa
    // fereastra de reluare (schimbarea limbii), sau pe loc la intrarea pe /requests/new
    expect(useConfiguratorStore.getState().roomInstances.map((r) => r.roomType)).toEqual(['KITCHEN']);
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    discardPendingEditSession();
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-1')).toBeNull();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
  });

  function mountEdit() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    return render(<StrictMode><QueryClientProvider client={client}><NextIntlClientProvider locale="en" messages={en}><ConfiguratorWizard editId="req-1" /></NextIntlClientProvider></QueryClientProvider></StrictMode>);
  }
  const editKey = 'mm_configurator_edit_v1:req-1';
  const backToStart = () => screen.findByRole('button', { name: en.Configurator.phaseGoTo.replace('{phase}', en.Configurator.phases.start) });
  const pastWindow = () => act(() => new Promise((r) => setTimeout(r, EDIT_RESUME_WINDOW_MS + 100)));

  it('a language switch (unmount + mount of the same edit) keeps the changes; the new draft stays untouched', async () => {
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    const before = localStorage.getItem('mm_configurator_v1');
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    const first = mountEdit();
    await backToStart();
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Brașov' }));
    first.unmount();
    expect(useConfiguratorStore.getState().roomInstances.map((r) => r.roomType)).toEqual(['KITCHEN']);
    // cealalta limba: pagina noua, cache de date nou (layout-ul [locale] se remonteaza)
    mountEdit();
    await backToStart();
    expect(useConfiguratorStore.getState().details.city).toBe('Brașov');
    // fereastra a trecut, dar editarea a fost reluata: nu se mai arunca
    await pastWindow();
    expect(sessionStorage.getItem(editKey)).not.toBeNull();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
  }, 10_000);

  it('leaving for another page throws the edit away once the window has passed; it then starts from the server', async () => {
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    const before = localStorage.getItem('mm_configurator_v1');
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    const first = mountEdit();
    await backToStart();
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Brașov' }));
    first.unmount();
    await pastWindow();
    expect(sessionStorage.getItem(editKey)).toBeNull();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    mountEdit();
    await backToStart();
    expect(useConfiguratorStore.getState().details.city).toBe('Cluj');
  }, 10_000);

  it('m1: "Back to request" throws the edit away at once; "Edit" right after starts from the server', async () => {
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    const before = localStorage.getItem('mm_configurator_v1');
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    const first = mountEdit();
    await backToStart();
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Brașov' }));
    await userEvent.click(screen.getByRole('link', { name: en.Configurator.edit.backToRequest }));
    first.unmount();
    expect(sessionStorage.getItem(editKey)).toBeNull();
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    mountEdit();
    await backToStart();
    expect(useConfiguratorStore.getState().details.city).toBe('Cluj');
  }, 10_000);

  it('after "Save changes" the edit is gone for good, even if the same edit opens right away', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(requestDto())));
    const first = mountEdit();
    await backToStart();
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Brașov' }));
    act(() => useConfiguratorStore.getState().setPhase('review'));
    await screen.findByText('Review step');
    act(() => hoisted.reviewProps!.onPublished('req-1'));
    expect(sessionStorage.getItem(editKey)).toBeNull();
    // pana la plecare ecranul nu se schimba (b3)
    expect(useConfiguratorStore.getState().phase).toBe('review');
    first.unmount();
    mountEdit();
    await backToStart();
    expect(useConfiguratorStore.getState().details.city).toBe('Cluj');
  }, 10_000);
});

// b3: dupa "Publica cererea" formularul nu mai sare la pasul 1 si nu mai salveaza ciorna
describe('after publishing (b3)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConfiguratorStore.getState().reset();
    hoisted.push.mockClear();
    hoisted.toastSuccess.mockClear();
    hoisted.reviewProps = null;
    hoisted.me = { data: undefined };
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); });

  function onReview() {
    localStorage.setItem('mm_draft_token', 'tok');
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    useConfiguratorStore.getState().setDetails({ city: 'Cluj' });
    useConfiguratorStore.getState().setPhase('review');
  }

  it('stops draft saves, keeps the review on screen until it leaves, then starts empty', async () => {
    onReview();
    const patches: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'PATCH') patches.push(String(url));
      return response(draft);
    }));
    const view = mount();
    await screen.findByText('Review step');
    // dialogul "Continui?" de la montare nu ne intereseaza aici
    await userEvent.keyboard('{Escape}');
    act(() => hoisted.reviewProps!.onPublishingChange!(true));
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Iași' }));
    act(() => hoisted.reviewProps!.onPublished('req-9'));
    await new Promise((r) => setTimeout(r, 1800));
    expect(patches).toEqual([]);
    expect(hoisted.push).toHaveBeenCalledWith('/requests/req-9');
    // mesajul nu mai pleaca inainte de navigare: ramane un semn pentru pagina cererii
    expect(hoisted.toastSuccess).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem('mm_publish_notice')!)).toMatchObject({ requestId: 'req-9', kind: 'published' });
    // pana la plecare: tot Sumarul (nu primul pas), dar copia din browser e deja stearsa
    expect(useConfiguratorStore.getState().phase).toBe('review');
    expect(screen.getByText('Review step')).toBeInTheDocument();
    expect(localStorage.getItem('mm_draft_token')).toBeNull();
    expect(localStorage.getItem('mm_configurator_v1')).toBeNull();
    view.unmount();
    expect(useConfiguratorStore.getState().phase).toBe('start');
    expect(useConfiguratorStore.getState().roomInstances).toEqual([]);

    // /requests/new porneste gol, fara "Continui?"
    let posts = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST' ? (++posts, response({ draftToken: 'fresh' })) : response(draft)));
    mount();
    await screen.findByText('Ready to choose a start mode');
    expect(posts).toBe(1);
    expect(screen.queryByText(en.Configurator.resume.title)).not.toBeInTheDocument();
  }, 10_000);

  it('a failed publish lets draft saves run again', async () => {
    onReview();
    const patches: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'PATCH') patches.push(String(url));
      return response(draft);
    }));
    mount();
    await screen.findByText('Review step');
    act(() => hoisted.reviewProps!.onPublishingChange!(true));
    act(() => useConfiguratorStore.getState().setDetails({ city: 'Iași' }));
    act(() => hoisted.reviewProps!.onPublishingChange!(false));
    await waitFor(() => expect(patches.length).toBe(1), { timeout: 3000 });
  }, 10_000);
});

// f2: un cont de firma vede nota de la inceput
describe('non-client account (f2)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); hoisted.me = { data: undefined }; });

  it('shows "requests are published from a client account" at the top of /requests/new', async () => {
    hoisted.me = { data: { role: 'COMPANY_USER', email: 'firma@demo.ro' } };
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST' ? response({ draftToken: 'x' }) : response(draft)));
    mount();
    await screen.findByText('Ready to choose a start mode');
    expect(screen.getByText(en.Configurator.clientOnly.note)).toBeVisible();
    expect(screen.getByRole('button', { name: en.Configurator.clientOnly.logout })).toBeVisible();
  });

  it('a client does not see the note', async () => {
    hoisted.me = { data: { role: 'CLIENT', email: 'ana@demo.ro' } };
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST' ? response({ draftToken: 'x' }) : response(draft)));
    mount();
    await screen.findByText('Ready to choose a start mode');
    expect(screen.queryByText(en.Configurator.clientOnly.note)).not.toBeInTheDocument();
  });
});
