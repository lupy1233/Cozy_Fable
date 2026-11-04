import { act, renderHook } from '@testing-library/react';
import { defaultPieceConfig, normalizePieceConfig } from '@marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planSlidingInteraction, slidingDrawerAccessible, useCabinetFronts } from './use-cabinet-fronts';

const fixture = (columns = 3) => normalizePieceConfig('WARDROBE', {
  ...defaultPieceConfig('WARDROBE'), widthM: columns * 0.8, heightM: 2, depthM: 0.65, doorMode: 'SLIDING',
  columns: Array.from({ length: columns }, () => ({ zones: [{ type: 'OPEN' as const }, { type: 'DRAWERS' as const, count: 2, heightM: 0.45 }] })),
});

afterEach(() => vi.useRealTimers());

describe('sliding access and collision sequencing', () => {
  it('checks the real leaf span before opening an internal drawer', () => {
    const config = fixture(2);
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(), { col: 0, zone: 1 })).toBe(false);
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(['slide:0']), { col: 0, zone: 1 })).toBe(true);
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(['slide:0']), { col: 1, zone: 1 })).toBe(false);
  });

  it('exposes either outside drawer bank in a three-column cabinet', () => {
    const config = fixture();
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(['slide:0']), { col: 0, zone: 1 })).toBe(true);
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(['slide:2']), { col: 2, zone: 1 })).toBe(true);
  });

  it('rejects access when a wide leaf cannot clear a drawer behind a narrower neighbor', () => {
    const base = fixture(2);
    const config = normalizePieceConfig('WARDROBE', { ...base, columns: base.columns.map((column, i) => ({ ...column, widthM: i === 0 ? 1.1 : 0.446 })) });
    expect(slidingDrawerAccessible('WARDROBE', config, new Set(['slide:0']), { col: 0, zone: 1 })).toBe(false);
    expect(planSlidingInteraction('WARDROBE', config, new Set(['slide:0']), { col: 0, zone: 1 })).toEqual([]);
  });

  it('closes drawers before the active leaf, then opens the requested same-track leaf', () => {
    const steps = planSlidingInteraction('WARDROBE', fixture(), new Set(['slide:0', '0:1']), { col: 2, zone: 0 });
    expect(steps.map((step) => [...step.openZones])).toEqual([['slide:0'], [], ['slide:2']]);
  });

  it('closes drawers before closing their covering leaf', () => {
    const steps = planSlidingInteraction('WARDROBE', fixture(), new Set(['slide:0', '0:1']), { col: 0, zone: 0 });
    expect(steps.map((step) => [...step.openZones])).toEqual([['slide:0'], []]);
  });

  it('ignores repeated drawer clicks until the leaf has completely opened', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCabinetFronts('WARDROBE', fixture(2)));
    act(() => result.current.toggleZone({ col: 0, zone: 1 }));
    act(() => result.current.toggleZone({ col: 0, zone: 1 }));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => vi.advanceTimersByTime(60_000));
    act(() => result.current.onFrontSettled('slide:0', false));
    act(() => result.current.onFrontSettled('slide:1', true));
    act(() => result.current.toggleZone({ col: 0, zone: 1 }));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => result.current.onFrontSettled('slide:0', true));
    act(() => result.current.toggleZone({ col: 0, zone: 1 }));
    expect([...result.current.openZones]).toEqual(['slide:0', '0:1']);
  });

  it('advances each stage only when the matching front really settles', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCabinetFronts('WARDROBE', fixture()));
    act(() => result.current.setOpenZones(new Set(['slide:0', '0:1'])));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => vi.advanceTimersByTime(60_000));
    act(() => result.current.onFrontSettled('0:1', true));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => result.current.onFrontSettled('0:1', false));
    expect([...result.current.openZones]).toEqual([]);
    act(() => result.current.toggleZone({ col: 1, zone: 0 }));
    act(() => result.current.onFrontSettled('slide:0', false));
    expect([...result.current.openZones]).toEqual(['slide:2']);
    act(() => result.current.toggleZone({ col: 0, zone: 0 }));
    expect([...result.current.openZones]).toEqual(['slide:2']);
    act(() => result.current.onFrontSettled('slide:2', true));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    expect([...result.current.openZones]).toEqual([]);
  });

  it('waits for every open drawer zone before moving its covering leaf', () => {
    const base = fixture();
    const config = normalizePieceConfig('WARDROBE', { ...base, columns: base.columns.map((column) => ({ ...column, zones: [...column.zones, { type: 'DRAWERS' as const, heightM: 0.45 }] })) });
    const { result } = renderHook(() => useCabinetFronts('WARDROBE', config));
    act(() => result.current.setOpenZones(new Set(['slide:0', '0:1', '0:2'])));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    act(() => result.current.onFrontSettled('0:1', false));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => result.current.onFrontSettled('0:2', false));
    expect([...result.current.openZones]).toEqual([]);
  });

  it('accepts immediate completion in reduced motion without scheduling timers', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCabinetFronts('WARDROBE', fixture()));
    act(() => result.current.setOpenZones(new Set(['slide:0', '0:1'])));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    act(() => result.current.onFrontSettled('0:1', false));
    act(() => result.current.onFrontSettled('slide:0', false));
    act(() => result.current.onFrontSettled('slide:2', true));
    expect([...result.current.openZones]).toEqual(['slide:2']);
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.toggleZone({ col: 2, zone: 1 }));
    expect([...result.current.openZones]).toEqual(['slide:2', '2:1']);
  });

  it('cancels queued opening on reset or unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCabinetFronts('WARDROBE', fixture()));
    act(() => result.current.setOpenZones(new Set(['slide:0', '0:1'])));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    act(() => result.current.setOpenZones(new Set()));
    act(() => result.current.onFrontSettled('0:1', false));
    act(() => result.current.onFrontSettled('slide:0', false));
    act(() => vi.runAllTimers());
    expect([...result.current.openZones]).toEqual([]);
    act(() => result.current.toggleZone({ col: 0, zone: 0 }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops a queued opening after the cabinet geometry changes', () => {
    const { result, rerender } = renderHook(({ config }) => useCabinetFronts('WARDROBE', config), { initialProps: { config: fixture() } });
    act(() => result.current.setOpenZones(new Set(['slide:0', '0:1'])));
    act(() => result.current.toggleZone({ col: 2, zone: 0 }));
    rerender({ config: fixture(2) });
    act(() => result.current.onFrontSettled('0:1', false));
    expect([...result.current.openZones]).toEqual(['slide:0']);
    act(() => result.current.toggleZone({ col: 1, zone: 0 }));
    expect([...result.current.openZones]).toEqual([]);
    act(() => result.current.onFrontSettled('slide:0', false));
    expect([...result.current.openZones]).toEqual(['slide:1']);
  });
});
