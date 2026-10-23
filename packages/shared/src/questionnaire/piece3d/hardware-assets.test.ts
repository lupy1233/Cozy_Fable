import { describe, expect, it } from 'vitest';
import {
  defaultPieceConfig, describePieceConfig, LEG_H, normalizePieceConfig, PIECE3D_HANDLE_STYLES, pieceConfig3dSchema,
} from './config';
import { validFurnitureConfig } from './furniture-config';
import { HANDLE_BAR_CC_MM, HARDWARE_ASSET_NODES, legAsset } from './hardware-assets';
import { buildPanels, type Panel3d } from './model';
import { buildDoorHingeDetails, buildFrontHandle, buildStaticHandles } from './showroom-details';

// Prototip 2026-10-22: ancorele GLB ale feroneriei. Primitivele istorice raman
// mereu (rezerva), modelul se monteaza doar cand incape pe piesa.
const drawer = (w: number, h: number): Panel3d => ({ role: 'DRAWER_FRONT', x: 0, y: 0, z: 0, w, h, d: 0.018 });
const door = (w: number, h: number, hinge: 'L' | 'R' = 'L'): Panel3d => ({ role: 'DOOR_FRONT', x: 0, y: 0, z: 0, w, h, d: 0.018, hinge });
const shape = (p: Panel3d) => [p.x, p.y, p.z, p.w, p.h, p.d, p.surface, p.shape, p.axis, p.radius];

describe('handle GLB anchors', () => {
  it('keeps the historic primitives for every style and marks them as fallback of one anchored node', () => {
    const plain = buildFrontHandle(drawer(0.6, 0.2));
    expect(plain.some(p => p.asset || p.assetFallback)).toBe(true);
    for (const style of PIECE3D_HANDLE_STYLES) {
      const parts = buildFrontHandle(drawer(0.6, 0.2), false, style);
      expect(parts.map(shape)).toEqual(plain.map(shape));
      const anchors = parts.filter(p => p.asset);
      expect(anchors).toHaveLength(1);
      const node = anchors[0].asset!.node;
      expect(HARDWARE_ASSET_NODES).toContain(node);
      expect(anchors[0].asset!.surface).toBe('BRASS');
      expect(parts.every(p => p.assetFallback === node)).toBe(true);
    }
  });

  it('picks the largest standard bar that fits and leaves tiny fronts to the primitives', () => {
    expect(buildFrontHandle(drawer(0.8, 0.2))[0].asset).toMatchObject({ id: 'HANDLE_BAR', node: 'handle_bar_256', rotationZ: 0 });
    expect(buildFrontHandle(drawer(0.3, 0.2))[0].asset?.node).toBe('handle_bar_096');
    expect(buildFrontHandle(door(0.4, 0.7))[0].asset).toMatchObject({ node: 'handle_bar_256', rotationZ: Math.PI / 2 });
    const tiny = buildFrontHandle(drawer(0.2, 0.12));
    expect(tiny).toHaveLength(3);
    expect(tiny.some(p => p.asset || p.assetFallback)).toBe(false);
    for (const cc of HANDLE_BAR_CC_MM) expect(HARDWARE_ASSET_NODES).toContain(`handle_bar_${String(cc).padStart(3, '0')}`);
  });

  it('mounts every style on the front face, inside the front outline', () => {
    const fronts = [drawer(0.6, 0.2), door(0.4, 0.7, 'L'), door(0.4, 0.7, 'R'), { ...drawer(0.5, 0.3), role: 'TILT_FRONT' as const }];
    for (const style of PIECE3D_HANDLE_STYLES) for (const front of fronts) {
      const anchor = buildFrontHandle(front, false, style).find(p => p.asset)?.asset;
      expect(anchor, `${style} on ${front.role}`).toBeDefined();
      const [mx, my, mz] = anchor!.mount;
      expect(Math.abs(mx)).toBeLessThanOrEqual(front.w / 2 + 1e-9);
      expect(Math.abs(my)).toBeLessThanOrEqual(front.h / 2 + 1e-9);
      expect(mz).toBeGreaterThan(front.d / 2);
      expect(mz).toBeLessThan(front.d / 2 + 0.002);
    }
  });

  it('scales the edge profile along the front and hugs the opening edge of doors', () => {
    const onDrawer = buildFrontHandle(drawer(0.6, 0.2), false, 'PROFILE')[0].asset!;
    expect(onDrawer.node).toBe('handle_profile');
    expect(onDrawer.scale![0]).toBeCloseTo(0.58);
    expect(onDrawer.scale!.slice(1)).toEqual([1, 1]);
    expect(onDrawer.mount[0]).toBe(0);
    expect(onDrawer.mount[1]).toBeCloseTo(0.1);
    const right = buildFrontHandle(door(0.4, 0.7, 'R'), false, 'PROFILE')[0].asset!;
    expect(right.mount[0]).toBeCloseTo(-0.2);
    expect(right.rotationZ).toBeCloseTo(Math.PI / 2);
    expect(right.scale![0]).toBeCloseTo(0.68);
    const left = buildFrontHandle(door(0.4, 0.7, 'L'), false, 'PROFILE')[0].asset!;
    expect(left.mount[0]).toBeCloseTo(0.2);
    expect(left.rotationZ).toBeCloseTo(-Math.PI / 2);
  });

  it('never anchors a model on flush sliding pulls or recessed drawers', () => {
    const sliding: Panel3d = { role: 'SLIDING_FRONT', x: 0, y: 0, z: 0, w: 0.6, h: 2, d: 0.018, slideDx: 0.6 };
    for (const style of PIECE3D_HANDLE_STYLES) {
      expect(buildFrontHandle(sliding, false, style).some(p => p.asset || p.assetFallback)).toBe(false);
      expect(buildFrontHandle(drawer(0.6, 0.2), true, style).some(p => p.asset || p.assetFallback)).toBe(false);
    }
  });

  it('moves anchors into piece coordinates for static scenes, following the config style', () => {
    const config = normalizePieceConfig('DRESSER', { ...defaultPieceConfig('DRESSER'), frontStyle: 'HANDLE', handleStyle: 'KNOB' });
    expect(config.handleStyle).toBe('KNOB');
    const statics = buildStaticHandles(config, buildPanels(config, 'DRESSER'));
    const anchors = statics.filter(p => p.asset);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.asset!.node).toBe('handle_knob');
      expect(anchor.asset!.mount[0]).toBeCloseTo(anchor.x, 9);
      expect(anchor.asset!.mount[1]).toBeCloseTo(anchor.y, 9);
      // bara istorica sta la 14 mm de fata; modelul la 0,5 mm
      expect(anchor.asset!.mount[2]).toBeCloseTo(anchor.z - 0.014 + 0.0005, 9);
    }
  });
});

