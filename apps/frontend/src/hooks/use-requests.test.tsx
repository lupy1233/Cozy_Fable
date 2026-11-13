import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AttachmentDto, RequestDto } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';
import { usePatchDraft, useRemoveAttachmentFor, useUploadAttachmentFor } from './use-requests';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));
const apiMock = vi.mocked(api);

const att = (id: string): AttachmentDto =>
  ({ id, filename: `${id}.pdf`, mimeType: 'application/pdf', sizeBytes: 2048, status: 'SAFE', downloadUrl: null, createdAt: '' }) as AttachmentDto;
const draft = (ids: string[]) => ({ id: 'r1', status: 'DRAFT', attachments: ids.map(att) }) as unknown as RequestDto;
const KEY = ['request', 'draft', 'tok'];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('useRemoveAttachmentFor (b5 pas 5)', () => {
  beforeEach(() => { apiMock.mockReset(); });

  it('removes the row immediately and an in-flight draft save cannot bring it back', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(KEY, draft(['keep-1', 'gone-1']));
    let finishDelete: () => void = () => {};
    let finishPatch: (v: RequestDto) => void = () => {};
    apiMock.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Promise<void>((r) => { finishDelete = () => r(undefined); }) as never;
      if (init?.method === 'PATCH') return new Promise<RequestDto>((r) => { finishPatch = r; }) as never;
      return Promise.resolve(draft(['keep-1'])) as never;
    });
    const patch = renderHook(() => usePatchDraft('tok'), { wrapper });
    const remove = renderHook(() => useRemoveAttachmentFor({ kind: 'draft', token: 'tok' }), { wrapper });

    // salvarea ciornei pleaca inainte de „Elimină” si se intoarce cu lista veche
    act(() => { patch.result.current.mutate({}); });
    act(() => { remove.result.current.mutate('gone-1'); });
    await waitFor(() => expect(client.getQueryData<RequestDto>(KEY)?.attachments.map((a) => a.id)).toEqual(['keep-1']));

    await act(async () => { finishPatch(draft(['keep-1', 'gone-1'])); });
    await waitFor(() => expect(patch.result.current.isSuccess).toBe(true));
    expect(client.getQueryData<RequestDto>(KEY)?.attachments.map((a) => a.id)).toEqual(['keep-1']);

    await act(async () => { finishDelete(); });
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true));
    expect(client.getQueryData<RequestDto>(KEY)?.attachments.map((a) => a.id)).toEqual(['keep-1']);
  });

  it('a failed delete puts the row back', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(KEY, draft(['keep-2', 'fail-2']));
    apiMock.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.reject(new ApiError('INTERNAL_ERROR', 500, 'boom')) as never;
      // reimprospatarea de dupa esec: serverul inca are fisierul
      return Promise.resolve(draft(['keep-2', 'fail-2'])) as never;
    });
    const remove = renderHook(() => useRemoveAttachmentFor({ kind: 'draft', token: 'tok' }), { wrapper });
    act(() => { remove.result.current.mutate('fail-2'); });
    await waitFor(() => expect(remove.result.current.isError).toBe(true));
    expect(client.getQueryData<RequestDto>(KEY)?.attachments.map((a) => a.id)).toEqual(['keep-2', 'fail-2']);
  });
});

describe('useUploadAttachmentFor (b5)', () => {
  beforeEach(() => { apiMock.mockReset(); });

  it('a file without a browser type is sent with the MIME from its extension (presign + PUT)', async () => {
    const { wrapper } = setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith('/confirm') ? att('x') : { attachmentId: 'x', uploadUrl: 'https://storage.test/u' }) as never);
    const upload = renderHook(() => useUploadAttachmentFor({ kind: 'draft', token: 'tok' }), { wrapper });
    await act(async () => { await upload.result.current.mutateAsync(new File(['%PDF'], 'plan.PDF', { type: '' })); });
    const presign = apiMock.mock.calls.find(([p]) => p === '/requests/drafts/tok/attachments');
    expect(JSON.parse(String(presign?.[1]?.body))).toMatchObject({ filename: 'plan.PDF', mimeType: 'application/pdf' });
    expect(fetchMock).toHaveBeenCalledWith('https://storage.test/u', expect.objectContaining({ headers: { 'Content-Type': 'application/pdf' } }));
    vi.unstubAllGlobals();
  });
});
