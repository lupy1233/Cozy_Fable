import { describe, expect, it } from 'vitest';
import { BACK_T, defaultPieceConfig, FRONT_GAP, normalizePieceConfig, PANEL_T, PIECE3D_KINDS, PIECE3D_RULES, pieceBaseHeight, type PieceConfig3d } from './config';
import { buildDrawerAssembly, buildTiltTray } from './drawer-model';
import { BED_MATTRESS_SIZES, BED_MATTRESS_WIDTH } from './furniture-config';
import { buildPanels, panelsWithinBounds, type Panel3d } from './model';

const frontEdge = (p: Panel3d) => p.z + p.d / 2;
const backEdge = (p: Panel3d) => p.z - p.d / 2;

describe('cabinet construction clearances', () => {
  it('legacy tilt trays remain inside the cabinet and within their bay while tipping', () => {
    const config: PieceConfig3d = { ...defaultPieceConfig('SHOE_CABINET'), columns: [{ zones: [{ type: 'TILT_OUT', count: 3 }] }] };
    const fronts = buildPanels(config, 'SHOE_CABINET').filter(panel => panel.role === 'TILT_FRONT');
    expect(fronts).toHaveLength(3);
    for (const front of fronts) {
      const tray = buildTiltTray(front, config.depthM);
      expect(tray).toHaveLength(4);
      for (const panel of tray) for (const progress of [0, 0.5, 1]) {
        expect(Math.abs(panel.x) + panel.w / 2).toBeLessThan(front.w / 2);
        for (const y of [panel.y - panel.h / 2, panel.y + panel.h / 2]) for (const z of [panel.z - panel.d / 2, panel.z + panel.d / 2]) {
          const angle = progress * 0.66;
          const rotatedY = (y + front.h / 2) * Math.cos(angle) - (z - front.d / 2) * Math.sin(angle);
          expect(rotatedY).toBeGreaterThan(0);
          expect(rotatedY).toBeLessThan(front.h);
          if (progress === 0) expect(front.z + z).toBeGreaterThan(-config.depthM / 2 + BACK_T);
        }
      }
    }
  });
  for (const columns of [2, 3]) for (const unequal of [false, true]) {
    it(`keeps ${columns} inset sliding leaves and hardware supported and bounded (${unequal ? 'unequal' : 'equal'} bays)`, () => {
      const config = normalizePieceConfig('WARDROBE', {
        ...defaultPieceConfig('WARDROBE'), widthM: columns === 2 ? 1.3 : 2.2, doorMode: 'SLIDING',
        columns: Array.from({ length: columns }, (_, i) => ({
          ...(unequal && i === 0 ? { widthM: 0.35 } : {}),
          zones: [{ type: 'OPEN' as const, fill: 'SHELVES' as const, count: 2 }, { type: 'DRAWERS' as const, count: 2 }],
        })),
      });
      const saved = JSON.stringify(config);
      const panels = buildPanels(config, 'WARDROBE');
      const leaves = panels.filter((p) => p.role === 'SLIDING_FRONT');
      const fixedTracks = panels.filter((p) => p.surface === 'METAL' && !p.motion);
      expect(leaves).toHaveLength(columns);
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(fixedTracks.some((p) => p.y < 0.15)).toBe(true);
      expect(fixedTracks.some((p) => p.y > config.heightM - 0.05)).toBe(true);
      for (const leaf of leaves) {
        expect(leaf.y - leaf.h / 2).toBeGreaterThan(pieceBaseHeight('WARDROBE', config) + PANEL_T);
        expect(leaf.y + leaf.h / 2).toBeLessThan(config.heightM - PANEL_T);
        expect(leaf.x + (leaf.slideDx ?? 0) - leaf.w / 2).toBeGreaterThanOrEqual(-config.widthM / 2 + PANEL_T + FRONT_GAP - 1e-8);
        expect(leaf.x + (leaf.slideDx ?? 0) + leaf.w / 2).toBeLessThanOrEqual(config.widthM / 2 - PANEL_T - FRONT_GAP + 1e-8);
        for (const other of leaves.filter((p) => p !== leaf && p.z === leaf.z)) {
          const shifted = leaf.x + (leaf.slideDx ?? 0);
          const separation = Math.abs(shifted - other.x) - (leaf.w + other.w) / 2;
          expect(separation).toBeGreaterThanOrEqual(FRONT_GAP - 1e-8);
        }
        const guides = panels.filter((p) => p.motion?.key === `slide:${leaf.col}`);
        expect(guides).toHaveLength(4);
        for (const guide of guides) expect(guide.motion?.travel).toEqual([leaf.slideDx, 0, 0]);
        expect(guides.some((p) => p.y < leaf.y - leaf.h / 2)).toBe(true);
        expect(guides.some((p) => p.y > leaf.y + leaf.h / 2)).toBe(true);
        const decks = fixedTracks.filter((p) => p.h === 0.004).sort((a, b) => a.y - b.y);
        for (const guide of guides) {
          if (guide.y < leaf.y) expect(guide.y - guide.h / 2).toBeCloseTo(decks[0].y + decks[0].h / 2, 8);
          else expect(guide.y + guide.h / 2).toBeCloseTo(decks[1].y - decks[1].h / 2, 8);
        }
      }
      const rearLeafFace = Math.min(...leaves.map(backEdge));
      for (const panel of panels.filter((p) => ['SHELF', 'DIVIDER', 'ZONE_SEP', 'DRAWER_FRONT'].includes(p.role))) {
        expect(frontEdge(panel)).toBeLessThan(rearLeafFace - 0.004);
      }
      expect(JSON.stringify(config)).toBe(saved);
    });
  }

  for (const kind of PIECE3D_KINDS.filter((k) => PIECE3D_RULES[k].zoneTypes.includes('DOOR'))) {
    it(`${kind} closes inset doors without intersecting their shelves`, () => {
      const initial = defaultPieceConfig(kind);
      const config = normalizePieceConfig(kind, { ...initial, columns: initial.columns.map(() => ({ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 2 }] })) });
      const panels = buildPanels(config, kind);
      const doors = panels.filter((p) => p.role === 'DOOR_FRONT');
      const shelves = panels.filter((p) => p.role === 'SHELF');
      expect(doors.length).toBeGreaterThan(0);
      expect(shelves.length).toBeGreaterThan(0);
      for (const shelf of shelves) {
        const door = doors.find((p) => p.col === shelf.col && p.zone === shelf.zone)!;
        expect(frontEdge(shelf)).toBeLessThanOrEqual(backEdge(door) - 0.005);
      }
      if (kind === 'DESK') expect(doors.every((p) => frontEdge(p) <= config.depthM / 2 - 0.02 + 1e-8)).toBe(true);
    });
  }

  it('rejects out-of-bounds sliding leaves instead of exempting them from geometry validation', () => {
    const config = defaultPieceConfig('WARDROBE');
    const escaped: Panel3d = { role: 'SLIDING_FRONT', x: 0, y: 1, z: config.depthM, w: 0.5, h: 1, d: PANEL_T };
    expect(panelsWithinBounds(config, [escaped])).toBe(false);
  });

  for (const kind of PIECE3D_KINDS.filter((k) => PIECE3D_RULES[k].hasPlinth)) {
    it(`${kind} plinth supports the carcass from all four sides`, () => {
      const config = defaultPieceConfig(kind);
      const plinth = buildPanels(config, kind).filter((p) => p.role === 'PLINTH');
      expect(plinth).toHaveLength(4);
      expect(plinth.filter((p) => p.w === PANEL_T)).toHaveLength(2);
      expect(plinth.filter((p) => p.d === PANEL_T)).toHaveLength(2);
      expect(plinth.every((p) => Math.abs(p.y - p.h / 2) < 1e-8)).toBe(true);
    });
  }

  it('drawer trays fit closed, clear the rear panel and retain runner overlap when extended', () => {
    const cases: Array<[string, PieceConfig3d]> = PIECE3D_KINDS.map((kind) => [kind, defaultPieceConfig(kind)]);
    cases.push(['WARDROBE', normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), doorMode: 'SLIDING' })]);
    for (const [kind, config] of cases) for (const front of buildPanels(config, kind as typeof PIECE3D_KINDS[number]).filter((p) => p.role === 'DRAWER_FRONT' && !p.motion)) {
      const { moving, fixed, travel } = buildDrawerAssembly(front, config.depthM);
      expect(moving.filter((p) => p.surface !== 'METAL')).toHaveLength(4);
      expect(moving.filter((p) => p.surface === 'METAL')).toHaveLength(2);
      const rails = fixed.filter((p) => p.d > 0.028);
      const mounts = fixed.filter((p) => p.d === 0.028);
      expect(rails).toHaveLength(2);
      expect(mounts).toHaveLength(4);
      for (const mount of mounts) {
        const rail = rails.find((p) => Math.sign(p.x) === Math.sign(mount.x))!;
        expect(Math.abs(mount.x) + mount.w / 2).toBeGreaterThan(front.w / 2 + FRONT_GAP);
        expect(Math.abs(mount.x) - mount.w / 2).toBeLessThan(Math.abs(rail.x) + rail.w / 2);
        expect(backEdge(mount)).toBeGreaterThan(backEdge(rail));
        expect(frontEdge(mount)).toBeLessThan(frontEdge(rail));
      }
      for (const panel of moving) {
        expect(Math.abs(panel.x) + panel.w / 2).toBeLessThan(front.w / 2);
        expect(front.z + backEdge(panel)).toBeGreaterThanOrEqual(-config.depthM / 2 + BACK_T + 0.028 - 1e-8);
        expect(frontEdge(panel)).toBeLessThanOrEqual(-front.d / 2 + 1e-8);
      }
      const movingRail = moving.find((p) => p.surface === 'METAL')!;
      expect(backEdge(movingRail) + travel).toBeLessThan(frontEdge(fixed[0]) - 0.025);
    }
  });
});

