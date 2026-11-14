import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CURRENT_FLOW_VERSION } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { FILE_REMOVAL_TIMEOUT_MS, ReviewStep } from './review-step';

const hoisted = vi.hoisted(() => ({
  me: { data: undefined as { email: string; role: string } | undefined, isPending: false },
  publish: { mutate: vi.fn(), mutateAsync: vi.fn(), error: null as unknown, isPending: false, isSuccess: false, failureCount: 0 },
  attachments: { attachments: [] as { id: string; filename: string; status: string }[], isSuccess: true, isFetching: false, dataUpdatedAt: 0 },
  remove: vi.fn(async (_id: string): Promise<unknown> => undefined),
  upload: vi.fn(),
  toastWarning: vi.fn(),
  // a6: raspunsul POST drafts/:token/coverage (undefined = nimic inca / eroare)
  coverage: { data: undefined as { coverage: 'COVERED' | 'NONE' | 'UNKNOWN' } | undefined },
  coverageArgs: [] as unknown[][],
}));
vi.mock('@/components/ui/toaster', () => ({ toast: { warning: hoisted.toastWarning, success: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => hoisted.me,
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useAttachmentsStateFor: () => hoisted.attachments,
  useUploadAttachmentFor: () => ({ mutateAsync: hoisted.upload }),
  useRemoveAttachmentFor: () => ({ mutateAsync: hoisted.remove }),
  usePublishDraft: () => hoisted.publish,
  useEditRequestById: () => hoisted.publish,
  useDraftCoverage: (...args: unknown[]) => {
    hoisted.coverageArgs.push(args);
    return hoisted.coverage;
  },
}));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./inspiration-picker', () => ({ InspirationPicker: () => null }));
vi.mock('./review-room-card', () => ({ ReviewRoomCard: () => null }));

function mount(onPublished: (id: string) => void = () => {}, editId?: string, onEditDetails: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReviewStep
        token="tok"
        editId={editId}
        uploadTarget={editId ? { kind: 'request', id: editId } : { kind: 'draft', token: 'tok' }}
        onBack={() => {}}
        onEditRoom={() => {}}
        onEditDetails={onEditDetails}
        onPublished={onPublished}
      />
    </NextIntlClientProvider>,
  );
}

// f2: doar un cont de client publica cereri
describe('ReviewStep — who can publish (f2)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setStartMode('STANDARD');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    hoisted.publish.error = null;
    hoisted.attachments = { attachments: [], isSuccess: true, isFetching: false, dataUpdatedAt: 0 };
  });

  it('a company account sees the note instead of the publish button', () => {
    hoisted.me = { data: { email: 'firma@demo.ro', role: 'COMPANY_USER' }, isPending: false };
    mount();
    expect(screen.getByText(en.Configurator.clientOnly.note)).toBeVisible();
    expect(screen.getByRole('button', { name: en.Configurator.clientOnly.logout })).toBeVisible();
    expect(screen.queryByRole('button', { name: en.Requests.publish })).not.toBeInTheDocument();
  });

  it('an admin sees the note too; a client sees the button', () => {
    hoisted.me = { data: { email: 'admin@demo.ro', role: 'ADMIN' }, isPending: false };
    const view = mount();
    expect(screen.getByText(en.Configurator.clientOnly.note)).toBeVisible();
    view.unmount();
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    mount();
    expect(screen.queryByText(en.Configurator.clientOnly.note)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Requests.publish })).toBeInTheDocument();
  });

  it('shows the server refusal REQUEST_PUBLISH_CLIENT_ONLY with its own text', () => {
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    hoisted.publish.error = new ApiError('REQUEST_PUBLISH_CLIENT_ONLY' as never, 403, 'Only clients');
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent(en.Configurator.apiErrors.REQUEST_PUBLISH_CLIENT_ONLY);
  });

  // revizuire etapa 2: piesa din Studio bifata "cere ajutor" e refuzata de server
  const studioText = (en.Configurator.validation as Record<string, string>).designHelpWithStudioPiece;
  it.skipIf(!studioText)('shows the Studio piece refusal like any validation error', () => {
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    hoisted.publish.error = new ApiError('VALIDATION_ERROR' as never, 400, 'Studio', [
      { roomIndex: 0, field: 'needsDesignHelp', messageKey: 'validation.designHelpWithStudioPiece' },
    ]);
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent(studioText);
  });
});

