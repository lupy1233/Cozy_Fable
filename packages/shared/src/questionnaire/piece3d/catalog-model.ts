import type { Piece3dKind, PieceConfig3d } from './config';
import { legAsset } from './hardware-assets';
import type { Panel3d } from './model';

export function buildCatalogPanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
  const { widthM: w, heightM: h, depthM: d } = config;
  const panels: Panel3d[] = [];
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, extra: Partial<Panel3d> = {}) =>
    panels.push({ role: 'FURNITURE', x, y, z, w: width, h: height, d: depth, radius: 0.002, ...extra });
  const fabric: Partial<Panel3d> = { surface: 'FABRIC', shape: 'SEAT_CUSHION' };
  const legs = (width: number, depth: number, height: number, z = 0) => {
    if (config.upholstery?.base === 'PLINTH') {
      box(0, height / 2, z, width - 0.09, height, depth - 0.09, { surface: 'LEG_FINISH' });
    } else for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [lx, lz] = [sx * (width / 2 - 0.085), z + sz * (depth / 2 - 0.085)];
      box(lx, height / 2, lz, 0.055, height, 0.055, config.upholstery?.base === 'BLACK'
        ? { surface: 'LEG_FINISH', shape: 'CYLINDER', grainAxis: 'Y' }
        : { surface: 'LEG_FINISH', shape: 'TAPERED_LEG', grainAxis: 'Y', ...legAsset(lx, height, lz, 0.055, height, 0.055, 'LEG_FINISH') });
    }
  };
  const door = (key: string, x: number, y: number, z: number, width: number, height: number, handle: boolean, sign = 1) => {
    const pivot: [number, number, number] = [x - sign * width / 2, y, z];
    const motion: NonNullable<Panel3d['motion']> = { key, type: 'ROTATE_Y', pivot, angle: -sign * Math.PI * 0.55 };
    box(x, y, z, width, height, 0.018, { role: 'DOOR_FRONT', grainAxis: 'Y', motion });
    if (handle) box(x + sign * (width / 2 - 0.04), y + height * 0.22, z + 0.021, 0.012, Math.min(0.12, height * 0.4), 0.025,
      { surface: 'METAL', radius: 0.005, motion });
    for (const sy of [-1, 1]) box(pivot[0] + sign * 0.015, y + sy * height * 0.3, z - 0.016, 0.03, 0.038, 0.025, { surface: 'METAL', motion });
  };
  if (kind === 'SOFA' || kind === 'ARMCHAIR') {
    const sofa = config.sofa;
    const count = sofa?.seats ?? 1;
    const bodyDepth = sofa?.bodyDepthM ?? d;
    const arm = (sofa?.arms ?? config.armchair?.arms) === 'WIDE' ? 0.22 : 0.12;
    const legH = config.upholstery?.base === 'PLINTH' ? 0.065 : 0.13;
    const baseH = 0.17;
    const seatH = config.upholstery?.firmness === 'SOFT' ? 0.17 : config.upholstery?.firmness === 'FIRM' ? 0.125 : 0.15;
    const seatTop = legH + baseH + seatH;
    const bodyZ = -d / 2 + bodyDepth / 2;
    const inner = w - arm * 2;
    const unit = inner / count;
    const chaiseIndex = sofa?.layout === 'CHAISE_LEFT' ? 0 : sofa?.layout === 'CHAISE_RIGHT' ? count - 1 : -1;
    legs(w, bodyDepth, legH, bodyZ);
    box(0, legH + baseH / 2, bodyZ, w - 0.03, baseH, bodyDepth - 0.02, { ...fabric, radius: 0.025 });
    const backDepth = 0.15;
    box(0, legH + (h - legH) / 2, -d / 2 + backDepth / 2, w, h - legH, backDepth,
      { surface: 'FABRIC', shape: 'HEADBOARD_PAD' });
    for (const sx of [-1, 1]) box(sx * (w / 2 - arm / 2), legH + (h * 0.7 - legH) / 2, bodyZ + 0.04,
      arm, h * 0.7 - legH, bodyDepth - 0.08, { surface: 'FABRIC', radius: Math.min(0.045, arm * 0.3) });
    for (let i = 0; i < count; i++) {
      const x = -inner / 2 + unit * (i + 0.5);
      const seatDepth = (i === chaiseIndex ? d : bodyDepth) - 0.22;
      if (i === chaiseIndex) {
        const extension = d - bodyDepth;
        box(x, legH + baseH / 2, d / 2 - extension / 2 - 0.01, unit - 0.012, baseH, extension, fabric);
        if (config.upholstery?.base === 'PLINTH') box(x, legH / 2, d / 2 - extension / 2 - 0.01, unit - 0.09, legH, extension - 0.09, { surface: 'LEG_FINISH' });
        else for (const sx of [-1, 1]) box(x + sx * (unit / 2 - 0.09), legH / 2, d / 2 - 0.09, 0.055, legH, 0.055,
          config.upholstery?.base === 'BLACK' ? { surface: 'LEG_FINISH', shape: 'CYLINDER' }
            : { surface: 'LEG_FINISH', shape: 'TAPERED_LEG', ...legAsset(x + sx * (unit / 2 - 0.09), legH, d / 2 - 0.09, 0.055, legH, 0.055, 'LEG_FINISH') });
      }
      if (sofa?.cushions !== 'BENCH' || chaiseIndex >= 0)
        box(x, legH + baseH + seatH / 2, -d / 2 + 0.2 + seatDepth / 2, unit - 0.015, seatH, seatDepth, fabric);
      box(x, seatTop + (h - seatTop - 0.025) / 2, -d / 2 + 0.225, unit - 0.018, h - seatTop - 0.025, 0.18,
        { surface: 'FABRIC', shape: 'HEADBOARD_PAD' });
    }
    if (sofa?.cushions === 'BENCH' && chaiseIndex < 0) box(0, legH + baseH + seatH / 2, bodyZ + 0.09, inner - 0.018, seatH, bodyDepth - 0.22, fabric);
    return panels;
  }
  if (kind === 'OTTOMAN' && config.ottoman) {
    const { shape, storage } = config.ottoman;
    const round = shape === 'ROUND';
    const legH = config.upholstery?.base === 'PLINTH' ? 0.04 : 0.1;
    const lidH = 0.1;
    const bodyH = h - legH - lidH;
    if (round && config.upholstery?.base === 'PLINTH') {
      box(0, legH / 2, 0, w - 0.07, legH, d - 0.07, { surface: 'LEG_FINISH', shape: 'ELLIPSE' });
    } else if (round) {
      for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) box(Math.cos(angle) * w * 0.3, legH / 2, Math.sin(angle) * d * 0.3, 0.05, legH, 0.05,
        { surface: 'LEG_FINISH', shape: 'TAPERED_LEG', ...legAsset(Math.cos(angle) * w * 0.3, legH, Math.sin(angle) * d * 0.3, 0.05, legH, 0.05, 'LEG_FINISH') });
    } else legs(w, d, legH);
    if (storage) {
      box(0, legH + 0.012, 0, w - 0.06, 0.024, d - 0.06, { shape: round ? 'ELLIPSE' : undefined, grainAxis: 'X' });
      if (round) box(0, legH + bodyH / 2, 0, w - 0.012, bodyH, d - 0.012, { surface: 'FABRIC', shape: 'ROUND_SHELL' });
      else {
        for (const sx of [-1, 1]) box(sx * (w / 2 - 0.025), legH + bodyH / 2, 0, 0.05, bodyH, d - 0.014, { surface: 'FABRIC', radius: 0.012 });
        for (const sz of [-1, 1]) box(0, legH + bodyH / 2, sz * (d / 2 - 0.025), w - 0.1, bodyH, 0.05, { surface: 'FABRIC', radius: 0.012 });
      }
    } else box(0, legH + bodyH / 2, 0, w - 0.012, bodyH, d - 0.012, { surface: 'FABRIC', shape: round ? 'ROUND_CUSHION' : 'SEAT_CUSHION' });
    box(0, h - lidH / 2, 0, w, lidH, d, { surface: 'FABRIC', shape: round ? 'ROUND_CUSHION' : 'SEAT_CUSHION',
      ...(storage ? { motion: { key: 'ottoman:lid', type: 'ROTATE_X', pivot: [0, h - lidH, -d / 2], angle: -Math.PI * 0.38 } } : {}) });
    if (storage) {
      const motion = panels[panels.length - 1].motion;
      box(0, h - lidH + 0.004, -d * 0.46, 0.07, 0.008, d * 0.08, { surface: 'METAL', motion });
      box(0, h - lidH - 0.005, -d / 2 + 0.007, 0.09, 0.014, 0.014, { surface: 'METAL', shape: 'CYLINDER', axis: 'X' });
    }
    return panels;
  }
  if (kind === 'BATHROOM_VANITY' && config.vanity) {
    const v = config.vanity;
    const floor = v.mounting === 'FLOOR';
    const bottom = floor ? 0.12 : 0;
    const cabinetTop = h - 0.14;
    const cabinetH = cabinetTop - bottom;
    const topT = 0.022;
    const n = v.basins === 'DOUBLE' ? 2 : 1;
    const unit = w / n;
    if (floor) for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - 0.07), bottom / 2, sz * (d / 2 - 0.07), 0.045, bottom, 0.045, { surface: 'METAL' });
    for (const sx of [-1, 1]) box(sx * (w / 2 - 0.009), bottom + cabinetH / 2, -0.02, 0.018, cabinetH, d - 0.08, { grainAxis: 'Y' });
    box(0, bottom + 0.009, -0.02, w - 0.036, 0.018, d - 0.08, { grainAxis: 'X' });
    // Dos deschis si traverse pentru acces la instalatii.
    for (const y of [bottom + 0.045, cabinetTop - 0.045]) box(0, y, -d / 2 + 0.022, w - 0.036, 0.07, 0.018, { grainAxis: 'X' });
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + unit * (i + 0.5);
      const bw = Math.min(0.5, unit - 0.08);
      const bd = Math.min(0.34, d - 0.11);
      const surface = v.countertop === 'LIGHT' ? 'STONE_LIGHT' as const : 'STONE_DARK' as const;
      // Blatul inconjoara gaura de scurgere, pastrata si in previzualizare.
      for (const sx of [-1, 1]) box(x + sx * (unit / 4 + 0.006), cabinetTop + topT / 2, 0, unit / 2 - 0.012, topT, d, { surface });
      for (const sz of [-1, 1]) box(x, cabinetTop + topT / 2, sz * (d / 4 + 0.006), 0.024, topT, d / 2 - 0.012, { surface });
      box(x, cabinetTop + topT + 0.052, 0, bw, 0.104, bd, { surface: 'CERAMIC', shape: 'BASIN' });
      box(x, cabinetTop - 0.085, 0, 0.035, 0.18, 0.035, { surface: 'METAL', shape: 'CYLINDER' });
      box(x, cabinetTop - 0.18, -d * 0.18, 0.035, 0.035, d * 0.36, { surface: 'METAL', shape: 'CYLINDER', axis: 'Z' });
      box(x, cabinetTop + 0.063, -d / 2 + 0.04, 0.022, 0.126, 0.022, { surface: 'METAL', shape: 'CYLINDER' });
      box(x, cabinetTop + 0.118, -d / 2 + 0.088, 0.023, 0.018, 0.116, { surface: 'METAL', radius: 0.005 });
      if (i > 0) box(x - unit / 2, bottom + cabinetH / 2, -0.02, 0.018, cabinetH, d - 0.08, { grainAxis: 'Y' });
      if (v.storage === 'DOORS') for (const sx of [-1, 1]) door(`vanity:door:${i}:${sx}`, x + sx * unit / 4, bottom + cabinetH / 2,
        d / 2 - 0.044, unit / 2 - 0.012, cabinetH - 0.009, v.handles === 'HANDLE', -sx);
      if (v.storage === 'DRAWERS') for (let j = 0; j < 2; j++) {
        const frontH = cabinetH / 2 - 0.007;
        const y = bottom + (j + 0.5) * cabinetH / 2;
        const motion: NonNullable<Panel3d['motion']> = { key: `vanity:drawer:${i}:${j}`, type: 'SLIDE', travel: [0, 0, d * 0.6] };
        box(x, y, d / 2 - 0.044, unit - 0.025, frontH, 0.018, { role: 'DRAWER_FRONT', motion, grainAxis: 'X' });
        if (v.handles === 'HANDLE') box(x, y + frontH * 0.26, d / 2 - 0.017, Math.min(0.18, unit * 0.3), 0.012, 0.025, { surface: 'METAL', motion });
        // Tavile in U pastreaza culoarul central liber pentru sifon.
        const gap = 0.16;
        const sideW = (unit - 0.07 - gap) / 2;
        const trayY = y - frontH / 2 + 0.03;
        for (const sx of [-1, 1]) {
          const tx = x + sx * (gap / 2 + sideW / 2);
          box(tx, trayY, 0.002, sideW, 0.012, d - 0.11, { motion, grainAxis: 'Z' });
          for (const edge of [-1, 1]) box(tx + edge * (sideW / 2 - 0.006), trayY + frontH * 0.3, 0.002, 0.012, frontH * 0.6, d - 0.11, { motion });
          box(tx, trayY + frontH * 0.3, -d / 2 + 0.063, sideW, frontH * 0.6, 0.012, { motion });
          box(tx, trayY - 0.013, 0, sideW * 0.65, 0.012, d - 0.16, { surface: 'METAL' });
        }
        box(x, trayY, d / 2 - 0.078, gap, 0.012, 0.05, { motion });
      }
    }
    return panels;
  }
  if (kind === 'ENTRYWAY' && config.entryway) {
    const e = config.entryway;
    const seatH = 0.45;
    box(0, h / 2, -d / 2 + 0.012, w, h, 0.024, { grainAxis: 'Y' });
    box(0, 0.035, 0, w - 0.08, 0.07, d - 0.08);
    for (const sx of [-1, 1]) box(sx * (w / 2 - 0.009), 0.24, -0.016, 0.018, 0.34, d - 0.072, { grainAxis: 'Y' });
    box(0, 0.08, 0, w, 0.018, d - 0.04, { grainAxis: 'X' });
    box(0, 0.245, -0.015, w - 0.036, 0.018, d - 0.074, { grainAxis: 'X' });
    box(0, 0.406, 0, w, 0.022, d, { grainAxis: 'X', shape: 'TABLETOP' });
    box(0, 0.433, 0.005, w - 0.025, 0.034, d - 0.03, e.upholsteredSeat ? fabric : { grainAxis: 'X', shape: 'TABLETOP' });
    const n = Math.ceil(w / 0.6);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n;
      if (i) box(x - w / n / 2, 0.24, -0.015, 0.018, 0.31, d - 0.074);
      if (e.shoeStorage === 'DOORS') door(`entryway:door:${i}`, x, 0.243, d / 2 - 0.035, w / n - 0.009, 0.296, true);
    }
    const mirrorW = e.mirror === 'NONE' ? 0 : w * 0.32;
    const mirrorX = (e.mirror === 'LEFT' ? -1 : 1) * (w / 2 - mirrorW / 2 - 0.025);
    if (mirrorW) {
      box(mirrorX, (h + seatH) / 2, -d / 2 + 0.031, mirrorW, h - seatH - 0.14, 0.02, { surface: 'ACCENT' });
      box(mirrorX, (h + seatH) / 2, -d / 2 + 0.044, mirrorW - 0.024, h - seatH - 0.164, 0.006, { surface: 'MIRROR' });
    }
    const hookW = w - mirrorW - 0.12;
    const hookX = e.mirror === 'NONE' ? 0 : -Math.sign(mirrorX) * mirrorW / 2;
    for (let i = 0; i < e.hooks; i++) {
      const x = hookX - hookW / 2 + (i + 0.5) * hookW / e.hooks;
      const y = h - 0.34;
      box(x, y, -d / 2 + 0.058, 0.025, 0.065, 0.055, { surface: 'METAL', radius: 0.007 });
      box(x, y + 0.018, -d / 2 + 0.094, 0.015, 0.045, 0.018, { surface: 'METAL', radius: 0.007 });
    }
    if (e.upperShelf) box(hookX, h - 0.13, -d / 2 + 0.14, hookW + 0.035, 0.024, 0.24, { shape: 'TABLETOP', grainAxis: 'X' });
    return panels;
  }
  return panels;
}
