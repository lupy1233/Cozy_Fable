import { describe, expect, it } from 'vitest';
import { readDimensionCm } from './use-dimension-field';

// b7: citirea campurilor de dimensiune (cm) din pasul 3D
describe('readDimensionCm', () => {
  it('"1,2" (sub 10, cu virgula) se citeste ca metri cand 120 cm intra in limite', () => {
    expect(readDimensionCm('1,2', 60, 600)).toEqual({
      kind: 'number',
      valueCm: 120,
      readCm: 120,
      meters: true,
      clamped: null,
    });
    expect(readDimensionCm('0.6', 35, 80)).toMatchObject({ valueCm: 60, meters: true });
  });

  it('"8,5" la inaltimea unui rand (10–230 cm) ramane cm si e corectat la minim', () => {
    expect(readDimensionCm('8,5', 10, 230)).toEqual({
      kind: 'number',
      valueCm: 10,
      readCm: 8.5,
      meters: false,
      clamped: 'min',
    });
  });

  it('metri in afara limitelor (0,3 m la minim 60 cm) → cm, corectat la minim', () => {
    expect(readDimensionCm('0,3', 60, 600)).toMatchObject({ valueCm: 60, meters: false, clamped: 'min' });
  });

  it('fara separator: "5" e in cm (corectat la minim), "700" corectat la maxim', () => {
    expect(readDimensionCm('5', 60, 600)).toMatchObject({ valueCm: 60, meters: false, clamped: 'min' });
    expect(readDimensionCm('700', 60, 600)).toMatchObject({ valueCm: 600, clamped: 'max' });
  });

  it('gol si text nevalid', () => {
    expect(readDimensionCm('  ', 60, 600)).toEqual({ kind: 'empty' });
    expect(readDimensionCm('1,2,3', 60, 600)).toEqual({ kind: 'invalid' });
  });
});
