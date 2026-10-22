import { afterEach, describe, expect, it, vi } from 'vitest';
import { maskPath, maskText, scrubClientEvent } from './monitoring';

describe('maskPath', () => {
  it('masca tokenurile si id-urile din cale si scoate query-ul', () => {
    expect(maskPath('/ro/requests/drafts/AbCdEf1234567890xyz')).toBe('/ro/requests/drafts/:token');
    expect(maskPath('/en/requests/3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab')).toBe('/en/requests/:id');
    expect(maskPath('/ro/reset-password?token=secret')).toBe('/ro/reset-password');
    expect(maskPath('/ro/marketplace')).toBe('/ro/marketplace');
  });
});

describe('maskText', () => {
  it('scoate emailuri, telefoane, id-uri, tokenuri si query-uri', () => {
    const text = maskText(
      'Fail for ana.popescu@demo.ro tel 0722123456 id 3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab at https://x.test/a?token=abc',
    );
    expect(text).not.toContain('ana.popescu');
    expect(text).not.toContain('0722123456');
    expect(text).not.toContain('3f2b8c1e');
    expect(text).not.toContain('token=abc');
    expect(text).toContain('[email]');
    expect(text).toContain('[n]');
    expect(text).toContain('[id]');
    expect(maskText('x y '.repeat(200))).toHaveLength(300);
  });
});

describe('scrubClientEvent', () => {
  it('pastreaza doar originea + calea mascata, fara cookie, user, breadcrumbs sau variabile', () => {
    const event = scrubClientEvent({
      request: {
        url: 'https://cozy.test/ro/requests/drafts/AbCdEf1234567890xyz?email=a@b.ro',
        headers: { Cookie: 'mm_access=secret', 'User-Agent': 'x' },
        cookies: { mm_access: 'secret' },
        query_string: 'email=a@b.ro',
      },
      user: { email: 'ana.popescu@demo.ro' },
      breadcrumbs: [{ message: 'ana.popescu@demo.ro' }],
      extra: { body: 'secret' },
      tags: { route: '/ro/x', digest: '123', email: 'ana.popescu@demo.ro' },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'bad ana.popescu@demo.ro',
            stacktrace: { frames: [{ filename: 'app:///_next/a.js?v=1', vars: { a: 1 }, context_line: 'secret' }] },
          },
        ],
      },
    });
    const serialized = JSON.stringify(event);
    for (const leaked of ['mm_access', 'secret', 'ana.popescu', 'a@b.ro', 'AbCdEf1234567890xyz']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(event.request).toEqual({ url: 'https://cozy.test/ro/requests/drafts/:token' });
    expect(event.tags).toEqual({ route: '/ro/x', digest: '123' });
    expect(event.exception.values[0].type).toBe('Error');
    expect(event.exception.values[0].stacktrace.frames[0]).toEqual({ filename: 'app:///_next/a.js' });
  });
});

describe('reportClientError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('@sentry/browser');
  });

  it('nu face nimic fara DSN', async () => {
    const captureException = vi.fn();
    vi.doMock('@sentry/browser', () => ({ captureException, withScope: vi.fn() }));
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const { reportClientError } = await import('./monitoring');
    reportClientError(new Error('x'), 'locale');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('trimite eroarea cu ruta mascata, digest si boundary cand DSN-ul e setat', async () => {
    const setTags = vi.fn();
    const captureException = vi.fn();
    const withScope = vi.fn((fn: (scope: { setTags: typeof setTags }) => void) => fn({ setTags }));
    vi.doMock('@sentry/browser', () => ({ captureException, withScope }));
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://pub@o1.ingest.example/42');
    const { reportClientError } = await import('./monitoring');
    const error = Object.assign(new Error('boom'), { digest: 'd1' });
    reportClientError(error, 'global');
    expect(setTags).toHaveBeenCalledWith({ route: '/', digest: 'd1', boundary: 'global' });
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
