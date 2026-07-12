import {
  BACK_T,
  COLUMN_W_MAX,
  columnWidth,
  DESK_PEDESTAL_W,
  FRONT_GAP,
  PANEL_T,
  PIECE3D_RULES,
  PLINTH_H,
  type Piece3dKind,
  type Piece3dZoneType,
  type PieceConfig3d,
} from './config';

// Modelul parametric (docs/10 §2): mobila e GENERATA din config — carcasa din
// panouri, coloane, polite/sertare/usi per zona. Functiile sunt PURE si
// testabile; componenta 3D din frontend doar deseneaza panourile.
// Sistem de coordonate: origine la mijlocul piesei pe X, podea la y=0,
// fata piesei la z=+depth/2 (metri, ca answers).

export type Panel3dRole =
  | 'SIDE'
  | 'TOP'
  | 'BOTTOM'
  | 'BACK'
  | 'PLINTH'
  | 'DIVIDER'
  | 'ZONE_SEP'
  | 'SHELF'
  | 'DRAWER_FRONT'
  | 'DOOR_FRONT'
  | 'TILT_FRONT'
  | 'ROD'
  | 'DESK_TOP';

export interface Panel3d {
  role: Panel3dRole;
  // centrul panoului
  x: number;
  y: number;
  z: number;
  // dimensiunile complete pe fiecare axa
  w: number;
  h: number;
  d: number;
  // pentru fronturi/polite: zona din care fac parte (highlight in UI)
  col?: number;
  zone?: number;
}

