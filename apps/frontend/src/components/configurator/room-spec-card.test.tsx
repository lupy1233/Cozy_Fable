import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { defaultPieceConfig, type AttachmentDto, type RequestRoomDto } from '@marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIMENSION_UNIT_STORAGE_KEY } from '@/lib/dimension-unit';
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
    // c4: firma vede dimensiunile in cm; metrii liniari raman in m (D2)
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('Mobilier: ~2,4 m liniari · Tavan: 265 cm');
    const noCeiling = show({ lengthM: 2.4, heightM: 2.6, answers: { piecesNeeded: ['WARDROBE'] } });
    expect(noCeiling.container.querySelector('[data-room-spec-header]')?.textContent).toBe('Mobilier: ~2,4 m liniari');
  });

  // m4: formularul manual de dinainte de configurator — dimensiunile sunt ale clientului
  it('a legacy room (no questionnaire answers) keeps the client-written L × W × H', () => {
    const { container } = show({ answers: null, flowVersion: null, lengthM: 4.5, widthM: 3.2, heightM: 2.6 });
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('450 × 320 × 260 cm');
    expect(container.textContent).not.toContain('m liniari');
    const unknown = show({ answers: null, flowVersion: null, lengthM: 4.5, widthM: 0, heightM: 2.6 });
    expect(unknown.container.querySelector('[data-room-spec-header]')?.textContent).toBe('Dimensiuni nespecificate');
  });

  it('a piece has no room header (its size is already in its own details)', () => {
    const { container } = show({ roomType: 'PIECE_BENCH', lengthM: 1.2, widthM: 0.4, heightM: 0.45, flowVersion: 2 });
    expect(container.querySelector('[data-room-spec-header]')).toBeNull();
  });
});

// c4 (PO c4-1): firma vede mereu centimetri; clientul, unitatea aleasa in formular
describe('RoomSpecCard units', () => {
  const answers = { piecesNeeded: ['WARDROBE'], dimensions: { wardrobeWidth: 2.455, ceilingHeight: 2.65 } };
  afterEach(() => localStorage.clear());

  it('the company always sees centimetres, whatever this browser remembers', () => {
    localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'm');
    const { container } = show({ lengthM: 2.4, answers });
    expect(container.textContent).toContain('245,5 cm');
    expect(container.textContent).toContain('Tavan: 265 cm');
    expect(container.textContent).not.toContain('2,455');
  });

  it('the client sees the unit chosen in the form (m)', () => {
    localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'm');
    const { container } = show({ lengthM: 2.4, answers }, 'client');
    expect(container.textContent).toContain('2,455 m');
    expect(container.textContent).toContain('Tavan: 2,65 m');
  });

  it('the client sees centimetres when nothing is remembered (other device, old request)', () => {
    const { container } = show({ lengthM: 2.4, answers }, 'client');
    expect(container.textContent).toContain('245,5 cm');
  });

  it('a legacy room on the client page follows the client unit too', () => {
    localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'm');
    const { container } = show({ answers: null, flowVersion: null, lengthM: 4.5, widthM: 3.2, heightM: 2.6 }, 'client');
    expect(container.querySelector('[data-room-spec-header]')?.textContent).toBe('4,5 × 3,2 × 2,6 m');
  });
});

// b10: pilulele folosesc eticheta scurta de rezumat, nu intrebarea intreaga
describe('RoomSpecCard short labels', () => {
  it('shows "Formă" instead of "Ce formă are bucătăria?"', () => {
    const { container } = show({ roomType: 'KITCHEN', flowVersion: 4, lengthM: 3, answers: { layout: 'STRAIGHT', hasIsland: false } });
    expect(container.textContent).toContain(ro.Configurator.flows.KITCHEN.layout.summaryLabel);
    expect(container.textContent).not.toContain(ro.Configurator.flows.KITCHEN.layout.title);
  });
});

// d4: imaginea 3D a piesei apare o singura data, in cardul piesei
describe('RoomSpecCard 3D image', () => {
  const snap = { id: 'snap-1', fileName: 'piesa.png', mimeType: 'image/png', sizeBytes: 10, scanStatus: 'CLEAN', downloadUrl: 'https://files.test/snap-1.png' } as unknown as AttachmentDto;
  it('shows the 3D image of a configured piece', () => {
    const { container } = render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <RoomSpecCard
          room={{ id: 'r1', roomType: 'PIECE_WARDROBE', lengthM: 1, widthM: 0.6, heightM: 2.2, items: [], flowVersion: 4, needsDesignHelp: false, answers: { config3d: defaultPieceConfig('WARDROBE'), snapshot3d: ['snap-1'] } }}
          index={1}
          attachments={[snap]}
        />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector('img[src="https://files.test/snap-1.png"]')).not.toBeNull();
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

// d3 (PO d3-2): lungimea aproximativa data cu "Am deja un proiect"
describe('RoomSpecCard approximate length', () => {
  it('shows "Lungime aproximativă: 6 m" when the client gave it', () => {
    const { container } = show({ roomType: 'KITCHEN', lengthM: 0, approxLengthM: 6 });
    expect(container.querySelector('[data-room-approx-length]')?.textContent).toBe('Lungime aproximativă: 6 m');
    const decimal = show({ roomType: 'KITCHEN', lengthM: 0, approxLengthM: 6.5 });
    expect(decimal.container.querySelector('[data-room-approx-length]')?.textContent).toBe('Lungime aproximativă: 6,5 m');
  });

  it('shows nothing without the field', () => {
    const { container } = show({ roomType: 'KITCHEN', lengthM: 0, approxLengthM: null });
    expect(container.querySelector('[data-room-approx-length]')).toBeNull();
  });
});
