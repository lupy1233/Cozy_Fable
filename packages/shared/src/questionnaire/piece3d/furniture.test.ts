import { describe, expect, it } from 'vitest';
import { defaultPieceConfig, normalizePieceConfig, pieceConfig3dSchema, PIECE3D_KINDS, PIECE3D_RULES } from './config';
import { BED_MATTRESS_SIZES, BED_MATTRESS_WIDTH, BED_STORAGES, TABLE_TYPES, TABLE_SHAPES, BENCH_STYLES } from './furniture-config';
import { buildPanels, buildZoneBoxes, panelsWithinBounds } from './model';
import { getFlow, collectScoreEntries, isFlowVersionRegistered } from '../engine';

describe('furniture families and legacy contracts', () => {
  for (const mattressSize of BED_MATTRESS_SIZES) for (const storage of BED_STORAGES) for (const upholstered of [true, false]) {
    it(`bed ${mattressSize}/${storage}/${upholstered} retains footprint and quoted mattress dimensions`, () => {
      const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize, storage, upholstered } });
      expect(pieceConfig3dSchema('BED').safeParse(config).success).toBe(true);
      expect(config.widthM).toBeGreaterThan(BED_MATTRESS_WIDTH[mattressSize]);
      const panels = buildPanels(config, 'BED');
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.every((p) => [p.w, p.h, p.d].every((v) => Number.isFinite(v) && v > 0))).toBe(true);
      const answers = { config3d: config, material: 'PAL' };
      const flow = getFlow('PIECE_BED');
      expect(flow.version).toBe(3);
      expect(flow.deriveRoom(answers).lengthM).toBe(BED_MATTRESS_WIDTH[mattressSize]);
      expect(flow.deriveRoom(answers).widthM).toBe(2);
      expect(flow.deriveRoom(answers).items).toHaveLength(1);
      expect(collectScoreEntries('PIECE_BED', answers).some((e) => 'optionKey' in e && e.category === 'BED_STORAGE' && e.optionKey === storage)).toBe(storage !== 'NONE');
      expect(buildZoneBoxes(config, 'BED')).toEqual([]);
    });
  }
  for (const type of TABLE_TYPES) for (const shape of TABLE_SHAPES) {
    if (shape === 'EXTENDABLE' && type !== 'DINING') continue;
    it(`table ${type}/${shape} round trips with correct dimensions`, () => {
      const config = normalizePieceConfig('TABLE', { ...defaultPieceConfig('TABLE'), table: { type, shape }, widthM: shape === 'ROUND' ? 1.1 : 1.3 });
      expect(pieceConfig3dSchema('TABLE').parse(JSON.parse(JSON.stringify(config)))).toEqual(config);
      expect(panelsWithinBounds(config, buildPanels(config, 'TABLE'))).toBe(true);
      const derived = getFlow('PIECE_TABLE').deriveRoom({ config3d: config, material: 'PAL' });
      expect(derived.lengthM).toBe(config.widthM);
      expect(derived.widthM).toBe(config.depthM);
      expect(derived.heightM).toBe(config.heightM);
    });
  }
  for (const style of BENCH_STYLES) for (const upholsteredSeat of [true, false]) for (const widthM of [0.6, 2]) {
    it(`bench ${style}/${upholsteredSeat}/${widthM} respects bounds`, () => {
      const config = normalizePieceConfig('BENCH', { ...defaultPieceConfig('BENCH'), bench: { style, upholsteredSeat }, widthM });
      expect(pieceConfig3dSchema('BENCH').safeParse(config).success).toBe(true);
      expect(panelsWithinBounds(config, buildPanels(config, 'BENCH'))).toBe(true);
      expect(getFlow('PIECE_BENCH').deriveRoom({ config3d: config, material: 'PAL' }).lengthM).toBe(widthM);
    });
  }
  it('rejects mismatched families, invented cabinet controls, nonfinite values and false footprints', () => {
    const bed = defaultPieceConfig('BED');
    for (const invalid of [{ ...bed, widthM: 1.6 }, { ...bed, widthM: NaN }, { ...bed, frontStyle: 'HANDLE' }, { ...bed, table: defaultPieceConfig('TABLE').table }, { ...bed, bed: undefined }])
      expect(pieceConfig3dSchema('BED').safeParse(invalid).success).toBe(false);
    expect(pieceConfig3dSchema('BOOKCASE').safeParse({ ...defaultPieceConfig('BOOKCASE'), bed: bed.bed }).success).toBe(false);
    expect(pieceConfig3dSchema('TABLE').safeParse({ ...defaultPieceConfig('TABLE'), table: { type: 'COFFEE', shape: 'EXTENDABLE' } }).success).toBe(false);
  });
  it('keeps historical flow versions readable and future versions unregistered', () => {
    for (const roomType of ['PIECE_BED', 'PIECE_TABLE', 'PIECE_BENCH'] as const) {
      expect(getFlow(roomType, 1).version).toBe(1);
      expect(getFlow(roomType, 2).version).toBe(2);
      expect(isFlowVersionRegistered(roomType, 99)).toBe(false);
    }
    expect(getFlow('PIECE_BED', 2).deriveRoom({ bedSize: 'Q_160', storage: 'LIFT_UP', material: 'PAL' }).lengthM).toBe(1.6);
  });
  it('all family configs survive JSON serialization without field loss', () => {
    for (const kind of PIECE3D_KINDS) {
      const config = defaultPieceConfig(kind);
      expect(pieceConfig3dSchema(kind).parse(JSON.parse(JSON.stringify(config)))).toEqual(config);
    }
  });
  it('two individually placed nightstands derive exactly two units', () => {
    const answers = { config3d: defaultPieceConfig('NIGHTSTAND'), count: 'ONE', material: 'PAL' };
    const quantity = [answers, answers].flatMap((a) => getFlow('PIECE_NIGHTSTAND').deriveRoom(a).items).reduce((sum, item) => sum + item.quantity, 0);
    expect(quantity).toBe(2);
  });
});