describe('leg and hinge GLB anchors', () => {
  it('lists the leg and hinge nodes next to the handles', () => {
    for (const node of ['leg_tapered', 'hinge_cup_l', 'hinge_cup_r']) expect(HARDWARE_ASSET_NODES).toContain(node);
  });

  it('mounts the tapered leg under cabinets on legs, at the top of each leg, unscaled, in the body finish', () => {
    const config = normalizePieceConfig('DRESSER', { ...defaultPieceConfig('DRESSER'), legs: true });
    expect(config.legs).toBe(true);
    const legs = buildPanels(config, 'DRESSER').filter(p => p.role === 'LEG');
    expect(legs).toHaveLength(4);
    for (const leg of legs) {
      expect(leg.asset).toMatchObject({ id: 'LEG_TAPERED', node: 'leg_tapered' });
      expect(leg.assetFallback).toBe('leg_tapered');
      expect(leg.asset!.mount).toEqual([leg.x, LEG_H, leg.z]);
      expect(leg.asset!.scale).toEqual([1, 1, 1]);
      expect(leg.asset!.surface).toBeUndefined();
    }
    expect(buildPanels(normalizePieceConfig('DRESSER', defaultPieceConfig('DRESSER')), 'DRESSER').some(p => p.role === 'LEG')).toBe(false);
  });

  it('keeps tall furniture legs procedural and gives upholstered pieces the leg finish, scaled to their size', () => {
    const table = buildPanels(normalizePieceConfig('TABLE', defaultPieceConfig('TABLE')), 'TABLE');
    expect(table.filter(p => p.role === 'LEG').length).toBeGreaterThan(0);
    expect(table.some(p => p.asset || p.assetFallback)).toBe(false);
    expect(legAsset(0, 0.3, 0, 0.065, 0.3, 0.065)).toEqual({});
    const base = defaultPieceConfig('OTTOMAN');
    const config = normalizePieceConfig('OTTOMAN', { ...base, upholstery: { ...base.upholstery!, base: 'OAK' } });
    const legs = buildPanels(config, 'OTTOMAN').filter(p => p.shape === 'TAPERED_LEG');
    expect(legs.length).toBeGreaterThan(0);
    for (const leg of legs) {
      expect(leg.asset).toMatchObject({ node: 'leg_tapered', surface: 'LEG_FINISH' });
      expect(leg.asset!.mount[1]).toBeCloseTo(leg.y + leg.h / 2, 9);
      expect(leg.asset!.scale![1]).toBeCloseTo(leg.h / 0.12, 9);
    }
    const black = normalizePieceConfig('OTTOMAN', { ...base, upholstery: { ...base.upholstery!, base: 'BLACK' } });
    expect(buildPanels(black, 'OTTOMAN').some(p => p.asset)).toBe(false);
  });

  it('anchors a cup hinge per hinge position on the back of doors, mirrored by side', () => {
    for (const hinge of ['L', 'R'] as const) {
      const front = door(0.4, 0.7, hinge);
      const parts = buildDoorHingeDetails(front);
      const cups = parts.filter(p => p.asset);
      expect(cups).toHaveLength(2);
      for (const cup of cups) {
        expect(cup.asset).toMatchObject({ id: 'HINGE_CUP', node: hinge === 'R' ? 'hinge_cup_r' : 'hinge_cup_l', surface: 'METAL' });
        expect(cup.asset!.mount[2]).toBeCloseTo(-front.d / 2, 9);
        expect(Math.abs(cup.asset!.mount[0])).toBeLessThan(front.w / 2);
        expect(Math.sign(cup.asset!.mount[0])).toBe(hinge === 'R' ? 1 : -1);
      }
      expect(parts.every(p => p.assetFallback?.startsWith('hinge_cup'))).toBe(true);
    }
    expect(buildDoorHingeDetails(door(0.4, 2.0)).filter(p => p.asset)).toHaveLength(3);
    expect(buildDoorHingeDetails(door(0.25, 0.1)).some(p => p.asset || p.assetFallback)).toBe(false);
  });
});

