import { fireEvent, render, screen } from '@testing-library/react';
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
