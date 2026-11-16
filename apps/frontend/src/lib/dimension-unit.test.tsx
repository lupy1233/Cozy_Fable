import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIMENSION_UNIT_STORAGE_KEY,
  readDimensionUnit,
  rememberDimensionUnit,
  useDimensionUnitPreference,
} from './dimension-unit';

function Probe() {
  return <span data-testid="unit">{useDimensionUnitPreference()}</span>;
}

afterEach(() => {
  window.localStorage.clear();
});

describe('preferinta de unitate (D1)', () => {
  it('implicit cm; valoare necunoscuta → cm', () => {
    expect(readDimensionUnit()).toBe('cm');
    window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'km');
    expect(readDimensionUnit()).toBe('cm');
  });

  it('rememberDimensionUnit scrie cheia si o citeste inapoi', () => {
    rememberDimensionUnit('m');
    expect(window.localStorage.getItem('cozy.dimensionUnit')).toBe('m');
    expect(readDimensionUnit()).toBe('m');
  });

  it('hook-ul porneste din localStorage si se schimba la rememberDimensionUnit', () => {
    window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, 'mm');
    render(<Probe />);
    expect(screen.getByTestId('unit').textContent).toBe('mm');
    act(() => rememberDimensionUnit('m'));
    expect(screen.getByTestId('unit').textContent).toBe('m');
  });

  it('stocare blocata → cm, fara exceptie', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberDimensionUnit('m')).not.toThrow();
    expect(readDimensionUnit()).toBe('cm');
    render(<Probe />);
    expect(screen.getByTestId('unit').textContent).toBe('cm');
  });
});
