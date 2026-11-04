'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Camera, Vector3 } from 'three';
import { fitShowroomCamera } from './showroom-camera';

type OrbitControlsLike = {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
};

type CameraFit = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  minDistance: number;
  maxDistance: number;
};

// Pozitia apartine utilizatorului dupa incadrarea initiala; editarile extind
// doar limitele de zoom, fara sa modifice orbita, tinta sau distanta curenta.
export function StableOrbitCamera({ sceneId, fit }: { sceneId: string; fit: CameraFit }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const initialized = useRef<{ camera: Camera; controls: OrbitControlsLike; sceneId: string } | null>(null);
  const [px, py, pz] = fit.position;
  const [tx, ty, tz] = fit.target;

  useEffect(() => {
    if (!controls || size.width <= 0 || size.height <= 0) return;
    const previous = initialized.current;
    if (!previous || previous.camera !== camera || previous.sceneId !== sceneId) {
      controls.minDistance = fit.minDistance;
      controls.maxDistance = fit.maxDistance;
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      camera.lookAt(controls.target);
      initialized.current = { camera, controls, sceneId };
      controls.update();
      invalidate();
      return;
    }

    if (previous.controls !== controls) {
      controls.target.copy(previous.controls.target);
      controls.minDistance = previous.controls.minDistance;
      controls.maxDistance = previous.controls.maxDistance;
      initialized.current = { camera, controls, sceneId };
    }
    const distance = camera.position.distanceTo(controls.target);
    controls.minDistance = Math.min(controls.minDistance, fit.minDistance, distance);
    controls.maxDistance = Math.max(controls.maxDistance, fit.maxDistance, distance);
  }, [camera, controls, invalidate, sceneId, size.width, size.height, px, py, pz, tx, ty, tz, fit.minDistance, fit.maxDistance]);
  return null;
}

export function PieceCameraRig({ width, height, depth }: { width: number; height: number; depth: number }) {
  const size = useThree((s) => s.size);
  const fit = fitShowroomCamera(width, height, depth, size.width / Math.max(size.height, 1));
  return <StableOrbitCamera sceneId="piece" fit={{ ...fit, minDistance: Math.max(0.8, Math.max(width, height, depth) * 0.7) }} />;
}

export function RoomCameraRig({ w, d, sceneId }: { w: number; d: number; sceneId: string }) {
  const viewport = useThree((s) => s.size);
  const portraitScale = Math.max(1, 0.9 * viewport.height / Math.max(viewport.width, 1));
  const dist = (Math.max(w, d) * 1.05 + 1.4) * portraitScale;
  return <StableOrbitCamera sceneId={sceneId} fit={{ position: [dist * 0.8, dist * 0.75, dist], target: [0, 0.5, 0], minDistance: 1.6, maxDistance: Math.max(Math.max(w, d) * 3 + 6, dist * 2) }} />;
}

export function HouseCameraRig({ size, cx, cz, width = size, depth = size, height = 2.6 }: { size: number; cx: number; cz: number; width?: number; depth?: number; height?: number }) {
  const viewport = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const length = Math.hypot(0.8, 1.1, 1);
  const direction = [0.8 / length, 1.1 / length, 1 / length];
  const horizontal = Math.hypot(direction[0], direction[2]);
  const right = [direction[2] / horizontal, 0, -direction[0] / horizontal];
  const up = [-direction[1] * direction[0] / horizontal, horizontal, -direction[1] * direction[2] / horizontal];
  const fov = 'fov' in camera ? Number(camera.fov) : 42;
  const tanVertical = Math.tan(fov * Math.PI / 360);
  const aspect = Math.max(viewport.width / Math.max(viewport.height, 1), 0.01);
  const targetY = (height - 0.12) / 2;
  let distance = 2;
  // Incadram toate colturile, inclusiv varful peretilor, cu margine pentru orbitare.
  for (const x of [-width / 2, width / 2]) for (const y of [-(height + 0.12) / 2, (height + 0.12) / 2]) for (const z of [-depth / 2, depth / 2]) {
    const towardCamera = x * direction[0] + y * direction[1] + z * direction[2];
    const screenX = Math.abs(x * right[0] + z * right[2]);
    const screenY = Math.abs(x * up[0] + y * up[1] + z * up[2]);
    distance = Math.max(distance, towardCamera + Math.max(screenX / (tanVertical * aspect), screenY / tanVertical) / 0.8);
  }
  return <StableOrbitCamera sceneId="house" fit={{ position: [cx + direction[0] * distance, targetY + direction[1] * distance, cz + direction[2] * distance], target: [cx, targetY, cz], minDistance: 2, maxDistance: Math.max(size * 4, distance * 2) }} />;
}
