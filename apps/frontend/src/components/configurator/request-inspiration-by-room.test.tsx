import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_MASK_TOKEN, type InspirationPhotoDto } from '@marketplace/shared';
import en from '@/messages/en.json';
import { RequestInspirationByRoom } from './request-inspiration-by-room';

// E-client-34: inspiratia pe cerere, grupata pe camere, cu notita clientului.

const byIds = vi.hoisted(() => ({ value: { isPending: false, data: [] as InspirationPhotoDto[] } }));
vi.mock('@/hooks/use-inspiration', () => ({ useInspirationByIds: () => byIds.value }));

const photo = (id: string, title: string): InspirationPhotoDto => ({
  id,
  title,
  roomType: 'KITCHEN',
  colors: [],
  materials: [],
  systems: [],
  imageUrl: `https://example.test/${id}.jpg`,
  sourceUrl: null,
  company: { id: 'c1', name: 'Firma Test' },
  published: true,
  featured: false,
  createdAt: '2026-09-01T00:00:00Z',
});

const rooms = [
  { id: 'room-kitchen', roomType: 'KITCHEN' as const },
  { id: 'room-living', roomType: 'LIVING' as const },
];

function renderIt(photos: Parameters<typeof RequestInspirationByRoom>[0]['photos']) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RequestInspirationByRoom photos={photos} rooms={rooms} />
    </NextIntlClientProvider>,
  );
}

describe('RequestInspirationByRoom', () => {
  beforeEach(() => {
    byIds.value = { isPending: false, data: [photo('p1', 'Kitchen A'), photo('p2', 'Living B'), photo('p3', 'General C')] };
  });

  it('groups by room in room order and puts the whole-home group last', () => {
    renderIt([
      { photoId: 'p3', note: null, requestRoomId: null },
      { photoId: 'p2', note: 'Love the shelves', requestRoomId: 'room-living' },
      { photoId: 'p1', note: 'Matte fronts', requestRoomId: 'room-kitchen' },
    ]);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['1. Kitchen', '2. Living room', 'For the whole home']);
    expect(screen.getByText('Matte fronts')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'See room' }).map((a) => a.getAttribute('href'))).toEqual([
      '#room-1',
      '#room-2',
    ]);
  });

  it('shows a single list without group titles when every photo is general (old requests)', () => {
    renderIt([
      { photoId: 'p1', note: null, requestRoomId: null },
      { photoId: 'p2', note: null, requestRoomId: null },
    ]);
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('renders the masked contact token as a localized label', () => {
    renderIt([{ photoId: 'p1', note: `call me ${CONTACT_MASK_TOKEN}, matte`, requestRoomId: 'room-kitchen' }]);
    const quote = screen.getByText(/call me/).closest('blockquote')!;
    expect(within(quote).getByText(en.ContactMask.hidden)).toBeInTheDocument();
    expect(quote.textContent).not.toContain(CONTACT_MASK_TOKEN);
  });

  it('a photo withdrawn from the gallery keeps its note on a placeholder; without a note it is omitted', () => {
    byIds.value = { isPending: false, data: [photo('p1', 'Kitchen A')] };
    renderIt([
      { photoId: 'gone-with-note', note: 'Keep this idea', requestRoomId: 'room-kitchen' },
      { photoId: 'gone-no-note', note: null, requestRoomId: 'room-kitchen' },
      { photoId: 'p1', note: null, requestRoomId: 'room-kitchen' },
    ]);
    expect(screen.getByText('Keep this idea')).toBeInTheDocument();
    expect(screen.getAllByText(en.Inspiration.imageUnavailable)).toHaveLength(1);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('renders nothing for an empty list', () => {
    const { container } = renderIt([]);
    expect(container).toBeEmptyDOMElement();
  });
});
