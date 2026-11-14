import {
  DESK_KNEE_MIN,
  DESK_PEDESTAL_W,
  DRAWERS_COUNT_MAX,
  DRAWERS_MAX_TOP,
  GEOM_EPS,
  HANGING_COUNT_MAX,
  HANGING_MIN_DEPTH,
  PANEL_T,
  PIECE3D_RULES,
  SHELVES_COUNT_MAX,
  SLIDING_COLUMNS_MAX,
  SLIDING_COLUMNS_MIN,
  drawersCountFor,
  hangingCountFor,
  resolvePieceLayout,
  shelvesCountFor,
  type Piece3dKind,
  type Piece3dZone,
  type PieceConfig3d,
} from './config';
import { isFurnitureKind } from './furniture-config';
import { canAddColumn, canRemoveColumn } from './model';

// b7: curatarea (normalizePieceConfig) scoate pe tacute ce nu mai incape.
// Functiile de aici NU schimba rezultatul curatarii — doar spun CE s-a scos
// si DE CE, ca pasul 3D sa poata explica (si sa pastreze intentia clientului).

export type Piece3dCleanupReason =
  // bara de haine scoasa: adancime sub 55cm / zona sub 80cm
  | 'HANGING_DEPTH'
  | 'HANGING_HEIGHT'
  // sertare scoase: marginea de sus peste 160cm / zona sub 15cm
  | 'DRAWERS_TOO_HIGH'
  | 'DRAWERS_TOO_SHORT'
  // polite scoase: zona fara 10cm de spatiu intre polite
  | 'SHELVES_SPACE'
  // birou: casetiera scoasa, latimea nu mai lasa loc pentru doua
  | 'PEDESTALS_WIDTH'
  // numarul de coloane potrivit la latime (fiecare coloana 22-100cm)
  | 'COLUMNS_WIDTH'
  // usile glisante au revenit la batante (doar la 2-3 coloane)
  | 'SLIDING_COLUMNS'
  // numar micsorat (nu scos de tot): bare / sertare / polite care nu mai incap
  | 'HANGING_COUNT'
  | 'DRAWERS_COUNT'
  | 'SHELVES_COUNT';

export interface Piece3dCleanupNote {
  reason: Piece3dCleanupReason;
  // zona afectata (lipsa = motiv pentru toata piesa)
  col?: number;
  zone?: number;
  // *_COUNT: cate au ramas dupa curatare
  kept?: number;
}

// Latimea minima a biroului cu doua casetiere (laterale + 2 casetiere +
// spatiul de genunchi) — aceeasi formula ca deskMaxColumns.
export const DESK_TWO_PEDESTALS_MIN_W = 2 * PANEL_T + 2 * DESK_PEDESTAL_W + DESK_KNEE_MIN;
// Pragul REAL de la care deskMaxColumns accepta a doua casetiera (cu
// toleranta GEOM_EPS) — de afisat clientului.
export const DESK_TWO_PEDESTALS_FROM_W = DESK_TWO_PEDESTALS_MIN_W - GEOM_EPS;

const hadHanging = (z: Piece3dZone) => z.fill === 'HANGING' || z.type === 'HANGING';
const hadShelves = (z: Piece3dZone) =>
  z.fill === 'SHELVES' || z.type === 'SHELVES' || (z.type === 'DOOR' && !z.fill && !!z.count);
const hadDrawers = (z: Piece3dZone) => z.type === 'DRAWERS' || z.type === 'TILT_OUT';

