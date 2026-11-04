import { LatheGeometry, Vector2 } from 'three';

export function createCatalogGeometry(shape: 'ROUND_CUSHION' | 'BASIN' | 'ROUND_SHELL', w: number, h: number, d: number, overview = false) {
  const wall = Math.min(0.25, 0.065 / w);
  const profile = shape === 'BASIN'
    ? [[0.07, -0.5], [0.52, -0.5], [0.78, -0.28], [0.94, 0.14], [1, 0.44], [0.99, 0.5], [0.94, 0.49], [0.88, 0.13], [0.74, -0.2], [0.49, -0.36], [0.07, -0.36], [0.07, -0.5]]
    : shape === 'ROUND_SHELL'
      ? [[1 - wall, -0.5], [0.97, -0.5], [1, -0.44], [1, 0.44], [0.97, 0.5], [1 - wall, 0.5], [1 - wall, -0.5]]
      : [[0, -0.5], [0.85, -0.5], [0.96, -0.4], [1, -0.12], [0.998, 0.06], [0.98, 0.13], [0.998, 0.17], [0.97, 0.34], [0.83, 0.46], [0.45, 0.5], [0, 0.5]];
  const geometry = new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), overview ? 24 : 40);
  geometry.scale(w / 2, h, d / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
