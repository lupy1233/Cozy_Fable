import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { boundsOutOfView, pieceBoxCorners, REFRAME_GROWTH, shouldReframe } from './camera-reframe';
import { fitShowroomCamera } from './showroom-camera';

// Etapa 9 (l1): decizia de reincadrare a camerei piesei (functii pure).
describe('shouldReframe', () => {
  const framed = { width: 2.4, height: 2.4, depth: 0.6 };

  it('pastreaza orbita cat piesa incape si creste putin', () => {
    expect(shouldReframe({ framed, next: { ...framed, width: 2.6 }, outOfView: false })).toBe(false);
    expect(shouldReframe({ framed, next: { width: 1, height: 1, depth: 0.4 }, outOfView: false })).toBe(false);
  });

  it('reincadreaza la crestere peste ~20% sau cand piesa iese din cadru', () => {
    expect(REFRAME_GROWTH).toBe(1.2);
    expect(shouldReframe({ framed, next: { width: 6, height: 2.8, depth: 0.8 }, outOfView: false })).toBe(true);
    expect(shouldReframe({ framed, next: framed, outOfView: true })).toBe(true);
  });
});

describe('boundsOutOfView', () => {
  const place = (b: { width: number; height: number; depth: number }, aspect: number) => {
    const camera = new PerspectiveCamera(32, aspect, 0.05, 60);
    const fit = fitShowroomCamera(b.width, b.height, b.depth, aspect);
    camera.position.set(...fit.position);
    camera.lookAt(...fit.target);
    return camera;
  };

  it('piesa incadrata e in cadru, pe ecran lat si pe telefon (scena scunda si lata)', () => {
    for (const aspect of [1.6, 375 / 260]) {
      const b = { width: 2.4, height: 2.4, depth: 0.6 };
      expect(boundsOutOfView(place(b, aspect), b)).toBe(false);
    }
  });

  it('dulap 600 × 280 × 80 iese din cadrul unui dulap de 240; biblioteca 400 × 280 × 50 se reincadreaza', () => {
    const camera = place({ width: 2.4, height: 2.4, depth: 0.6 }, 1.6);
    expect(boundsOutOfView(camera, { width: 6, height: 2.8, depth: 0.8 })).toBe(true);
    // biblioteca de 4 m poate inca incapea pe lat, dar gabaritul creste peste 20% → reincadrare
    expect(shouldReframe({
      framed: { width: 2.4, height: 2.4, depth: 0.6 },
      next: { width: 4, height: 2.8, depth: 0.5 },
      outOfView: boundsOutOfView(camera, { width: 4, height: 2.8, depth: 0.5 }),
    })).toBe(true);
    // dupa reincadrare incape
    for (const b of [{ width: 6, height: 2.8, depth: 0.8 }, { width: 4, height: 2.8, depth: 0.5 }]) {
      expect(boundsOutOfView(place(b, 1.6), b)).toBe(false);
      expect(boundsOutOfView(place(b, 375 / 260), b)).toBe(false);
    }
  });

  it('cutia are opt colturi, pe podea', () => {
    const corners = pieceBoxCorners({ width: 2, height: 1, depth: 0.5 });
    expect(corners).toHaveLength(8);
    expect(Math.min(...corners.map((c) => c.y))).toBe(0);
    expect(Math.max(...corners.map((c) => c.y))).toBe(1);
  });
});
