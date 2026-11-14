import {
  COLUMN_W_MAX,
  DRAWERS_COUNT_MAX,
  GEOM_EPS,
  PIECE3D_RULES,
  normalizePieceConfig,
  resolveColumnWidths,
  resolvePieceLayout,
  type Piece3dKind,
  type Piece3dZone,
  type Piece3dZoneType,
  type PieceConfig3d,
} from './config';
import { isFurnitureKind, TABLE_ROUND_DIAMETER, TABLE_SEATS, type TableOptions3d } from './furniture-config';

// Etapa 9 (l1, raspunsurile PO l1-1 / l1-2 / l1-3): reguli noi de configurator, aplicate DOAR
// cand omul creeaza sau editeaza piesa (initialPieceConfig, pasul 3D, ciornele la redeschidere).
// Schema (pieceConfig3dSchema) si curatarea veche (normalizePieceConfig) NU se schimba: cererile
// publicate si ciornele vechi raman valide, se afiseaza si costa la fel.

// l1-1: frontul unui sertar are cel mult 50 cm; zona mai inalta se strange la n x 50 cm
export const DRAWER_FRONT_H_MAX = 0.5;
// l1-2: coloana de biblioteca are cel mult 80 cm; comoda TV cel putin 35 cm inaltime
export const BOOKCASE_COLUMN_W_MAX = 0.8;
export const TV_UNIT_HEIGHT_MIN = 0.35;

// Ordinea de AFISARE a tipurilor de zona (aceeasi pe toate piesele). Tipul implicit al zonei noi
// ramane PIECE3D_RULES[kind].zoneTypes[0] (lista piesei), separat de ordinea de afisare.
export const PIECE3D_ZONE_TYPE_ORDER: readonly Piece3dZoneType[] = ['OPEN', 'DRAWERS', 'DOOR'];

export function zoneTypesInDisplayOrder(kind: Piece3dKind): Piece3dZoneType[] {
  const allowed = PIECE3D_RULES[kind].zoneTypes;
  return [
    ...PIECE3D_ZONE_TYPE_ORDER.filter((type) => allowed.includes(type)),
    ...allowed.filter((type) => !PIECE3D_ZONE_TYPE_ORDER.includes(type)),
  ];
}

// Latimea maxima a unei coloane la creare/editare (biblioteca 80 cm, restul ca pana acum).
export function columnWidthMaxFor(kind: Piece3dKind): number {
  return kind === 'BOOKCASE' ? BOOKCASE_COLUMN_W_MAX : COLUMN_W_MAX;
}

