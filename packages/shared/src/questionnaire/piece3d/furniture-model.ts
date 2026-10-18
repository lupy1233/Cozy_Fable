import type { PieceConfig3d, Piece3dKind } from './config';
import { BED_MATTRESS_WIDTH } from './furniture-config';
import type { Panel3d } from './model';
import { isNewFurnitureKind } from './catalog-config';
import { buildCatalogPanels } from './catalog-model';

// Geometrie noua, in gabaritul declarat; asternutul este context vizual, nu articol ofertat.
export function buildFurniturePanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
  if (isNewFurnitureKind(kind)) return buildCatalogPanels(config, kind);
  const { widthM: w, heightM: h, depthM: d } = config;
  const panels: Panel3d[] = [];
  const box = (role: Panel3d['role'], x: number, y: number, z: number, pw: number, ph: number, pd: number, extra: Partial<Panel3d> = {}) =>
    panels.push({ role, x, y, z, w: pw, h: ph, d: pd, ...extra });
  if (kind === 'BED' && config.bed) {
    const bed = config.bed;
    const mw = BED_MATTRESS_WIDTH[bed.mattressSize];
    const rail = bed.upholstered ? 0.09 : 0.045;
    const fabric = bed.upholstered ? { surface: 'FABRIC' as const, radius: 0.025 } : {};
    box('FURNITURE', 0, h / 2, -d / 2 + 0.055, w, h, 0.11, { radius: 0.009, grainAxis: 'X', ...fabric });
    // Ritmul cusaturilor citeste tapiteria fara textura fotografica grea.
    if (bed.upholstered) {
      const n = mw < 1.2 ? 3 : 5;
      for (let i = 0; i < n; i++) box('FURNITURE', -w / 2 + 0.045 + (i + 0.5) * (w - 0.09) / n,
        0.73, -d / 2 + 0.12, (w - 0.09) / n - 0.012, 0.46, 0.075, { surface: 'FABRIC', shape: 'HEADBOARD_PAD' });
    } else {
      box('FURNITURE', 0, 0.74, -d / 2 + 0.114, w - 0.065, 0.44, 0.018, { radius: 0.006, grainAxis: 'X' });
    }
    const bottom = bed.storage === 'NONE' ? 0.1 : 0.04;
    const railH = 0.32 - bottom;
    for (const sign of [-1, 1]) {
      const x = sign * (mw / 2 + rail / 2);
      if (bed.storage === 'DRAWERS') {
        const trayDepth = mw / 2 - 0.044;
        const trayHeight = 0.18;
        const trayY = bottom + 0.026 + trayHeight / 2;
        const trayX = sign * (mw / 2 - trayDepth / 2);
        for (const [i, z] of [-0.48, 0.51].entries()) {
          const motion: NonNullable<Panel3d['motion']> = {
            key: `bed:drawer:${sign < 0 ? 'L' : 'R'}:${i}`,
            type: 'SLIDE', travel: [sign * trayDepth * 0.76, 0, 0],
          };
          box('DRAWER_FRONT', x, bottom + railH / 2, z,
            rail, railH - 0.014, 0.974, { ...fabric, radius: 0.003, grainAxis: 'Z', motion });
          box('FURNITURE', trayX, bottom + 0.02, z, trayDepth, 0.012, 0.932, { motion, grainAxis: 'Z' });
          box('FURNITURE', sign * (mw / 2 - trayDepth + 0.006), trayY, z,
            0.012, trayHeight, 0.908, { motion, grainAxis: 'Z' });
          for (const side of [-1, 1]) {
            box('FURNITURE', trayX, trayY, z + side * 0.46,
              trayDepth, trayHeight, 0.012, { motion, grainAxis: 'X' });
            box('FURNITURE', trayX, bottom + 0.08, z + side * 0.47,
              trayDepth - 0.02, 0.018, 0.006, { motion, surface: 'METAL' });
            box('FURNITURE', trayX, bottom + 0.08, z + side * 0.477,
              trayDepth - 0.012, 0.03, 0.008, { surface: 'METAL' });
            const separator = [-0.966, 0.015, 0.996][i + (side > 0 ? 1 : 0)];
            const supportFace = separator - side * 0.008;
            const runnerFace = z + side * 0.481;
            const supportGap = side * (supportFace - runnerFace);
            if (supportGap > 0) for (const mount of [-1, 1]) {
              box('FURNITURE', trayX + mount * trayDepth * 0.3, bottom + 0.08,
                (supportFace + runnerFace) / 2, 0.028, 0.028, supportGap + 0.002, { surface: 'METAL' });
            }
          }
        }
        // Traversele sustin somiera, fara un fals panou inchis peste golul sertarului.
        box('FURNITURE', sign * (mw / 2 - 0.01), 0.295, 0.02, 0.02, 0.05, 1.99, { grainAxis: 'Z' });
      } else box('FURNITURE', x, bottom + railH / 2, 0.02, rail, railH, 2.02, { radius: 0.004, ...fabric, grainAxis: 'Z' });
      if (bed.storage === 'NONE') {
        for (const z of [-0.83, 0.87]) box('LEG', x, 0.05, z, 0.065, 0.1, 0.065);
      }
    }
    box('FURNITURE', 0, bottom + railH / 2, 1.045, mw + 2 * rail, railH, 0.08, { radius: 0.004, ...fabric, grainAxis: 'X' });
    if (bed.storage !== 'NONE') box('PLINTH', 0, 0.022, 0.01, mw - 0.05, 0.044, 1.96);
    if (bed.storage === 'DRAWERS') {
      box('FURNITURE', 0, 0.155, 0.02, 0.035, 0.222, 1.99, { grainAxis: 'Z' });
      for (const z of [-0.966, 0.015, 0.996]) {
        box('FURNITURE', 0, 0.15, z, mw, 0.208, 0.016, { grainAxis: 'X' });
      }
    }
    if (bed.storage === 'LIFT_UP') box('BOTTOM', 0, 0.05, 0.01, mw, 0.012, 1.97, { grainAxis: 'Z' });
    box('FURNITURE', 0, 0.283, 0, mw, 0.035, 2, { surface: 'ACCENT' });
    box('FURNITURE', 0, 0.412, 0, mw - 0.014, 0.228, 1.99, { surface: 'BEDDING', radius: 0.035 });
    // Pilota cade peste margini, deasupra sertarelor si in gabaritul existent.
    box('FURNITURE', 0, 0.474, 0.28, mw + 0.076, 0.23, 1.58, { surface: 'BEDDING', shape: 'BED_DUVET' });
    for (const y of [0.339, 0.481]) box('FURNITURE', 0, y, 0, mw - 0.01, 0.004, 1.994,
      { surface: 'BEDDING', shape: 'PIPING', seamRadius: 0.035 });
    const pillows = mw < 1.2 ? 1 : 2;
    for (let i = 0; i < pillows; i++) {
      const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * mw / 4;
      const pw = pillows === 1 ? 0.64 : mw / 2 - 0.075;
      box('FURNITURE', x, 0.599, -0.69 + (i % 2) * 0.014, pw, 0.15, 0.46, { surface: 'BEDDING', shape: 'BED_PILLOW' });
    }
    box('FURNITURE', 0, 0.483, 0.62, mw + 0.076, 0.23, 0.5, { surface: 'FABRIC', shape: 'BED_THROW' });
    return panels;
  }
  if (kind === 'TABLE' && config.table) {
    const table = config.table;
    const top = 0.035;
    if (table.shape === 'EXTENDABLE') {
      for (const side of [-1, 1]) box('FURNITURE', side * (w / 4 + 0.00075), h - top / 2, 0,
        w / 2 - 0.0015, top, d, { radius: 0.004, grainAxis: 'X' });
    } else box('FURNITURE', 0, h - top / 2, 0, w, top, d, { radius: 0.008, grainAxis: 'X', shape: table.shape === 'ROUND' ? 'ELLIPSE' : 'TABLETOP' });
    box('FURNITURE', 0, h - top - 0.009, 0, w - 0.055, 0.018, d - 0.055,
      { radius: 0.004, grainAxis: 'X', shape: table.shape === 'ROUND' ? 'ELLIPSE' : undefined });
    if (table.shape === 'ROUND') {
      const base = Math.min(w * 0.55, 0.65);
      box('FURNITURE', 0, (h - top) / 2, 0, base, h - top, base, { shape: 'PEDESTAL', grainAxis: 'Y' });
    } else {
      const leg = table.type === 'DINING' ? 0.078 : 0.065;
      const inset = 0.075;
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        box('LEG', sx * (w / 2 - inset), (h - top) / 2, sz * (d / 2 - inset), leg, h - top, leg, { shape: 'TAPERED_LEG' });
      for (const sz of [-1, 1]) box('FURNITURE', 0, h - top - 0.045, sz * (d / 2 - inset), w - 2 * inset, 0.09, 0.035, { radius: 0.003, grainAxis: 'X' });
      for (const sx of [-1, 1]) box('FURNITURE', sx * (w / 2 - inset), h - top - 0.045, 0, 0.035, 0.09, d - 2 * inset, { radius: 0.003, grainAxis: 'Z' });
      if (table.shape === 'EXTENDABLE') {
        for (const sz of [-1, 1]) box('FURNITURE', 0, h - top - 0.03, sz * d * 0.2,
          w * 0.74, 0.022, 0.025, { surface: 'METAL' });
      }
    }
    return panels;
  }
  if (kind === 'BENCH' && config.bench) {
    const bench = config.bench;
    const top = bench.upholsteredSeat ? 0.065 : 0.03;
    const baseH = h - top;
    box('FURNITURE', 0, h - top / 2, 0, w, top, d, bench.upholsteredSeat ? { surface: 'FABRIC', shape: 'SEAT_CUSHION' } : { shape: 'TABLETOP', grainAxis: 'X' });
    box('FURNITURE', 0, baseH - 0.009, 0, w - 0.04, 0.018, d - 0.04, { radius: 0.004, grainAxis: 'X' });
    if (bench.style === 'WITH_STORAGE') {
      box('PLINTH', 0, 0.025, 0, w - 0.06, 0.05, d - 0.06);
      box('BOTTOM', 0, 0.059, 0, w - 0.04, 0.018, d - 0.04, { grainAxis: 'X' });
      for (const sx of [-1, 1]) box('SIDE', sx * (w / 2 - 0.01), 0.05 + (baseH - 0.05) / 2, 0, 0.02, baseH - 0.05, d);
      for (const sz of [-1, 1]) box('FURNITURE', 0, (baseH + 0.024) / 2, sz * (d / 2 - 0.01), w - 0.04, baseH - 0.076, 0.02, { grainAxis: 'X' });
      // Canelura de prindere sub capac, fara maner care ar depasi adancimea declarata.
      box('FURNITURE', 0, baseH - 0.022, d / 2 - 0.012, Math.min(0.18, w * 0.22), 0.008, 0.003, { surface: 'ACCENT' });
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        box('LEG', sx * (w / 2 - 0.06), baseH / 2, sz * (d / 2 - 0.06), 0.065, baseH, 0.065, { shape: 'TAPERED_LEG' });
      for (const sz of [-1, 1]) box('FURNITURE', 0, baseH - 0.04, sz * (d / 2 - 0.06), w - 0.12, 0.08, 0.028, { radius: 0.003, grainAxis: 'X' });
      for (const sx of [-1, 1]) box('FURNITURE', sx * (w / 2 - 0.06), baseH - 0.04, 0, 0.028, 0.08, d - 0.12, { radius: 0.003, grainAxis: 'Z' });
      if (bench.style === 'WITH_SHOE_SPACE') {
        for (let i = 0; i < 4; i++) box('SHELF', 0, 0.12, -0.12 + i * 0.08, w - 0.075, 0.018, 0.064, { grainAxis: 'X' });
        for (const sx of [-1, 1]) box('FURNITURE', sx * (w / 2 - 0.06), 0.1, 0, 0.028, 0.024, d - 0.08, { grainAxis: 'Z' });
      }
    }
  }
  return panels;
}