describe('bed storage construction', () => {
  for (const mattressSize of BED_MATTRESS_SIZES) for (const upholstered of [false, true]) {
    it(`${mattressSize}/${upholstered} has four complete sideways drawers, clear openings and fixed supports`, () => {
      const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize, upholstered, storage: 'DRAWERS' } });
      const panels = buildPanels(config, 'BED');
      expect(panelsWithinBounds(config, panels)).toBe(true);
      expect(panels.some((p) => p.role === 'FRONT_BACKDROP')).toBe(false);
      const keys = new Set(panels.filter((p) => p.motion).map((p) => p.motion!.key));
      expect([...keys].sort()).toEqual(['bed:drawer:L:0', 'bed:drawer:L:1', 'bed:drawer:R:0', 'bed:drawer:R:1']);
      for (const key of keys) {
        const drawer = panels.filter((p) => p.motion?.key === key);
        expect(drawer).toHaveLength(7);
        expect(drawer.filter((p) => p.role === 'DRAWER_FRONT')).toHaveLength(1);
        const [dx, dy, dz] = drawer[0].motion!.travel!;
        expect(Math.sign(dx)).toBe(key.includes(':L:') ? -1 : 1);
        expect(Math.abs(dx)).toBeLessThan(BED_MATTRESS_WIDTH[mattressSize] / 2);
        expect([dy, dz]).toEqual([0, 0]);
        expect(drawer.every((p) => JSON.stringify(p.motion) === JSON.stringify(drawer[0].motion))).toBe(true);
      }
      const fixedHardware = panels.filter((p) => p.surface === 'METAL' && !p.motion);
      expect(fixedHardware).toHaveLength(16);
      const rails = fixedHardware.filter((p) => p.w > 0.028);
      const mounts = fixedHardware.filter((p) => p.w === 0.028);
      const separators = panels.filter((p) => !p.motion && p.d === 0.016);
      for (const rail of rails) {
        const connected = [...mounts, ...separators].filter((p) =>
          Math.abs(p.z - rail.z) <= (p.d + rail.d) / 2 &&
          Math.abs(p.x - rail.x) < (p.w + rail.w) / 2);
        expect(connected.length).toBeGreaterThan(0);
      }
      for (const mount of mounts) {
        expect(separators.some((p) => Math.abs(p.z - mount.z) < (p.d + mount.d) / 2)).toBe(true);
      }
      expect(panels.some((p) => !p.motion && p.w === 0.035 && p.d > 1.9)).toBe(true);
    });
  }
});
