import { describe, expect, it } from 'vitest';
import { buildSecurityTxt } from './security-txt';

describe('buildSecurityTxt', () => {
  const now = new Date('2026-09-29T10:00:00.123Z');

  it('nu publica nimic fara adresa de contact (niciun placeholder)', () => {
    expect(buildSecurityTxt({ siteUrl: 'https://cozy.example', contact: '', now })).toBeNull();
    expect(buildSecurityTxt({ siteUrl: 'https://cozy.example', contact: '   ', now })).toBeNull();
  });

  it('contine Contact, Expires, Preferred-Languages si Canonical, fiecare pe linia ei', () => {
    const body = buildSecurityTxt({ siteUrl: 'https://cozy.example/', contact: 'suport@cozy.example', now });
    expect(body).toBe(
      'Contact: mailto:suport@cozy.example\n' +
        'Expires: 2027-03-28T10:00:00Z\n' +
        'Preferred-Languages: ro, en\n' +
        'Canonical: https://cozy.example/.well-known/security.txt\n',
    );
  });

  it('Expires este la 180 de zile dupa build si sub un an (RFC 9116)', () => {
    const body = buildSecurityTxt({ siteUrl: 'https://cozy.example', contact: 'suport@cozy.example', now }) ?? '';
    const match = /^Expires: (.+)$/m.exec(body);
    expect(match).not.toBeNull();
    const expires = new Date(match?.[1] ?? '');
    const days = (expires.getTime() - now.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(180);
    expect(days).toBeLessThan(365);
  });
});
