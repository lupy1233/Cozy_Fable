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
  // T1: usa glisanta pe toata inaltimea unei coloane, pe sina in fata carcasei
  | 'SLIDING_FRONT'
  // T1: picior conic (comoda "pe picioare"); FE il deseneaza ca cilindru
  | 'LEG'
  | 'ROD'
  | 'DESK_TOP'
  // fundal intunecat in spatele fronturilor: rostul dintre fronturi (luftul)
  // se citeste ca linie inchisa, stil Tylko
  | 'FRONT_BACKDROP';

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
): void {
  const column = config.columns[colIndex];
  const D = config.depthM;
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
        z: D / 2 - T / 2,
        w: w ?? layout.width - 2 * FRONT_GAP,
        h,
        d: T,
        col: colIndex,
        zone: j,
        ...(hinge ? { hinge } : {}),
      });

    // fundal intunecat in spatele fronturilor — luftul se citeste ca rost
    const backdrop = () =>
      panels.push({
        role: 'FRONT_BACKDROP',
        x: cx,
        y: (top + bottom) / 2,
        z: D / 2 - T - 0.004,
        w: layout.width,
        h: zoneH,
        d: 0.002,
        col: colIndex,
        zone: j,
      });

    // polite orizontale distribuite egal in zona (si in spatele usilor)
    const shelves = (count: number) => {
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
        backdrop();
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
    zonePanels(config, layout, resolved[i] ?? [], i, panels);
  });
  return panels;
}

// Genereaza panourile piesei din config (docs/10: buildPanels(config) → Panel[]).
export function buildPanels(config: PieceConfig3d, kind: Piece3dKind): Panel3d[] {
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
    panels.push({
      role: 'PLINTH',
      x: 0,
      y: base / 2,
      z: D / 2 - 0.03 - T / 2,
      w: W - 2 * T,
      h: base,
      d: T,
    });
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
      z: BACK_T / 2,
      w: T,
      h: layouts[i].top - layouts[i].bottom,
      d: D - BACK_T,
    });
  }
  layouts.forEach((layout, i) => zonePanels(config, layout, resolved[i]?.zones ?? [], i, panels));
  if (rules.slidingDoors && config.doorMode === 'SLIDING') {
    slidingDoorPanels(config, layouts, panels);
  }
  return panels;
}

// Usile glisante (T1): cate o usa pe toata inaltimea per coloana, pe doua
// sine alternante IN FATA carcasei; usa acopera si jumatatile despartitoarelor
// vecine. Directia de deschidere e per usa (slideTo), capetele doar spre
// interior; distanta de glisare = latimea coloanei vecine (usa ajunge peste ea).
function slidingDoorPanels(
  config: PieceConfig3d,
  layouts: ColumnLayout[],
  panels: Panel3d[],
): void {
  const { widthM: W, heightM: H, depthM: D } = config;
  const n = layouts.length;
  layouts.forEach((layout, i) => {
    const left = Math.max(-W / 2, layout.left - T);
    const right = Math.min(W / 2, layout.left + layout.width + T);
    // sine alternante: usile vecine stau pe adancimi diferite ca sa se
    // poata suprapune la deschidere
    const z = D / 2 + T / 2 + (i % 2 === 0 ? T + 0.006 : 0.003);
    const dir: Piece3dSlideDirection =
      i === 0 ? 'R' : i === n - 1 ? 'L' : config.columns[i]?.slideTo ?? 'L';
    const neighbor = dir === 'R' ? layouts[i + 1] : layouts[i - 1];
    const dx = (neighbor ? neighbor.width + T : layout.width) * (dir === 'R' ? 1 : -1);
    panels.push({
      role: 'SLIDING_FRONT',
      x: (left + right) / 2,
      y: H / 2,
      z,
      w: right - left,
      h: H - 0.02,
      d: T,
      col: i,
      slide: dir,
      slideDx: dx,
    });
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
// afara gabaritului declarat. Usile glisante sunt exceptate pe adancime —
// stau pe sine IN FATA carcasei, deci ies legitim din gabaritul de adancime.
export function panelsWithinBounds(config: PieceConfig3d, panels: Panel3d[]): boolean {
  const eps = 1e-6;
  return panels.every((p) => {
    if (p.role === 'SLIDING_FRONT') return true;
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
