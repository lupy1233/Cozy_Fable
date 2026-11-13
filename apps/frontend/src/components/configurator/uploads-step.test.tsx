import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { AttachmentDto } from '@marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { UploadsStep } from './uploads-step';

const SKETCH = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const PROJECT = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
let attachments: AttachmentDto[] = [];

vi.mock('./inspiration-picker', () => ({ InspirationPicker: () => null }));
// lista vine din mock; incarcarea si stergerea folosesc hookurile reale (b5)
vi.mock('@/hooks/use-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-requests')>()),
  useAttachmentsFor: () => attachments,
}));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));
const apiMock = vi.mocked(api);

function file(id: string, filename: string, status: AttachmentDto['status']): AttachmentDto {
  return { id, filename, status, mimeType: 'application/pdf', sizeBytes: 2048 } as AttachmentDto;
}

function upload(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en}>
        <UploadsStep target={{ kind: 'draft', token: 't' }} onBack={() => {}} onContinue={() => {}} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const reasons = en.Configurator.uploads.rejectReason;
const rejectedList = (container: HTMLElement) => container.querySelector('[data-upload-rejected]') as HTMLElement;
const dropzone = () => screen.getByRole('button', { name: en.Configurator.uploads.dropLabel });

describe('UploadsStep — own project and room files (E-client-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.mockReset();
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setDetails({ hasOwnProject: true });
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'OWN_PROJECT',
      phase: 'uploads',
      roomInstances: [{ localId: 'bed', roomType: 'BEDROOM', flowVersion: 2, answers: { sketch: [SKETCH] }, completed: true }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('blocks Continue until a SAFE project file exists', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'PENDING_SCAN')];
    mount();
    expect(screen.getByRole('button', { name: en.Configurator.nav.continue })).toBeDisabled();
    expect(screen.getByText(en.Configurator.uploads.projectRequired)).toBeVisible();
    expect(screen.getByRole('button', { name: en.Configurator.uploads.switchToGuided })).toBeVisible();
  });

  it('enables Continue with a SAFE project file', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'SAFE')];
    mount();
    expect(screen.getByRole('button', { name: en.Configurator.nav.continue })).toBeEnabled();
  });

  it('lists room sketches read-only and project files with remove', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'SAFE')];
    const { container } = mount();
    const roomFiles = container.querySelector('[data-room-files]') as HTMLElement;
    expect(within(roomFiles).getByText('sketch.pdf')).toBeVisible();
    expect(within(roomFiles).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Configurator.uploads.removeFile.replace('{name}', 'project.pdf') })).toBeVisible();
    expect(screen.queryByRole('button', { name: en.Configurator.uploads.removeFile.replace('{name}', 'sketch.pdf') })).not.toBeInTheDocument();
  });

  // b6: schitele unei camere scoase din cos nu devin "fisierele proiectului"
  it('the sketch of a removed room is not listed as a project file', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'SAFE')];
    act(() => useConfiguratorStore.getState().removeRoom('bed'));
    expect(useConfiguratorStore.getState().discardedFiles).toEqual([SKETCH]);
    mount();
    expect(screen.queryByText('sketch.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('project.pdf')).toBeVisible();
  });

  // E-client-9 (C7-3): avertismentul ca fisierele sunt vizibile firmelor inainte de preluare
  it('shows the pre-claim visibility notice above the dropzone', () => {
    attachments = [];
    const { container } = mount();
    const notice = container.querySelector('[data-uploads-visibility]') as HTMLElement;
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent(en.Configurator.uploads.visibilityNotice);
  });
});

