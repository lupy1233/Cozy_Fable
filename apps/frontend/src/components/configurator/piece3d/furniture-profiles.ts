import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPipingGeometry } from './showroom-geometry';

type Ring = { y: number; inset: number };

// Colturi cu raza metrica: o bancheta lata nu capata colturi de perna supradimensionate.
function roundedLoft(w: number, d: number, radius: number, rings: Ring[], steps: number) {
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
  const perimeter = (inset: number) => {
    const hw = w / 2 - inset, hd = d / 2 - inset;
    const r = Math.max(.001, Math.min(radius - inset, hw / 2, hd / 2));
    return Array.from({ length: 4 * (steps + 1) }, (_, index) => {
      const side = Math.floor(index / (steps + 1)), t = index % (steps + 1);
      const a = (side + t / steps) * Math.PI / 2;
      return { x: (side === 0 || side === 3 ? hw - r : -hw + r) + Math.cos(a) * r,
        z: (side < 2 ? hd - r : -hd + r) + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) };
    });
  };
  const count = 4 * (steps + 1);
  rings.forEach((ring, row) => {
    const before = rings[Math.max(0, row - 1)], after = rings[Math.min(rings.length - 1, row + 1)];
    const slope = (after.inset - before.inset) / (after.y - before.y);
    perimeter(ring.inset).forEach((point, col) => {
      const normal = new Vector3(point.nx, slope, point.nz).normalize();
      positions.push(point.x, ring.y, point.z); normals.push(normal.x, normal.y, normal.z); uv.push(col / count, row / (rings.length - 1));
      if (row < rings.length - 1) {
        const a = row * count + col, b = row * count + (col + 1) % count, c = a + count, e = b + count;
        indices.push(a, c, b, b, c, e);
      }
    });
  });
  // Capace separate, cu normale plane; baza ramane asezata pe suport.
  for (const row of [0, rings.length - 1]) {
    const ring = rings[row], up = row > 0 ? 1 : -1;
    const center = positions.length / 3;
    positions.push(0, ring.y, 0); normals.push(0, up, 0); uv.push(.5, .5);
    perimeter(ring.inset).forEach(point => {
      positions.push(point.x, ring.y, point.z); normals.push(0, up, 0); uv.push(point.x / w + .5, point.z / d + .5);
    });
    for (let col = 0; col < count; col++) {
      const a = center + 1 + col, b = center + 1 + (col + 1) % count;
      indices.push(center, up > 0 ? b : a, up > 0 ? a : b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeBoundingBox();
  return geometry;
}

export function createTaperedLegGeometry(w: number, h: number, d: number, overview = false) {
  const taper = Math.min(w, d) * .16;
  return roundedLoft(w, d, .003, [
    { y: -h / 2, inset: taper },
    { y: h / 2 - Math.min(.13, h * .32), inset: 0 },
    { y: h / 2, inset: 0 },
  ], overview ? 1 : 2);
}

export function createTabletopGeometry(w: number, h: number, d: number, overview = false) {
  return roundedLoft(w, d, Math.min(.012, h / 3), [
    { y: -h / 2, inset: Math.min(.009, h * .26) },
    { y: h / 2 - .007, inset: 0 },
    { y: h / 2 - .002, inset: 0 },
    { y: h / 2, inset: .002 },
  ], overview ? 2 : 4);
}

export function createSeatCushionGeometry(w: number, h: number, d: number, overview = false) {
  const radius = .035, seamRadius = .0015, seamY = -h * .04;
  const body = roundedLoft(w, d, radius, [
    { y: -h / 2, inset: .014 },
    { y: -h / 2 + .005, inset: .005 },
    { y: -h * .24, inset: .002 },
    { y: seamY, inset: seamRadius },
    { y: h * .22, inset: .003 },
    { y: h * .42, inset: .01 },
    { y: h / 2, inset: .033 },
  ], overview ? 4 : 8);
  const seam = createPipingGeometry(w, seamRadius * 2, d, overview, radius - seamRadius);
  seam.translate(0, seamY, 0);
  const geometry = mergeGeometries([body, seam], false)!;
  body.dispose(); seam.dispose();
  geometry.computeBoundingBox();
  return geometry;
}
