import { describe, expect, it } from 'vitest';
import { parseSessionHint } from './session-hint';

// Indiciul de sesiune (cookie mm_session) accepta doar cele 3 roluri, exact.
describe('parseSessionHint', () => {
  it('accepta cele 3 roluri', () => {
    expect(parseSessionHint('CLIENT')).toBe('CLIENT');
    expect(parseSessionHint('COMPANY_USER')).toBe('COMPANY_USER');
    expect(parseSessionHint('ADMIN')).toBe('ADMIN');
  });

  it.each([undefined, null, '', 'admin', 'CLIENT;x', '<script>', ' ADMIN', 'ADMIN '])(
    'respinge %j',
    (raw) => {
      expect(parseSessionHint(raw as string | undefined | null)).toBeNull();
    },
  );
});
