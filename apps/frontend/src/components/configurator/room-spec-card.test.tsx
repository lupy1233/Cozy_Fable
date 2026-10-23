import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { RequestRoomDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { RoomSpecCard } from './room-spec-card';

vi.mock('./piece3d/dynamic', () => ({ PieceViewer3dDialog: () => null }));

function show(room: Partial<RequestRoomDto>) {
  const full: RequestRoomDto = { id: 'r1', roomType: 'BEDROOM', lengthM: 3, widthM: 0.6, heightM: 2.6, items: [], answers: {}, flowVersion: 2, ...room };
  return render(<NextIntlClientProvider locale="ro" messages={ro}><RoomSpecCard room={full} index={1} /></NextIntlClientProvider>);
}

describe('RoomSpecCard dimensions', () => {
  it('shows "Dimensiuni nespecificate" instead of a zero-length footprint', () => {
    const { container } = show({ lengthM: 0 });
    expect(screen.getByText('Dimensiuni nespecificate')).toBeVisible();
    expect(container.textContent).not.toContain('0 ×');
  });

  it('keeps the L × W × H footprint when every dimension is known', () => {
    show({ lengthM: 3.2 });
    expect(screen.getByText('3.2 × 0.6 × 2.6 m')).toBeVisible();
    expect(screen.queryByText('Dimensiuni nespecificate')).not.toBeInTheDocument();
  });
});
