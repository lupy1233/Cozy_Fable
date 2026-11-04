import { BACK_T, FRONT_GAP } from './config';
import type { Panel3d } from './model';

export interface DrawerAssembly3d {
  // Coordonate locale fata de centrul frontului. Doar moving urmeaza frontul.
  moving: Panel3d[];
  fixed: Panel3d[];
  travel: number;
}

// Cos rabatabil simplificat; intreaga tava ramane atasata frontului.
export function buildTiltTray(front: Panel3d, depthM: number): Panel3d[] {
  const width = front.w - 0.04;
  const depth = Math.min(front.h * 0.45, depthM - BACK_T - front.d - 0.035);
  const height = Math.min(0.12, front.h * 0.3);
  const bottom = -front.h / 2 + 0.025;
  const z = -front.d / 2 - depth / 2;
  return [
    { role: 'FURNITURE', x: 0, y: bottom, z, w: width, h: 0.012, d: depth },
    { role: 'FURNITURE', x: 0, y: bottom + height / 2, z: -front.d / 2 - depth + 0.006, w: width, h: height, d: 0.012 },
    ...[-1, 1].map(sign => ({ role: 'FURNITURE' as const, x: sign * (width - 0.012) / 2, y: bottom + height / 2, z, w: 0.012, h: height, d: depth })),
  ];
}

export function buildDrawerAssembly(front: Panel3d, depthM: number): DrawerAssembly3d {
  const t = 0.012;
  const boxW = front.w - 0.036;
  const boxD = Math.max(0.08, front.z - front.d / 2 + depthM / 2 - BACK_T - 0.03);
  const boxH = Math.max(0.045, Math.min(front.h - 0.028, front.h * 0.62));
  const bottomY = -front.h / 2 + 0.018;
  const sideY = bottomY + t / 2 + boxH / 2;
  const z = -front.d / 2 - boxD / 2;
  const moving: Panel3d[] = [];
  const fixed: Panel3d[] = [];
  const panel = (x: number, y: number, pz: number, w: number, h: number, d: number,
    surface?: Panel3d['surface']): Panel3d => ({ role: 'FURNITURE', x, y, z: pz, w, h, d, radius: 0.001, surface });
  moving.push(panel(0, bottomY, z, boxW, t, boxD));
  for (const sign of [-1, 1]) {
    moving.push(panel(sign * (boxW - t) / 2, sideY, z, t, boxH, boxD));
    moving.push(panel(sign * (boxW / 2 + 0.0025), bottomY + boxH * 0.44, z,
      0.005, 0.018, boxD - 0.016, 'METAL'));
    fixed.push(panel(sign * (boxW / 2 + 0.009), bottomY + boxH * 0.44, z,
      0.008, 0.03, boxD - 0.008, 'METAL'));
    const runnerOuter = boxW / 2 + 0.013;
    const wallInner = front.w / 2 + FRONT_GAP;
    for (const depthFraction of [0.2, 0.8]) {
      fixed.push(panel(sign * (runnerOuter + wallInner) / 2, bottomY + boxH * 0.44,
        -front.d / 2 - boxD * depthFraction, wallInner - runnerOuter + 0.002, 0.028, 0.028, 'METAL'));
    }
  }
  moving.push(panel(0, sideY, -front.d / 2 - boxD + t / 2, boxW - 2 * t, boxH, t));
  return { moving, fixed, travel: boxD * 0.76 };
}
