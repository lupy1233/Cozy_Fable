import { describe, expect, it } from 'vitest';
import { formatDecimal, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it.each([
    ['1,6', 1.6],
    ['1.6', 1.6],
    [' 150,5 ', 150.5],
    ['0', 0],
    ['2,', 2],
    [',5', 0.5],
    ['1 50', 150],
  ])('citeste %j ca %d', (raw, value) => {
    expect(parseDecimal(raw)).toEqual({ kind: 'number', value });
  });

  it.each(['1,2,3', '1.2,3', 'abc', '1,6m', '-2', '+2', '1e3', ',', '.'])('respinge %j', (raw) => {
    expect(parseDecimal(raw)).toEqual({ kind: 'invalid' });
  });

  it('textul gol sau doar spatii e "gol", nu zero', () => {
    expect(parseDecimal('')).toEqual({ kind: 'empty' });
    expect(parseDecimal('   ')).toEqual({ kind: 'empty' });
  });
});

describe('formatDecimal', () => {
  it('afiseaza virgula in romana si punctul in engleza', () => {
    expect(formatDecimal(1.6, 'ro')).toBe('1,6');
    expect(formatDecimal(150.5, 'ro')).toBe('150,5');
    expect(formatDecimal(1.6, 'en')).toBe('1.6');
  });

  it('fara grupare de mii si fara artefacte float', () => {
    expect(formatDecimal(1505, 'ro')).toBe('1505');
    expect(formatDecimal(0.1 + 0.2, 'ro')).toBe('0,3');
    expect(formatDecimal(150.50000001, 'ro', 1)).toBe('150,5');
    expect(formatDecimal(2, 'ro')).toBe('2');
  });

  it('valoarea formatata se poate reciti', () => {
    for (const v of [0.05, 1.6, 2.45, 150.5, 1234.5]) {
      for (const locale of ['ro', 'en']) {
        expect(parseDecimal(formatDecimal(v, locale))).toEqual({ kind: 'number', value: v });
      }
    }
  });
});
