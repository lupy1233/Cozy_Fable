import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdempotentRunner } from './use-idempotent-api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('stable mutation keys', () => {
  it('preserves the same key after network failure, then starts a fresh intent after success', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network lost')).mockImplementation(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    const request = createIdempotentRunner(async () => 'user-1');
    await expect(request('/purchase', { method: 'POST', body: '{"package":"a"}' })).rejects.toThrow('network lost');
    await request('/purchase', { method: 'POST', body: '{"package":"a"}' });
    await request('/purchase', { method: 'POST', body: '{"package":"a"}' });
    const keys = fetchMock.mock.calls.map(([, options]) => options.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).not.toBe(keys[2]);
  });

  it('scopes retained keys to user identity and the exact payload', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network lost'));
    vi.stubGlobal('fetch', fetchMock);
    let user = 'user-1';
    const request = createIdempotentRunner(async () => user);
    await request('/purchase', { body: 'a' }).catch(() => undefined);
    await request('/purchase', { body: 'b' }).catch(() => undefined);
    user = 'user-2';
    await request('/purchase', { body: 'a' }).catch(() => undefined);
    const keys = fetchMock.mock.calls.map(([, options]) => options.headers['Idempotency-Key']);
    expect(new Set(keys).size).toBe(3);
  });
});

// E-admin-platform-54: 503 DATABASE_BUSY → o singura reincercare automata, cu aceeasi cheie
const errorResponse = (status: number, code: string) =>
  new Response(
    JSON.stringify({ error: { code, message: code, timestamp: new Date().toISOString(), traceId: 't-1' } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
const keysOf = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([, options]) => options.headers['Idempotency-Key']);

describe('DATABASE_BUSY auto-retry', () => {
  it('retries once after 2 s with the same Idempotency-Key and reports the retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, 'DATABASE_BUSY'))
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);
    const onBusyRetry = vi.fn();
    const request = createIdempotentRunner(async () => 'user-1', { onBusyRetry });

    const pending = request('/claims', { method: 'POST', body: '{"requestId":"r1"}' });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = keysOf(fetchMock);
    expect(keys[0]).toBe(keys[1]);
    expect(onBusyRetry).toHaveBeenCalledTimes(1);
  });

  it('gives up after the second DATABASE_BUSY and keeps the key for a manual retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, 'DATABASE_BUSY'))
      .mockResolvedValueOnce(errorResponse(503, 'DATABASE_BUSY'))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const request = createIdempotentRunner(async () => 'user-1', { busyRetryDelayMs: 2_000 });

    const first = request('/claims', { method: 'POST', body: 'a' });
    const outcome = expect(first).rejects.toMatchObject({ code: 'DATABASE_BUSY', status: 503 });
    await vi.advanceTimersByTimeAsync(2_000);
    await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await request('/claims', { method: 'POST', body: 'a' });
    const keys = keysOf(fetchMock);
    expect(new Set(keys).size).toBe(1);
  });

  it('does not auto-retry other server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500, 'INTERNAL_ERROR'));
    vi.stubGlobal('fetch', fetchMock);
    const onBusyRetry = vi.fn();
    const request = createIdempotentRunner(async () => 'user-1', { onBusyRetry });

    await expect(request('/claims', { method: 'POST', body: 'a' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onBusyRetry).not.toHaveBeenCalled();
  });
});
