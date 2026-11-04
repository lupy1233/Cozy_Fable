import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Fetele plane au doar doua triunghiuri; subdivizam numai muchiile si colturile.
export function createBoardGeometry(w: number, h: number, d: number, radius = .002, overview = false) {
  const r = Math.max(0, Math.min(radius, w / 4, h / 4, d / 4));
  if (!r) return new BoxGeometry(w, h, d);
  const half = [w / 2, h / 2, d / 2];
  const core = half.map(value => value - r);
  const steps = overview ? (r > .01 ? 2 : 1) : (r > .01 ? 4 : 2);
  const positions: number[] = [], normals: number[] = [], uv: number[] = [];
  type Vertex = { p: Vector3; n: Vector3 };
  const vertex = (center: number[], normal: number[]): Vertex => {
    const n = new Vector3(...normal as [number, number, number]).normalize();
    return { p: new Vector3(...center as [number, number, number]).addScaledVector(n, r), n };
  };
  const triangle = (a: Vertex, b: Vertex, c: Vertex) => {
    const cross = b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p));
    if (cross.lengthSq() < 1e-24) return;
    const verts = cross.dot(a.n.clone().add(b.n).add(c.n)) < 0 ? [a, c, b] : [a, b, c];
    for (const { p, n } of verts) {
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      uv.push(p.x / w + .5, p.z / d + .5);
    }
  };
  const quad = (a: Vertex, b: Vertex, c: Vertex, e: Vertex) => { triangle(a, b, c); triangle(a, c, e); };
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => {
      const p = [0, 0, 0], n = [0, 0, 0];
      p[axis] = sign * core[axis]; p[u] = su * core[u]; p[v] = sv * core[v]; n[axis] = sign;
      return vertex(p, n);
    });
    quad(points[0], points[1], points[2], points[3]);
  }
  for (let axis = 0; axis < 3; axis++) for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const edge = (along: number, step: number) => {
      const p = [0, 0, 0], n = [0, 0, 0];
      p[axis] = along * core[axis]; p[u] = su * core[u]; p[v] = sv * core[v];
      n[u] = su * (steps - step); n[v] = sv * step;
      return vertex(p, n);
    };
    for (let step = 0; step < steps; step++) quad(edge(-1, step), edge(1, step), edge(1, step + 1), edge(-1, step + 1));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const center = [sx * core[0], sy * core[1], sz * core[2]];
    const corner = (i: number, j: number) => vertex(center, [sx * i, sy * j, sz * (steps - i - j)]);
    for (let i = 0; i < steps; i++) for (let j = 0; j < steps - i; j++) {
      triangle(corner(i, j), corner(i + 1, j), corner(i, j + 1));
      if (i + j < steps - 1) triangle(corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeBoundingBox();
  return geometry;
}