// M1 + m7: poza 3D a unei camere bifate si fisierele camerelor scoase nu pleaca la firme
describe('ReviewStep — files that must not reach companies (M1, m7)', () => {
  const PNG = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
  const file = (id: string) => ({ id, filename: 'configurare-3d.png', status: 'SAFE' });
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    hoisted.publish.error = null;
    hoisted.publish.mutateAsync = vi.fn(async () => ({ id: 'req-9', attachments: [] }));
    hoisted.attachments = { attachments: [file(PNG)], isSuccess: true, isFetching: false, dataUpdatedAt: 0 };
    hoisted.remove.mockReset();
    hoisted.remove.mockImplementation(async () => undefined);
    hoisted.toastWarning.mockClear();
    // scenariul din revizie: piesa configurata 3D, poza urcata la o publicare esuata,
    // apoi camera bifata "am nevoie de ajutor"
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'STANDARD',
      phase: 'review',
      details: { budgetRange: 'UNDISCLOSED', addressText: 'Str. 1', county: 'Cluj', city: 'Cluj', contactPreferences: [{ channel: 'EMAIL', value: 'ana@demo.ro' }] },
      roomInstances: [
        { localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: true },
        { localId: 'p', roomType: 'PIECE_DESK', flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK, answers: { snapshot3d: [PNG] }, completed: true, needsDesignHelp: true },
      ],
    });
    // camera nebifata trebuie sa fie completa; o bifam si pe ea ca Sumarul sa permita publicarea
    useConfiguratorStore.getState().setRoomDesignHelp('k', true);
  });

  it('the 3D picture of a flagged room is not a project file and is deleted from the draft before publishing', async () => {
    const onPublished = vi.fn();
    mount(onPublished);
    expect(screen.queryByText(en.Configurator.review.filesTitle)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    expect(hoisted.remove).toHaveBeenCalledWith(PNG);
    // camera bifata pleaca fara poza
    const payload = vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0] as { rooms: { answers: Record<string, unknown> }[] };
    expect(payload.rooms.every((r) => !('snapshot3d' in r.answers))).toBe(true);
  });

  it('if the files cannot be removed, the request is not published and a retry is offered', async () => {
    hoisted.remove.mockImplementation(async () => {
      throw new ApiError('INTERNAL_ERROR' as never, 500, 'down');
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    expect(await screen.findByText(en.Configurator.review.cleanupFailed)).toBeVisible();
    expect(hoisted.publish.mutateAsync).not.toHaveBeenCalled();
    hoisted.remove.mockImplementation(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.cleanupRetry }));
    await waitFor(() => expect(hoisted.publish.mutateAsync).toHaveBeenCalledTimes(1));
  });

  it('a file list that is not loaded yet blocks publishing too; a file already gone (404) counts as removed', async () => {
    hoisted.attachments = { ...hoisted.attachments, isSuccess: false };
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    expect(await screen.findByText(en.Configurator.review.cleanupFailed)).toBeVisible();
    view.unmount();
    hoisted.attachments = { ...hoisted.attachments, isSuccess: true };
    hoisted.remove.mockImplementation(async () => {
      throw new ApiError('NOT_FOUND' as never, 404, 'gone');
    });
    const onPublished = vi.fn();
    mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
  });

  it('while editing, nothing is removed before saving, and a removal that never answers does not hold "Saving" forever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let saved = false;
      hoisted.publish.mutateAsync = vi.fn(async () => {
        saved = true;
        return { id: 'req-1', attachments: [file(PNG)] };
      });
      hoisted.remove.mockImplementation(() => {
        expect(saved).toBe(true);
        return new Promise(() => {});
      });
      const onPublished = vi.fn();
      mount(onPublished, 'req-1');
      fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.saveEdit }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(hoisted.publish.mutateAsync).toHaveBeenCalled();
      expect(hoisted.remove).toHaveBeenCalledWith(PNG);
      expect(onPublished).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FILE_REMOVAL_TIMEOUT_MS + 10);
      });
      expect(onPublished).toHaveBeenCalledWith('req-1');
      expect(hoisted.toastWarning).toHaveBeenCalledWith(en.Configurator.review.filesLeftWarning);
    } finally {
      vi.useRealTimers();
    }
  });
});