// Cutia interioara a unei zone — hit-target pentru click/tap in 3D (R2).
export interface ZoneBox3d {
  col: number;
  zone: number;
  type: Piece3dZoneType;
  count?: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

const T = PANEL_T;

interface ColumnLayout {
  // marginea stanga interioara a coloanei
  left: number;
  width: number;
  bottom: number;
  top: number;
}

// Layout-ul unei zone in coloana ei (zonele sunt ordonate de sus in jos).
function zoneSlices(layout: ColumnLayout, zoneCount: number): { top: number; bottom: number }[] {
  const interior = layout.top - layout.bottom;
  const zoneH = (interior - (zoneCount - 1) * T) / zoneCount;
  return Array.from({ length: zoneCount }, (_, j) => {
    const top = layout.top - j * (zoneH + T);
    return { top, bottom: top - zoneH };
  });
}

// Panourile din interiorul unei zone (fronturi/polite/bara) + separatoarele.
function zonePanels(
  config: PieceConfig3d,
  layout: ColumnLayout,
  colIndex: number,
  panels: Panel3d[],
): void {
  const column = config.columns[colIndex];
  const D = config.depthM;
  const slices = zoneSlices(layout, column.zones.length);
  const innerD = D - BACK_T;
  const cx = layout.left + layout.width / 2;

  column.zones.forEach((zone, j) => {
    const { top, bottom } = slices[j];
    const zoneH = top - bottom;

    // separator orizontal sub zona (nu si sub ultima — acolo e fundul/blatul)
    if (j < column.zones.length - 1) {
      panels.push({
        role: 'ZONE_SEP',
        x: cx,
        y: bottom - T / 2,
        z: BACK_T / 2,
        w: layout.width,
        h: T,
        d: innerD,
        col: colIndex,
      });
    }

    const front = (role: Panel3dRole, y: number, h: number, x = cx, w?: number) =>
      panels.push({
        role,
        x,
        y,
        z: D / 2 - T / 2,
        w: w ?? layout.width - 2 * FRONT_GAP,
        h,
        d: T,
        col: colIndex,
        zone: j,
      });

    switch (zone.type) {
      case 'SHELVES': {
        const count = zone.count ?? 1;
        for (let s = 1; s <= count; s++) {
          panels.push({
            role: 'SHELF',
            x: cx,
            y: bottom + (s * zoneH) / (count + 1),
            z: BACK_T / 2,
            w: layout.width,
            h: T,
            d: innerD - 0.01,
            col: colIndex,
            zone: j,
          });
        }
        break;
      }
      case 'DRAWERS':
      case 'TILT_OUT': {
        const count = zone.count ?? 1;
        const role = zone.type === 'DRAWERS' ? 'DRAWER_FRONT' : 'TILT_FRONT';
        const each = zoneH / count;
        for (let s = 0; s < count; s++) {
          front(role, bottom + (s + 0.5) * each, each - 2 * FRONT_GAP);
        }
        break;
      }
      case 'DOOR': {
        // usa dubla peste ~65cm — acelasi prag ca pieceConfigTotals
        if (layout.width > 0.65) {
          const leafW = (layout.width - 3 * FRONT_GAP) / 2;
          front('DOOR_FRONT', (top + bottom) / 2, zoneH - 2 * FRONT_GAP, cx - leafW / 2 - FRONT_GAP / 2, leafW);
          front('DOOR_FRONT', (top + bottom) / 2, zoneH - 2 * FRONT_GAP, cx + leafW / 2 + FRONT_GAP / 2, leafW);
        } else {
          front('DOOR_FRONT', (top + bottom) / 2, zoneH - 2 * FRONT_GAP);
        }
        break;
      }
      case 'HANGING':
        panels.push({
          role: 'ROD',
          x: cx,
          y: top - 0.08,
          z: 0,
          w: layout.width,
          h: 0.028,
          d: 0.028,
          col: colIndex,
          zone: j,
        });
        break;
      case 'OPEN':
        break;
    }
  });
}

function zoneBoxesFor(
  config: PieceConfig3d,
  layout: ColumnLayout,
  colIndex: number,
  boxes: ZoneBox3d[],
): void {
  const column = config.columns[colIndex];
  const innerD = config.depthM - BACK_T;
  const slices = zoneSlices(layout, column.zones.length);
  column.zones.forEach((zone, j) => {
    const { top, bottom } = slices[j];
    boxes.push({
      col: colIndex,
      zone: j,
      type: zone.type,
      count: zone.count,
      x: layout.left + layout.width / 2,
      y: (top + bottom) / 2,
      z: BACK_T / 2,
      w: layout.width,
      h: top - bottom,
      d: innerD,
    });
  });
}

// Layout-urile coloanelor pentru piesele-carcasa (toate in afara de DESK).
function carcassColumnLayouts(config: PieceConfig3d, kind: Piece3dKind): ColumnLayout[] {
  const rules = PIECE3D_RULES[kind];
  const plinth = rules.hasPlinth ? PLINTH_H : 0;
  const n = config.columns.length;
  const colW = columnWidth(config.widthM, n);
  const bottom = plinth + T;
  const top = config.heightM - T;
  return Array.from({ length: n }, (_, i) => ({
    left: -config.widthM / 2 + T + i * (colW + T),
    width: colW,
    bottom,
    top,
  }));
}

// Layout-urile casetierelor de birou (stanga, apoi dreapta).
function deskPedestalLayouts(config: PieceConfig3d): ColumnLayout[] {
  const W = config.widthM;
  const bottom = 0.02 + T;
  const top = config.heightM - T;
  const layouts: ColumnLayout[] = [];
  if (config.columns.length >= 1) {
    layouts.push({ left: -W / 2 + T, width: DESK_PEDESTAL_W, bottom, top });
  }
  if (config.columns.length >= 2) {
    layouts.push({ left: W / 2 - T - DESK_PEDESTAL_W, width: DESK_PEDESTAL_W, bottom, top });
  }
  return layouts;
}

function deskPanels(config: PieceConfig3d): Panel3d[] {
  const { widthM: W, heightM: H, depthM: D } = config;
  const panels: Panel3d[] = [];
  const sideH = H - T;
  // blatul + picioarele laterale (panouri pline, stil birou modern)
  panels.push({ role: 'DESK_TOP', x: 0, y: H - T / 2, z: 0, w: W, h: T, d: D });
  panels.push({ role: 'SIDE', x: -W / 2 + T / 2, y: sideH / 2, z: 0, w: T, h: sideH, d: D - 0.04 });
  panels.push({ role: 'SIDE', x: W / 2 - T / 2, y: sideH / 2, z: 0, w: T, h: sideH, d: D - 0.04 });
  // panou de modestie
  panels.push({
    role: 'BACK',
    x: 0,
    y: H - T - 0.15,
    z: -D / 2 + BACK_T / 2 + 0.02,
    w: W - 2 * T,
    h: 0.3,
    d: BACK_T,
  });

  const layouts = deskPedestalLayouts(config);
  layouts.forEach((layout, i) => {
    // peretele interior al casetierei (cel exterior e piciorul biroului)
    const innerX = i === 0 ? layout.left + layout.width + T / 2 : layout.left - T / 2;
    panels.push({ role: 'DIVIDER', x: innerX, y: sideH / 2, z: 0, w: T, h: sideH, d: D - 0.04 });
    panels.push({
      role: 'BOTTOM',
      x: layout.left + layout.width / 2,
      y: layout.bottom - T / 2,
      z: 0,
      w: layout.width,
      h: T,
      d: D - 0.04,
    });
    panels.push({
      role: 'BACK',
      x: layout.left + layout.width / 2,
      y: (layout.bottom + layout.top) / 2,
      z: -D / 2 + BACK_T / 2 + 0.02,
      w: layout.width,
      h: layout.top - layout.bottom,
      d: BACK_T,
    });
    zonePanels(config, layout, i, panels);
  });
  return panels;
}

// Genereaza panourile piesei din config (docs/10: buildPanels(config) → Panel[]).
export function buildPanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
  if (kind === 'DESK') return deskPanels(config);

