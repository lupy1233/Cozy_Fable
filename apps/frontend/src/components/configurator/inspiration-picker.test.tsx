import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_FLOW_VERSION, type InspirationPhotoDto } from '@marketplace/shared';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { InspirationPicker } from './inspiration-picker';

// E-client-34: "Adauga toata colectia" (pana la 10), notitele colectiei in cardurile pozelor.

const photo = (n: number): InspirationPhotoDto => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title: `Photo ${n}`,
  roomType: 'KITCHEN',
  colors: [],
  materials: [],
  systems: [],
  imageUrl: `https://example.test/${n}.jpg`,
  sourceUrl: null,
  company: { id: 'c1', name: 'Firma Test' },
  published: true,
  featured: false,
  createdAt: '2026-09-01T00:00:00Z',
});

const all = Array.from({ length: 12 }, (_, i) => photo(i + 1));

const mocks = vi.hoisted(() => ({ boardPhotos: [] as unknown[] }));
vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ data: { id: 'u1', email: 'a@b.ro' } }) }));
vi.mock('@/hooks/use-inspiration', () => ({
  useInspiration: () => ({ isPending: false, isSuccess: true, data: all }),
}));
vi.mock('@/hooks/use-inspiration-boards', () => ({
  useBoards: () => ({
    isPending: false,
    data: [{ id: 'b1', name: 'Kitchen ideas', itemsCount: 12, coverUrls: [], createdAt: '', updatedAt: '' }],
  }),
  useBoardDetail: (id: string) => ({
    isPending: false,
    data: id
      ? {
          id: 'b1',
          name: 'Kitchen ideas',
          itemsCount: 12,
          coverUrls: [],
          createdAt: '',
          updatedAt: '',
          photos: all,
          items: all.map((p, i) => ({
            photoId: p.id,
            note: i === 0 ? 'Matte fronts' : null,
            roomType: i === 0 ? 'KITCHEN' : null,
          })),
        }
      : undefined,
  }),
}));

function renderPicker() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InspirationPicker />
    </NextIntlClientProvider>,
  );
}

async function openBoard() {
  await userEvent.click(screen.getByRole('button', { name: en.Configurator.inspirationPicker.browse }));
  await userEvent.click(screen.getByRole('button', { name: en.Configurator.inspirationPicker.tabBoards }));
  await userEvent.click(screen.getByRole('button', { name: /Kitchen ideas/ }));
}

describe('InspirationPicker — whole collection', () => {
  beforeEach(() => {
    localStorage.clear();
    const s = useConfiguratorStore.getState();
    s.reset();
    s.loadSnapshot({
      phase: 'review',
      startMode: 'STANDARD',
      roomInstances: [
        { localId: 'k1', roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, answers: {}, completed: false },
      ],
      activeRoomIndex: 0,
      activeStepIndex: 0,
      details: {},
      inspirationPhotoIds: [],
      updatedAt: Date.now(),
    });
  });

  it('adds up to 10 photos from a 12-photo collection and explains the cap', async () => {
    renderPicker();
    await openBoard();
    await userEvent.click(screen.getByRole('button', { name: 'Add the whole collection (12)' }));

    expect(useConfiguratorStore.getState().inspirationPhotoIds).toHaveLength(10);
    expect(screen.getByRole('status')).toHaveTextContent('Added 10 of 12 photos — a request can have at most 10.');
    // plafon atins: butonul e dezactivat
    expect(screen.getByRole('button', { name: 'Add the whole collection (12)' })).toBeDisabled();
  });

  it('keeps the collection note and suggests the only kitchen of the request', async () => {
    renderPicker();
    await openBoard();
    await userEvent.click(screen.getByRole('button', { name: 'Add the whole collection (12)' }));

    const meta = useConfiguratorStore.getState().inspirationMeta ?? {};
    expect(meta[all[0].id]).toEqual({ note: 'Matte fronts', roomLocalId: 'k1' });
    // cardul pozei are notita in textarea (cardurile sunt in pagina, sub dialog)
    const notes = screen.getAllByLabelText(en.Configurator.inspirationPicker.noteLabel);
    expect(notes.some((el) => (el as HTMLTextAreaElement).value === 'Matte fronts')).toBe(true);
    expect(screen.getAllByText(en.Configurator.inspirationPicker.notesVisibleHint).length).toBeGreaterThan(0);
  });

  it('picking a gallery photo shows its card; typing saves the note and clearing drops it', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: en.Configurator.inspirationPicker.browse }));
    await userEvent.click(screen.getByRole('button', { name: /^Photo 1 Photo 1 / }));
    const id = all[0].id;
    expect(useConfiguratorStore.getState().inspirationPhotoIds).toEqual([id]);
    // camera sugerata din tipul pozei (o singura bucatarie in cerere)
    expect(useConfiguratorStore.getState().inspirationMeta?.[id]).toEqual({ roomLocalId: 'k1' });

    // dialogul modal blocheaza pagina: il inchidem ca sa scriem in cardul pozei
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.Configurator.inspirationPicker.confirm) }));
    const note = screen.getAllByLabelText(en.Configurator.inspirationPicker.noteLabel)[0];
    await userEvent.type(note, 'Island');
    expect(useConfiguratorStore.getState().inspirationMeta?.[id]?.note).toBe('Island');
    await userEvent.clear(note);
    expect(useConfiguratorStore.getState().inspirationMeta?.[id]?.note).toBeUndefined();
  });
});
