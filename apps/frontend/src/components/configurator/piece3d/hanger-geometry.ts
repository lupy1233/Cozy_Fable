import { CatmullRomCurve3, ExtrudeGeometry, Path, Shape, TubeGeometry, Vector3 } from 'three';

// Profil subtire de lemn cu gol interior; umerasul ocupa planul Y/Z, bara ocupa X.
export function createHangerGeometry(w: number, h: number, d: number) {
  const bevel = .001;
  const half = d / 2 - bevel, top = h / 2 - bevel, bottom = -h / 2 + bevel;
  const outline = new Shape();
  outline.moveTo(-.018, top);
  outline.lineTo(.018, top);
  outline.lineTo(half, bottom + .026);
  outline.lineTo(half, bottom + .009);
  outline.lineTo(half - .014, bottom);
  outline.lineTo(-half + .014, bottom);
  outline.lineTo(-half, bottom + .009);
  outline.lineTo(-half, bottom + .026);
  outline.closePath();
  const opening = new Path();
  opening.moveTo(0, top - .025);
  opening.lineTo(-half + .034, bottom + .016);
  opening.lineTo(half - .034, bottom + .016);
  opening.closePath();
  outline.holes.push(opening);
  const geometry = new ExtrudeGeometry(outline, { depth: w - 2 * bevel, steps: 1,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  geometry.translate(0, 0, -(w - 2 * bevel) / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.computeBoundingBox();
  return geometry;
}

// Carligul inconjoara bara de 26 mm; interiorul curbei atinge partea ei superioara.
export function createHangerHookGeometry(overview = false) {
  const centerY = .0375, radius = .017;
  const points = [new Vector3(0, -.0545, 0), new Vector3(0, .0015, 0), new Vector3(0, .0115, -.006)];
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI * (1.25 + i / 10 * 1.25);
    points.push(new Vector3(0, centerY + Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  const geometry = new TubeGeometry(new CatmullRomCurve3(points), overview ? 16 : 24, .002, overview ? 4 : 6, false);
  geometry.computeBoundingBox();
  return geometry;
}
