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

  // d1: antetul nu mai prezinta numere calculate drept "L × l × H" al camerei
  it('shows the furniture linear meters, not a made-up L × W × H footprint', () => {
    const { container } = show({ lengthM: 5.6 });
    const header = container.querySelector('[data-room-spec-header]');
    expect(header?.textContent).toBe('Mobilier: ~5,6 m liniari');
    expect(container.textContent).not.toContain('× 0.6');
    expect(container.textContent).not.toMatch(/\d\s*×\s*\d/);
  });

  it('adds the ceiling height only when the client gave it', () => {
    const { container } = show({ lengthM: 2.4, answers: { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.65 } } });
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('Mobilier: ~2,4 m liniari · Tavan: 2,65 m');
    const noCeiling = show({ lengthM: 2.4, heightM: 2.6, answers: { piecesNeeded: ['WARDROBE'] } });
    expect(noCeiling.container.querySelector('[data-room-spec-header]')?.textContent).toBe('Mobilier: ~2,4 m liniari');
  });

  // m4: formularul manual de dinainte de configurator — dimensiunile sunt ale clientului
  it('a legacy room (no questionnaire answers) keeps the client-written L × W × H', () => {
    const { container } = show({ answers: null, flowVersion: null, lengthM: 4.5, widthM: 3.2, heightM: 2.6 });
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('4,5 × 3,2 × 2,6 m');
    expect(container.textContent).not.toContain('m liniari');
    const unknown = show({ answers: null, flowVersion: null, lengthM: 4.5, widthM: 0, heightM: 2.6 });
    expect(unknown.container.querySelector('[data-room-spec-header]')?.textContent).toBe('Dimensiuni nespecificate');
  });

  it('a piece has no room header (its size is already in its own details)', () => {
    const { container } = show({ roomType: 'PIECE_BENCH', lengthM: 1.2, widthM: 0.4, heightM: 0.45, flowVersion: 2 });
    expect(container.querySelector('[data-room-spec-header]')).toBeNull();
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
    // d1: semnul spune ca detaliile se stabilesc cu firma, o singura data
    expect(screen.getAllByText(ro.Configurator.roomSpec.designHelpDetails)).toHaveLength(1);
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('Dimensiuni nespecificate');
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
