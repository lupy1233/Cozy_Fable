import { describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createBoardGeometry } from './board-geometry';
import { createCushionGeometry, createEllipticGeometry, createPedestalGeometry, createPipingGeometry, createCylinderGeometry } from './showroom-geometry';

describe('showroom cushion geometry', () => {
  it.each([[0.6, 0.13, 0.4], [1.6, 0.06, 0.9], [0.8, 0.08, 0.38]])(
    'preserves finite geometry inside the declared %s × %s × %s envelope', (w, h, d) => {
      const geometry = createCushionGeometry(w, h, d);
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < position.count; i++) {
        expect(Math.abs(position.getX(i))).toBeLessThanOrEqual(w / 2 + 1e-6);
        expect(Math.abs(position.getY(i))).toBeLessThanOrEqual(h / 2 + 1e-6);
        expect(Math.abs(position.getZ(i))).toBeLessThanOrEqual(d / 2 + 1e-6);
        expect([normal.getX(i), normal.getY(i), normal.getZ(i)].every(Number.isFinite)).toBe(true);
      }
      expect(geometry.boundingBox!.max.y).toBeCloseTo(h / 2);
      expect(geometry.boundingBox!.min.y).toBeCloseTo(-h / 2);
      // O singura forma rotunjita, fara multe blocuri separate.
      expect(position.count).toBeLessThan(600);
      geometry.dispose();
    },
  );
});

describe('elliptic furniture geometry', () => {
  it.each([[1.4, 0.035, 1.4], [0.25, 0.7, 0.25], [0.65, 0.04, 0.65]])(
    'bakes real dimensions into vertices for metric grain: %s × %s × %s', (w, h, d) => {
      const geometry = createEllipticGeometry(w, h, d);
      const bounds = geometry.boundingBox!;
      expect(bounds.min.x).toBeCloseTo(-w / 2);
      expect(bounds.max.x).toBeCloseTo(w / 2);
      expect(bounds.min.y).toBeCloseTo(-h / 2);
      expect(bounds.max.y).toBeCloseTo(h / 2);
      expect(bounds.min.z).toBeCloseTo(-d / 2);
      expect(bounds.max.z).toBeCloseTo(d / 2);
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      geometry.dispose();
    },
  );
});

describe('overview soft and elliptic profiles', () => {
  it.each(['CUSHION', 'ELLIPSE'] as const)('%s retains its bounds with lower tessellation', (shape) => {
    const create = (overview: boolean) => shape === 'CUSHION'
      ? createCushionGeometry(1.6, 0.075, 1.47, overview)
      : createEllipticGeometry(1.4, 0.035, 1.1, 0.008, overview);
    const detail = create(false);
    const overview = create(true);
    try {
      expect(overview.boundingBox!.min.distanceTo(detail.boundingBox!.min)).toBeLessThan(1e-6);
      expect(overview.boundingBox!.max.distanceTo(detail.boundingBox!.max)).toBeLessThan(1e-6);
      expect(overview.getAttribute('position').count).toBeLessThan(detail.getAttribute('position').count);
      expect([...overview.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    } finally {
      detail.dispose(); overview.dispose();
    }
  });
});

describe('new detail profiles preserve scale at both rendering tiers', () => {
  const cases = [
    { name: 'small seam', dims: [0.3, 0.003, 0.4], create: createPipingGeometry },
    { name: 'wide seam', dims: [2, 0.004, 0.4], create: createPipingGeometry },
    { name: 'coffee pedestal', dims: [0.385, 0.415, 0.385], create: createPedestalGeometry },
    { name: 'dining pedestal', dims: [0.65, 0.715, 0.65], create: createPedestalGeometry },
  ];
  for (const { name, dims: [w, h, d], create } of cases) it(name, () => {
    const detail = create(w, h, d, false), overview = create(w, h, d, true);
    try {
      for (const geometry of [detail, overview]) {
        const bounds = geometry.boundingBox!;
        for (const [axis, size] of [['x', w], ['y', h], ['z', d]] as const) {
          expect(bounds.min[axis]).toBeCloseTo(-size / 2, 6);
          expect(bounds.max[axis]).toBeCloseTo(size / 2, 6);
        }
        expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      }
      expect(overview.getAttribute('position').count).toBeLessThan(detail.getAttribute('position').count);
    } finally { detail.dispose(); overview.dispose(); }
  });
  for (const axis of ['X', 'Y', 'Z'] as const) it(`hardware cylinder ${axis} keeps its declared axes`, () => {
    const geometry = createCylinderGeometry(.012, .08, .006, axis);
    try {
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(.012, 6);
      expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(.08, 6);
      expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(.006, 6);
    } finally { geometry.dispose(); }
  });
});

describe('stitched edges follow the supporting surface', () => {
  for (const overview of [false, true]) for (const mattress of [false, true]) it(`${mattress ? 'mattress' : 'wide bench'} / overview=${overview}`, () => {
    const w = mattress ? 1.586 : 1.996, h = mattress ? .192 : .065, d = mattress ? 1.99 : .396;
    const body = mattress ? createBoardGeometry(w, h, d, .035, overview) : createCushionGeometry(w, h, d, overview);
    const seam = createPipingGeometry(w + .004, .004, d + .004, overview, mattress ? .035 : undefined);
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const bodyMesh = new Mesh(body, material), seamMesh = new Mesh(seam, material);
    seamMesh.position.y = mattress ? .055 : 0;
    bodyMesh.updateMatrixWorld(); seamMesh.updateMatrixWorld();
    try {
      for (let i = 0; i < 72; i++) {
        const a = (i + .3) / 72 * Math.PI * 2;
        const ray = new Raycaster(new Vector3(0, seamMesh.position.y, 0), new Vector3(Math.cos(a), 0, Math.sin(a)));
        const surfaceHit = ray.intersectObject(bodyMesh)[0];
        const surface = surfaceHit.distance;
        const hits = ray.intersectObject(seamMesh).map(hit => hit.distance);
        expect(hits.length).toBeGreaterThanOrEqual(2);
        expect(Math.min(...hits)).toBeLessThan(surface);
        expect(Math.max(...hits)).toBeGreaterThan(surface);
        // La un unghi razant, distanta pe raza e mai mare decat grosimea cordonului.
        const normalExposure = (Math.max(...hits) - surface) * Math.abs(surfaceHit.face!.normal.dot(ray.ray.direction));
        expect(normalExposure).toBeLessThan(.003);
      }
    } finally { body.dispose(); seam.dispose(); material.dispose(); }
  });
});
