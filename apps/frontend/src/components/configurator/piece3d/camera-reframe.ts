import { Vector3, type Camera } from 'three';

// Etapa 9 (l1, pasul 1): cand se reincadreaza singura camera piesei. Orbita aleasa de om ramane
// cat timp piesa incape; camera se muta doar cand piesa iese din cadru sau gabaritul creste
// vizibil (peste ~20% fata de ultima incadrare). Functii pure, testate separat.

export interface PieceBounds {
  width: number;
  height: number;
  depth: number;
}

// pragul de crestere a gabaritului (diagonala cutiei) peste care reincadram
export const REFRAME_GROWTH = 1.2;

const diagonal = (b: PieceBounds) => Math.hypot(b.width, b.height, b.depth);

// Cutia piesei sta centrata pe X/Z, pe podea (y de la 0 la inaltime) — ca in fitShowroomCamera.
export function pieceBoxCorners(b: PieceBounds): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [-b.width / 2, b.width / 2])
    for (const y of [0, b.height])
      for (const z of [-b.depth / 2, b.depth / 2]) out.push(new Vector3(x, y, z));
  return out;
}

// Adevarat cand un colt al piesei iese din cadrul camerei (sau ajunge in spatele ei).
export function boundsOutOfView(camera: Camera, b: PieceBounds, margin = 1): boolean {
  camera.updateMatrixWorld();
  if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
    camera.updateProjectionMatrix();
  }
  return pieceBoxCorners(b).some((corner) => {
    const p = corner.project(camera);
    return !Number.isFinite(p.x) || Math.abs(p.x) > margin || Math.abs(p.y) > margin || p.z < -1 || p.z > 1;
  });
}

export function shouldReframe({
  framed,
  next,
  outOfView,
}: {
  framed: PieceBounds;
  next: PieceBounds;
  outOfView: boolean;
}): boolean {
  if (outOfView) return true;
  const before = diagonal(framed);
  if (before <= 0) return true;
  return diagonal(next) > before * REFRAME_GROWTH;
}
