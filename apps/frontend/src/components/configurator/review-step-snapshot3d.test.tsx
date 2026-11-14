import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { enterEditSession, leaveEditSession, useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { readEditSnapshotFiles } from '@/stores/edit-snapshot-files';
import { config3dKey } from '@/stores/snapshot3d';
import { ReviewStep } from './review-step';

const OLD = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const NEW = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const hoisted = vi.hoisted(() => ({
  publish: { mutate: vi.fn(), mutateAsync: vi.fn(), error: null as unknown, isPending: false, isSuccess: false, failureCount: 0 },
  attachments: { attachments: [] as Record<string, unknown>[], isSuccess: true, isFetching: false, dataUpdatedAt: 0 },
  remove: vi.fn(async (_id: string): Promise<unknown> => undefined),
  upload: vi.fn(async (_file: File): Promise<{ id: string }> => ({ id: '' })),
  api: vi.fn(async (_path: string, _init?: unknown): Promise<unknown> => undefined),
}));
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: hoisted.api }));
vi.mock('@/components/ui/toaster', () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({ data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useAttachmentsStateFor: () => hoisted.attachments,
  useUploadAttachmentFor: () => ({ mutateAsync: hoisted.upload }),
  useRemoveAttachmentFor: () => ({ mutateAsync: hoisted.remove }),
  usePublishDraft: () => hoisted.publish,
  useEditRequestById: () => hoisted.publish,
  useDraftCoverage: () => ({ data: undefined }),
}));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./inspiration-picker', () => ({ InspirationPicker: () => null }));
vi.mock('./room-answer-summary', () => ({ RoomAnswerSummary: () => null }));
// piesa de test nu are toti pasii completati; aici conteaza doar imaginea
vi.mock('./room-screens', async (orig) => ({ ...(await orig<typeof import('./room-screens')>()), roomIssue: () => null }));

const config = defaultPieceConfig('DESK');
const KEY = config3dKey(config);
const details = {
  budgetRange: 'UNDISCLOSED', budgetChosen: true, addressText: 'Str. 1', county: 'Cluj', city: 'Cluj',
  contactPreferences: [{ channel: 'EMAIL' as const, value: 'ana@demo.ro' }],
};
const s = () => useConfiguratorStore.getState();

function load(room: Partial<RoomInstance>, answers: Record<string, unknown> = {}) {
  s().loadSnapshot({
    ...s().snapshot(),
    startMode: 'STANDARD',
    phase: 'review',
    details,
    roomInstances: [{ localId: 'd', roomType: 'PIECE_DESK', flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK, answers: { config3d: config, ...answers } as never, completed: true, ...room }],
  });
}

function mount(onPublished: (id: string) => void = () => {}, editId?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReviewStep
        token="tok"
        editId={editId}
        uploadTarget={editId ? { kind: 'request', id: editId } : { kind: 'draft', token: 'tok' }}
        onBack={() => {}}
        onEditRoom={() => {}}
        onEditDetails={() => {}}
        onPublished={onPublished}
      />
    </NextIntlClientProvider>,
  );
}

const texts = (en.Configurator.review as unknown as { snapshot3d: Record<string, string> }).snapshot3d;
const payloadAnswers = () =>
  (vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0] as { rooms: { answers: Record<string, unknown> }[] }).rooms[0].answers;

