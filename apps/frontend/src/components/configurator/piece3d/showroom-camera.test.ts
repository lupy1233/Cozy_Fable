import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitShowroomCamera } from './showroom-camera';

describe('showroom camera framing', () => {
  it.each([0.3, 0.5, 1, 1.65, 2.5])('keeps wide/tall/deep pieces inside aspect %s without orbit clamping', (aspect) => {
    for (const [w, h, d] of [[6, 2.8, 0.8], [3, 0.75, 1.8], [1.73, 1, 2.2], [0.45, 0.55, 0.4]]) {
      const fit = fitShowroomCamera(w, h, d, aspect);
      const camera = new PerspectiveCamera(32, aspect, 0.05, 200);
      camera.position.set(...fit.position);
      camera.lookAt(...fit.target);
      camera.updateMatrixWorld();
      expect(camera.position.distanceTo(new Vector3(...fit.target))).toBeLessThan(fit.maxDistance);
      for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.841);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.841);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
});