describe('showroom geometry stays derived, bounded and economical', () => {
  for (const kind of PIECE3D_KINDS) for (const size of ['default', 'min', 'max'] as const) {
    it(`${kind}/${size} keeps configuration intact and yields deterministic bounded geometry`, () => {
      const rules = PIECE3D_RULES[kind];
      const config = normalizePieceConfig(kind, {
        ...defaultPieceConfig(kind),
        widthM: rules.width[size], heightM: rules.height[size], depthM: rules.depth[size],
        ...(rules.legsOption && size !== 'default' ? { legs: true } : {}),
        ...(rules.slidingDoors && size === 'max' ? { doorMode: 'SLIDING' as const } : {}),
      });
      const saved = JSON.stringify(config);
      expect(pieceConfig3dSchema(kind).safeParse(config).success).toBe(true);
      const panels = buildPanels(config, kind);
      expect(JSON.stringify(config)).toBe(saved);
      expect(buildPanels(config, kind)).toEqual(panels);
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.length).toBeGreaterThan(0);
      expect(panels.length).toBeLessThanOrEqual(160);
      for (const panel of panels) {
        expect([panel.x, panel.y, panel.z, panel.w, panel.h, panel.d].every(Number.isFinite)).toBe(true);
        expect(Math.min(panel.w, panel.h, panel.d)).toBeGreaterThan(0);
        expect(panel.radius).toBeGreaterThan(0);
        expect(panel.radius!).toBeLessThanOrEqual(Math.min(panel.w, panel.h, panel.d) / 4);
        expect(['X', 'Y', 'Z']).toContain(panel.grainAxis);
        if (panel.shape === 'CUSHION') expect(['BEDDING', 'FABRIC']).toContain(panel.surface);
      }
      expect(saved).not.toMatch(/grainAxis|CUSHION|radius/);
    });
  }

  it('keeps bed softness distinct from the rigid layered mattress without excessive detail', () => {
    for (const mattressSize of BED_MATTRESS_SIZES) for (const storage of BED_STORAGES) for (const upholstered of [true, false]) {
      const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize, storage, upholstered } });
      const panels = buildPanels(config, 'BED');
      const pillows = panels.filter((p) => p.shape === 'BED_PILLOW');
      expect(pillows).toHaveLength(BED_MATTRESS_WIDTH[mattressSize] < 1.2 ? 1 : 2);
      expect(panels.filter((p) => p.surface === 'BEDDING' && !p.shape)).toHaveLength(1);
      expect(panels.length).toBeLessThanOrEqual(storage === 'DRAWERS' ? 70 : 26);
      expect(panelsWithinBounds(config, panels)).toBe(true);
    }
  });

  it('adds complete inset table aprons and a restrained underside without altering quoted size', () => {
    for (const type of TABLE_TYPES) for (const shape of TABLE_SHAPES) for (const widthM of [0.5, 3]) {
      if (shape === 'EXTENDABLE' && type !== 'DINING') continue;
      const config = normalizePieceConfig('TABLE', { ...defaultPieceConfig('TABLE'), table: { type, shape }, widthM });
      const answers = { config3d: config, material: 'PAL' };
      const quoted = getFlow('PIECE_TABLE').deriveRoom(answers);
      const panels = buildPanels(config, 'TABLE');
      expect(getFlow('PIECE_TABLE').deriveRoom(answers)).toEqual(quoted);
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.length).toBeLessThanOrEqual(shape === 'EXTENDABLE' ? 13 : 11);
      expect(panels.filter((p) => p.role === 'LEG')).toHaveLength(shape === 'ROUND' ? 0 : 4);
      if (shape !== 'ROUND') expect(panels.filter((p) => p.h === 0.09)).toHaveLength(4);
    }
  });

  it('gives every bench variant a bounded seat support and correct soft/hard distinction', () => {
    for (const style of BENCH_STYLES) for (const upholsteredSeat of [true, false]) {
      const config = normalizePieceConfig('BENCH', { ...defaultPieceConfig('BENCH'), bench: { style, upholsteredSeat } });
      const panels = buildPanels(config, 'BENCH');
      expect(panels.filter((p) => p.shape === 'SEAT_CUSHION')).toHaveLength(upholsteredSeat ? 1 : 0);
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.length).toBeLessThanOrEqual(style === 'WITH_SHOE_SPACE' ? 18 : 12);
    }
  });
});