// Compara configuratia dinainte de curatare (`before`, intentia clientului)
// cu cea curatata (`after` = normalizePieceConfig(kind, before)) si intoarce
// ce s-a scos, cu motivul. Lista goala = nimic pierdut.
export function explainPieceCleanup(
  kind: Piece3dKind,
  before: PieceConfig3d,
  after: PieceConfig3d,
): Piece3dCleanupNote[] {
  // acelasi obiect = nicio curatare de explicat (si nicio fals-pozitiva pe
  // forme vechi inca nemigrate)
  if (before === after || isFurnitureKind(kind)) return [];
  const rules = PIECE3D_RULES[kind];
  const notes: Piece3dCleanupNote[] = [];

  if (before.columns.length !== after.columns.length) {
    if (kind === 'DESK') {
      if (after.columns.length < before.columns.length) notes.push({ reason: 'PEDESTALS_WIDTH' });
    } else {
      notes.push({ reason: 'COLUMNS_WIDTH' });
    }
  }

  if (rules.slidingDoors && before.doorMode === 'SLIDING' && after.doorMode !== 'SLIDING') {
    notes.push({ reason: 'SLIDING_COLUMNS' });
  }

  const layout = resolvePieceLayout(kind, after);
  const nCols = Math.min(before.columns.length, after.columns.length);
  for (let ci = 0; ci < nCols; ci++) {
    const bZones = before.columns[ci].zones;
    const aZones = after.columns[ci].zones;
    const nZones = Math.min(bZones.length, aZones.length);
    for (let zi = 0; zi < nZones; zi++) {
      const b = bZones[zi];
      const a = aZones[zi];
      const r = layout[ci]?.zones[zi];
      if (!r) continue;
      if (hadHanging(b) && a.fill !== 'HANGING') {
        if (after.depthM < HANGING_MIN_DEPTH - GEOM_EPS) {
          notes.push({ reason: 'HANGING_DEPTH', col: ci, zone: zi });
        } else if (hangingCountFor(r.height) < 1) {
          notes.push({ reason: 'HANGING_HEIGHT', col: ci, zone: zi });
        }
      }
      if (hadShelves(b) && a.fill !== 'SHELVES' && shelvesCountFor(r.height) < 1) {
        notes.push({ reason: 'SHELVES_SPACE', col: ci, zone: zi });
      }
      if (hadDrawers(b) && a.type !== 'DRAWERS') {
        if (r.top > DRAWERS_MAX_TOP + GEOM_EPS) {
          notes.push({ reason: 'DRAWERS_TOO_HIGH', col: ci, zone: zi });
        } else if (drawersCountFor(r.height) < 1) {
          notes.push({ reason: 'DRAWERS_TOO_SHORT', col: ci, zone: zi });
        }
      }
      // numar micsorat de geometrie (a ramas exact cat incape, dar mai putin
      // decat a vrut clientul) — nu si taierile la plafonul fix al tipului
      const wanted = b.count ?? 1;
      const kept = a.count ?? 1;
      if (wanted > kept) {
        if (hadHanging(b) && a.fill === 'HANGING' && kept < HANGING_COUNT_MAX && kept === hangingCountFor(r.height)) {
          notes.push({ reason: 'HANGING_COUNT', col: ci, zone: zi, kept });
        } else if (hadShelves(b) && a.fill === 'SHELVES' && kept < SHELVES_COUNT_MAX && kept === shelvesCountFor(r.height)) {
          notes.push({ reason: 'SHELVES_COUNT', col: ci, zone: zi, kept });
        } else if (hadDrawers(b) && a.type === 'DRAWERS' && kept < DRAWERS_COUNT_MAX && kept === drawersCountFor(r.height)) {
          notes.push({ reason: 'DRAWERS_COUNT', col: ci, zone: zi, kept });
        }
      }
    }
  }
  return notes;
}

export type Piece3dColumnLimit =
  | 'MAX_COLUMNS'
  | 'SLIDING_COLUMNS'
  | 'PEDESTALS_WIDTH'
  | 'COLUMN_WIDTH';

// De ce butoanele Coloane "+" / "−" sunt dezactivate (null = activ sau
// nimic de explicat, ex. minimul de o coloana).
export function columnStepperLimits(
  kind: Piece3dKind,
  config: PieceConfig3d,
): { add: Piece3dColumnLimit | null; remove: Piece3dColumnLimit | null } {
  if (isFurnitureKind(kind)) return { add: null, remove: null };
  const rules = PIECE3D_RULES[kind];
  const n = config.columns.length;
  const sliding = config.doorMode === 'SLIDING';
  let add: Piece3dColumnLimit | null = null;
  if (!canAddColumn(kind, config)) {
    if (n >= rules.maxColumns) add = 'MAX_COLUMNS';
    else if (sliding && n >= SLIDING_COLUMNS_MAX) add = 'SLIDING_COLUMNS';
    else if (kind === 'DESK') add = 'PEDESTALS_WIDTH';
    else add = 'COLUMN_WIDTH';
  }
  let remove: Piece3dColumnLimit | null = null;
  if (!canRemoveColumn(kind, config)) {
    if (n <= Math.max(rules.minColumns, kind === 'DESK' ? 0 : 1)) remove = null;
    else if (sliding && n <= SLIDING_COLUMNS_MIN) remove = 'SLIDING_COLUMNS';
    else if (kind !== 'DESK') remove = 'COLUMN_WIDTH';
  }
  return { add, remove };
}