// d4 pasii 2-4: miniatura in Sumar; fara imagine → desenare ascunsa sau mesaj; publicarea merge
describe('ReviewStep — 3D picture of the piece (d4)', () => {
  beforeEach(() => {
    localStorage.clear();
    s().reset();
    // jsdom nu are WebGL: desenarea ascunsa esueaza pe loc
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    hoisted.publish.error = null;
    hoisted.publish.mutateAsync = vi.fn(async () => ({ id: 'req-9', attachments: [] }));
    hoisted.attachments = { attachments: [], isSuccess: true, isFetching: false, dataUpdatedAt: 0 };
    hoisted.remove.mockReset();
    hoisted.remove.mockImplementation(async () => undefined);
    hoisted.upload.mockReset();
    hoisted.upload.mockImplementation(async () => ({ id: NEW }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('a fresh uploaded picture is shown as a thumbnail in the piece card', () => {
    load({ snapshot3dKey: KEY }, { snapshot3d: [OLD] });
    hoisted.attachments.attachments = [{ id: OLD, filename: 'configurare-3d.png', status: 'SAFE', mimeType: 'image/png', downloadUrl: 'https://cdn/x.png' }];
    mount();
    const img = screen.getByRole('img', { name: /3D picture of the piece/ });
    expect(img).toHaveAttribute('src', 'https://cdn/x.png');
    expect(screen.getByText(texts.caption)).toBeVisible();
  });

  it('a capture of the current configuration shows at once and is uploaded to the draft', async () => {
    load({});
    s().setSnapshot3d('d', PNG);
    mount();
    expect(screen.getByRole('img', { name: /3D picture of the piece/ })).toHaveAttribute('src', PNG);
    await waitFor(() => expect(s().roomInstances[0].answers.snapshot3d).toEqual([NEW]));
    expect(hoisted.upload).toHaveBeenCalledTimes(1);
  });

  it('without a picture and without WebGL the card says so, and publishing still works without a picture', async () => {
    load({});
    const onPublished = vi.fn();
    mount(onPublished);
    expect(await screen.findByText(texts.failed)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    expect('snapshot3d' in payloadAnswers()).toBe(false);
  });

  it('a stale picture (configuration changed) never leaves with the request and is deleted from the draft first', async () => {
    load({ snapshot3dKey: 'other-config' }, { snapshot3d: [OLD] });
    hoisted.attachments.attachments = [{ id: OLD, filename: 'configurare-3d.png', status: 'SAFE', mimeType: 'image/png', downloadUrl: 'https://cdn/x.png' }];
    const onPublished = vi.fn();
    mount(onPublished);
    expect(await screen.findByText(texts.failed)).toBeVisible();
    expect(screen.queryByRole('img', { name: /3D picture of the piece/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    expect(hoisted.remove).toHaveBeenCalledWith(OLD);
    expect(hoisted.remove.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(hoisted.publish.mutateAsync).mock.invocationCallOrder[0]);
    expect('snapshot3d' in payloadAnswers()).toBe(false);
  });

  it('while editing, nothing uploads before saving; on save the new picture goes up and the old one is removed after', async () => {
    let saved = false;
    hoisted.publish.mutateAsync = vi.fn(async () => {
      saved = true;
      return { id: 'req-1', attachments: [{ id: OLD }, { id: NEW }] };
    });
    hoisted.remove.mockImplementation(async () => {
      expect(saved).toBe(true);
      return undefined;
    });
    load({ snapshot3dKey: 'other-config' }, { snapshot3d: [OLD] });
    s().setSnapshot3d('d', PNG);
    const onPublished = vi.fn();
    mount(onPublished, 'req-1');
    // nimic nu urca doar pentru ca Sumarul e deschis
    await new Promise((r) => setTimeout(r, 20));
    expect(hoisted.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.saveEdit }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-1'));
    expect(hoisted.upload).toHaveBeenCalledTimes(1);
    expect(payloadAnswers().snapshot3d).toEqual([NEW]);
    expect(hoisted.remove).toHaveBeenCalledWith(OLD);
    expect(hoisted.remove).not.toHaveBeenCalledWith(NEW);
  });

  // revizuire M2: cererea publicata are cel mult o imagine 3D pe piesa
  it('editing: a failed save followed by a successful one still deletes the old picture', async () => {
    let attempt = 0;
    hoisted.publish.mutateAsync = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('down');
      return { id: 'req-1', attachments: [{ id: OLD }, { id: NEW }] };
    });
    load({ snapshot3dKey: 'other-config' }, { snapshot3d: [OLD] });
    s().setSnapshot3d('d', PNG);
    const onPublished = vi.fn();
    mount(onPublished, 'req-1');
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.saveEdit }));
    await waitFor(() => expect(hoisted.publish.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: en.Configurator.review.saveEdit })).toBeEnabled());
    // a doua salvare: imaginea e deja la zi, nimic nu mai urca
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.saveEdit }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-1'));
    expect(hoisted.upload).toHaveBeenCalledTimes(1);
    expect(payloadAnswersAt(1).snapshot3d).toEqual([NEW]);
    expect(hoisted.remove).toHaveBeenCalledWith(OLD);
    expect(hoisted.remove).not.toHaveBeenCalledWith(NEW);
    expect(readEditSnapshotFiles('req-1')).toEqual({ uploads: [], replaced: [] });
  });

  it('editing: a picture uploaded by a failed save is deleted when the edit is abandoned', async () => {
    hoisted.publish.mutateAsync = vi.fn(async () => { throw new Error('down'); });
    enterEditSession('req-1');
    load({ snapshot3dKey: 'other-config' }, { snapshot3d: [OLD] });
    s().setSnapshot3d('d', PNG);
    mount(() => {}, 'req-1');
    fireEvent.click(screen.getByRole('button', { name: en.Configurator.review.saveEdit }));
    await waitFor(() => expect(hoisted.publish.mutateAsync).toHaveBeenCalledTimes(1));
    expect(readEditSnapshotFiles('req-1').uploads).toEqual([NEW]);
    leaveEditSession();
    // imaginea noua (nesalvata) pleaca de pe cerere; cea salvata ramane
    expect(hoisted.api).toHaveBeenCalledWith(`/requests/req-1/attachments/${NEW}`, { method: 'DELETE' });
    expect(hoisted.api).not.toHaveBeenCalledWith(`/requests/req-1/attachments/${OLD}`, expect.anything());
    expect(readEditSnapshotFiles('req-1')).toEqual({ uploads: [], replaced: [] });
  });

  // revizuire m1: stergerea imaginii vechi de pe ciorna se termina inainte de publicare
  it('a new request: deleting the replaced picture finishes before publishing starts', async () => {
    let removed = false;
    hoisted.remove.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      removed = true;
      return undefined;
    });
    hoisted.publish.mutateAsync = vi.fn(async () => {
      expect(removed).toBe(true);
      return { id: 'req-9', attachments: [] };
    });
    // imaginea veche nu e in lista incarcata (abia urcata alta in locul ei)
    load({ snapshot3dKey: 'other-config' }, { snapshot3d: [OLD] });
    s().setSnapshot3d('d', PNG);
    const onPublished = vi.fn();
    mount(onPublished);
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'));
    expect(hoisted.remove).toHaveBeenCalledWith(OLD);
    expect(payloadAnswers().snapshot3d).toEqual([NEW]);
  });
});

const payloadAnswersAt = (call: number) =>
  (vi.mocked(hoisted.publish.mutateAsync).mock.calls[call][0] as { rooms: { answers: Record<string, unknown> }[] }).rooms[0].answers;
