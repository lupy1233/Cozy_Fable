import {
  BACK_T,
  COLUMN_W_MAX,
  columnWidth,
  deskMaxColumns,
  DESK_PEDESTAL_W,
  FRONT_GAP,
  PANEL_T,
  PIECE3D_RULES,
  pieceBaseHeight,
  resolvePieceLayout,
  SLIDING_COLUMNS_MAX,
  SLIDING_COLUMNS_MIN,
  type Piece3dKind,
  type Piece3dSlideDirection,
  type Piece3dZoneType,
  type PieceConfig3d,
  type ResolvedZone3d,
} from './config';
import { isFurnitureKind } from './furniture-config';
import { buildFurniturePanels } from './furniture-model';

// Modelul parametric (docs/10 §2): mobila e GENERATA din config — carcasa din
// panouri, coloane, polite/sertare/usi per zona. Functiile sunt PURE si
// testabile; componenta 3D din frontend doar deseneaza panourile.
// Sistem de coordonate: origine la mijlocul piesei pe X, podea la y=0,
// fata piesei la z=+depth/2 (metri, ca answers).

export type Panel3dRole =
  | 'FURNITURE'
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
  // Usa glisanta incadrata intre laterale, plafon si fund, pe doua sine.
  | 'SLIDING_FRONT'
  // T1: picior conic (comoda "pe picioare"); FE il deseneaza ca cilindru
  | 'LEG'
  | 'ROD'
  | 'DESK_TOP'
  // fundal intunecat in spatele fronturilor: rostul dintre fronturi (luftul)
  // se citeste ca linie inchisa, stil Tylko
  | 'FRONT_BACKDROP';

