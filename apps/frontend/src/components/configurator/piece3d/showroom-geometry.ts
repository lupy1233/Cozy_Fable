import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2, Vector3 } from 'three';

export function createCylinderGeometry(w: number, h: number, d: number, axis: 'X' | 'Y' | 'Z' = 'Y', overview = false) {
  const geometry = new CylinderGeometry(1, 1, 1, overview ? 12 : 20);
  if (axis === 'X') { geometry.rotateZ(Math.PI / 2); geometry.scale(w, h / 2, d / 2); }
  else if (axis === 'Z') { geometry.rotateX(Math.PI / 2); geometry.scale(w / 2, h / 2, d); }
  else geometry.scale(w / 2, h, d / 2);
  geometry.computeBoundingBox();
  return geometry;
}

// Soclu strunjit cu talpa evazata si racorduri, in gabaritul descris de panou.
export function createPedestalGeometry(w: number, h: number, d: number, overview = false) {
  const profile = [[0, 0], [.46, 0], [.495, .012], [.5, .028], [.49, .048], [.43, .07],
    [.3, .11], [.21, .18], [.18, .28], [.17, .7], [.19, .85], [.25, .96], [.3, 1], [0, 1]];
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, (y - .5) * h)), overview ? 24 : 48);
  geometry.scale(w, 1, d);
  geometry.computeBoundingBox();
  return geometry;
}

// Cordon continuu cusut, integral in gabarit; 4 sectiuni ajung pentru grosimea milimetrica.
export function createPipingGeometry(w: number, h: number, d: number, overview = false, cornerRadius?: number) {
  const radius = Math.min(h / 2, 0.003, w / 8, d / 8);
  const points: Vector3[] = [];
  const outward: Vector3[] = [];
  const hw = w / 2 - radius, hd = d / 2 - radius;
  if (cornerRadius !== undefined) {
    const corner = Math.min(cornerRadius, hw, hd);
    const steps = overview ? 4 : 8;
    for (let side = 0; side < 4; side++) for (let step = 0; step <= steps; step++) {
      const a = (side + step / steps) * Math.PI / 2;
      const cx = side === 0 || side === 3 ? hw - corner : -hw + corner;
      const cz = side < 2 ? hd - corner : -hd + corner;
      points.push(new Vector3(cx + Math.cos(a) * corner, 0, cz + Math.sin(a) * corner));
      outward.push(new Vector3(Math.cos(a), 0, Math.sin(a)));
    }
  } else {
    // Exact acelasi poligon ecuatorial ca SphereGeometry din perna, inclusiv overview.
    const segments = overview ? 16 : 28;
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      points.push(new Vector3(Math.sign(c) * Math.pow(Math.abs(c), 0.38) * hw, 0,
        Math.sign(s) * Math.pow(Math.abs(s), 0.38) * hd));
    }
  }
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= points.length; i++) {
    const point = points[i % points.length];
    const tangent = points[(i + 1) % points.length].clone().sub(points[(i + points.length - 1) % points.length]).normalize();
    const direction = outward[i % points.length] ?? new Vector3(tangent.z, 0, -tangent.x);
    for (let j = 0; j <= 4; j++) {
      const angle = j / 4 * Math.PI * 2;
      const nx = direction.x * Math.cos(angle), ny = Math.sin(angle), nz = direction.z * Math.cos(angle);
      positions.push(point.x + nx * radius, ny * radius, point.z + nz * radius);
      normals.push(nx, ny, nz); uvs.push(i / points.length, j / 4);
      if (i < points.length && j < 4) {
        const a = i * 5 + j, b = a + 5;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  return geometry;
}

export function createEllipticGeometry(w: number, h: number, d: number, radius = 0.003, overview = false) {
  const bevel = Math.min(radius, h / 3, Math.min(w, d) / 8);
  const radial = bevel / Math.min(w, d);
  // Fata superioara plana, muchie subtire si retragere discreta dedesubt.
  const profile = [[0, -h / 2], [.5 - radial * 1.4, -h / 2],
    [.5 - radial, -h / 2 + bevel * .25], [.5, h / 2 - bevel],
    [.5, h / 2 - bevel * .4], [.5 - radial * .25, h / 2 - bevel * .1],
    [.5 - radial * .5, h / 2], [0, h / 2]].map(([x, y]) => new Vector2(x, y));
  const geometry = new LatheGeometry(profile, overview ? 24 : 48);
  // Cu dimensiuni reale in vertecsi, fibra nu se intinde pe mesele rotunde.
  geometry.scale(w, 1, d);
  geometry.computeBoundingBox();
  return geometry;
}

// Forma moale ramane integral in gabaritul derivat din configuratie.
export function createCushionGeometry(w: number, h: number, d: number, overview = false) {
  const result = new SphereGeometry(1, overview ? 16 : 28, overview ? 12 : 18);
  const positions = result.getAttribute('position');
  const puff = (v: number, power: number) => Math.sign(v) * Math.pow(Math.abs(v), power);
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, puff(positions.getX(i), 0.38) * w / 2,
      puff(positions.getY(i), 0.65) * h / 2, puff(positions.getZ(i), 0.38) * d / 2);
  }
  result.computeVertexNormals();
  result.computeBoundingBox();
  return result;
}
