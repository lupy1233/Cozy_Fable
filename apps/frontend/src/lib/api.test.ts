import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiBlob, refreshSession } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('coordinated session refresh', () => {
  it('network-failed refresh recovers on a later independent attempt', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(refreshSession()).resolves.toBe(false);
    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not loop if the resource still rejects after successful refresh', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response('{"error":{"code":"UNAUTHORIZED","message":"Expired"}}', { status: url.endsWith('/auth/refresh') ? 200 : 401 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/private', { method: 'POST', headers: { 'Idempotency-Key': 'fixed-attempt' }, body: '{}' })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const resourceCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/private'));
    expect(resourceCalls).toHaveLength(2);
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      if (call[0].endsWith('/private')) expect(call[1].headers).toMatchObject({ 'Idempotency-Key': 'fixed-attempt', 'Content-Type': 'application/json' });
    }
  });
  it('REST retries and socket renewal share one refresh request', async () => {
    let finishRefresh!: (response: Response) => void;
    const refresh = new Promise<Response>((resolve) => { finishRefresh = resolve; });
    let requests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) return refresh;
      requests += 1;
      return Promise.resolve(new Response(requests === 1 ? '{}' : '{"ok":true}', { status: requests === 1 ? 401 : 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = api('/private');
    const socketRefresh = refreshSession();
    await Promise.resolve();
    finishRefresh(new Response('{}', { status: 200 }));
    await expect(socketRefresh).resolves.toBe(true);
    await expect(request).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('a failed refresh resolves false and does not recursively retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiBlob (E-company-19: descarcare factura prin sesiune)', () => {
  it('401 → refresh → retry → Blob', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":"UNAUTHORIZED","message":"Expired"}}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchMock);
    const blob = await apiBlob('/billing/orders/o1/invoice');
    // Blob din realm-ul fetch (undici), nu din jsdom → verificare prin tag, nu instanceof
    expect(Object.prototype.toString.call(blob)).toBe('[object Blob]');
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('%PDF');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/refresh$/);
  });

  it('404 cu eroare JSON → ApiError cu status 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"code":"PAYMENT_NOT_FOUND","message":"Order not found"}}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const err = await apiBlob('/billing/orders/missing/invoice').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'PAYMENT_NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
