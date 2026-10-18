import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildPanels, defaultPieceConfig, normalizePieceConfig } from '@marketplace/shared';
import { createCatalogGeometry } from './catalog-geometry';
import { createShowroomPanelGeometry } from './showroom-batches';
import { furnitureMotionBounds } from './furniture-motion-bounds';

describe('catalog profiles and storage clearance', () => {
  for (const shape of ['BASIN', 'ROUND_CUSHION', 'ROUND_SHELL'] as const) for (const overview of [false, true]) {
    it(`${shape}/${overview} is finite, bounded and economical`, () => {
      const geometry = createCatalogGeometry(shape, 0.8, 0.15, 0.6, overview);
      const bounds = geometry.boundingBox!;
      expect(bounds.min.x).toBeCloseTo(-0.4, 6); expect(bounds.max.x).toBeCloseTo(0.4, 6);
      expect(bounds.min.y).toBeCloseTo(-0.075, 6); expect(bounds.max.y).toBeCloseTo(0.075, 6);
      expect(bounds.min.z).toBeCloseTo(-0.3, 6); expect(bounds.max.z).toBeCloseTo(0.3, 6);
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      expect(geometry.index!.count / 3).toBeLessThan(1000);
      geometry.dispose();
    });
  }
  for (const widthM of [0.4, 0.8, 1.4]) for (const shape of ['ROUND', 'RECTANGULAR'] as const) {
    it(`${shape} ${widthM}m lid stays above the shell for its entire opening sweep`, () => {
      const config = normalizePieceConfig('OTTOMAN', { ...defaultPieceConfig('OTTOMAN'), widthM, ottoman: { shape, storage: true } });
      const lid = buildPanels(config, 'OTTOMAN').find(p => p.motion)!;
      const geometry = createShowroomPanelGeometry(lid);
      const positions = geometry.getAttribute('position');
      const pivot = new Vector3(...lid.motion!.pivot!);
      const bounds = furnitureMotionBounds(config, buildPanels(config, 'OTTOMAN'));
      for (let step = 0; step <= 20; step++) for (let i = 0; i < positions.count; i++) {
        const p = new Vector3().fromBufferAttribute(positions, i).add(new Vector3(lid.x, lid.y, lid.z)).sub(pivot)
          .applyAxisAngle(new Vector3(1, 0, 0), lid.motion!.angle! * step / 20).add(pivot);
        expect(p.y).toBeGreaterThanOrEqual(pivot.y - 1e-6);
        expect(p.y).toBeLessThanOrEqual(bounds.height + 0.003);
        expect(Math.abs(p.x) * 2).toBeLessThanOrEqual(bounds.width + 0.003);
        expect(Math.abs(p.z) * 2).toBeLessThanOrEqual(bounds.depth + 0.003);
      }
      geometry.dispose();
    });
  }
});
