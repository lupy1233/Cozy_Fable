import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp, cspFromEnv, httpsOrigin, parseOrigins } from './csp';

function directive(csp: string, name: string): string {
  return csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';
}

describe('buildCsp (E-admin-platform-56)', () => {
  it('uses the nonce and strict-dynamic, never unsafe-inline for scripts', () => {
    const csp = buildCsp({ nonce: 'abc123' })!;
    const script = directive(csp, 'script-src');
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('report-uri /csp-report');
    expect(csp).toContain('report-to csp');
  });

  it('narrows img-src and connect-src when storage origins are set', () => {
    const csp = buildCsp({ nonce: 'n', storageOrigins: ['https://bucket.example.eu'], extraImgOrigins: ['https://img.example.org'] })!;
    const img = directive(csp, 'img-src').split(' ');
    const connect = directive(csp, 'connect-src').split(' ');
    expect(img).not.toContain('https:');
    expect(connect).not.toContain('https:');
    expect(connect).not.toContain('wss:');
    expect(img).toContain('https://bucket.example.eu');
    expect(img).toContain('https://img.example.org');
    expect(img).toContain('https://cdn.prod.website-files.com');
    expect(connect).toContain('https://bucket.example.eu');
    expect(connect).toContain('https://places.googleapis.com');
  });

  it('keeps the broad fallback without storage origins', () => {
    const csp = buildCsp({ nonce: 'n' })!;
    expect(directive(csp, 'img-src')).toBe("img-src 'self' data: blob: https:");
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https: wss: blob:");
  });

  it('adds the analytics origin only when it is https', () => {
    const withHttps = buildCsp({ nonce: 'n', storageOrigins: ['https://s.example'], analyticsOrigin: httpsOrigin('https://stats.example.com/') })!;
    expect(directive(withHttps, 'connect-src')).toContain('https://stats.example.com');
    const withHttp = buildCsp({ nonce: 'n', storageOrigins: ['https://s.example'], analyticsOrigin: httpsOrigin('http://stats.example.com') })!;
    expect(directive(withHttp, 'connect-src')).not.toContain('stats.example.com');
  });

  it('returns null in dev', () => {
    expect(buildCsp({ nonce: 'n', dev: true })).toBeNull();
  });
});

describe('parseOrigins', () => {
  it('normalizes https origins and drops invalid or non-https entries', () => {
    expect(parseOrigins(' https://a.example.com/path , http://b.example.com, nope, https://a.example.com ,')).toEqual([
      'https://a.example.com',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe('cspFromEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is null outside production and reads the build-time origins in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(cspFromEnv('n')).toBeNull();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_STORAGE_ORIGIN', 'https://bucket.example.eu/uploads');
    vi.stubEnv('NEXT_PUBLIC_CSP_IMG_ORIGINS', 'https://img.example.org');
    const csp = cspFromEnv('n')!;
    expect(directive(csp, 'img-src')).toContain('https://bucket.example.eu');
    expect(directive(csp, 'img-src')).toContain('https://img.example.org');
  });
});