// b5: fisierele respinse nu mai dispar fara mesaj
describe('UploadsStep — rejected files (b5)', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.mockReset();
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      phase: 'uploads',
      roomInstances: [{ localId: 'bed', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: true }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows how many file slots are left (10 + 8 per room, minus files already added)', () => {
    attachments = [file(PROJECT, 'project.pdf', 'SAFE')];
    const { container } = mount();
    // 1 camera → 18 locuri, 1 folosit
    expect(container.querySelector('[data-upload-slots]')).toHaveTextContent('You can add 17 more files.');
  });

  it('a .txt and a 30 MB file dropped in the zone are listed with the reason, without calling the server', () => {
    attachments = [];
    const { container } = mount();
    fireEvent.drop(dropzone(), {
      dataTransfer: { files: [upload('notes.txt', 'text/plain', 10), upload('huge.pdf', 'application/pdf', 30 * 1024 * 1024)] },
    });
    const list = rejectedList(container);
    expect(within(list).getByText(en.Configurator.uploads.rejectedTitle)).toBeVisible();
    expect(within(list).getByText('notes.txt')).toBeVisible();
    expect(within(list).getByText(reasons.TYPE)).toBeVisible();
    expect(within(list).getByText('huge.pdf')).toBeVisible();
    expect(within(list).getByText(reasons.SIZE)).toBeVisible();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('three files at once, one refused by the server: the other two appear, the refused one has a message', async () => {
    attachments = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    let n = 0;
    apiMock.mockImplementation((async (path: string, init?: RequestInit) => {
      if (path.endsWith('/attachments') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { filename: string };
        if (body.filename === 'b.pdf') throw new ApiError('FILE_TOO_LARGE', 400, 'Invalid file size');
        n += 1;
        return { attachmentId: `id-${body.filename}`, uploadUrl: `https://storage.test/${n}` };
      }
      if (path.endsWith('/confirm')) {
        const id = path.split('/').at(-2) as string;
        const done = file(id, id.replace('id-', ''), 'SAFE');
        attachments = [...attachments, done];
        return done;
      }
      return undefined;
    }) as typeof api);
    const { container } = mount();
    fireEvent.drop(dropzone(), {
      dataTransfer: { files: [upload('a.pdf', 'application/pdf', 100), upload('b.pdf', 'application/pdf', 100), upload('c.pdf', 'application/pdf', 100)] },
    });
    await waitFor(() => expect(screen.getByText('c.pdf')).toBeVisible());
    expect(screen.getByText('a.pdf')).toBeVisible();
    const list = rejectedList(container);
    expect(within(list).getByText('b.pdf')).toBeVisible();
    expect(within(list).getByText(reasons.SIZE)).toBeVisible();
    expect(within(list).queryByText('a.pdf')).not.toBeInTheDocument();
    // pe rand: cererile de link nu pornesc toate deodata
    const presigns = apiMock.mock.calls.filter(([p, i]) => p.endsWith('/attachments') && i?.method === 'POST');
    expect(presigns.map(([, i]) => JSON.parse(String(i?.body)).filename)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('a network error offers "Try again" and the retry uploads the file', async () => {
    attachments = [];
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    apiMock.mockImplementation((async (path: string, init?: RequestInit) => {
      if (path.endsWith('/attachments') && init?.method === 'POST') return { attachmentId: 'id-net', uploadUrl: 'https://storage.test/u' };
      if (path.endsWith('/confirm')) {
        const done = file('id-net', 'net.pdf', 'SAFE');
        attachments = [done];
        return done;
      }
      return undefined;
    }) as typeof api);
    const { container } = mount();
    fireEvent.drop(dropzone(), { dataTransfer: { files: [upload('net.pdf', 'application/pdf', 100)] } });
    const retry = await screen.findByRole('button', { name: en.Configurator.uploads.retry });
    expect(within(rejectedList(container)).getByText(reasons.NETWORK)).toBeVisible();
    await act(async () => { fireEvent.click(retry); });
    await waitFor(() => expect(container.querySelector('[data-upload-rejected]')).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a file blocked by the scan is listed with the reason and removed from the request', async () => {
    attachments = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    apiMock.mockImplementation((async (path: string, init?: RequestInit) => {
      if (path.endsWith('/attachments') && init?.method === 'POST') return { attachmentId: 'id-bad', uploadUrl: 'https://storage.test/u' };
      if (path.endsWith('/confirm')) return file('id-bad', 'bad.png', 'BLOCKED');
      return undefined;
    }) as typeof api);
    const { container } = mount();
    fireEvent.drop(dropzone(), { dataTransfer: { files: [upload('bad.png', 'image/png', 85)] } });
    await waitFor(() => expect(within(rejectedList(container)).getByText(reasons.SCAN)).toBeVisible());
    expect(within(rejectedList(container)).getByText('bad.png')).toBeVisible();
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/requests/drafts/t/attachments/id-bad', { method: 'DELETE' }));
  });
});

// m8: fisierele camerelor scoase nu ocupa locuri
describe('UploadsStep — slots ignore files of removed rooms (m8)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'STANDARD',
      phase: 'uploads',
      roomInstances: [
        { localId: 'a', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: true },
        { localId: 'b', roomType: 'BEDROOM', flowVersion: 2, answers: { sketch: [SKETCH] }, completed: true },
      ],
    });
  });

  it('after removing a room with a sketch, the sketch no longer takes a slot', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE')];
    act(() => useConfiguratorStore.getState().removeRoom('b'));
    const { container } = mount();
    // 10 + 8 pentru o camera, niciun fisier ramas
    expect(container.querySelector('[data-upload-slots]')).toHaveTextContent('You can add 18 more files.');
  });
});
