// e3 (etapa 9): „ce s-a schimbat” intre doua copii salvate ale cererii (request_versions.snapshot).
// Functie pura. Compara DOAR ce fisa preluarii arata deja firmei: bugetul, termenul, mesajul,
// localitatea (oras / judet / tara — niciodata strada sau blocul), proiectarea, proiectul propriu,
// pozele de inspiratie si camerele. Contactele si adresa exacta NU intra niciodata in comparatie.
// Nu intoarce valori, doar CE s-a schimbat (valorile noi le vede firma pe fisa, cu mascarea ei).

export const REQUEST_CHANGE_FIELDS = [
  'budget',
  'deadline',
  'description',
  'location',
  'designHelp',
  'ownProject',
  'inspiration',
] as const;
export type RequestChangeField = (typeof REQUEST_CHANGE_FIELDS)[number];

export type RoomChangeKind = 'ADDED' | 'REMOVED' | 'MODIFIED';
// answers = raspunsurile din chestionar (material, piese, dimensiuni, fisiere...)
export type RoomChangeAspect = 'answers' | 'designHelp' | 'approxLength';

export interface RoomChange {
  change: RoomChangeKind;
  roomType: string;
  // a cata camera de acest tip (1-based) in copia in care exista (cea noua; la scoase, cea veche)
  ordinal: number;
  // cate camere de acest tip are copia respectiva (interfata adauga numarul doar daca sunt mai multe)
  ofType: number;
  // false = cele doua copii nu se pot compara sigur (versiuni de chestionar diferite):
  // interfata spune doar „Camera X a fost modificata”, fara detalii
  detailed: boolean;
  aspects: RoomChangeAspect[];
}

export interface RequestVersionDiff {
  // false = formatul copiilor nu se poate compara deloc; interfata spune doar „Cererea a fost modificata”
  comparable: boolean;
  fields: RequestChangeField[];
  rooms: RoomChange[];
}

// cheia raspunsului cu imaginea 3D generata la salvare: se schimba la fiecare salvare, fara ca
// piesa sa se schimbe — nu e o modificare a clientului
const IGNORED_ANSWER_KEYS = new Set(['snapshot3d']);

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// egalitate structurala independenta de ordinea cheilor; undefined == cheie lipsa
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (isObj(v)) {
    const out: Obj = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] !== undefined) out[k] = stable(v[k]);
    }
    return out;
  }
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function textLower(v: unknown): string {
  return text(v).toLowerCase();
}

interface SnapRoom {
  sourceLocalId: string | null;
  roomType: string;
  flowVersion: unknown;
  answers: Obj;
  needsDesignHelp: boolean;
  approxLengthM: number | null;
}

function readRoom(v: unknown): SnapRoom | null {
  if (!isObj(v) || typeof v.roomType !== 'string') return null;
  return {
    sourceLocalId: typeof v.sourceLocalId === 'string' && v.sourceLocalId ? v.sourceLocalId : null,
    roomType: v.roomType,
    flowVersion: v.flowVersion,
    answers: isObj(v.answers) ? v.answers : {},
    needsDesignHelp: v.needsDesignHelp === true,
    approxLengthM: typeof v.approxLengthM === 'number' ? v.approxLengthM : null,
  };
}

function answersWithoutIgnored(a: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(a)) if (!IGNORED_ANSWER_KEYS.has(k)) out[k] = v;
  return out;
}

// pozele de inspiratie: doar poza + notita (camera legata are id local in prima copie si id
// persistat in urmatoarele — ar da diferente false)
function inspirationKey(v: unknown): unknown {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter(isObj)
    .map((p) => `${String(p.photoId ?? '')}|${text(p.note)}`)
    .sort();
}

function ordinalIn(rooms: SnapRoom[], index: number): { ordinal: number; ofType: number } {
  const type = rooms[index].roomType;
  let ordinal = 0;
  let ofType = 0;
  rooms.forEach((r, i) => {
    if (r.roomType !== type) return;
    ofType += 1;
    if (i <= index) ordinal += 1;
  });
  return { ordinal, ofType };
}

function diffFields(prev: Obj, next: Obj): RequestChangeField[] {
  const out: RequestChangeField[] = [];
  if (
    prev.budgetRange !== next.budgetRange ||
    (prev.budgetEstimateRon ?? null) !== (next.budgetEstimateRon ?? null) ||
    (prev.budgetDeclared === true) !== (next.budgetDeclared === true)
  ) {
    out.push('budget');
  }
  if ((prev.deadlineBucket ?? null) !== (next.deadlineBucket ?? null)) out.push('deadline');
  if (text(prev.description) !== text(next.description)) out.push('description');
  if (
    textLower(prev.city) !== textLower(next.city) ||
    textLower(prev.county) !== textLower(next.county) ||
    (text(prev.country) || 'RO').toUpperCase() !== (text(next.country) || 'RO').toUpperCase()
  ) {
    out.push('location');
  }
  if ((prev.includesPaidDesign === true) !== (next.includesPaidDesign === true)) out.push('designHelp');
  if ((prev.hasOwnProject === true) !== (next.hasOwnProject === true)) out.push('ownProject');
  // o copie veche fara campul de inspiratie nu se compara (nu stim ce era)
  if (Array.isArray(prev.inspirationPhotos) && Array.isArray(next.inspirationPhotos)) {
    if (!same(inspirationKey(prev.inspirationPhotos), inspirationKey(next.inspirationPhotos))) out.push('inspiration');
  }
  return out;
}

