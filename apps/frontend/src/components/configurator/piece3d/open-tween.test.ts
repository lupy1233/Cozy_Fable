import { describe, expect, it } from 'vitest';
import { createOpenTween, OPEN_DURATION_MS, retargetOpenTween, sampleOpenTween } from './open-tween';

describe('mechanism timing independent of demand rendering', () => {
  it.each(Object.entries(OPEN_DURATION_MS))('%s takes its full duration after ten minutes idle', (_, duration) => {
    const tween = retargetOpenTween(createOpenTween(), true, 600_000, duration);
    expect(sampleOpenTween(tween, 600_000)).toBe(0);
    expect(sampleOpenTween(tween, 600_000 + duration / 2)).toBeCloseTo(0.5);
    expect(sampleOpenTween(tween, 600_000 + duration - 1)).toBeLessThan(1);
    expect(sampleOpenTween(tween, 600_000 + duration)).toBe(1);
  });

  it.each([30, 60, 120])('finishes at the same wall time at %i FPS', (fps) => {
    const tween = retargetOpenTween(createOpenTween(), true, 1_000, 600);
    for (let time = 1_000; time < 1_600; time += 1_000 / fps) sampleOpenTween(tween, time);
    expect(sampleOpenTween(tween, 1_300)).toBeCloseTo(0.5);
    expect(sampleOpenTween(tween, 1_600)).toBe(1);
  });

  it('reverses from the exact current position with a proportional remaining duration', () => {
    const opening = retargetOpenTween(createOpenTween(), true, 0, 400);
    const closing = retargetOpenTween(opening, false, 200, 400);
    expect(sampleOpenTween(closing, 200)).toBe(0.5);
    expect(closing.duration).toBe(200);
    expect(sampleOpenTween(closing, 300)).toBeCloseTo(0.25);
    expect(sampleOpenTween(closing, 400)).toBe(0);
  });

  it('clamps delayed frames and completes reduced motion immediately', () => {
    const tween = retargetOpenTween(createOpenTween(), true, 5_000, 750);
    expect(sampleOpenTween(tween, 4_999)).toBe(0);
    expect(sampleOpenTween(tween, 50_000)).toBe(1);
    expect(sampleOpenTween(retargetOpenTween(tween, false, 50_000, 750, true), 50_000)).toBe(0);
  });
});
