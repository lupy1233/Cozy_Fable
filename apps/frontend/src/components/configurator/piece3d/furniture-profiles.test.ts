import { describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createBoardGeometry } from './board-geometry';
import { createSeatCushionGeometry, createTabletopGeometry, createTaperedLegGeometry } from './furniture-profiles';

describe('bounded board topology', () => {
  for (const overview of [false, true]) for (const dims of [[2.4, .018, .6], [.018, 2.8, .6], [.092, .092, .018], [1.586, .228, 1.99]]) {
    it(`${dims.join('/')} overview=${overview} is closed with outward faces and exact bounds`, () => {
      const [w, h, d] = dims;
      const geometry = createBoardGeometry(w, h, d, dims[1] === .228 ? .035 : .0015, overview);
      try {
        const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
        expect(position.count / 3).toBeLessThanOrEqual(236);
        const edges = new Map<string, number>();
        const pointKey = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map(x => Math.round(x * 1e7)).join(',');
        for (let i = 0; i < position.count; i += 3) {
          const a = new Vector3().fromBufferAttribute(position, i), b = new Vector3().fromBufferAttribute(position, i + 1), c = new Vector3().fromBufferAttribute(position, i + 2);
          const face = b.sub(a).cross(c.sub(a));
          expect(face.dot(new Vector3().fromBufferAttribute(normal, i))).toBeGreaterThan(0);
          for (const [start, end] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
            const key = [pointKey(start), pointKey(end)].sort().join('|'); edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        expect([...edges.values()].every(count => count === 2)).toBe(true);
        for (const [axis, size] of [['x', w], ['y', h], ['z', d]] as const) {
          expect(geometry.boundingBox!.min[axis]).toBeCloseTo(-size / 2, 6);
          expect(geometry.boundingBox!.max[axis]).toBeCloseTo(size / 2, 6);
        }
      } finally { geometry.dispose(); }
    });
  }
});

describe('table and bench profiles', () => {
  const profiles = [
    { make: createTabletopGeometry, dims: [.6, .03, .4] },
    { make: createTabletopGeometry, dims: [2.4, .035, .7] },
    { make: createTaperedLegGeometry, dims: [.078, .715, .078] },
    { make: createTaperedLegGeometry, dims: [.065, .385, .065] },
    { make: createSeatCushionGeometry, dims: [.6, .065, .4] },
    { make: createSeatCushionGeometry, dims: [2, .065, .4] },
  ];
  for (const { make, dims: [w, h, d] } of profiles) it(`${make.name} ${w} retains size, finite normals and a cheaper overview`, () => {
    const detail = make(w, h, d), overview = make(w, h, d, true);
    try {
      for (const geometry of [detail, overview]) {
        for (const [axis, size] of [['x', w], ['y', h], ['z', d]] as const) {
          expect(geometry.boundingBox!.min[axis]).toBeCloseTo(-size / 2, 6);
          expect(geometry.boundingBox!.max[axis]).toBeCloseTo(size / 2, 6);
        }
        expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
        expect(geometry.index!.count / 3).toBeLessThanOrEqual(850);
      }
      expect(overview.index!.count).toBeLessThan(detail.index!.count);
    } finally { detail.dispose(); overview.dispose(); }
  });

  for (const overview of [false, true]) for (const w of [.6, 2]) it(`seat ${w} overview=${overview} rests flat and its seam encloses the entire body perimeter`, () => {
    const h = .065, d = .4, geometry = createSeatCushionGeometry(w, h, d, overview);
    const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material);
    mesh.updateMatrixWorld();
    try {
      for (const x of [-w / 2 + .04, 0, w / 2 - .04]) for (const z of [-.16, 0, .16]) {
        const hit = new Raycaster(new Vector3(x, -.1, z), new Vector3(0, 1, 0)).intersectObject(mesh)[0];
        expect(hit.point.y).toBeCloseTo(-h / 2, 6);
      }
      for (let i = 0; i < 100; i++) {
        const angle = (i + .31) / 100 * Math.PI * 2;
        const ray = new Raycaster(new Vector3(0, -h * .04, 0), new Vector3(Math.cos(angle), 0, Math.sin(angle)));
        const hits = ray.intersectObject(mesh);
        const distances = hits.map(hit => hit.distance).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-6);
        expect(distances).toHaveLength(3);
        expect((distances[2] - distances[0]) * Math.abs(hits[0].face!.normal.dot(ray.ray.direction))).toBeLessThan(.0032);
      }
    } finally { geometry.dispose(); material.dispose(); }
  });
});