// a6 (PO a6-1 / a6-2): nicio firma in zona → avertisment inaintea butonului, publicarea ramane posibila
describe('ReviewStep — no company in the area (a6)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    hoisted.publish.error = null;
    hoisted.publish.mutateAsync = vi.fn(async () => ({ id: 'req-9', attachments: [] }));
    hoisted.attachments = { attachments: [], isSuccess: true, isFetching: false, dataUpdatedAt: 0 };
    hoisted.coverageArgs = [];
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'DESIGN_HELP',
      phase: 'review',
      details: {
        budgetRange: 'UNDISCLOSED', budgetChosen: true, addressText: 'Str. 1', county: 'Cluj', city: 'Cluj',
        contactPreferences: [{ channel: 'EMAIL', value: 'ana@demo.ro' }],
      },
      roomInstances: [{ localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: true, needsDesignHelp: true }],
    });
  });

  afterEach(() => {
    hoisted.coverage = { data: undefined };
  });

  it('NONE: the warning shows before "Publish", without any number, and publishing still works', async () => {
    hoisted.coverage = { data: { coverage: 'NONE' } };
    const onPublished = vi.fn();
    mount(onPublished);
    const warning = screen.getByTestId('no-coverage-warning');
    expect(warning).toHaveTextContent(en.Requests.visibility.noCoverage.title);
    expect(warning).toHaveTextContent(en.Requests.visibility.noCoverage.reviewBody);
    expect(warning.textContent).not.toMatch(/\d/);
    // avertismentul sta inaintea butonului
    const button = screen.getByRole('button', { name: en.Requests.publish });
    expect(warning.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    // intrebarea pleaca cu tokenul ciornei si adresa din Detalii
    expect(hoisted.coverageArgs[0]).toEqual(['tok', { addressText: 'Str. 1', city: 'Cluj', county: 'Cluj', country: 'RO' }]);
  });

  it.each([
    ['COVERED', { coverage: 'COVERED' as const }],
    ['UNKNOWN', { coverage: 'UNKNOWN' as const }],
    ['no answer / error', undefined],
  ])('%s: no warning', (_label, data) => {
    hoisted.coverage = { data };
    mount();
    expect(screen.queryByTestId('no-coverage-warning')).not.toBeInTheDocument();
  });

  it('while editing a published request nothing is asked and nothing is shown', () => {
    hoisted.coverage = { data: { coverage: 'NONE' } };
    mount(() => {}, 'req-1');
    expect(hoisted.coverageArgs[0]?.[0]).toBeNull();
    expect(screen.queryByTestId('no-coverage-warning')).not.toBeInTheDocument();
  });
});

// b11 (PO 2026-11-13): bugetul ales de client face parte din Date generale
describe('ReviewStep — the budget must be chosen (b11)', () => {
  const details = { addressText: 'Str. 1', county: 'Cluj', city: 'Cluj', contactPreferences: [{ channel: 'EMAIL' as const, value: 'ana@demo.ro' }] };
  function load(extra: Record<string, unknown>) {
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'DESIGN_HELP',
      phase: 'review',
      details: { ...details, ...extra },
      roomInstances: [{ localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: true, needsDesignHelp: true }],
    });
  }
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    hoisted.me = { data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false };
    hoisted.publish.error = null;
    hoisted.publish.mutateAsync = vi.fn(async () => ({ id: 'req-9', attachments: [] }));
    hoisted.attachments = { attachments: [], isSuccess: true, isFetching: false, dataUpdatedAt: 0 };
  });

  it('a draft without a chosen budget cannot be published; "Edit" sends the client to the general details', () => {
    load({});
    const onEditDetails = vi.fn();
    mount(() => {}, undefined, onEditDetails);
    expect(screen.getByRole('button', { name: en.Requests.publish })).toBeDisabled();
    expect(screen.getAllByText(en.Configurator.review.detailsIncomplete).length).toBeGreaterThan(0);
    // randul Buget din Sumar: necompletat, nu o treapta pusa din oficiu
    expect(screen.getByText(en.Requests.field.budgetRange).nextElementSibling).toHaveTextContent(en.Configurator.review.facts.notProvided);
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.edit }));
    expect(onEditDetails).toHaveBeenCalledTimes(1);
    expect(hoisted.publish.mutateAsync).not.toHaveBeenCalled();
  });

  it('a chosen amount is sent as declared, with the band derived as on the server', async () => {
    load({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetChosen: true });
    const onPublished = vi.fn();
    mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    expect(vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0]).toMatchObject({
      budgetRange: 'FROM_5K_TO_15K',
      budgetEstimateRon: 12000,
      budgetDeclared: true,
    });
  });

  it('"I prefer not to share" is published as undisclosed, never as a default band', async () => {
    load({ budgetRange: 'UNDISCLOSED', budgetChosen: true });
    const onPublished = vi.fn();
    mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    const payload = vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ budgetRange: 'UNDISCLOSED', budgetDeclared: false });
    expect(payload.budgetEstimateRon).toBeUndefined();
  });

  // b12: blocul / apartamentul pleaca la publicare; gol = nu se trimite
  it('sends the building / apartment field, trimmed; an empty one is left out', async () => {
    load({ budgetRange: 'UNDISCLOSED', budgetChosen: true, addressDetails: '  bl. A2, ap. 14 ' });
    const onPublished = vi.fn();
    const first = mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0]).toMatchObject({ addressDetails: 'bl. A2, ap. 14' });
    first.unmount();
    load({ budgetRange: 'UNDISCLOSED', budgetChosen: true, addressDetails: '   ' });
    mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(hoisted.publish.mutateAsync).toHaveBeenCalledTimes(2));
    expect((vi.mocked(hoisted.publish.mutateAsync).mock.calls[1][0] as Record<string, unknown>).addressDetails).toBeUndefined();
  });
});
