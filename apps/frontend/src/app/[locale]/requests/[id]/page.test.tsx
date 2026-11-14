import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json';
import { leavePublishNotice, PUBLISH_NOTICE_KEY, PUBLISH_NOTICE_TTL_MS } from '@/components/configurator/publish-notice';
import { ApiError } from '@/lib/api';
import RequestDetailPage from './page';

// E-client-3: repostul nu mai depinde de un token local; dupa un repost folosit,
// explicatie + link catre o cerere noua in locul butonului.
const state = vi.hoisted(() => ({
  request: null as unknown,
  repost: { mutate: vi.fn(), isPending: false, isSuccess: false, error: null as unknown },
  repostId: '' as string,
  toastSuccess: vi.fn(),
  fulfillment: null as unknown,
  requestError: null as unknown,
  // f3: plasa de siguranta (401 + „cine sunt eu” esuat → login)
  meError: false,
  toLogin: vi.fn(),
}));
vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ isError: state.meError, data: undefined }) }));
vi.mock('@/lib/use-login-redirect', () => ({ useLoginRedirect: () => state.toLogin }));
// e1: "Accepted on" vine din panoul de dupa acceptare
vi.mock('@/hooks/use-fulfillment', () => ({
  useClientFulfillment: () => ({ data: state.fulfillment, isPending: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: { success: state.toastSuccess } }));

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'req-1' }) }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useRequest: () =>
    state.requestError
      ? { isPending: false, isError: true, error: state.requestError, data: undefined, refetch: vi.fn() }
      : { isPending: false, isError: false, data: state.request },
  useDeleteRequest: () => ({ mutate: vi.fn(), isPending: false }),
  // E-client-9: cardul "Cine vede cererea" (fara date → nu se randeaza)
  useRequestVisibility: () => ({ data: undefined }),
  useRepostRequest: (id: string) => {
    state.repostId = id;
    return state.repost;
  },
}));
vi.mock('@/components/configurator/attachment-item', () => ({ AttachmentThumb: () => null }));
vi.mock('@/components/configurator/room-spec-card', () => ({ RoomSpecCard: () => null, RoomSpecNav: () => null }));
vi.mock('@/components/configurator/request-inspiration-by-room', () => ({ RequestInspirationByRoom: () => null }));
vi.mock('@/components/studio/scene-button', () => ({ StudioScenesButton: () => null }));

function request(over: Record<string, unknown>) {
  return {
    id: 'req-1',
    status: 'EXPIRED',
    repostUsed: false,
    title: 'Bucătărie',
    description: '',
    budgetRange: 'UNDISCLOSED',
    deadlineBucket: null,
    addressText: 'Str. X 1',
    city: 'Cluj-Napoca',
    county: 'Cluj',
    expiresAt: null,
    preClaimEditsUsed: 0,
    postClaimEditsUsed: 0,
    rooms: [],
    attachments: [],
    inspirationPhotoIds: [],
    inspirationPhotos: [],
    studioScenes: [],
    ...over,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RequestDetailPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  state.repost = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null };
  state.fulfillment = null;
  state.requestError = null;
  state.meError = false;
  state.toLogin = vi.fn();
});

// e1: "Expires" doar cat cererea asteapta in piata; dupa acceptare "Accepted on <data>"
describe('request detail expiry and acceptance date (e1)', () => {
  const expiresAt = '2026-12-01T10:00:00Z';

  it('shows "Expires" while the request is in the marketplace', () => {
    state.request = request({ status: 'IN_MARKETPLACE', expiresAt });
    renderPage();
    expect(screen.getByText(en.Requests.expiresAt)).toBeTruthy();
    expect(screen.queryByText(en.Requests.acceptedOn)).toBeNull();
  });

  it.each(['CLAIMED_PARTIAL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'ACCEPTED', 'COMPLETED'])(
    'hides "Expires" in %s',
    (status) => {
      state.request = request({ status, expiresAt });
      renderPage();
      expect(screen.queryByText(en.Requests.expiresAt)).toBeNull();
    },
  );

  it('shows "Accepted on <date>" after acceptance, in the app language', () => {
    state.request = request({ status: 'ACCEPTED', expiresAt });
    state.fulfillment = { requestId: 'req-1', acceptedAt: '2026-11-03T10:00:00Z', stages: [] };
    renderPage();
    expect(screen.getByText(en.Requests.acceptedOn)).toBeTruthy();
    expect(screen.getByText('November 3, 2026')).toBeTruthy();
  });

  it('a 401 keeps the loading state instead of "not found"', () => {
    state.requestError = new ApiError('UNAUTHORIZED', 401, 'unauthorized');
    renderPage();
    expect(screen.queryByText(en.Requests.empty)).toBeNull();
    expect(state.toLogin).not.toHaveBeenCalled();
  });

  it('f3: a 401 with a failed who-am-I goes to login instead of staying on the skeleton', () => {
    state.requestError = new ApiError('UNAUTHORIZED', 401, 'unauthorized');
    state.meError = true;
    renderPage();
    expect(state.toLogin).toHaveBeenCalled();
  });

  it('f3: a 404 with a failed who-am-I does not trigger the session safety net', () => {
    state.requestError = new ApiError('NOT_FOUND', 404, 'missing');
    state.meError = true;
    renderPage();
    expect(state.toLogin).not.toHaveBeenCalled();
  });
});

describe('request detail repost section', () => {
  it('shows the hint and the repost button without any local token', () => {
    state.request = request({});
    renderPage();
    expect(screen.getByText(en.Requests.repostHint)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.repost }));
    expect(state.repost.mutate).toHaveBeenCalledTimes(1);
    expect(state.repostId).toBe('req-1');
  });

  it('explains a used repost and links to a new request instead of the button', () => {
    state.request = request({ repostUsed: true });
    renderPage();
    expect(screen.getByText(en.Requests.repostUsedNote)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.Requests.repostStartNew }).getAttribute('href')).toBe('/requests/new');
    expect(screen.queryByRole('button', { name: en.Requests.repost })).toBeNull();
  });

  it('keeps the success message after the status leaves EXPIRED', () => {
    state.request = request({ status: 'IN_MARKETPLACE', repostUsed: true });
    state.repost = { ...state.repost, isSuccess: true };
    renderPage();
    expect(screen.getByText(en.Requests.reposted)).toBeTruthy();
    expect(screen.queryByText(en.Requests.repostUsedNote)).toBeNull();
  });

  it('shows nothing for a live request', () => {
    state.request = request({ status: 'IN_MARKETPLACE' });
    renderPage();
    expect(screen.queryByRole('button', { name: en.Requests.repost })).toBeNull();
    expect(screen.queryByText(en.Requests.repostHint)).toBeNull();
  });
});

