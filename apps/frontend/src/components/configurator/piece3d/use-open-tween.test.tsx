import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpenTween } from './use-open-tween';

const harness = vi.hoisted(() => ({ frame: () => {}, priority: 0, invalidate: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: unknown) => unknown) => selector({ invalidate: harness.invalidate }),
  useFrame: (frame: () => void, priority: number) => { harness.frame = frame; harness.priority = priority; },
}));

describe('open tween lifecycle', () => {
  let now: number;
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    harness.invalidate.mockClear();
  });

  it('ignores idle frame delta and unrelated config renders without restarting motion', () => {
    const values: number[] = [];
    const { rerender } = renderHook(({ open }) => useOpenTween(open, 400, p => values.push(p)), { initialProps: { open: false } });
    now = 600_000;
    rerender({ open: true });
    expect(values.at(-1)).toBe(0);
    now += 100;
    act(() => harness.frame());
    expect(values.at(-1)).toBeCloseTo(0.15625);
    rerender({ open: true });
    now += 100;
    act(() => harness.frame());
    expect(values.at(-1)).toBeCloseTo(0.5);
    now += 200;
    act(() => harness.frame());
    expect(values.at(-1)).toBe(1);
    harness.invalidate.mockClear();
    act(() => harness.frame());
    expect(harness.invalidate).not.toHaveBeenCalled();
    expect(harness.priority).toBe(-1);
  });

  it('reverses a mounted moving assembly without jumping to a stale frame', () => {
    const apply = vi.fn();
    const { rerender } = renderHook(({ open }) => useOpenTween(open, 400, apply), { initialProps: { open: true } });
    now = 200;
    rerender({ open: false });
    expect(apply).toHaveBeenLastCalledWith(0.5);
    now = 400;
    act(() => harness.frame());
    expect(apply).toHaveBeenLastCalledWith(0);
  });

  it('reports completion only after the settled transform has been applied', () => {
    const order: string[] = [];
    renderHook(() => useOpenTween(true, 400, p => order.push(`pose:${p}`), open => order.push(`done:${open}`)));
    now = 399;
    act(() => harness.frame());
    expect(order).not.toContain('done:true');
    now = 500;
    act(() => harness.frame());
    expect(order.slice(-2)).toEqual(['pose:1', 'done:true']);
    act(() => harness.frame());
    expect(order.filter(entry => entry === 'done:true')).toHaveLength(1);
  });
});
