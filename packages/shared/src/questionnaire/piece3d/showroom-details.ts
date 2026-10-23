import type { Piece3dHandleStyle, PieceConfig3d } from './config';
import { HANDLE_BAR_CC_MM, handleBarNode, hingeAsset } from './hardware-assets';
import type { Panel3d, Panel3dAsset } from './model';

// Feronerie vizuala derivata, fara efect asupra cotelor ofertate sau a BOM-ului.
const detail = (x: number, y: number, z: number, w: number, h: number, d: number,
  extra: Partial<Panel3d> = {}): Panel3d => ({ role: 'FURNITURE', x, y, z, w, h, d,
  radius: Math.min(0.002, w / 4, h / 4, d / 4), surface: 'METAL', ...extra });

// Prototip 2026-10-22: manerele si balamalele au si modele GLB (vezi
// hardware-assets.ts); distantele intre posturile barei sunt cele standard din
// comert (mm). Primitivele de mai jos raman mereu, ca rezerva.
// capatul barei dincolo de post, pe fiecare parte (ca in model)
const HANDLE_BAR_OVERHANG = 0.012;
// jumatate de milimetru in fata frontului, ca modelul sa nu se bata cu fata
const HANDLE_ASSET_LIFT = 0.0005;
const SHELL_W = 0.09;
const SHELL_H = 0.042;
const KNOB_D = 0.03;
const PROFILE_INSET = 0.02;

// Modelul care incape pe front (sau nimic: raman primitivele). x/y = ancora
// barei istorice; length = lungimea barei calculate pentru acest front.
function handleAsset(front: Panel3d, style: Piece3dHandleStyle, x: number, y: number, length: number): Panel3dAsset | undefined {
  const door = front.role === 'DOOR_FRONT';
  const z = front.d / 2 + HANDLE_ASSET_LIFT;
  const surface = 'BRASS';
  if (style === 'BAR') {
    const cc = [...HANDLE_BAR_CC_MM].reverse().find(mm => mm / 1000 + 2 * HANDLE_BAR_OVERHANG <= length);
    return cc ? { id: 'HANDLE_BAR', node: handleBarNode(cc), mount: [x, y, z], rotationZ: door ? Math.PI / 2 : 0, surface } : undefined;
  }
  if (style === 'KNOB') return Math.min(front.w, front.h) >= KNOB_D * 2 ? { id: 'HANDLE_KNOB', node: 'handle_knob', mount: [x, y, z], surface } : undefined;
  if (style === 'SHELL') {
    return front.w >= SHELL_W + 0.03 && front.h >= SHELL_H + 0.02 ? { id: 'HANDLE_SHELL', node: 'handle_shell', mount: [x, y, z], surface } : undefined;
  }
  // PROFILE: pe muchia de sus la sertare/rabatabile, pe muchia de deschidere la usi
  const span = (door ? front.h : front.w) - PROFILE_INSET;
  if (span < 0.08) return undefined;
  const scale: [number, number, number] = [span, 1, 1];
  if (!door) return { id: 'HANDLE_PROFILE', node: 'handle_profile', mount: [0, front.h / 2, z], scale, surface };
  const sign = front.hinge === 'R' ? 1 : -1;
  return { id: 'HANDLE_PROFILE', node: 'handle_profile', mount: [-sign * front.w / 2, 0, z], rotationZ: sign * Math.PI / 2, scale, surface };
}

// Coordonate relative la centrul frontului, pentru acelasi maner in toate scenele.
// Primitivele (bara + posturi) se intorc mereu; cand un model GLB incape,
// primul panou devine ancora (`asset`) si toate poarta `assetFallback`.
export function buildFrontHandle(front: Panel3d, recessed = false, style: Piece3dHandleStyle = 'BAR'): Panel3d[] {
  const door = front.role === 'DOOR_FRONT';
  const sliding = front.role === 'SLIDING_FRONT';
  const tilt = front.role === 'TILT_FRONT';
  if (!door && !sliding && !tilt && front.role !== 'DRAWER_FRONT') return [];
  const z = front.d / 2;
  if (sliding || recessed) {
    const sign = (front.slideDx ?? 0) >= 0 ? 1 : -1;
    const x = sliding ? -sign * (front.w / 2 - 0.035) : 0;
    const y = sliding ? 0 : Math.max(0, front.h / 2 - 0.045);
    const w = sliding ? 0.022 : Math.min(0.14, front.w * 0.4);
    const h = sliding ? Math.min(0.24, front.h * 0.3) : 0.022;
    // Insertul ramane practic la fata, astfel ca foile glisante nu se agata.
    return [detail(x, y, z, w, h, 0.001, { surface: 'METAL' }),
      detail(x, y, z + 0.0006, w - 0.006, h - 0.006, 0.0003, { surface: 'ACCENT' })];
  }
  const length = door ? Math.min(0.32, front.h * 0.45) : Math.min(tilt ? 0.26 : 0.28, front.w * (tilt ? 0.4 : 0.45));
  const sign = front.hinge === 'R' ? 1 : -1;
  const x = door ? -sign * (front.w / 2 - 0.05) : 0;
  const y = door ? 0 : Math.max(0, front.h / 2 - (tilt ? 0.05 : 0.045));
  const result = [detail(x, y, z + 0.014, door ? 0.012 : length, door ? length : 0.012, 0.012,
    { surface: 'BRASS', shape: 'CYLINDER', axis: door ? 'Y' : 'X' })];
  const postOffset = length / 2 - Math.min(0.018, length * 0.2);
  for (const side of [-1, 1]) result.push(detail(x + (door ? 0 : side * postOffset),
    y + (door ? side * postOffset : 0), z + 0.007,
    0.008, 0.008, 0.014, { surface: 'BRASS', shape: 'CYLINDER', axis: 'Z' }));
  const asset = handleAsset(front, style, x, y, length);
  if (!asset) return result;
  return result.map((p, i) => i === 0 ? { ...p, asset, assetFallback: asset.node } : { ...p, assetFallback: asset.node });
}