// Redesign 2026-11-12: drumul cererii (pasul curent marcat) + banda cu pasul urmator si butonul lui.
describe('request detail journey and next step', () => {
  it('marks the current step and links to the offers when it is the client turn', () => {
    state.request = request({ status: 'OFFERS_RECEIVED' });
    renderPage();
    const steps = within(screen.getByRole('list', { name: 'Request journey' })).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.getAttribute('aria-current'))).toEqual([null, null, 'step', null, null]);
    expect(screen.getByRole('link', { name: en.Requests.viewOffers }).getAttribute('href')).toBe(
      '/requests/req-1/offers',
    );
  });

  it('has no offers link while the request waits in the marketplace', () => {
    state.request = request({ status: 'IN_MARKETPLACE' });
    renderPage();
    const steps = within(screen.getByRole('list', { name: 'Request journey' })).getAllByRole('listitem');
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    expect(screen.queryByRole('link', { name: en.Requests.viewOffers })).toBeNull();
  });

  it('a finished request has every step done and none current', () => {
    state.request = request({ status: 'COMPLETED' });
    renderPage();
    const steps = within(screen.getByRole('list', { name: 'Request journey' })).getAllByRole('listitem');
    expect(steps.some((s) => s.getAttribute('aria-current'))).toBe(false);
    expect(screen.getByRole('link', { name: en.Requests.viewOffers })).toBeTruthy();
  });
});

// b3: mesajul de reusita apare PE pagina cererii, o singura data
describe('request detail success message after publishing', () => {
  beforeEach(() => {
    sessionStorage.clear();
    state.toastSuccess.mockClear();
    state.request = request({ status: 'IN_MARKETPLACE' });
  });
  const renderStrict = () => render(
    <StrictMode>
      <NextIntlClientProvider locale="en" messages={en}>
        <RequestDetailPage />
      </NextIntlClientProvider>
    </StrictMode>,
  );

  it('shows "published" once, then never again (reload, back)', () => {
    leavePublishNotice('req-1', 'published');
    const view = renderStrict();
    expect(state.toastSuccess).toHaveBeenCalledTimes(1);
    expect(state.toastSuccess).toHaveBeenCalledWith(en.Configurator.review.publishedToast);
    expect(sessionStorage.getItem(PUBLISH_NOTICE_KEY)).toBeNull();
    view.unmount();
    renderStrict();
    expect(state.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows "changes saved" after an edit', () => {
    leavePublishNotice('req-1', 'editSaved');
    renderPage();
    expect(state.toastSuccess).toHaveBeenCalledWith(en.Configurator.review.editSavedToast);
  });

  it('without a notice, or with a notice for another request, shows nothing', () => {
    renderPage();
    leavePublishNotice('req-2', 'published');
    renderPage();
    expect(state.toastSuccess).not.toHaveBeenCalled();
  });

  it('an expired notice shows nothing and is cleaned up', () => {
    sessionStorage.setItem(PUBLISH_NOTICE_KEY, JSON.stringify({ requestId: 'req-1', kind: 'published', at: Date.now() - PUBLISH_NOTICE_TTL_MS - 1 }));
    renderPage();
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PUBLISH_NOTICE_KEY)).toBeNull();
  });
});

// b11: aceeasi suma ca in Sumar, in lei, fara trepte
describe('request detail budget (b11)', () => {
  it('shows the chosen amount in lei, not a budget band', () => {
    state.request = request({ status: 'IN_MARKETPLACE', budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true });
    renderPage();
    expect(screen.getByText('12,000 lei')).toBeTruthy();
    expect(screen.queryByText(en.Requests.budget.FROM_5K_TO_15K)).toBeNull();
  });

  // M2: clientul isi vede suma salvata si la o cerere veche (sunt datele lui), sub eticheta neutra
  it('an old request (amount not declared) still shows the client their saved amount under "Budget"', () => {
    state.request = request({ status: 'IN_MARKETPLACE', budgetRange: 'OVER_15K', budgetEstimateRon: 24000, budgetDeclared: false });
    renderPage();
    expect(screen.getByText('24,000 lei')).toBeTruthy();
    expect(screen.getByText(en.Requests.field.budgetRange)).toBeTruthy();
    expect(screen.queryByText(en.Requests.budgetView.declaredLabel)).toBeNull();
  });

  it('"I prefer not to share" and old requests without an amount show "Budget not stated"', () => {
    state.request = request({ status: 'IN_MARKETPLACE', budgetRange: 'UNDER_5K', budgetEstimateRon: null });
    renderPage();
    expect(screen.getByText(en.Requests.budgetView.undisclosed)).toBeTruthy();
    expect(screen.queryByText(en.Requests.budget.UNDER_5K)).toBeNull();
  });
});
