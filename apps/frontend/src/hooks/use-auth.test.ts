import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { fetchMe } from './use-auth';

// SEC2-11 (E-admin-platform-5): vizitatorul anonim primeste 200 { user: null } de la
// /auth/me; fetchMe il transforma in 401 local, fara niciun apel /auth/refresh.
afterEach(() => vi.unstubAllGlobals());

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('fetchMe', () => {
  it('rejects with a local 401 on { user: null } without calling /auth/refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ user: null }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await fetchMe().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe('UNAUTHORIZED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/me');
  });

  it('resolves the user when a session exists', async () => {
    const user = { id: 'u1', email: 'ana@demo.ro', role: 'CLIENT' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ user })));
    await expect(fetchMe()).resolves.toEqual(user);
  });
});
