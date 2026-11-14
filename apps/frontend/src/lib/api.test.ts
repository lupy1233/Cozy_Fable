import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiBlob, refreshSession } from './api';
import { onSessionLost, resetSessionLostForTests } from './session-lost';

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

describe('semnalul „sesiune pierduta” (f3)', () => {
  beforeEach(() => resetSessionLostForTests());

  it('refresh esuat cu mai multe cereri simultane → semnalul pleaca o singura data; erorile merg mai departe', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"error":{"code":"UNAUTHORIZED","message":"Revoked"}}', { status: 401 })));
    vi.stubGlobal('fetch', fetchMock);
    const handler = vi.fn();
    const off = onSessionLost(handler);
    try {
      const results = await Promise.allSettled([api('/requests'), api('/notifications'), api('/auth/me'), apiBlob('/billing/orders/o1/invoice')]);
      expect(results.every((r) => r.status === 'rejected' && (r.reason as ApiError).status === 401)).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toMatchObject({ source: 'api' });
    } finally {
      off();
    }
  });

  it('refresh reusit si cererea reluata reuseste, sau 401 pe login → fara semnal', async () => {
    const handler = vi.fn();
    const off = onSessionLost(handler);
    try {
      let calls = 0;
      vi.stubGlobal('fetch', vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) return Promise.resolve(new Response('{}', { status: 200 }));
        calls += 1;
        return Promise.resolve(new Response(calls === 1 ? '{}' : '{"ok":true}', { status: calls === 1 ? 401 : 200 }));
      }));
      await expect(api('/private')).resolves.toEqual({ ok: true });
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"error":{"code":"INVALID_CREDENTIALS","message":"x"}}', { status: 401 }))));
      await expect(api('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 });
      expect(handler).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it('review M1: refresh reusit, dar cererea reluata primeste tot 401 → semnal', async () => {
    const handler = vi.fn();
    const off = onSessionLost(handler);
    try {
      vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response('{}', { status: url.endsWith('/auth/refresh') ? 200 : 401 }))));
      await expect(api('/requests/r1')).rejects.toMatchObject({ status: 401 });
      expect(handler).toHaveBeenCalledWith({ source: 'api', path: '/requests/r1' });
    } finally {
      off();
    }
  });

  it('review M1: un semnal ignorat de ascultator (false) nu porneste fereastra de 5 s', async () => {
    const seen: string[] = [];
    // ignora tot ce nu vine din /auth/me (ca ascultatorul cand „cine sunt eu” nu e in cache)
    const off = onSessionLost((d) => { seen.push(d.path ?? ''); return d.path === '/auth/me'; });
    try {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))));
      await expect(api('/requests/r1')).rejects.toMatchObject({ status: 401 });
      await expect(api('/auth/me')).rejects.toMatchObject({ status: 401 });
      await expect(api('/notifications')).rejects.toMatchObject({ status: 401 });
      // primul ignorat, al doilea a actionat, al treilea cade in fereastra
      expect(seen).toEqual(['/requests/r1', '/auth/me']);
    } finally {
      off();
    }
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