export interface Panel3d {
  radius?: number;
  surface?: 'FABRIC' | 'BEDDING' | 'ACCENT' | 'METAL' | 'BRASS' | 'HANGER_WOOD' | 'LEG_FINISH' | 'CERAMIC' | 'STONE_LIGHT' | 'STONE_DARK' | 'MIRROR';
  // Metadate derivate exclusiv pentru randare; nu intra in configuratia salvata.
  shape?: 'ELLIPSE' | 'CUSHION' | 'PIPING' | 'PEDESTAL' | 'CYLINDER' | 'BED_PILLOW' | 'BED_DUVET' | 'BED_THROW' | 'HEADBOARD_PAD' | 'HANGER' | 'HANGER_HOOK' | 'TAPERED_LEG' | 'TABLETOP' | 'SEAT_CUSHION' | 'ROUND_CUSHION' | 'BASIN' | 'ROUND_SHELL';
  axis?: 'X' | 'Y' | 'Z';
  seamRadius?: number;
  grainAxis?: 'X' | 'Y' | 'Z';
  motion?: {
    key: string;
    type: 'SLIDE' | 'ROTATE_X' | 'ROTATE_Y';
    travel?: [number, number, number];
    pivot?: [number, number, number];
    angle?: number;
  };
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
  // DOOR_FRONT: latura balamalei — in jurul ei se roteste usa la deschidere
  hinge?: 'L' | 'R';
  // SLIDING_FRONT: directia si distanta (m, semnata) de glisare la deschidere
  slide?: Piece3dSlideDirection;
  slideDx?: number;
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
const SLIDING_RECESS = 0.072;
const SLIDING_TRACK_H = 0.012;

function interiorFront(config: PieceConfig3d): number {
  return config.depthM / 2 - (config.doorMode === 'SLIDING' ? SLIDING_RECESS : 0);
}

interface ColumnLayout {
  // marginea stanga interioara a coloanei
  left: number;
  width: number;
  bottom: number;
  top: number;
}

// Panourile din interiorul unei zone (fronturi/polite/bara) + separatoarele.
// Pozitiile verticale vin din layout-ul REZOLVAT (R5.3: randuri blocate).
function zonePanels(
  config: PieceConfig3d,
  layout: ColumnLayout,
  slices: ResolvedZone3d[],
  colIndex: number,
  panels: Panel3d[],
  depthInset = 0,
): void {
  const column = config.columns[colIndex];
  const D = config.depthM;
  const rear = -D / 2 + BACK_T + depthInset;
  const frontEdge = interiorFront(config) - depthInset;
  const innerD = frontEdge - rear;
  const innerZ = (rear + frontEdge) / 2;
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
        z: innerZ,
        w: layout.width,
        h: T,
        d: innerD,
        col: colIndex,
      });
    }

    const front = (
      role: Panel3dRole,
      y: number,
      h: number,
      x = cx,
      w?: number,
      hinge?: 'L' | 'R',
    ) =>
      panels.push({
        role,
        x,
        y,
        z: frontEdge - T / 2,
        w: w ?? layout.width - 2 * FRONT_GAP,
        h,
        d: T,
        col: colIndex,
        zone: j,
        ...(hinge ? { hinge } : {}),
      });

    // polite orizontale distribuite egal in zona (si in spatele usilor)
    const shelves = (count: number) => {
      const shelfFront = frontEdge - (zone.type === 'DOOR' ? T + 0.006 : 0.01);
      for (let s = 1; s <= count; s++) {
        panels.push({
          role: 'SHELF',
          x: cx,
          y: bottom + (s * zoneH) / (count + 1),
          z: (rear + shelfFront) / 2,
          w: layout.width,
          h: T,
          d: shelfFront - rear,
          col: colIndex,
          zone: j,
        });
      }
    };

    // bare suprapuse (R5.4): zona se imparte in segmente egale, cate o bara
    // sub varful fiecarui segment (80cm/bara garantati de validare/normalize)
    const rods = (count: number) => {
      const each = zoneH / count;
      for (let s = 0; s < count; s++) {
        panels.push({
          role: 'ROD',
          x: cx,
          y: top - s * each - 0.08,
          z: 0,
          w: layout.width,
          h: 0.028,
          d: 0.028,
          col: colIndex,
          zone: j,
        });
      }
    };

    // continutul interior al zonelor OPEN/DOOR (R5.3): polite sau bare
    const fillPanels = () => {
      if (zone.fill === 'SHELVES') shelves(zone.count ?? 1);
      else if (zone.fill === 'HANGING') rods(zone.count ?? 1);
    };

    switch (zone.type) {
      case 'SHELVES':
        // legacy pre-R5.3 (datele publicate raman randabile)
        shelves(zone.count ?? 1);
        break;
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
        if (zone.fill) fillPanels();
        else if (zone.count) shelves(zone.count); // legacy: DOOR cu count = polite
        // usa dubla peste ~65cm — acelasi prag ca pieceConfigTotals;
        // balamaua sta pe muchia exterioara, usa se deschide spre privitor
        if (layout.width > 0.65) {
          const leafW = (layout.width - 3 * FRONT_GAP) / 2;
          const mid = (top + bottom) / 2;
          front('DOOR_FRONT', mid, zoneH - 2 * FRONT_GAP, cx - leafW / 2 - FRONT_GAP / 2, leafW, 'L');
          front('DOOR_FRONT', mid, zoneH - 2 * FRONT_GAP, cx + leafW / 2 + FRONT_GAP / 2, leafW, 'R');
        } else {
          front('DOOR_FRONT', (top + bottom) / 2, zoneH - 2 * FRONT_GAP, cx, undefined, cx < 0 ? 'L' : 'R');
        }
        break;
      }
      case 'HANGING':
        // legacy pre-R5.3
        rods(1);
        break;
      case 'OPEN':
        fillPanels();
        break;
    }
  });
}

