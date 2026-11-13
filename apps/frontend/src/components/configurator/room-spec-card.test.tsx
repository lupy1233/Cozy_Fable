import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { RequestRoomDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { RoomSpecCard } from './room-spec-card';

vi.mock('./piece3d/dynamic', () => ({ PieceViewer3dDialog: () => null }));

function show(room: Partial<RequestRoomDto>, audience?: 'company' | 'client') {
  const full: RequestRoomDto = { id: 'r1', roomType: 'BEDROOM', lengthM: 3, widthM: 0.6, heightM: 2.6, items: [], answers: {}, flowVersion: 2, needsDesignHelp: false, ...room };
  return render(<NextIntlClientProvider locale="ro" messages={ro}><RoomSpecCard room={full} index={1} audience={audience} /></NextIntlClientProvider>);
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

// b8 (PO g0-8): firma vede clar la ce camera i se cere ajutor
describe('RoomSpecCard design help', () => {
  const items = [{ id: 'i1', name: 'Dulap', material: 'PAL' as const, systems: [], description: null, quantity: 1 }];

  it('shows the design-help sign instead of the answers for a flagged room', () => {
    const { container } = show({ needsDesignHelp: true, items });
    expect(screen.getByText(ro.Configurator.roomSpec.designHelpCompany)).toBeVisible();
    expect(container.querySelector('[data-room-design-help]')).not.toBeNull();
    expect(screen.queryByText('Dulap')).not.toBeInTheDocument();
  });

  it('speaks to the client on the client page', () => {
    show({ needsDesignHelp: true }, 'client');
    expect(screen.getByText(ro.Configurator.roomSpec.designHelpClient)).toBeVisible();
  });

  it('shows no sign for a regular room', () => {
    const { container } = show({ items });
    expect(container.querySelector('[data-room-design-help]')).toBeNull();
    expect(screen.getByText('Dulap')).toBeVisible();
  });
});
