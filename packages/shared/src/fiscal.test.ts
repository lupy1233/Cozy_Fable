import { describe, expect, it } from 'vitest';
import { isValidIban, isValidRoCui, normalizeCui, normalizeIban } from './fiscal';

describe('fiscal validators', () => {
  it('accepts valid Romanian CUIs with or without the RO prefix', () => {
    expect(isValidRoCui('RO12345674')).toBe(true);
    expect(isValidRoCui('40298306')).toBe(true);
    expect(isValidRoCui(' ro 12345674 ')).toBe(true);
  });

  it('rejects CUIs with a wrong check digit or malformed input', () => {
    expect(isValidRoCui('RO12345678')).toBe(false);
    expect(isValidRoCui('abc')).toBe(false);
    expect(isValidRoCui('')).toBe(false);
    expect(isValidRoCui('1')).toBe(false);
    expect(isValidRoCui('12345678901')).toBe(false);
  });

  it('normalizes CUI and IBAN input', () => {
    expect(normalizeCui(' ro12345674 ')).toBe('12345674');
    expect(normalizeIban('ro08 test 0000 0000 0000 0001')).toBe('RO08TEST0000000000000001');
  });

  it('validates IBAN checksums (mod-97) and Romanian length', () => {
    expect(isValidIban('RO08TEST0000000000000001')).toBe(true);
    expect(isValidIban('ro08 test 0000 0000 0000 0001')).toBe(true);
    // valoarea din seed trece mod-97 — de aceea readiness compara si cu placeholderele
    expect(isValidIban('RO49AAAA1B31007593840000')).toBe(true);
    expect(isValidIban('RO49AAAA1B31007593840001')).toBe(false);
    expect(isValidIban('RO08TEST000000000000001')).toBe(false);
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('not an iban')).toBe(false);
  });
});