function zoneBoxesFor(
  config: PieceConfig3d,
  layout: ColumnLayout,
  slices: ResolvedZone3d[],
  colIndex: number,
  boxes: ZoneBox3d[],
): void {
  const column = config.columns[colIndex];
  const innerD = config.depthM - BACK_T;
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

// Layout-urile coloanelor pentru piesele-carcasa (toate in afara de DESK) —
// latimile vin din layout-ul rezolvat (coloane blocate + impartire egala).
function carcassColumnLayouts(
  config: PieceConfig3d,
  kind: Piece3dKind,
  widths: number[],
): ColumnLayout[] {
  // baza (soclu sau picioare) vine din sursa comuna cu resolver-ul (T1)
  const bottom = pieceBaseHeight(kind, config) + T;
  const top = config.heightM - T;
  let left = -config.widthM / 2 + T;
  return widths.map((width) => {
    const layout = { left, width, bottom, top };
    left += width + T;
    return layout;
  });
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

function deskPanels(config: PieceConfig3d, resolved: ResolvedZone3d[][]): Panel3d[] {
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
    zonePanels(config, layout, resolved[i] ?? [], i, panels, 0.02);
  });
  return panels;
}

// Genereaza panourile piesei din config (docs/10: buildPanels(config) → Panel[]).
export function buildPanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
  return buildStructuralPanels(config, kind).map((panel) => {
    const front = ['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT'].includes(panel.role);
    const horizontal = ['TOP', 'BOTTOM', 'SHELF', 'ZONE_SEP', 'DESK_TOP'].includes(panel.role);
    const vertical = ['SIDE', 'DIVIDER', 'LEG'].includes(panel.role);
    const radius = front ? 0.0015 : panel.role === 'DESK_TOP' ? 0.0035 : horizontal ? 0.0012 : 0.0008;
    return {
      ...panel,
      radius: Math.min(panel.radius ?? radius, panel.w / 4, panel.h / 4, panel.d / 4),
      grainAxis: panel.grainAxis ?? (horizontal ? 'X' : vertical ? 'Y' : panel.w >= panel.h ? 'X' : 'Y'),
    };
  });
}

function buildStructuralPanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
  if (isFurnitureKind(kind)) return buildFurniturePanels(config, kind);
  const resolved = resolvePieceLayout(kind, config);
  if (kind === 'DESK')
    return deskPanels(
      config,
      resolved.map((c) => c.zones),
    );

  const rules = PIECE3D_RULES[kind];
  const { widthM: W, heightM: H, depthM: D } = config;
  // T1: comoda "pe picioare" inlocuieste soclul cu 4 picioare conice
  const legs = config.legs === true && rules.legsOption === true;
  const base = pieceBaseHeight(kind, config);
  const bodyH = H - base;
  const panels: Panel3d[] = [];

  // carcasa: 2 laterale, sus, jos, spate (+ soclu sau picioare)
  panels.push({ role: 'SIDE', x: -W / 2 + T / 2, y: base + bodyH / 2, z: 0, w: T, h: bodyH, d: D });
  panels.push({ role: 'SIDE', x: W / 2 - T / 2, y: base + bodyH / 2, z: 0, w: T, h: bodyH, d: D });
  panels.push({ role: 'BOTTOM', x: 0, y: base + T / 2, z: 0, w: W - 2 * T, h: T, d: D });
  panels.push({ role: 'TOP', x: 0, y: H - T / 2, z: 0, w: W - 2 * T, h: T, d: D });
  panels.push({
    role: 'BACK',
    x: 0,
    y: base + T + (H - base - 2 * T) / 2,
    z: -D / 2 + BACK_T / 2,
    w: W - 2 * T,
    h: H - base - 2 * T,
    d: BACK_T,
  });
  if (legs) {
    const lx = W / 2 - 0.07;
    const lz = D / 2 - 0.07;
    for (const [x, z] of [
      [-lx, -lz],
      [-lx, lz],
      [lx, -lz],
      [lx, lz],
    ] as const) {
      panels.push({ role: 'LEG', x, y: base / 2, z, w: 0.05, h: base, d: 0.05 });
    }
  } else if (base > 0) {
    const baseW = W - 0.06;
    const baseD = D - 0.06;
    for (const sign of [-1, 1]) {
      panels.push({ role: 'PLINTH', x: 0, y: base / 2, z: sign * (baseD - T) / 2,
        w: baseW, h: base, d: T });
      panels.push({ role: 'PLINTH', x: sign * (baseW - T) / 2, y: base / 2, z: 0,
        w: T, h: base, d: baseD - 2 * T });
    }
  }

  const layouts = carcassColumnLayouts(
    config,
    kind,
    resolved.map((c) => c.width),
  );
  // despartitoare verticale intre coloane
  for (let i = 0; i < layouts.length - 1; i++) {
    panels.push({
      role: 'DIVIDER',
      x: layouts[i].left + layouts[i].width + T / 2,
      y: (layouts[i].bottom + layouts[i].top) / 2,
      z: (interiorFront(config) - D / 2 + BACK_T) / 2,
      w: T,
      h: layouts[i].top - layouts[i].bottom,
      d: interiorFront(config) + D / 2 - BACK_T,
    });
  }
  layouts.forEach((layout, i) => zonePanels(config, layout, resolved[i]?.zones ?? [], i, panels));
  if (rules.slidingDoors && config.doorMode === 'SLIDING') {
    slidingDoorPanels(config, layouts, panels);
  }
  return panels;
}

