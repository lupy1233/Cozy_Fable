import { describe, expect, it } from 'vitest';
import { NEW_PIECE_KINDS, SOFA_LAYOUTS, defaultPieceConfig, normalizePieceConfig, pieceConfig3dSchema, buildPanels, panelsWithinBounds, describePieceConfig, type PieceConfig3d, type Piece3dKind } from './index';
import { getFlow, validateRoomAnswers } from '../engine';

const variants: Array<[Piece3dKind, Partial<PieceConfig3d>]> = [];
for (const layout of SOFA_LAYOUTS) for (const seats of [2, 3, 4]) for (const arms of ['SLIM', 'WIDE'] as const) for (const cushions of ['SPLIT', 'BENCH'] as const)
  variants.push(['SOFA', { widthM: 1.4, sofa: { seats, layout, arms, cushions, bodyDepthM: 0.8, chaiseDepthM: 2 } }]);
for (const shape of ['RECTANGULAR', 'ROUND'] as const) for (const storage of [true, false]) for (const base of ['OAK', 'BLACK', 'PLINTH'] as const)
  variants.push(['OTTOMAN', { widthM: 0.4, depthM: 1.4, ottoman: { shape, storage }, upholstery: { fabric: 'BOUCLE', color: '#91775e', firmness: 'SOFT', base } }]);
for (const mounting of ['WALL', 'FLOOR'] as const) for (const basins of ['SINGLE', 'DOUBLE'] as const) for (const storage of ['DRAWERS', 'DOORS', 'OPEN'] as const)
  for (const widthM of [0.6, 2]) variants.push(['BATHROOM_VANITY', { widthM, heightM: 0.5, depthM: 0.4, vanity: { mounting, basins, storage, handles: 'HANDLE', countertop: 'DARK' } }]);
for (const mirror of ['NONE', 'LEFT', 'RIGHT'] as const) for (const shoeStorage of ['OPEN', 'DOORS'] as const)
  variants.push(['ENTRYWAY', { widthM: 0.8, heightM: 1.6, depthM: 0.35, entryway: { hooks: 6, mirror, shoeStorage, upperShelf: true, upholsteredSeat: true } }]);

describe('new catalog dimensions, storage and quotation contract', () => {
  it.each(variants.map(([kind, patch], i) => ({ kind, patch, i })))('$kind variant $i stays bounded and survives export', ({ kind, patch }) => {
    const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...patch });
    expect(pieceConfig3dSchema(kind).parse(JSON.parse(JSON.stringify(config)))).toEqual(config);
    const panels = buildPanels(config, kind);
    expect(panelsWithinBounds(config, panels)).toBe(true);
    expect(panels.every(p => [p.x, p.y, p.z, p.w, p.h, p.d].every(Number.isFinite) && Math.min(p.w, p.h, p.d) > 0)).toBe(true);
    expect(panels.length).toBeLessThan(150);
    const flow = getFlow(`PIECE_${kind}`);
    const answers = { config3d: config, material: 'ALTUL', materialOther: 'Custom frame and upholstery sample' };
    expect(validateRoomAnswers(flow.roomType, answers, { partial: false })).toEqual({ ok: true });
    const derived = flow.deriveRoom(answers);
    expect([derived.lengthM, derived.heightM, derived.widthM]).toEqual([config.widthM, config.heightM, config.depthM]);
    expect(derived.items[0].description).toContain(describePieceConfig(kind, config));
    expect(derived.items[0].material).toBe('ALTUL');
    expect(derived.items[0].description).toContain('Custom frame and upholstery sample');
  });
  it('rejects incorrect family payloads, undeclared elevation and false chaise bounds', () => {
    for (const kind of NEW_PIECE_KINDS) {
      const config = defaultPieceConfig(kind);
      expect(pieceConfig3dSchema(kind).safeParse({ ...config, bed: defaultPieceConfig('BED').bed }).success).toBe(false);
      if (kind !== 'SOFA') expect(pieceConfig3dSchema(kind).safeParse({ ...config, sofa: defaultPieceConfig('SOFA').sofa }).success).toBe(false);
    }
    expect(pieceConfig3dSchema('ARMCHAIR').safeParse({ ...defaultPieceConfig('ARMCHAIR'), mountingHeightM: 1 }).success).toBe(false);
    const config = normalizePieceConfig('SOFA', { ...defaultPieceConfig('SOFA'), sofa: { ...defaultPieceConfig('SOFA').sofa!, layout: 'CHAISE_RIGHT' } });
    expect(config.depthM).toBe(1.6);
    expect(pieceConfig3dSchema('SOFA').safeParse({ ...config, depthM: 0.95 }).success).toBe(false);
  });
  it('vanity drawer trays leave a 16cm plumbing channel and move with their fronts', () => {
    const config = defaultPieceConfig('BATHROOM_VANITY');
    const drawers = buildPanels(config, 'BATHROOM_VANITY').filter(p => p.motion?.key === 'vanity:drawer:0:1');
    expect(drawers.filter(p => p.role === 'DRAWER_FRONT')).toHaveLength(1);
    expect(drawers.filter(p => p.h === 0.012 && p.d > 0.1)).toHaveLength(2);
    for (const panel of drawers.filter(p => p.d > 0.1)) expect(Math.abs(panel.x) - panel.w / 2).toBeGreaterThanOrEqual(0.08 - 1e-6);
    const front = drawers.find(p => p.role === 'DRAWER_FRONT')!;
    for (const panel of drawers.filter(p => p.h === 0.012)) expect(panel.z + panel.d / 2).toBeCloseTo(front.z - front.d / 2, 6);
  });
  it('open vanity omits opening hardware and entryway doors retain their visible handles in requests', () => {
    const vanity = defaultPieceConfig('BATHROOM_VANITY');
    vanity.vanity!.storage = 'OPEN';
    expect(getFlow('PIECE_BATHROOM_VANITY').deriveRoom({ config3d: vanity, material: 'PAL' }).items[0].systems).toEqual([]);
    const entryway = defaultPieceConfig('ENTRYWAY'); entryway.entryway!.shoeStorage = 'DOORS';
    expect(getFlow('PIECE_ENTRYWAY').deriveRoom({ config3d: entryway, material: 'PAL' }).items[0].systems).toEqual(['MANER']);
  });
  it('keeps closed fronts clear of fixed carcass panels', () => {
    for (const [kind, patch] of variants.filter(([k]) => k === 'BATHROOM_VANITY' || k === 'ENTRYWAY')) {
      const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...patch });
      const panels = buildPanels(config, kind);
      for (const front of panels.filter(p => p.role === 'DOOR_FRONT' || p.role === 'DRAWER_FRONT')) for (const fixed of panels.filter(p => !p.motion)) {
        const overlap = Math.min(front.x + front.w / 2, fixed.x + fixed.w / 2) - Math.max(front.x - front.w / 2, fixed.x - fixed.w / 2) > 1e-6 &&
          Math.min(front.y + front.h / 2, fixed.y + fixed.h / 2) - Math.max(front.y - front.h / 2, fixed.y - fixed.h / 2) > 1e-6 &&
          Math.min(front.z + front.d / 2, fixed.z + fixed.d / 2) - Math.max(front.z - front.d / 2, fixed.z - fixed.d / 2) > 1e-6;
        expect(overlap, `${kind}: ${JSON.stringify(fixed)}`).toBe(false);
      }
    }
  });
});
