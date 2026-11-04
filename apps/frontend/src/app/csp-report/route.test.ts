import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCspReportRateLimit } from '@/lib/csp-report';
import { POST } from './route';

const UUID = '3f2a9c1e-7b4d-4e8f-9a1b-2c3d4e5f6a7b';

function post(body: string, type = 'application/csp-report') {
  return new Request('http://localhost:3000/csp-report', {
    method: 'POST',
    body,
    headers: { 'content-type': type, 'x-forwarded-for': '203.0.113.9' },
  });
}

const legacy = JSON.stringify({
  'csp-report': {
    'document-uri': `https://www.example.test/ro/requests/${UUID}?token=SECRETQUERYTOKEN123`,
    'effective-directive': 'script-src-elem',
    'violated-directive': 'script-src-elem',
    'blocked-uri': 'https://evil.example.net/x.js?leak=1',
    'script-sample': 'alert(document.cookie)',
  },
});

const reportsJson = JSON.stringify([
  {
    type: 'csp-violation',
    url: `https://www.example.test/en/requests/${UUID}?draft=abc`,
    body: {
      documentURL: `https://www.example.test/en/requests/${UUID}?draft=SECRETQUERYTOKEN123`,
      effectiveDirective: 'img-src',
      blockedURL: 'https://images.example.org/photo.jpg?sig=zzz',
      sample: '',
    },
  },
  { type: 'deprecation', body: { id: 'x' } },
]);

describe('POST /csp-report', () => {
  const warn = vi.fn();

  beforeEach(() => {
    resetCspReportRateLimit();
    warn.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(warn);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the legacy format with a masked path and no query, sample or IP', async () => {
    const res = await POST(post(legacy));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      evt: 'csp_violation',
      directive: 'script-src-elem',
      blocked: 'https://evil.example.net',
      page: '/ro/requests/:id',
    });
    expect(line).not.toMatch(/SECRETQUERYTOKEN|leak|alert|203\.0\.113\.9|token=/);
  });

  it('logs the reports+json format and ignores non-CSP reports', async () => {
    const res = await POST(post(reportsJson, 'application/reports+json'));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      evt: 'csp_violation',
      directive: 'img-src',
      blocked: 'https://images.example.org',
      page: '/en/requests/:id',
    });
    expect(line).not.toMatch(/SECRETQUERYTOKEN|sig=|draft=/);
  });

  it('answers 204 without logging for a body over 16 KB', async () => {
    const huge = JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src', pad: 'x'.repeat(17 * 1024) } });
    const res = await POST(post(huge));
    expect(res.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers 204 without logging for invalid JSON or an unknown content type', async () => {
    expect((await POST(post('{not json'))).status).toBe(204);
    expect((await POST(post(legacy, 'text/plain'))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stops logging after 60 reports inside the window', async () => {
    for (let i = 0; i < 61; i += 1) {
      const res = await POST(post(legacy));
      expect(res.status).toBe(204);
    }
    expect(warn).toHaveBeenCalledTimes(60);
  });

  it('keeps inline/eval markers and truncates long directives', async () => {
    const body = JSON.stringify({
      'csp-report': { 'document-uri': 'https://www.example.test/ro', 'violated-directive': `${'x'.repeat(100)} 'self'`, 'blocked-uri': 'inline' },
    });
    await POST(post(body));
    const parsed = JSON.parse(String(warn.mock.calls[0][0]));
    expect(parsed.blocked).toBe('inline');
    expect(parsed.directive).toHaveLength(64);
    expect(parsed.page).toBe('/ro');
  });
});
