import { describe, expect, it, vi } from 'vitest';
import { BED_MATTRESS_SIZES, BED_MATTRESS_WIDTH, buildPanels, defaultPieceConfig, normalizePieceConfig } from '@marketplace/shared';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createShowroomPanelGeometry } from './showroom-batches';

vi.mock('./showroom-panel', () => ({ ShowroomMaterial: () => null }));
vi.mock('./showroom-environment', () => ({ useShowroomLighting: () => ({ overview: false }) }));

describe('lightweight bed geometry', () => {
  for (const mattressSize of BED_MATTRESS_SIZES) for (const overview of [false, true]) {
    it(`${mattressSize}/${overview ? 'overview' : 'detail'} keeps cloth above storage and the runner on the duvet`, () => {
      const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize, upholstered: true, storage: 'DRAWERS' } });
      const panels = buildPanels(config, 'BED');
      const material = new MeshBasicMaterial({ side: DoubleSide });
      const meshes = panels.filter(p => p.shape === 'BED_DUVET' || p.shape === 'BED_THROW' || p.shape === 'BED_PILLOW' || p.shape === 'HEADBOARD_PAD')
        .map(panel => {
          const geometry = createShowroomPanelGeometry(panel, overview);
          const mesh = new Mesh(geometry, material);
          mesh.position.set(panel.x, panel.y, panel.z); mesh.updateMatrixWorld();
          return { panel, mesh };
        });
      try {
        for (const { panel, mesh } of meshes) {
          const p = mesh.geometry.getAttribute('position');
          expect([...mesh.geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
          for (let i = 0; i < p.count; i++) {
            expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(panel.w / 2 + 1e-6);
            expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(panel.h / 2 + 1e-6);
            expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(panel.d / 2 + 1e-6);
            if (panel.shape === 'BED_DUVET' || panel.shape === 'BED_THROW') {
              expect(p.getY(i) + panel.y).toBeGreaterThan(.37);
              expect(Math.abs(p.getX(i) + panel.x)).toBeLessThan(config.widthM / 2);
              expect(Math.abs(p.getZ(i) + panel.z)).toBeLessThan(config.depthM / 2);
              expect(panel.motion).toBeUndefined();
            }
          }
        }
        const duvet = meshes.find(({ panel }) => panel.shape === 'BED_DUVET')!.mesh;
        const runner = meshes.find(({ panel }) => panel.shape === 'BED_THROW')!.mesh;
        const halfWidth = BED_MATTRESS_WIDTH[mattressSize] / 2;
        for (const x of [-halfWidth - .025, -halfWidth, 0, halfWidth, halfWidth + .025]) {
          for (const z of [.3701, .39, .4775, .56, .675, .81, .8699]) {
            const ray = new Raycaster(new Vector3(x, 2, z), new Vector3(0, -1, 0));
            const duvetHits = ray.intersectObject(duvet);
            const runnerHits = ray.intersectObject(runner);
            expect(duvetHits.length).toBeGreaterThanOrEqual(2);
            expect(runnerHits.length).toBeGreaterThanOrEqual(2);
            const duvetTop = Math.max(...duvetHits.map(hit => hit.point.y));
            const runnerBottom = Math.min(...runnerHits.map(hit => hit.point.y));
            expect(runnerBottom - duvetTop).toBeCloseTo(.004, 5);
          }
        }
        // Caderea la picior incepe dincolo de saltea, nu o taie pe diagonala.
        for (const z of [.92, .95, .98, .994]) {
          const ray = new Raycaster(new Vector3(0, 2, z), new Vector3(0, -1, 0));
          expect(ray.intersectObject(duvet)[0].point.y).toBeGreaterThan(.526);
        }
      } finally { meshes.forEach(({ mesh }) => mesh.geometry.dispose()); material.dispose(); }
    });
  }

  it.each([
    { name: 'wooden', upholstered: false, storage: 'NONE' as const, detailLimit: 8448, overviewLimit: 3364 },
    { name: 'upholstered', upholstered: true, storage: 'NONE' as const, detailLimit: 15976, overviewLimit: 5548 },
    { name: 'drawers', upholstered: false, storage: 'DRAWERS' as const, detailLimit: 22828, overviewLimit: 8464 },
  ])('$name stays within the previous detailed geometry budget', ({ upholstered, storage, detailLimit, overviewLimit }) => {
    const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize: 'Q_160', upholstered, storage } });
    for (const overview of [false, true]) {
      let triangles = 0;
      for (const panel of buildPanels(config, 'BED')) {
        const geometry = createShowroomPanelGeometry(panel, overview);
        triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
        geometry.dispose();
      }
      expect(triangles).toBeLessThanOrEqual(overview ? overviewLimit : detailLimit);
    }
  });
});
