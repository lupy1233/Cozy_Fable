import { describe, expect, it } from 'vitest';
import { defaultPieceConfig, normalizePieceConfig, PIECE3D_KINDS, PIECE3D_RULES } from './config';
import { buildPanels, panelsWithinBounds } from './model';
import { buildDoorHingeDetails, buildFrontHandle, buildInteriorDetails, buildStaticHandles } from './showroom-details';
import { TABLE_TYPES, TABLE_SHAPES, TABLE_LENGTH_LIMITS } from './furniture-config';

describe('dimension-driven visual hardware', () => {
  for (const doorMode of ['HINGED', 'SLIDING'] as const) for (const depthM of [.545, .55, .8]) for (const count of [1, 2, 3]) {
    it(`hangs one hanger per actual rod: ${doorMode}/${depthM}/${count}`, () => {
      const config = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), widthM: 1.2, heightM: 2.7, depthM, doorMode,
        columns: [{ zones: [{ type: 'DOOR', fill: 'HANGING', count }] }, { zones: [{ type: 'OPEN', fill: 'HANGING', count }] }] });
      const saved = JSON.stringify(config);
      const panels = buildPanels(config, 'WARDROBE'), rods = panels.filter(p => p.role === 'ROD');
      const interiors = buildInteriorDetails(panels);
      const hangers = interiors.filter(p => p.shape === 'HANGER'), hooks = interiors.filter(p => p.shape === 'HANGER_HOOK');
      expect(rods.length).toBeGreaterThan(0);
      expect(hangers).toHaveLength(rods.length); expect(hooks).toHaveLength(rods.length);
      expect(panelsWithinBounds(config, interiors)).toBe(true);
      expect(JSON.stringify(config)).toBe(saved);
      rods.forEach((rod, i) => {
        expect(hangers[i].x).toBe(rod.x); expect(hangers[i].z).toBe(rod.z);
        expect(hooks[i].x).toBe(rod.x); expect(hooks[i].z).toBe(rod.z);
        expect(hangers[i].w).toBe(.016);
        expect(hangers[i].d).toBeGreaterThan(.36); expect(hangers[i].d).toBeLessThanOrEqual(.42);
        expect(hangers[i].y + hangers[i].h / 2).toBeCloseTo(rod.y - .09);
        for (const front of panels.filter(p => ['DOOR_FRONT', 'SLIDING_FRONT'].includes(p.role)
          && (p.col === undefined || p.col === rod.col)))
          expect(hangers[i].z + hangers[i].d / 2).toBeLessThanOrEqual(front.z - front.d / 2 - .0099);
      });
    });
  }

  it('removes hangers when reduced depth removes hanging fill', () => {
    const config = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), depthM: .45 });
    const panels = buildPanels(config, 'WARDROBE');
    expect(panels.some(p => p.role === 'ROD')).toBe(false);
    expect(buildInteriorDetails(panels).some(p => p.shape === 'HANGER' || p.shape === 'HANGER_HOOK')).toBe(false);
  });

  for (const kind of PIECE3D_KINDS) for (const width of ['min', 'max'] as const) for (const depth of ['min', 'max'] as const) {
    it(`${kind}/${width} width/${depth} depth keeps finite supported detail and saved dimensions`, () => {
      const rule = PIECE3D_RULES[kind];
      const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), widthM: rule.width[width],
        depthM: rule.depth[depth], heightM: rule.height[width], frontStyle: 'HANDLE' });
      const saved = JSON.stringify(config);
      const panels = buildPanels(config, kind);
      const interiors = buildInteriorDetails(panels);
      const handles = buildStaticHandles(config, panels);
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panelsWithinBounds(config, interiors)).toBe(true);
      expect(JSON.stringify(config)).toBe(saved);
      for (const part of [...interiors, ...handles]) {
        expect([part.x, part.y, part.z, part.w, part.h, part.d].every(Number.isFinite)).toBe(true);
        expect(Math.min(part.w, part.h, part.d)).toBeGreaterThan(0);
      }
      for (const shelf of panels.filter(p => p.role === 'SHELF' && p.col !== undefined)) {
        const supports = interiors.filter(p => Math.abs(p.y + p.h / 2 - (shelf.y - shelf.h / 2)) < 1e-8
          && Math.abs(p.x - shelf.x) < shelf.w / 2 + 0.002 && Math.abs(p.z - shelf.z) < shelf.d / 2);
        expect(supports).toHaveLength(4);
      }
      expect(buildStaticHandles({ ...config, frontStyle: 'PUSH' }, panels)).toEqual([]);
    });
  }

  it('sliding pulls stay flush and room/editor pulls have exactly the same construction', () => {
    const config = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), frontStyle: 'HANDLE', doorMode: 'SLIDING' });
    const panels = buildPanels(config, 'WARDROBE');
    const statics = buildStaticHandles(config, panels);
    expect(statics.length).toBeGreaterThan(0);
    const expected = panels.flatMap(front => buildFrontHandle(front, front.role === 'DRAWER_FRONT').map(p =>
      ({ ...p, x: p.x + front.x, y: p.y + front.y, z: p.z + front.z })));
    expect(statics).toEqual(expected);
    for (const front of panels.filter(p => p.role === 'SLIDING_FRONT')) for (const pull of buildFrontHandle(front)) {
      expect(pull.z + pull.d / 2).toBeLessThanOrEqual(front.d / 2 + 0.001);
      expect(Math.abs(pull.x) + pull.w / 2).toBeLessThan(front.w / 2);
    }
  });

  it('pull mounting posts physically contact both front and bar at minimum door sizes', () => {
    for (const role of ['DOOR_FRONT', 'DRAWER_FRONT', 'TILT_FRONT'] as const) {
      const handle = buildFrontHandle({ role, x: 0, y: 0, z: 0, w: 0.2, h: 0.12, d: 0.018, hinge: 'L' });
      const [bar, ...posts] = handle;
      expect(posts).toHaveLength(2);
      for (const post of posts) {
        expect(post.z - post.d / 2).toBeCloseTo(0.009);
        expect(post.z + post.d / 2).toBeGreaterThan(bar.z - bar.d / 2);
      }
    }
  });

  it('hinge details follow the back of the selected leaf without exceeding its edges', () => {
    for (const hinge of ['L', 'R'] as const) for (const h of [0.092, 0.12, 0.8, 2.7]) {
      const front = { role: 'DOOR_FRONT' as const, x: 0, y: 0, z: 0, w: 0.25, h, d: 0.018, hinge };
      for (const p of buildDoorHingeDetails(front)) {
        expect(Math.abs(p.x) + p.w / 2).toBeLessThanOrEqual(front.w / 2);
        expect(Math.abs(p.y) + p.h / 2).toBeLessThan(front.h / 2);
        expect(p.z + p.d / 2).toBeLessThanOrEqual(-front.d / 2 + 1e-9);
        expect(p.z - p.d / 2).toBeGreaterThan(-front.d / 2 - 0.006);
      }
    }
  });

  it('hinges clear densely spaced shelves behind inset doors', () => {
    const config = normalizePieceConfig('BOOKCASE', { ...defaultPieceConfig('BOOKCASE'), widthM: 0.6, heightM: 0.8, depthM: 0.35,
      columns: [{ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 6 }] }] });
    const panels = buildPanels(config, 'BOOKCASE');
    for (const front of panels.filter(p => p.role === 'DOOR_FRONT')) for (const hinge of buildDoorHingeDetails(front))
      for (const shelf of panels.filter(p => p.role === 'SHELF'))
        expect(front.z + hinge.z - hinge.d / 2).toBeGreaterThan(shelf.z + shelf.d / 2);
  });
});

describe('furniture profiles at mixed dimension extremes', () => {
  for (const type of TABLE_TYPES) for (const shape of TABLE_SHAPES) for (const wide of [false, true]) for (const deep of [false, true]) {
    if (shape === 'EXTENDABLE' && type !== 'DINING') continue;
    it(`${type}/${shape}/${wide}/${deep} stays within the normalized footprint`, () => {
      const config = normalizePieceConfig('TABLE', { ...defaultPieceConfig('TABLE'), table: { type, shape },
        widthM: TABLE_LENGTH_LIMITS[type][wide ? 'max' : 'min'], depthM: deep ? 1.2 : 0.4 });
      const panels = buildPanels(config, 'TABLE');
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.every(p => Math.min(p.w, p.h, p.d) > 0)).toBe(true);
      if (shape === 'ROUND') expect(panels.filter(p => p.shape === 'PEDESTAL')).toHaveLength(1);
      if (shape === 'EXTENDABLE') {
        const tops = panels.filter(p => Math.abs(p.y + p.h / 2 - config.heightM) < 1e-8);
        expect(tops).toHaveLength(2);
        expect(tops[1].x - tops[1].w / 2 - (tops[0].x + tops[0].w / 2)).toBeCloseTo(0.003);
      }
    });
  }
});