describe('handle style in the config', () => {
  it('is kept only with visible handles, omits BAR and validates with the schema', () => {
    const base = defaultPieceConfig('WARDROBE');
    expect(normalizePieceConfig('WARDROBE', { ...base, frontStyle: 'HANDLE', handleStyle: 'SHELL' }).handleStyle).toBe('SHELL');
    expect(normalizePieceConfig('WARDROBE', { ...base, frontStyle: 'HANDLE', handleStyle: 'BAR' }).handleStyle).toBeUndefined();
    expect(normalizePieceConfig('WARDROBE', { ...base, frontStyle: 'PUSH', handleStyle: 'SHELL' }).handleStyle).toBeUndefined();
    expect(normalizePieceConfig('WARDROBE', { ...base, handleStyle: 'SHELL' }).handleStyle).toBeUndefined();
    const schema = pieceConfig3dSchema('WARDROBE');
    const withHandles = normalizePieceConfig('WARDROBE', { ...base, frontStyle: 'HANDLE' });
    for (const style of PIECE3D_HANDLE_STYLES) expect(schema.safeParse({ ...withHandles, handleStyle: style }).success).toBe(true);
    expect(schema.safeParse({ ...withHandles, handleStyle: 'FOO' }).success).toBe(false);
  });

  it('names the handle type for firms without changing the historic bar text', () => {
    const base = normalizePieceConfig('DRESSER', { ...defaultPieceConfig('DRESSER'), frontStyle: 'HANDLE' });
    expect(describePieceConfig('DRESSER', base)).toMatch(/fronturi cu maner(,|$)/);
    expect(describePieceConfig('DRESSER', { ...base, handleStyle: 'SHELL' })).toContain('fronturi cu maner scoica');
    expect(describePieceConfig('DRESSER', { ...base, handleStyle: 'PROFILE' })).toContain('fronturi cu maner profil');
  });

  it('is rejected and dropped on furniture without fronts', () => {
    const bed = defaultPieceConfig('BED');
    expect(validFurnitureConfig('BED', { ...bed, handleStyle: 'KNOB' })).toBe(false);
    expect(normalizePieceConfig('BED', { ...bed, handleStyle: 'KNOB' }).handleStyle).toBeUndefined();
  });
});