  const rules = PIECE3D_RULES[kind];
  const { widthM: W, heightM: H, depthM: D } = config;
  const plinth = rules.hasPlinth ? PLINTH_H : 0;
  const bodyH = H - plinth;
  const panels: Panel3d[] = [];

  // carcasa: 2 laterale, sus, jos, spate (+ soclu)
  panels.push({ role: 'SIDE', x: -W / 2 + T / 2, y: plinth + bodyH / 2, z: 0, w: T, h: bodyH, d: D });
  panels.push({ role: 'SIDE', x: W / 2 - T / 2, y: plinth + bodyH / 2, z: 0, w: T, h: bodyH, d: D });
  panels.push({ role: 'BOTTOM', x: 0, y: plinth + T / 2, z: 0, w: W - 2 * T, h: T, d: D });
  panels.push({ role: 'TOP', x: 0, y: H - T / 2, z: 0, w: W - 2 * T, h: T, d: D });
  panels.push({
    role: 'BACK',
    x: 0,
    y: plinth + T + (H - plinth - 2 * T) / 2,
    z: -D / 2 + BACK_T / 2,
    w: W - 2 * T,
    h: H - plinth - 2 * T,
    d: BACK_T,
  });
  if (plinth > 0) {
    panels.push({
      role: 'PLINTH',
      x: 0,
      y: plinth / 2,
      z: D / 2 - 0.03 - T / 2,
      w: W - 2 * T,
      h: plinth,
      d: T,
    });
  }

  const layouts = carcassColumnLayouts(config, kind);
  // despartitoare verticale intre coloane
  for (let i = 0; i < layouts.length - 1; i++) {
    panels.push({
      role: 'DIVIDER',
      x: layouts[i].left + layouts[i].width + T / 2,
      y: (layouts[i].bottom + layouts[i].top) / 2,
      z: BACK_T / 2,
      w: T,
      h: layouts[i].top - layouts[i].bottom,
      d: D - BACK_T,
    });
  }
  layouts.forEach((layout, i) => zonePanels(config, layout, i, panels));
  return panels;
}

// Cutiile zonelor pentru interactiune (click/tap → schimba tipul zonei).
export function buildZoneBoxes(config: PieceConfig3d, kind: Piece3dKind): ZoneBox3d[] {
  const boxes: ZoneBox3d[] = [];
  const layouts =
    kind === 'DESK' ? deskPedestalLayouts(config) : carcassColumnLayouts(config, kind);
  layouts.forEach((layout, i) => zoneBoxesFor(config, layout, i, boxes));
  return boxes;
}

// Ciclul de tipuri la click pe zona (R2): urmatorul tip permis piesei.
export function nextZoneType(kind: Piece3dKind, current: Piece3dZoneType): Piece3dZoneType {
  const allowed = PIECE3D_RULES[kind].zoneTypes;
  const idx = allowed.indexOf(current);
  return allowed[(idx + 1) % allowed.length];
}

// Verificare rapida de sanitate folosita in teste si dev: niciun panou in
// afara gabaritului declarat.
export function panelsWithinBounds(config: PieceConfig3d, panels: Panel3d[]): boolean {
  const eps = 1e-6;
  return panels.every(
    (p) =>
      p.x - p.w / 2 >= -config.widthM / 2 - eps &&
      p.x + p.w / 2 <= config.widthM / 2 + eps &&
      p.y - p.h / 2 >= -eps &&
      p.y + p.h / 2 <= config.heightM + eps &&
      p.z - p.d / 2 >= -config.depthM / 2 - eps &&
      p.z + p.d / 2 <= config.depthM / 2 + eps,
  );
}

// Folosit de UI ca sa stie daca mai incape o coloana (butonul +).
export function canAddColumn(kind: Piece3dKind, config: PieceConfig3d): boolean {
  const rules = PIECE3D_RULES[kind];
  const n = config.columns.length;
  if (n >= rules.maxColumns) return false;
  if (kind === 'DESK') return true;
  return columnWidth(config.widthM, n + 1) >= 0.22;
}

export function canRemoveColumn(kind: Piece3dKind, config: PieceConfig3d): boolean {
  const rules = PIECE3D_RULES[kind];
  const n = config.columns.length;
  if (n <= Math.max(rules.minColumns, kind === 'DESK' ? 0 : 1)) return false;
  if (kind === 'DESK') return true;
  return columnWidth(config.widthM, n - 1) <= COLUMN_W_MAX;
}