// Inaltimea minima a piesei la creare/editare (comoda TV 35 cm, restul ca in PIECE3D_RULES).
export function pieceHeightMinFor(kind: Piece3dKind): number {
  const min = PIECE3D_RULES[kind].height.min;
  return kind === 'TV_UNIT' ? Math.max(min, TV_UNIT_HEIGHT_MIN) : min;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const drawerZoneCap = (count: number | undefined) => round3((count ?? 1) * DRAWER_FRONT_H_MAX);

// Revizuire M1: blocajul unei zone de sertare e socotit "pus de regula" DOAR cand e egal cu
// plafonul pentru numarul ei de sertare (count x 50 cm) in configuratia salvata anterior si omul
// nu l-a schimbat acum (aceeasi valoare in intentie). Doar acela se elibereaza inainte de
// curatare, ca regula sa se refaca (piesa scade, numarul de sertare creste). Blocajul nou sau
// schimbat de om ramane; peste plafon il coboara regula, cu motiv.
function isRuleDrawerLock(zone: Piece3dZone | undefined): boolean {
  return (
    !!zone &&
    zone.type === 'DRAWERS' &&
    zone.heightM !== undefined &&
    Math.abs(zone.heightM - drawerZoneCap(zone.count)) < 1e-6
  );
}

// Zona de sertare a unui front mai inalt de 50 cm.
export function drawerZoneOverCap(height: number, count: number | undefined): boolean {
  return height > drawerZoneCap(count) + GEOM_EPS;
}

export function releaseRuleDrawerLocks(intent: PieceConfig3d, previous: PieceConfig3d): PieceConfig3d {
  let changed = false;
  const columns = intent.columns.map((column, ci) => ({
    ...column,
    zones: column.zones.map((zone, zi) => {
      const prev = previous.columns[ci]?.zones[zi];
      if (
        zone.type !== 'DRAWERS' ||
        zone.heightM === undefined ||
        !isRuleDrawerLock(prev) ||
        Math.abs((prev?.heightM ?? NaN) - zone.heightM) > 1e-6
      ) {
        return zone;
      }
      changed = true;
      const { heightM: _rule, ...rest } = zone;
      void _rule;
      return rest;
    }),
  }));
  return changed ? { ...intent, columns } : intent;
}

// Zonele vecine care pot primi restul inaltimii: fara sertare si NEBLOCATE (revizuire m2:
// blocajele puse de om pe vecine se respecta).
function freeNeighbours(zones: Piece3dZone[], zi: number): number[] {
  return zones.flatMap((zone, i) => (i !== zi && zone.type !== 'DRAWERS' && zone.heightM === undefined ? [i] : []));
}

// Numarul minim de sertare al unei zone cand nu are vecina libera (restul inaltimii ramane in
// zona): sub el frontul ar trece de 50 cm, iar regula l-ar pune la loc (revizuire m3).
export function drawerCountMinFor(kind: Piece3dKind, config: PieceConfig3d, col: number, zone: number): number {
  const zones = config.columns[col]?.zones ?? [];
  const z = zones[zone];
  if (!z || z.type !== 'DRAWERS' || isFurnitureKind(kind)) return 1;
  if (freeNeighbours(zones, zone).length > 0) return 1;
  const r = resolvePieceLayout(kind, config)[col]?.zones[zone];
  if (!r) return 1;
  return Math.max(1, Math.min(DRAWERS_COUNT_MAX, Math.ceil(r.height / DRAWER_FRONT_H_MAX - GEOM_EPS)));
}

// Zona de sertare cu front peste 50 cm: daca are o vecina libera fara sertare, se blocheaza la
// n x 50 cm si restul trece la vecina; altfel (coloana doar cu sertare sau vecine blocate de om)
// creste numarul de sertare pana cand frontul incape in 50 cm (minimul de 15 cm ramane).
// Revizuire m4: strangerea nu ridica nicio zona de sertare peste 160 cm — cand vecina libera e
// dedesubt, zonele de sub cea stransa urca, dar raman sub varful ei (care era deja <= 160 cm).
function capDrawerFronts(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  let cur: PieceConfig3d = config;
  for (let ci = 0; ci < cur.columns.length; ci++) {
    for (let guard = 0; guard < 3 * PIECE3D_RULES[kind].maxZonesPerColumn + 2; guard++) {
      const resolved = resolvePieceLayout(kind, cur)[ci]?.zones ?? [];
      const zones = cur.columns[ci].zones;
      const zi = zones.findIndex(
        (zone, i) => zone.type === 'DRAWERS' && !!resolved[i] && drawerZoneOverCap(resolved[i].height, zone.count),
      );
      if (zi < 0) break;
      const next = zones.slice();
      if (freeNeighbours(zones, zi).length === 0) {
        const wanted = Math.ceil(resolved[zi].height / DRAWER_FRONT_H_MAX - GEOM_EPS);
        next[zi] = { ...zones[zi], count: Math.min(DRAWERS_COUNT_MAX, Math.max(zones[zi].count ?? 1, wanted)) };
        if (next[zi].count === zones[zi].count) break;
      } else {
        next[zi] = { ...zones[zi], heightM: drawerZoneCap(zones[zi].count) };
      }
      cur = {
        ...cur,
        columns: cur.columns.map((column, i) => (i === ci ? { ...column, zones: next } : column)),
      };
    }
  }
  return normalizePieceConfig(kind, cur);
}

function capBookcaseColumns(config: PieceConfig3d): PieceConfig3d {
  const rules = PIECE3D_RULES.BOOKCASE;
  const over = (c: PieceConfig3d) =>
    resolveColumnWidths('BOOKCASE', c).some((w) => w > BOOKCASE_COLUMN_W_MAX + GEOM_EPS);
  let cur: PieceConfig3d = {
    ...config,
    columns: config.columns.map((column) =>
      column.widthM !== undefined && column.widthM > BOOKCASE_COLUMN_W_MAX
        ? { ...column, widthM: BOOKCASE_COLUMN_W_MAX }
        : column,
    ),
  };
  while (over(cur) && cur.columns.length < rules.maxColumns) {
    cur = { ...cur, columns: [...cur.columns, rules.defaultColumn()] };
  }
  if (over(cur)) {
    // blocajele nu mai lasa loc: impartire egala
    cur = {
      ...cur,
      columns: cur.columns.map((column) => {
        const { widthM: _w, ...rest } = column;
        void _w;
        return rest;
      }),
    };
  }
  return normalizePieceConfig('BOOKCASE', cur);
}

// Lungimea (sau diametrul) de la care incap persoanele alese — sub ea, avertisment.
export const TABLE_SEATS_MIN_LENGTH = {
  RECTANGULAR: { FOUR: 1.2, SIX: 1.6, EIGHT_PLUS: 2.0 },
  ROUND: { FOUR: 0.9, SIX: 1.2, EIGHT_PLUS: 1.5 },
} as const;

// Adancimea dreptunghiulara implicita cand masa trece de la rotund inapoi la dreptunghi
// (inainte lua diametrul, deci de obicei maximul de 120 cm).
export const TABLE_RECT_DEPTH_DEFAULT = { DINING: 0.9, COFFEE: 0.6, CONSOLE: 0.4 } as const;

export function tableSeatsShortfall(config: PieceConfig3d): { seats: (typeof TABLE_SEATS)[number]; minM: number } | null {
  const table = config.table;
  if (!table || table.type !== 'DINING') return null;
  const seats = table.seats ?? 'SIX';
  const minM = TABLE_SEATS_MIN_LENGTH[table.shape === 'ROUND' ? 'ROUND' : 'RECTANGULAR'][seats];
  return config.widthM < minM - GEOM_EPS ? { seats, minM } : null;
}

// Adancimea mesei dupa trecerea de la rotund la dreptunghi: cea dreptunghiulara de dinainte
// (daca o stim), altfel implicitul tipului — nu mai e mutata tacit pe maxim.
export function tableDepthAfterRound(type: TableOptions3d['type'], rememberedM?: number): number {
  const v = rememberedM ?? TABLE_RECT_DEPTH_DEFAULT[type];
  return round3(Math.max(0.4, Math.min(1.2, v)));
}

function capTable(config: PieceConfig3d): PieceConfig3d {
  const table = config.table;
  if (!table || table.shape !== 'ROUND') return config;
  const range = TABLE_ROUND_DIAMETER[table.type];
  const d = round3(Math.max(range.min, Math.min(range.max, config.widthM)));
  if (Math.abs(d - config.widthM) < 1e-9 && Math.abs(d - config.depthM) < 1e-9) return config;
  return { ...config, widthM: d, depthM: d };
}

// Aplica regulile noi peste o configuratie deja curatata (normalizePieceConfig). Intoarce ACELASI
// obiect cand nu e nimic de schimbat. Idempotent pe configuratiile produse de el.
export function applyPieceEditRules(kind: Piece3dKind, config: PieceConfig3d): PieceConfig3d {
  let next = config;
  if (isFurnitureKind(kind)) {
    if (kind === 'TABLE') next = capTable(config);
  } else {
    if (kind === 'TV_UNIT' && next.heightM < TV_UNIT_HEIGHT_MIN - 1e-9) {
      next = normalizePieceConfig(kind, { ...next, heightM: TV_UNIT_HEIGHT_MIN });
    }
    if (kind === 'BOOKCASE') next = capBookcaseColumns(next);
    next = capDrawerFronts(kind, next);
  }
  return JSON.stringify(next) === JSON.stringify(config) ? config : next;
}

// Pasul 3D: intentia omului (configuratia dinainte de curatare) → configuratia salvata.
// `previous` = configuratia salvata din care s-a pornit intentia, cand intentia nu e tinuta de pas
// (redeschidere / prima editare): blocajele puse atunci de regula pe sertare (count x 50 cm,
// neschimbate de om) se elibereaza INAINTE de curatare, ca sa nu scoata bara de haine / politele
// vecinei cand piesa scade. Fara `previous` (intentia tinuta de pas nu contine blocajele regulii)
// nu se elibereaza nimic.
export function editPieceConfig(kind: Piece3dKind, intent: PieceConfig3d, previous?: PieceConfig3d): PieceConfig3d {
  const released = isFurnitureKind(kind) || !previous ? intent : releaseRuleDrawerLocks(intent, previous);
  return applyPieceEditRules(kind, normalizePieceConfig(kind, released));
}
