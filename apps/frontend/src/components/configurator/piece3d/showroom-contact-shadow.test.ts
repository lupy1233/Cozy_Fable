import { describe, expect, it } from 'vitest';
import { LessEqualDepth, Raycaster, Vector3 } from 'three';
import { createContactShadowResources } from './showroom-contact-shadow';

type Resources = ReturnType<typeof createContactShadowResources>;

function dispose(resources: Resources) {
  resources.target.dispose(); resources.scratch.dispose();
  resources.floorGeometry.dispose(); resources.floorMaterial.dispose();
  resources.depth.dispose(); resources.blurMaterial.dispose(); resources.quadGeometry.dispose();
}

describe('showroom contact shadow projection', () => {
  it.each([2, 5, 10])('keeps a moving drawer shadow below the drawer at floor scale %s', (scale) => {
    const resources = createContactShadowResources(scale, 2.5, -0.008, 256, '#5c5043');
    resources.floor.updateMatrixWorld();
    try {
      // Verifica ambele laterale ale patului si fata unui dulap, inclusiv dupa extensie.
      for (const [startX, startZ, moveX, moveZ] of [
        [-0.2, 0.15, -0.18, 0], [0.2, -0.15, 0.18, 0], [0.12, 0.2, 0, 0.18],
      ]) {
        for (const progress of [0, 0.5, 1]) {
          const point = new Vector3((startX + moveX * progress) * scale, 0.3, (startZ + moveZ * progress) * scale);
          const captured = point.clone().project(resources.camera);
          const floorHit = new Raycaster(point, new Vector3(0, -1, 0)).intersectObject(resources.floor)[0];
          expect(floorHit?.uv).toBeDefined();
          expect(floorHit.uv!.x).toBeCloseTo((captured.x + 1) / 2, 6);
          expect(floorHit.uv!.y).toBeCloseTo((captured.y + 1) / 2, 6);
          expect(floorHit.point.x).toBeCloseTo(point.x, 6);
          expect(floorHit.point.z).toBeCloseTo(point.z, 6);
        }
      }
    } finally { dispose(resources); }
  });

  it('selects the lower surface when the bed frame and drawer overlap in the capture', () => {
    const resources = createContactShadowResources(5, 2.5, -0.008, 256, '#5c5043');
    try {
      const drawerUnderside = new Vector3(0.6, 0.09, 0.4).project(resources.camera);
      const frameUnderside = new Vector3(0.6, 0.37, 0.4).project(resources.camera);
      expect(drawerUnderside.x).toBe(frameUnderside.x);
      expect(drawerUnderside.y).toBe(frameUnderside.y);
      expect(drawerUnderside.z).toBeLessThan(frameUnderside.z);
      expect(resources.target.depthBuffer).toBe(true);
      expect(resources.depth.depthFunc).toBe(LessEqualDepth);
      expect(resources.depth.depthTest).toBe(true);
      expect(resources.depth.depthWrite).toBe(true);
    } finally { dispose(resources); }
  });
});
