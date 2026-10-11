import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const signedPower = (value: number, power: number) => Math.sign(value) * Math.pow(Math.abs(value), power);
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// Acelasi contur pentru perna si cordon: cusatura nu pluteste dupa redimensionare.
function pillowPoint(x: number, y: number, z: number, w: number, h: number, d: number) {
  const px = signedPower(x, .62), pz = signedPower(z, .62);
  const py = y < 0 ? -Math.min(1, Math.abs(y) * 2.8) * .94
    : Math.pow(y, .86) * (1 - .10 * Math.exp(-9 * (px * px + pz * pz)));
  const pinch = .004 * Math.sin(px * 2.8 + pz * 1.7) * (1 - Math.abs(y));
  return new Vector3(px * (w - .003) / 2, py * h / 2 + pinch,
    pz * (d - .003) / 2 + .006 * Math.sin(px * 2.4) * (1 - pz * pz));
}

export function createBedPillowGeometry(w: number, h: number, d: number, overview = false) {
  const segments = overview ? 16 : 24;
  const body = new SphereGeometry(1, segments, overview ? 12 : 18);
  const position = body.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const p = pillowPoint(position.getX(i), position.getY(i), position.getZ(i), w, h, d);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  body.computeVertexNormals();
  const points = Array.from({ length: segments }, (_, i) => {
    const a = i / segments * Math.PI * 2;
    return pillowPoint(Math.cos(a), 0, Math.sin(a), w, h, d);
  });
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  const radius = .0015;
  for (let i = 0; i <= segments; i++) {
    const p = points[i % segments];
    const tangent = points[(i + 1) % segments].clone().sub(points[(i + segments - 1) % segments]).normalize();
    const outward = new Vector3(tangent.z, 0, -tangent.x).normalize();
    for (let j = 0; j <= 4; j++) {
      const a = j / 4 * Math.PI * 2;
      vertices.push(p.x + outward.x * Math.cos(a) * radius, p.y + Math.sin(a) * radius, p.z + outward.z * Math.cos(a) * radius);
      uv.push(i / segments, j / 4);
      if (i < segments && j < 4) { const a = i * 5 + j, b = a + 5; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const seam = new BufferGeometry();
  seam.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  seam.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  seam.setIndex(indices);
  seam.computeVertexNormals();
  const result = mergeGeometries([body, seam], false)!;
  body.dispose(); seam.dispose();
  result.computeBoundingBox();
  return result;
}

// Volumul frontal al tabliei foloseste aceleasi varfuri ca o perna, fara panouri suplimentare.
export function createHeadboardPadGeometry(w: number, h: number, d: number, overview = false) {
  const result = new SphereGeometry(1, overview ? 12 : 20, overview ? 10 : 14);
  const p = result.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setXYZ(i,
    signedPower(p.getX(i), .28) * w / 2,
    signedPower(p.getY(i), .28) * h / 2,
    signedPower(p.getZ(i), .72) * d / 2);
  result.computeVertexNormals(); result.computeBoundingBox();
  return result;
}

// Cutele sunt calculate o singura data in coordonate metrice, identic sub pled si pilota.
function clothHeight(x: number, z: number, w: number, h: number) {
  const side = smooth((Math.abs(x) - (w / 2 - .035)) / .035);
  const foot = smooth((z - .995) / .075);
  const drop = 1 - (1 - side) * (1 - foot);
  const folds = .009 * (1 + Math.sin(x * 9 + z * 4)) + .003 * (1 + Math.sin(z * 19 - x * 3));
  const edgeFold = .006 * Math.sin(z * 22 + x * 2) * side;
  const turnback = .019 * Math.exp(-Math.pow((z + .40) / .055, 2));
  return h / 2 - .050 - (h - .080) * drop + folds * (1 - .4 * drop) + edgeFold + turnback * (1 - side);
}

// Grila inchisa, rara: nu exista simulare, textura noua sau deformare pe fiecare cadru.
export function createBedClothGeometry(w: number, h: number, d: number, offsetZ: number, overview = false, throwBlanket = false) {
  const across = overview ? 8 : 16, along = overview ? 8 : 16;
  const thickness = throwBlanket ? .005 : .012;
  const xs: number[] = [];
  // Esantioane concentrate la margine pentru a pastra caderea aproape verticala.
  const top = w / 2 - .035;
  for (let i = 0; i <= across; i++) xs.push(-top + 2 * top * i / across);
  xs.unshift(-w / 2, -w / 2 + .009); xs.push(w / 2 - .009, w / 2);
  // Pledul este o portiune din aceeasi grila: inclusiv interpolarea ramane deasupra pilotei.
  const globalZ = [...Array.from({ length: along + 1 }, (_, i) => -.51 + 1.58 * i / along), .37, .87, .995, 1.023, 1.05];
  const start = offsetZ - d / 2, end = offsetZ + d / 2;
  const zs = [...new Set([start, end, ...globalZ.filter(z => z > start + 1e-8 && z < end - 1e-8)])].sort((a, b) => a - b).map(z => z - offsetZ);
  const columns = xs.length, rows = zs.length, layerSize = columns * rows;
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < 2; layer++) for (const z of zs) for (const x of xs) {
    const y = clothHeight(x, z + offsetZ, w, h) - layer * thickness;
    vertices.push(x, y, z); uv.push((x + w / 2) / w, (z + d / 2) / d);
  }
  for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) {
    const a = row * columns + col, b = a + 1, c = a + columns, e = c + 1;
    indices.push(a, c, b, b, c, e);
    indices.push(a + layerSize, b + layerSize, c + layerSize, b + layerSize, e + layerSize, c + layerSize);
  }
  const edge: number[] = [];
  for (let i = 0; i < columns; i++) edge.push(i);
  for (let i = 1; i < rows; i++) edge.push(i * columns + columns - 1);
  for (let i = columns - 2; i >= 0; i--) edge.push((rows - 1) * columns + i);
  for (let i = rows - 2; i > 0; i--) edge.push(i * columns);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  result.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  result.setIndex(indices); result.computeVertexNormals(); result.computeBoundingBox();
  return result;
}
