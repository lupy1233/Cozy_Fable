import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json';
import RequestDetailPage from './page';

// E-client-3: repostul nu mai depinde de un token local; dupa un repost folosit,
// explicatie + link catre o cerere noua in locul butonului.
const state = vi.hoisted(() => ({
  request: null as unknown,
  repost: { mutate: vi.fn(), isPending: false, isSuccess: false, error: null as unknown },
  repostId: '' as string,
}));

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'req-1' }) }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useRequest: () => ({ isPending: false, isError: false, data: state.request }),
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
