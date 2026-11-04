import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMonitoringRateLimit } from '@/lib/monitoring-rate-limit';
import { POST } from './route';

const DSN = 'https://pub@o1.ingest.example/42';

function envelope(dsn: string, extra = '') {
  return `${JSON.stringify({ event_id: 'abc', dsn })}\n{"type":"event"}\n{"exception":{}}${extra}`;
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/monitoring', {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': '203.0.113.9', ...headers },
  });
}

describe('POST /monitoring (tunel tracker)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetMonitoringRateLimit();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('404 fara DSN configurat', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const res = await POST(post(envelope(DSN)));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 pentru un DSN diferit (nu e proxy deschis)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    expect((await POST(post(envelope('https://pub@evil.example/42')))).status).toBe(400);
    expect((await POST(post(envelope('https://pub@o1.ingest.example/7')))).status).toBe(400);
    expect((await POST(post('not json'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trimite envelope-ul valid la furnizor, fara IP-ul clientului', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    const body = envelope(DSN);
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://o1.ingest.example/api/42/envelope/');
    expect(init.body).toBe(body);
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-sentry-envelope' });
    expect(JSON.stringify(init)).not.toContain('203.0.113.9');
  });

  it('502 cand furnizorul raspunde cu eroare sau nu raspunde', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect((await POST(post(envelope(DSN)))).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect((await POST(post(envelope(DSN)))).status).toBe(502);
  });

  it('413 peste 256 kB', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    const big = envelope(DSN, 'x'.repeat(300 * 1024));
    expect((await POST(post(big))).status).toBe(413);
    expect((await POST(post(envelope(DSN), { 'content-length': String(1024 * 1024) }))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('429 peste 60 envelope-uri pe minut', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    for (let i = 0; i < 60; i++) expect((await POST(post(envelope(DSN)))).status).toBe(200);
    expect((await POST(post(envelope(DSN)))).status).toBe(429);
  });
});
