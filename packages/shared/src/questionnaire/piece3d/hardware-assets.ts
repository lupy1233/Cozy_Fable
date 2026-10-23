import type { Panel3d, Panel3dAsset } from './model';

// Prototip 2026-10-22: feronerie din modele GLB (apps/frontend/public/3d/
// hardware.glb, generat din Blender cu tools/make-hardware.py). Nodurile de
// aici trebuie sa existe in fisier. Primitivele procedurale raman MEREU in
// lista de panouri, ca rezerva (`assetFallback`): randarea le deseneaza cand
// modelul nu e incarcat. Nimic de aici nu intra in config, BOM sau pret.
export const HANDLE_BAR_CC_MM = [96, 128, 160, 192, 256, 320] as const;
export const handleBarNode = (cc: number) => `handle_bar_${String(cc).padStart(3, '0')}`;
export const HARDWARE_ASSET_NODES: readonly string[] = [
  ...HANDLE_BAR_CC_MM.map(handleBarNode), 'handle_knob', 'handle_shell', 'handle_profile',
  'leg_tapered', 'hinge_cup_l', 'hinge_cup_r',
];

// piciorul canonic din GLB (m): origine sus, in centru; se scaleaza pe fiecare axa
export const LEG_ASSET_SIZE = { w: 0.05, h: 0.12, d: 0.05 } as const;
// in afara intervalului (ex. picioarele mesei) piciorul ramane procedural
const LEG_ASSET_H_RANGE: readonly [number, number] = [0.08, 0.18];
// usile mai scunde pastreaza balamalele procedurale (butucul din model are 42mm)
const HINGE_ASSET_MIN_DOOR_H = 0.12;

type AssetFields = Pick<Panel3d, 'asset' | 'assetFallback'>;

// Picior conic: x/z = centrul piciorului, top = cota de sus (unde se prinde de corp).
export function legAsset(x: number, top: number, z: number, w: number, h: number, d: number, surface?: Panel3d['surface']): AssetFields {
  if (h < LEG_ASSET_H_RANGE[0] || h > LEG_ASSET_H_RANGE[1]) return {};
  const node = 'leg_tapered';
  const asset: Panel3dAsset = {
    id: 'LEG_TAPERED', node, mount: [x, top, z],
    scale: [w / LEG_ASSET_SIZE.w, h / LEG_ASSET_SIZE.h, d / LEG_ASSET_SIZE.d],
  };
  if (surface) asset.surface = surface;
  return { asset, assetFallback: node };
}

// Balama cu cupa pe spatele usii: x/y = centrul cupei in coordonatele usii.
export function hingeAsset(front: Panel3d, x: number, y: number): AssetFields {
  if (front.h < HINGE_ASSET_MIN_DOOR_H) return {};
  const node = front.hinge === 'R' ? 'hinge_cup_r' : 'hinge_cup_l';
  return { asset: { id: 'HINGE_CUP', node, mount: [x, y, -front.d / 2], surface: 'METAL' }, assetFallback: node };
}