// Doua canale incadrate in carcasa. Interioarele se opresc in spatele sinelor;
// deplasarea este limitata de laterale si pentru coloane de latimi diferite.
function slidingDoorPanels(
  config: PieceConfig3d,
  layouts: ColumnLayout[],
  panels: Panel3d[],
): void {
  const { widthM: W, heightM: H, depthM: D } = config;
  const n = layouts.length;
  const openingLeft = -W / 2 + T;
  const openingRight = W / 2 - T;
  const bottom = layouts[0].bottom;
  const top = H - T;
  const tracks = [D / 2 - T / 2 - 0.006, D / 2 - T / 2 - 0.034];
  const trackRear = tracks[1] - T / 2 - 0.005;
  const trackFront = tracks[0] + T / 2 + 0.004;
  const leafEdges = layouts.map((layout) => ({
    left: Math.max(openingLeft + FRONT_GAP, layout.left - T / 2 - 0.01),
    right: Math.min(openingRight - FRONT_GAP, layout.left + layout.width + T / 2 + 0.01),
  }));
  for (const y of [bottom + 0.002, top - 0.002]) {
    panels.push({ role: 'FURNITURE', surface: 'METAL', x: 0, y,
      z: (trackRear + trackFront) / 2, w: openingRight - openingLeft, h: 0.004, d: trackFront - trackRear });
  }
  for (const track of tracks) for (const sign of [-1, 1]) {
    for (const y of [bottom + SLIDING_TRACK_H / 2, top - SLIDING_TRACK_H / 2]) {
      panels.push({ role: 'FURNITURE', surface: 'METAL', x: 0, y,
        z: track + sign * (T / 2 + 0.003), w: openingRight - openingLeft, h: SLIDING_TRACK_H, d: 0.002 });
    }
  }
  layouts.forEach((layout, i) => {
    const { left, right } = leafEdges[i];
    const z = tracks[i % 2];
    const dir: Piece3dSlideDirection =
      i === 0 ? 'R' : i === n - 1 ? 'L' : config.columns[i]?.slideTo ?? 'L';
    const neighbor = dir === 'R' ? layouts[i + 1] : layouts[i - 1];
    const requested = neighbor ? neighbor.left + neighbor.width / 2 - (left + right) / 2 : 0;
    let minTravel = openingLeft + FRONT_GAP - left;
    let maxTravel = openingRight - FRONT_GAP - right;
    leafEdges.forEach((other, j) => {
      if (j % 2 !== i % 2 || j === i) return;
      if (j < i) minTravel = Math.max(minTravel, other.right + FRONT_GAP - left);
      else maxTravel = Math.min(maxTravel, other.left - FRONT_GAP - right);
    });
    const dx = Math.max(minTravel, Math.min(maxTravel, requested));
    const leafBottom = bottom + SLIDING_TRACK_H + 0.003;
    const leafTop = top - SLIDING_TRACK_H - 0.003;
    panels.push({
      role: 'SLIDING_FRONT',
      x: (left + right) / 2,
      y: (leafTop + leafBottom) / 2,
      z,
      w: right - left,
      h: leafTop - leafBottom,
      d: T,
      col: i,
      slide: dir,
      slideDx: dx,
    });
    // Patine prinse de canat, ghidate intre buzele profilului de sus/jos.
    for (const x of [left + 0.045, right - 0.045]) for (const y of [leafBottom - 0.003, leafTop + 0.003]) {
      panels.push({ role: 'FURNITURE', surface: 'METAL', x, y, z,
        w: 0.024, h: 0.016, d: T - 0.003,
        motion: { key: `slide:${i}`, type: 'SLIDE', travel: [dx, 0, 0] } });
    }
  });
}