export function buildStaticHandles(config: PieceConfig3d, panels: readonly Panel3d[]): Panel3d[] {
  if (config.frontStyle !== 'HANDLE') return [];
  return panels.flatMap(front => buildFrontHandle(front, config.doorMode === 'SLIDING' && front.role === 'DRAWER_FRONT', config.handleStyle ?? 'BAR')
    .map(p => ({
      ...p, x: p.x + front.x, y: p.y + front.y, z: p.z + front.z,
      ...(p.asset ? { asset: { ...p.asset, mount: [p.asset.mount[0] + front.x, p.asset.mount[1] + front.y, p.asset.mount[2] + front.z] as [number, number, number] } } : {}),
    })));
}

export function buildInteriorDetails(panels: readonly Panel3d[]): Panel3d[] {
  const backs = panels.filter(p => p.role === 'BACK');
  const sides = panels.filter(p => p.role === 'SIDE');
  const fronts = panels.filter(p => ['DOOR_FRONT', 'SLIDING_FRONT', 'TILT_FRONT'].includes(p.role));
  return panels.flatMap(panel => {
    const result: Panel3d[] = [];
    if (panel.role === 'SHELF' && panel.col !== undefined) {
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        result.push(detail(panel.x + side * (panel.w / 2 - 0.005), panel.y - panel.h / 2 - 0.003,
          panel.z + end * Math.max(0, panel.d / 2 - 0.045), 0.012, 0.006, 0.006,
          { shape: 'CYLINDER', axis: 'X' }));
      }
    } else if (panel.role === 'ROD') {
      for (const side of [-1, 1]) result.push(detail(panel.x + side * (panel.w / 2 - 0.004),
        panel.y, panel.z, 0.008, 0.039, 0.039, { surface: 'BRASS', shape: 'CYLINDER', axis: 'X' }));
      // Umerasul sta transversal pe bara; latimea lui ocupa adancimea dulapului.
      const rear = Math.max(-Infinity, ...backs.filter(p => Math.abs(p.x - panel.x) < p.w / 2).map(p => p.z + p.d / 2));
      const front = Math.min(Infinity, ...sides.map(p => p.z + p.d / 2),
        ...fronts.filter(p => p.col === undefined || p.col === panel.col).map(p => p.z - p.d / 2));
      const space = Math.min(panel.z - rear, front - panel.z);
      const span = Number.isFinite(space) ? Math.min(.42, 2 * (space - .01)) : .38;
      if (span >= .12 && panel.w >= .04 && panel.y >= .24) {
        result.push(detail(panel.x, panel.y - .16, panel.z, .016, .14, span,
          { surface: 'HANGER_WOOD', shape: 'HANGER', grainAxis: 'X', col: panel.col, zone: panel.zone }));
        result.push(detail(panel.x, panel.y - .0395, panel.z, .004, .113, .038,
          { surface: 'METAL', shape: 'HANGER_HOOK', grainAxis: 'X', col: panel.col, zone: panel.zone }));
      }
    }
    return result;
  });
}

// La deschidere, cupele balamalelor urmeaza usa. Nu simuleaza un model comercial.
export function buildDoorHingeDetails(front: Panel3d): Panel3d[] {
  if (front.role !== 'DOOR_FRONT') return [];
  const sign = front.hinge === 'R' ? 1 : -1;
  const count = front.h > 1.6 ? 3 : 2;
  const cup = Math.min(0.035, front.h * 0.3);
  const barrelH = Math.min(0.042, front.h * 0.36);
  const inset = Math.max(barrelH / 2 + 0.002, Math.min(0.1, front.h * 0.22));
  const result: Panel3d[] = [];
  for (let i = 0; i < count; i++) {
    const y = -front.h / 2 + inset + i * (front.h - 2 * inset) / (count - 1);
    const x = sign * (front.w / 2 - 0.022);
    // cupa e ancora modelului GLB (cupa + brat + butuc); butucul e doar rezerva
    const hinge = hingeAsset(front, x, y);
    result.push(detail(x, y, -front.d / 2 - 0.002, cup, cup, 0.004, { shape: 'CYLINDER', axis: 'Z', ...hinge }));
    result.push(detail(sign * (front.w / 2 - 0.003), y, -front.d / 2 - 0.0025, 0.006, barrelH, 0.005,
      { shape: 'CYLINDER', axis: 'Y', ...(hinge.assetFallback ? { assetFallback: hinge.assetFallback } : {}) }));
  }
  return result;
}
