import { describe, expect, it } from 'vitest';
import { createHangerGeometry, createHangerHookGeometry } from './hanger-geometry';

describe('lightweight rod hanger', () => {
  it.each([.12, .381, .42])('wooden body fits its thin Y/Z envelope at %s m depth', d => {
    const geometry = createHangerGeometry(.016, .14, d);
    try {
      const p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(.008001);
        expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(.070001);
        expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(d / 2 + 1e-6);
      }
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      expect((geometry.index?.count ?? p.count) / 3).toBeLessThan(200);
    } finally { geometry.dispose(); }
  });

  it.each([false, true])('hook clears and rests on the rod, overview=%s', overview => {
    const geometry = createHangerHookGeometry(overview);
    try {
      const p = geometry.getAttribute('position');
      let closest = Infinity;
      for (let i = 0; i < p.count; i++) {
        expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(.002001);
        expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(.056501);
        expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(.019001);
        const distance = Math.hypot(p.getY(i) - .0395, p.getZ(i));
        closest = Math.min(closest, distance);
        expect(distance).toBeGreaterThan(.0127);
      }
      expect(closest).toBeLessThan(.0145);
      expect(geometry.boundingBox!.min.y - .0395).toBeLessThan(-.09);
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      expect(geometry.index!.count / 3).toBeLessThanOrEqual(288);
    } finally { geometry.dispose(); }
  });
});