// Cutiile zonelor pentru interactiune (click/tap → schimba tipul zonei).
export function buildZoneBoxes(config: PieceConfig3d, kind: Piece3dKind): ZoneBox3d[] {
  const boxes: ZoneBox3d[] = [];
  const resolved = resolvePieceLayout(kind, config);
  const layouts =
    kind === 'DESK'
      ? deskPedestalLayouts(config)
      : carcassColumnLayouts(
          config,
          kind,
          resolved.map((c) => c.width),
        );
  layouts.forEach((layout, i) => zoneBoxesFor(config, layout, resolved[i]?.zones ?? [], i, boxes));
  return boxes;
}

// Ciclul de tipuri la click pe zona (R2): urmatorul tip permis piesei.
export function nextZoneType(kind: Piece3dKind, current: Piece3dZoneType): Piece3dZoneType {
  const allowed = PIECE3D_RULES[kind].zoneTypes;
  const idx = allowed.indexOf(current);
  return allowed[(idx + 1) % allowed.length];
}

// Verificare rapida de sanitate folosita in teste si dev: niciun panou in
// afara gabaritului declarat, inclusiv usile glisante si feroneria.
export function panelsWithinBounds(config: PieceConfig3d, panels: Panel3d[]): boolean {
  const eps = 1e-6;
  return panels.every((p) => {
    return (
      p.x - p.w / 2 >= -config.widthM / 2 - eps &&
      p.x + p.w / 2 <= config.widthM / 2 + eps &&
      p.y - p.h / 2 >= -eps &&
      p.y + p.h / 2 <= config.heightM + eps &&
      p.z - p.d / 2 >= -config.depthM / 2 - eps &&
      p.z + p.d / 2 <= config.depthM / 2 + eps
    );
  });
}

// Folosit de UI ca sa stie daca mai incape o coloana (butonul +).
export function canAddColumn(kind: Piece3dKind, config: PieceConfig3d): boolean {
  const rules = PIECE3D_RULES[kind];
  const n = config.columns.length;
  if (n >= rules.maxColumns) return false;
  // usile glisante exista doar la 2-3 coloane (T1): cu glisare activa,
  // coloanele raman in interval — altfel alegerea PO s-ar pierde tacit
  if (config.doorMode === 'SLIDING' && n >= SLIDING_COLUMNS_MAX) return false;
  // birou: a doua casetiera doar daca latimea lasa loc de genunchi intre ele
  if (kind === 'DESK') return n + 1 <= deskMaxColumns(config.widthM);
  return columnWidth(config.widthM, n + 1) >= 0.22;
}

export function canRemoveColumn(kind: Piece3dKind, config: PieceConfig3d): boolean {
  const rules = PIECE3D_RULES[kind];
  const n = config.columns.length;
  if (n <= Math.max(rules.minColumns, kind === 'DESK' ? 0 : 1)) return false;
  if (config.doorMode === 'SLIDING' && n <= SLIDING_COLUMNS_MIN) return false;
  if (kind === 'DESK') return true;
  return columnWidth(config.widthM, n - 1) <= COLUMN_W_MAX;
}
