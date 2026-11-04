import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Vector3 } from 'three';
import { buildPanels, defaultPieceConfig, normalizePieceConfig, PIECE3D_KINDS, PIECE3D_RULES } from '@marketplace/shared';
import { createShowroomBatches, createShowroomPanelGeometry } from './showroom-batches';
import { boardGrainOffset } from './showroom-grain';

// Aceste teste verifica geometria pura; integrarea R3F este verificata in browser.
vi.mock('./showroom-panel', () => ({ ShowroomMaterial: () => null }));
vi.mock('./showroom-environment', () => ({ useShowroomLighting: () => ({ overview: false }) }));

describe('static showroom batching', () => {
  for (const kind of PIECE3D_KINDS) for (const size of ['default', 'min', 'max'] as const) {
    it(`${kind}/${size} preserves every panel, triangle, bound and local texture coordinate`, () => {
      const rules = PIECE3D_RULES[kind];
      const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), widthM: rules.width[size], heightM: rules.height[size], depthM: rules.depth[size] });
      const panels = buildPanels(config, kind);
      const batches = createShowroomBatches(panels);
      try {
        expect(batches.flatMap((b) => b.panelIndices).sort((a, b) => a - b)).toEqual(panels.map((_, i) => i));
        expect(batches.length).toBeLessThan(panels.length);
        const sourceBounds = new Box3();
        let sourceVertices = 0;
        for (const panel of panels) {
          const geometry = createShowroomPanelGeometry(panel);
          sourceVertices += geometry.index?.count ?? geometry.getAttribute('position').count;
          if (panel.role === 'ROD') geometry.rotateZ(Math.PI / 2);
          geometry.translate(panel.x, panel.y, panel.z);
          geometry.computeBoundingBox();
          sourceBounds.union(geometry.boundingBox!);
          geometry.dispose();
        }
        const batchBounds = new Box3();
        let batchVertices = 0;
        for (const batch of batches) {
          expect(batch.geometry.index).toBeNull();
          expect(batch.geometry.groups).toHaveLength(0);
          batchVertices += batch.geometry.getAttribute('position').count;
          batchBounds.union(batch.geometry.boundingBox!);
          for (const attribute of Object.keys(batch.geometry.attributes)) {
            expect(Array.from(batch.geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
          }
          let offset = 0;
          for (const index of batch.panelIndices) {
            const panel = panels[index];
            const geometry = createShowroomPanelGeometry(panel);
            const count = geometry.index?.count ?? geometry.getAttribute('position').count;
            const texturePosition = batch.geometry.getAttribute('showroomPosition');
            const worldPosition = batch.geometry.getAttribute('position');
            if (texturePosition) for (const vertex of [offset, offset + Math.floor(count / 2), offset + count - 1]) {
              const expected = new Vector3().fromBufferAttribute(texturePosition, vertex);
              if (!batch.surface) expected.sub(new Vector3(...boardGrainOffset(panel)));
              if (panel.role === 'ROD') expected.applyAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
              expected.add(new Vector3(panel.x, panel.y, panel.z));
              const actual = new Vector3().fromBufferAttribute(worldPosition, vertex);
              expect(actual.distanceTo(expected)).toBeLessThan(5e-6);
            }
            offset += count;
            geometry.dispose();
          }
        }
        expect(batchVertices).toBe(sourceVertices);
        expect(batchBounds.min.distanceTo(sourceBounds.min)).toBeLessThan(1e-6);
        expect(batchBounds.max.distanceTo(sourceBounds.max)).toBeLessThan(1e-6);
      } finally {
        batches.forEach((batch) => batch.geometry.dispose());
      }
    });
  }

  it('retains ellipse/cushion/rod/front profiles and disposes temporary geometry', () => {
    const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose');
    const panels = [
      ...buildPanels(normalizePieceConfig('TABLE', { ...defaultPieceConfig('TABLE'), table: { type: 'DINING', shape: 'ROUND' } }), 'TABLE'),
      ...buildPanels(defaultPieceConfig('BED'), 'BED'),
      ...buildPanels(defaultPieceConfig('WARDROBE'), 'WARDROBE'),
    ];
    const batches = createShowroomBatches(panels);
    try {
      expect(panels.some((p) => p.shape === 'ELLIPSE')).toBe(true);
      expect(panels.some((p) => p.shape === 'BED_PILLOW')).toBe(true);
      expect(batches.some((b) => b.material === 'ROD')).toBe(true);
      expect(batches.some((b) => b.front)).toBe(true);
      expect(dispose.mock.calls.length).toBeGreaterThanOrEqual(panels.length);
      expect(batches.reduce((sum, b) => sum + b.panelIndices.length, 0)).toBe(panels.length);
      expect(batches.length).toBeLessThan(panels.length / 2);
    } finally {
      batches.forEach((batch) => batch.geometry.dispose());
      dispose.mockRestore();
    }
  });

  it('does not invent geometry for an empty piece', () => {
    expect(createShowroomBatches([])).toEqual([]);
  });

  for (const kind of PIECE3D_KINDS) {
    it(`${kind} overview preserves every component and bound with fewer vertices`, () => {
      const panels = buildPanels(defaultPieceConfig(kind), kind);
      const detail = createShowroomBatches(panels);
      const overview = createShowroomBatches(panels, true);
      try {
        expect(overview.flatMap(batch => batch.panelIndices).sort((a, b) => a - b)).toEqual(panels.map((_, i) => i));
        expect(overview.length).toBeLessThanOrEqual(detail.length);
        let detailedVertices = 0;
        let overviewVertices = 0;
        const detailedBounds = new Box3(), overviewBounds = new Box3();
        detail.forEach(batch => { detailedVertices += batch.geometry.getAttribute('position').count; detailedBounds.union(batch.geometry.boundingBox!); });
        overview.forEach((batch) => {
          // Cutele rare pot pierde sub 1 mm la varf; gabaritul declarat este verificat separat.
          overviewBounds.union(batch.geometry.boundingBox!);
          for (const attr of ['position', 'normal'])
            expect(Array.from(batch.geometry.getAttribute(attr).array).every(Number.isFinite)).toBe(true);
          expect(batch.geometry.getAttribute('showroomPosition')).toBeUndefined();
          expect(batch.geometry.getAttribute('showroomNormal')).toBeUndefined();
          overviewVertices += batch.geometry.getAttribute('position').count;
        });
        const tolerance = kind === 'BED' ? .001 : 1e-6;
        expect(overviewBounds.min.distanceTo(detailedBounds.min)).toBeLessThan(tolerance);
        expect(overviewBounds.max.distanceTo(detailedBounds.max)).toBeLessThan(tolerance);
        expect(overviewVertices).toBeLessThan(detailedVertices * 0.65);
      } finally {
        [...detail, ...overview].forEach((batch) => batch.geometry.dispose());
      }
    });
  }
});
