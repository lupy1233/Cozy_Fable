import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIRECT, isSafeRedirect, safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it.each([
    '/requests/abc?x=1',
    '/requests/new',
    '/dashboard',
    '/inspiration/boards',
    '/change-password#top',
    // query / fragment liber: „//” si „\” acolo nu schimba destinatia
    '/requests/abc?x=1&y=//z',
    '/requests/abc?back=%2F%2Fz',
    '/requests/abc#//z',
    '/requests/abc?p=..%2F..',
    // puncte care nu sunt segmente intregi
    '/requests/a.b/c..d/.well',
  ])('pastreaza calea interna %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
    expect(isSafeRedirect(path)).toBe(true);
  });

  it.each([
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'https://evil.com',
    'http://localhost:3000/dashboard',
    'javascript:alert(1)',
    'evil.com',
    'requests/new',
    '/\t/evil.com',
    '/\n/evil.com',
    '/foo\\..\\..\\evil',
    '',
    '/' + 'a'.repeat(600),
  ])('respinge %j si intoarce /dashboard', (value) => {
    expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
    expect(isSafeRedirect(value)).toBe(false);
  });

  // revizuire etapa 2: „//”, „\” oriunde in cale si segmentele „.” / „..”, si codate
  it.each([
    '/..//evil.com',
    '/requests//evil.com',
    '/requests/abc//',
    '/requests\\abc',
    '/requests/abc\\?x=1',
    '/..',
    '/../dashboard',
    '/requests/../admin',
    '/requests/./new',
    '/requests/.',
    '/%2e%2e//evil.com',
    '/%2E%2E/dashboard',
    '/requests/%2e/new',
    '/requests/.%2e/admin',
    '/%5cevil.com',
    '/requests%5C%5Cevil',
    '/%2f%2fevil.com',
    '/requests/%2F%2Fevil',
    '/%252e%252e/dashboard',
    '/%25252e%25252e/dashboard',
    '/requests/%E0%A4%A',
  ])('respinge in partea de cale %j', (value) => {
    expect(isSafeRedirect(value)).toBe(false);
    expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
  });

  it('null / undefined → fallback; fallback-ul se poate schimba', () => {
    expect(safeRedirect(null)).toBe('/dashboard');
    expect(safeRedirect(undefined)).toBe('/dashboard');
    expect(safeRedirect('//evil.com', '/login')).toBe('/login');
  });
});
