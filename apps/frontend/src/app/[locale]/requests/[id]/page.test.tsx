import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json';
import { leavePublishNotice, PUBLISH_NOTICE_KEY, PUBLISH_NOTICE_TTL_MS } from '@/components/configurator/publish-notice';
import { defaultPieceConfig } from '@marketplace/shared';
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
  // e4: stergerea cu dialogul aplicatiei
  del: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
  replace: vi.fn(),
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
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useRequest: () =>
    state.requestError
      ? { isPending: false, isError: true, error: state.requestError, data: undefined, refetch: vi.fn() }
      : { isPending: false, isError: false, data: state.request },
  useDeleteRequest: () => state.del,
  // E-client-9: cardul "Cine vede cererea" (fara date → nu se randeaza)
  useRequestVisibility: () => ({ data: undefined }),
  useRepostRequest: (id: string) => {
    state.repostId = id;
    return state.repost;
  },
}));
vi.mock('@/components/configurator/attachment-item', () => ({
  AttachmentThumb: ({ attachment }: { attachment: { id: string } }) => <span data-attachment-thumb={attachment.id} />,
}));
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
    hasOwnProject: false,
    includesPaidDesign: false,
    contactPreferences: [],
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
  state.del = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
  state.replace = vi.fn();
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

// d5: fisa cererii reia randurile din Sumar — inclusiv contactele transmise firmelor si un
// singur rand "Cum ai pornit cererea"
describe('request detail sheet repeats the summary rows (d5)', () => {
  it('shows budget, deadline, address, the contacts sent to companies and the start mode', () => {
    state.request = request({
      status: 'IN_MARKETPLACE',
      budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetDeclared: true,
      deadlineBucket: 'ONE_TO_THREE_MONTHS',
      contactPreferences: [
        { id: 'c1', channel: 'EMAIL', value: 'ana@example.test' },
        { id: 'c2', channel: 'PHONE', value: '+40 722 000 000' },
      ],
      rooms: [
        { id: 'r1', roomType: 'KITCHEN', needsDesignHelp: false, answers: { a: 1 }, items: [] },
        { id: 'r2', roomType: 'BATHROOM', needsDesignHelp: true, answers: null, items: [] },
      ],
    });
    renderPage();
    expect(screen.getByText(en.Requests.field.budgetRange)).toBeTruthy();
    expect(screen.getByText(en.Requests.field.addressText)).toBeTruthy();
    expect(screen.getByText(en.Configurator.review.facts.contact)).toBeTruthy();
    expect(screen.getByText(/ana@example\.test/)).toBeTruthy();
    expect(screen.getByText(/\+40 722 000 000/)).toBeTruthy();
    // un singur rand despre mod, cu camerele care au nevoie de ajutor
    expect(screen.getAllByText(en.Configurator.review.facts.mode)).toHaveLength(1);
    expect(screen.getByText(en.Configurator.start.STANDARD.title)).toBeTruthy();
    expect(screen.getByText(new RegExp(en.Configurator.rooms.type.BATHROOM))).toBeTruthy();
    expect(screen.queryByText(en.Requests.field.hasOwnProject)).toBeNull();
  });

  it('own project → "I already have a project"', () => {
    state.request = request({ status: 'IN_MARKETPLACE', hasOwnProject: true });
    renderPage();
    expect(screen.getByText(en.Configurator.start.OWN_PROJECT.title)).toBeTruthy();
  });
});

// d4 (verificarea etapei 7): imaginea 3D a piesei se arata o singura data — in cardul piesei,
// nu si in lista "Atasamente"
describe('request detail attachments', () => {
  const file = (id: string) => ({ id, fileName: `${id}.png`, mimeType: 'image/png', sizeBytes: 10, scanStatus: 'CLEAN', downloadUrl: `https://files.test/${id}.png` });
  const wardrobe = { id: 'r1', roomType: 'PIECE_WARDROBE', flowVersion: 4, needsDesignHelp: false, lengthM: 1, widthM: 0.6, heightM: 2.2, items: [], answers: { config3d: defaultPieceConfig('WARDROBE'), snapshot3d: ['snap'], sketch: ['sketch'] } };

  it('lists the sketch but not the 3D image already shown in the piece card', () => {
    state.request = request({ status: 'IN_MARKETPLACE', rooms: [wardrobe], attachments: [file('snap'), file('sketch')] });
    const { container } = renderPage();
    const section = container.querySelector('[aria-labelledby="request-attachments-title"]') as HTMLElement;
    expect(section.querySelector('[data-attachment-thumb="sketch"]')).not.toBeNull();
    expect(section.querySelector('[data-attachment-thumb="snap"]')).toBeNull();
  });

  it('hides the section when the 3D image is the only file', () => {
    state.request = request({ status: 'IN_MARKETPLACE', rooms: [wardrobe], attachments: [file('snap')] });
    const { container } = renderPage();
    expect(container.querySelector('[aria-labelledby="request-attachments-title"]')).toBeNull();
  });

  it('keeps the image in the list when the card cannot show it (design-help room)', () => {
    state.request = request({ status: 'IN_MARKETPLACE', rooms: [{ ...wardrobe, needsDesignHelp: true }], attachments: [file('snap')] });
    const { container } = renderPage();
    expect(container.querySelector('[data-attachment-thumb="snap"]')).not.toBeNull();
  });
});

// e4: stergerea cu dialogul aplicatiei (nu fereastra browserului), consecintele spuse, apoi
// mesajul de reusita pe lista de cereri
describe('request detail delete dialog (e4)', () => {
  it('explains the consequences and deletes only after "Delete permanently"', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    state.request = request({ status: 'OFFERS_RECEIVED' });
    state.toastSuccess.mockClear();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `${en.Requests.deleteRequest}…` }));
    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(en.Requests.deleteDialog.title)).toBeTruthy();
    expect(within(dialog).getByText(en.Requests.deleteDialog.permanent)).toBeTruthy();
    expect(within(dialog).getByText(en.Requests.deleteDialog.offers)).toBeTruthy();
    expect(within(dialog).getByText(en.Requests.deleteDialog.chats)).toBeTruthy();
    expect(within(dialog).getByText(en.Requests.deleteDialog.credits)).toBeTruthy();
    expect(state.del.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: en.Requests.deleteDialog.confirm }));
    expect(state.del.mutate).toHaveBeenCalledTimes(1);
    const [id, opts] = (state.del.mutate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('req-1');
    opts.onSuccess();
    expect(state.toastSuccess).toHaveBeenCalledWith(en.Requests.deleteDialog.done);
    expect(state.replace).toHaveBeenCalledWith('/requests');
    confirmSpy.mockRestore();
  });

  it('cancel closes the dialog without deleting', () => {
    state.request = request({ status: 'IN_MARKETPLACE' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `${en.Requests.deleteRequest}…` }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en.Requests.deleteDialog.cancel }));
    expect(state.del.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a server error stays in the dialog', () => {
    state.request = request({ status: 'IN_MARKETPLACE' });
    state.del = { ...state.del, error: new ApiError('REQUEST_NOT_DELETABLE', 400, 'nope') };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `${en.Requests.deleteRequest}…` }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeTruthy();
  });
});