// copia bruta a camerei, fara id si fara imaginea 3D regenerata (cu sau fara versiunea de chestionar)
function roomContentKey(r: SnapRoom, withFlowVersion: boolean): string {
  return JSON.stringify(stable({
    roomType: r.roomType,
    ...(withFlowVersion ? { flowVersion: r.flowVersion } : {}),
    answers: answersWithoutIgnored(r.answers),
    needsDesignHelp: r.needsDesignHelp,
    approxLengthM: r.approxLengthM,
  }));
}

function compareRoom(a: SnapRoom, b: SnapRoom): { detailed: boolean; aspects: RoomChangeAspect[] } | null {
  if (a.flowVersion !== b.flowVersion) {
    // m3 (revizuire): versiuni de chestionar diferite — raspunsurile nu se pot compara cheie cu
    // cheie, deci fara detalii; dar o camera cu copia bruta identica NU e marcata modificata
    if (roomContentKey(a, false) === roomContentKey(b, false)) return null;
    return { detailed: false, aspects: [] };
  }
  const aspects: RoomChangeAspect[] = [];
  if (!same(answersWithoutIgnored(a.answers), answersWithoutIgnored(b.answers))) aspects.push('answers');
  if (a.needsDesignHelp !== b.needsDesignHelp) aspects.push('designHelp');
  if (a.approxLengthM !== b.approxLengthM) aspects.push('approxLength');
  return aspects.length > 0 ? { detailed: true, aspects } : null;
}

// Perechile de camere, in trei treceri: (1) dupa id (sourceLocalId; de la a doua editare e
// id-ul camerei salvate); (2) m3 (revizuire): camerele ramase cu continut IDENTIC (aceeasi copie
// bruta) — la prima editare copia de la publicare are id-urile locale ale formularului, iar fara
// trecerea asta „scot primul din doua dulapuri” ar iesi pe dos („Dulap 1 modificat + Dulap 2
// scos”); (3) restul, dupa tip, in ordinea din cerere.
function pairRooms(prev: SnapRoom[], next: SnapRoom[]): { pairs: [number, number][]; added: number[]; removed: number[] } {
  const usedPrev = new Set<number>();
  const usedNext = new Set<number>();
  const pairs: [number, number][] = [];
  next.forEach((n, j) => {
    if (!n.sourceLocalId) return;
    const i = prev.findIndex((p, k) => !usedPrev.has(k) && p.sourceLocalId === n.sourceLocalId && p.roomType === n.roomType);
    if (i < 0) return;
    usedPrev.add(i);
    usedNext.add(j);
    pairs.push([i, j]);
  });
  const prevKeys = prev.map((p) => roomContentKey(p, true));
  next.forEach((n, j) => {
    if (usedNext.has(j)) return;
    const key = roomContentKey(n, true);
    const i = prev.findIndex((_, k) => !usedPrev.has(k) && prevKeys[k] === key);
    if (i < 0) return;
    usedPrev.add(i);
    usedNext.add(j);
    pairs.push([i, j]);
  });
  next.forEach((n, j) => {
    if (usedNext.has(j)) return;
    const i = prev.findIndex((p, k) => !usedPrev.has(k) && p.roomType === n.roomType);
    if (i < 0) return;
    usedPrev.add(i);
    usedNext.add(j);
    pairs.push([i, j]);
  });
  const added = next.map((_, j) => j).filter((j) => !usedNext.has(j));
  const removed = prev.map((_, i) => i).filter((i) => !usedPrev.has(i));
  return { pairs, added, removed };
}

export function diffRequestVersions(prevSnapshot: unknown, nextSnapshot: unknown): RequestVersionDiff {
  if (!isObj(prevSnapshot) || !isObj(nextSnapshot)) return { comparable: false, fields: [], rooms: [] };
  const fields = diffFields(prevSnapshot, nextSnapshot);
  const prevRaw = prevSnapshot.rooms;
  const nextRaw = nextSnapshot.rooms;
  if (!Array.isArray(prevRaw) || !Array.isArray(nextRaw)) return { comparable: false, fields, rooms: [] };
  const prevRooms = prevRaw.map(readRoom);
  const nextRooms = nextRaw.map(readRoom);
  if (prevRooms.some((r) => r === null) || nextRooms.some((r) => r === null)) {
    return { comparable: false, fields, rooms: [] };
  }
  const prev = prevRooms as SnapRoom[];
  const next = nextRooms as SnapRoom[];
  const { pairs, added, removed } = pairRooms(prev, next);

  const rooms: RoomChange[] = [];
  for (const j of added) {
    rooms.push({ change: 'ADDED', roomType: next[j].roomType, ...ordinalIn(next, j), detailed: true, aspects: [] });
  }
  for (const [i, j] of pairs.sort((x, y) => x[1] - y[1])) {
    const cmp = compareRoom(prev[i], next[j]);
    if (cmp) rooms.push({ change: 'MODIFIED', roomType: next[j].roomType, ...ordinalIn(next, j), ...cmp });
  }
  for (const i of removed) {
    rooms.push({ change: 'REMOVED', roomType: prev[i].roomType, ...ordinalIn(prev, i), detailed: true, aspects: [] });
  }
  return { comparable: true, fields, rooms };
}
