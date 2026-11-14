import { describe, expect, it } from 'vitest';
import {
  defaultPieceConfig,
  initialPieceConfig,
  normalizePieceConfig,
  PIECE3D_KINDS,
  PIECE3D_RULES,
  pieceConfig3dSchema,
  resolveColumnWidths,
  resolvePieceLayout,
  type Piece3dKind,
  type PieceConfig3d,
} from './config';
import { explainPieceCleanup } from './cleanup-notes';
import { collectScoreEntries, getFlow } from '../engine';
import { isFurnitureKind } from './furniture-config';
import { canRemoveColumn } from './model';
import {
  applyPieceEditRules,
  BOOKCASE_COLUMN_W_MAX,
  columnWidthMaxFor,
  DRAWER_FRONT_H_MAX,
  drawerCountMinFor,
  editPieceConfig,
  pieceHeightMinFor,
  PIECE3D_ZONE_TYPE_ORDER,
  tableDepthAfterRound,
  tableSeatsShortfall,
  TV_UNIT_HEIGHT_MIN,
  zoneTypesInDisplayOrder,
} from './edit-rules';

// Etapa 9 (l1): regulile noi de editare. Se aplica doar la creare / editare; schema si
// curatarea veche raman neschimbate (cererile publicate raman valide).

const edit = (kind: Piece3dKind, config: PieceConfig3d) => editPieceConfig(kind, config);
const reasons = (kind: Piece3dKind, intent: PieceConfig3d) =>
  explainPieceCleanup(kind, intent, edit(kind, intent)).map((n) => n.reason);

function drawerFronts(kind: Piece3dKind, config: PieceConfig3d): number[] {
  const layout = resolvePieceLayout(kind, config);
  return config.columns.flatMap((column, ci) =>
    column.zones.flatMap((zone, zi) =>
      zone.type === 'DRAWERS' ? [layout[ci].zones[zi].height / (zone.count ?? 1)] : [],
    ),
  );
}

describe('front de sertar de cel mult 50 cm (l1-1)', () => {
  it('dulap de 280 cm: zona de sertare se strange la n x 50 cm, restul trece la usa', () => {
    // configuratia veche (fara regula), ca o ciorna salvata inainte de etapa 9
    const before = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), widthM: 6, heightM: 2.8, depthM: 0.8 });
    // azi (fara regula) frontul trece de 50 cm
    expect(Math.max(...drawerFronts('WARDROBE', before))).toBeGreaterThan(0.6);
    const after = applyPieceEditRules('WARDROBE', before);
    for (const front of drawerFronts('WARDROBE', after)) expect(front).toBeLessThanOrEqual(DRAWER_FRONT_H_MAX + 0.005);
    const layout = resolvePieceLayout('WARDROBE', after);
    const beforeLayout = resolvePieceLayout('WARDROBE', before);
    after.columns.forEach((column, ci) => {
      expect(column.zones[1]).toMatchObject({ type: 'DRAWERS', count: 2, heightM: 1 });
      expect(layout[ci].zones[1].height).toBeCloseTo(1, 6);
      // vecina primeste tot restul (suma inaltimilor ramane aceeasi)
      const sum = (zones: { height: number }[]) => zones.reduce((s, z) => s + z.height, 0);
      expect(sum(layout[ci].zones)).toBeCloseTo(sum(beforeLayout[ci].zones), 6);
      expect(layout[ci].zones[0].height).toBeGreaterThan(beforeLayout[ci].zones[0].height);
      // bara de haine ramane (sta mai sus, cu mai mult loc)
      expect(column.zones[0].fill).toBe('HANGING');
    });
    expect(pieceConfig3dSchema('WARDROBE').safeParse(after).success).toBe(true);
    expect(explainPieceCleanup('WARDROBE', before, after).map((n) => n.reason)).toContain('DRAWER_FRONT_MAX');
  });

  it('coloana doar cu sertare: creste numarul de sertare (minimul de 15 cm ramane)', () => {
    const intent: PieceConfig3d = { ...defaultPieceConfig('DRESSER'), heightM: 1.4, widthM: 0.8, columns: [{ zones: [{ type: 'DRAWERS', count: 2 }] }] };
    const after = edit('DRESSER', intent);
    expect(after.columns[0].zones[0].count).toBe(3);
    for (const front of drawerFronts('DRESSER', after)) {
      expect(front).toBeLessThanOrEqual(DRAWER_FRONT_H_MAX + 0.005);
      expect(front).toBeGreaterThanOrEqual(0.15);
    }
    expect(reasons('DRESSER', intent)).toContain('DRAWER_FRONT_MAX');
  });

  it('regula se reface la fiecare editare: dulapul coborat elibereaza zona, mai multe sertare o largesc', () => {
    const tall = applyPieceEditRules('WARDROBE', normalizePieceConfig('WARDROBE', { ...initialPieceConfig('WARDROBE'), heightM: 2.8 }));
    expect(tall.columns[0].zones[1].heightM).toBe(1);
    // aceeasi configuratie (cu blocajul pus de regula, pornind de la ce e salvat) coborata la 1,8 m:
    // impartire egala din nou, bara de haine ramane
    const low = editPieceConfig('WARDROBE', { ...tall, heightM: 1.8 }, tall);
    expect(low.columns[0].zones[1].heightM).toBeUndefined();
    expect(low.columns[0].zones[0].fill).toBe('HANGING');
    // 3 sertare in loc de 2: maximul devine 150 cm, zona nu mai e stransa
    const three = editPieceConfig('WARDROBE', { ...tall, columns: tall.columns.map((c) => ({ ...c, zones: [c.zones[0], { ...c.zones[1], count: 3 }] })) }, tall);
    expect(three.columns[0].zones[1].heightM).toBeUndefined();
  });

  it('blocajul pus de om sub maxim ramane; peste maxim se coboara la maxim', () => {
    const base = initialPieceConfig('WARDROBE');
    const withRow = (heightM: number): PieceConfig3d => ({ ...base, heightM: 2.8, columns: base.columns.map((c) => ({ ...c, zones: [c.zones[0], { type: 'DRAWERS', count: 2, heightM }] })) });
    expect(edit('WARDROBE', withRow(0.7)).columns[0].zones[1].heightM).toBe(0.7);
    expect(edit('WARDROBE', withRow(1.3)).columns[0].zones[1].heightM).toBe(1);
  });

  // revizuire M1: blocajele de 50 / 100 / 150 cm puse de om nu se mai pierd
  for (const count of [1, 2, 3]) {
    for (const heightM of [0.5, 1, 1.5]) {
      if (heightM > count * DRAWER_FRONT_H_MAX + 1e-9) continue;
      it(`blocajul omului la ${heightM * 100} cm cu ${count} sertare ramane (si fata de configuratia salvata)`, () => {
        const base = initialPieceConfig('WARDROBE');
        // ce era salvat: zona de sertare cu acelasi numar de sertare, neblocata
        const saved = normalizePieceConfig('WARDROBE', {
          ...base,
          heightM: 2.8,
          columns: base.columns.map((c) => ({ ...c, zones: [c.zones[0], { type: 'DRAWERS', count }] })),
        });
        // omul scrie valoarea in "Inaltime rand" (sau apasa lacatul pe o inaltime exacta)
        const intent: PieceConfig3d = {
          ...saved,
          columns: saved.columns.map((c, ci) => (ci === 0 ? { ...c, zones: [c.zones[0], { type: 'DRAWERS', count, heightM }] } : c)),
        };
        const out = editPieceConfig('WARDROBE', intent, saved);
        expect(out.columns[0].zones[1]).toMatchObject({ count, heightM });
        // fara motiv fals pe zona omului (celelalte coloane pot fi stranse legitim)
        expect(explainPieceCleanup('WARDROBE', intent, out).filter((n) => n.col === 0)).toEqual([]);
        // intentia tinuta de pas: tot ramane
        expect(editPieceConfig('WARDROBE', intent).columns[0].zones[1]).toMatchObject({ count, heightM });
      });
    }
  }

  it('dulap nou (zona blocata de regula la 100 cm): omul scrie 50 cm → ramane 50, fara motiv fals', () => {
    const saved = initialPieceConfig('WARDROBE');
    expect(saved.columns[0].zones[1]).toMatchObject({ count: 2, heightM: 1 });
    const intent: PieceConfig3d = { ...saved, columns: saved.columns.map((c, ci) => (ci === 0 ? { ...c, zones: [c.zones[0], { ...c.zones[1], heightM: 0.5 }] } : c)) };
    const out = editPieceConfig('WARDROBE', intent, saved);
    expect(out.columns[0].zones[1]).toMatchObject({ count: 2, heightM: 0.5 });
    expect(explainPieceCleanup('WARDROBE', intent, out)).toEqual([]);
  });

  it('cerere veche cu blocaj de om la 50 cm (1 sertar): schimbarea altui lucru nu il sterge', () => {
    const base = defaultPieceConfig('WARDROBE');
    const saved = normalizePieceConfig('WARDROBE', { ...base, columns: base.columns.map((c) => ({ ...c, zones: [c.zones[0], { type: 'DRAWERS', count: 1, heightM: 0.5 }] })) });
    const out = editPieceConfig('WARDROBE', { ...saved, finish: 'NUC' }, saved);
    out.columns.forEach((c) => expect(c.zones[1]).toMatchObject({ count: 1, heightM: 0.5 }));
  });

  it('revizuire m2: vecinele blocate de om raman blocate — cresc sertarele in loc', () => {
    const base = initialPieceConfig('WARDROBE');
    // [Deschis blocat 120 cm sus, Sertare 2 liber (~115 cm), Usa blocata 30 cm jos] la 280 cm
    const intent: PieceConfig3d = {
      ...base,
      heightM: 2.8,
      columns: base.columns.map((c) => ({ ...c, zones: [{ type: 'OPEN', heightM: 1.2 }, { type: 'DRAWERS', count: 2 }, { type: 'DOOR', heightM: 0.3 }] })),
    };
    const out = edit('WARDROBE', intent);
    out.columns.forEach((c) => {
      expect(c.zones[0].heightM).toBe(1.2);
      expect(c.zones[1]).toMatchObject({ type: 'DRAWERS', count: 3 });
      expect(c.zones[2].heightM).toBe(0.3);
    });
    for (const front of drawerFronts('WARDROBE', out)) expect(front).toBeLessThanOrEqual(DRAWER_FRONT_H_MAX + 0.005);
    expect(reasons('WARDROBE', intent)).toContain('DRAWER_FRONT_MAX');
  });

  it('revizuire m3: minimul de sertare in coloana fara vecina libera', () => {
    const dresser = edit('DRESSER', { ...defaultPieceConfig('DRESSER'), heightM: 1.4, widthM: 0.8, columns: [{ zones: [{ type: 'DRAWERS', count: 3 }] }] });
    expect(drawerCountMinFor('DRESSER', dresser, 0, 0)).toBe(3);
    const wardrobe = initialPieceConfig('WARDROBE');
    expect(drawerCountMinFor('WARDROBE', wardrobe, 0, 1)).toBe(1);
  });

  it('revizuire m4: regula nu transforma nicio zona de sertare in zona deschisa (peste 160 cm)', () => {
    const types = ['OPEN', 'DRAWERS', 'DOOR'] as const;
    let checked = 0;
    for (const heightM of [1.8, 2.2, 2.8]) for (const a of types) for (const b of types) for (const c of types) for (const lockTop of [undefined, 0.3, 0.9]) {
      const base = initialPieceConfig('WARDROBE');
      const intent: PieceConfig3d = {
        ...base,
        heightM,
        columns: [{ zones: [{ type: 'OPEN', ...(lockTop ? { heightM: lockTop } : {}) }, { type: a, ...(a === 'DRAWERS' ? { count: 1 } : {}) }, { type: b, ...(b === 'DRAWERS' ? { count: 1 } : {}) }, { type: c, ...(c === 'DRAWERS' ? { count: 2 } : {}) }] }],
      };
      const normalized = normalizePieceConfig('WARDROBE', intent);
      const out = applyPieceEditRules('WARDROBE', normalized);
      normalized.columns[0].zones.forEach((z, i) => {
        if (z.type === 'DRAWERS') expect(out.columns[0].zones[i].type).toBe('DRAWERS');
      });
      expect(applyPieceEditRules('WARDROBE', out)).toBe(out);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('ordinea tipurilor de zona', () => {
  it('mereu Deschis · Sertare · Usa la afisare; implicitul zonei noi ramane al piesei', () => {
    expect(PIECE3D_ZONE_TYPE_ORDER).toEqual(['OPEN', 'DRAWERS', 'DOOR']);
    for (const kind of PIECE3D_KINDS) {
      const allowed = PIECE3D_RULES[kind].zoneTypes;
      const shown = zoneTypesInDisplayOrder(kind);
      expect([...shown].sort(), kind).toEqual([...allowed].sort());
      expect(shown, kind).toEqual(PIECE3D_ZONE_TYPE_ORDER.filter((t) => allowed.includes(t)));
    }
    expect(PIECE3D_RULES.SHOE_CABINET.zoneTypes[0]).toBe('DOOR');
    expect(PIECE3D_RULES.DRESSER.zoneTypes[0]).toBe('DRAWERS');
  });
});

describe('limitele l1-2, cu motiv', () => {
  it('biblioteca: coloana de cel mult 80 cm (mai multe coloane, blocajele coborate)', () => {
    const wide = normalizePieceConfig('BOOKCASE', { ...defaultPieceConfig('BOOKCASE'), widthM: 3, columns: Array.from({ length: 3 }, () => PIECE3D_RULES.BOOKCASE.defaultColumn()) });
    expect(Math.max(...resolveColumnWidths('BOOKCASE', wide))).toBeGreaterThan(0.9);
    const after = applyPieceEditRules('BOOKCASE', wide);
    expect(after.columns.length).toBe(4);
    for (const w of resolveColumnWidths('BOOKCASE', after)) expect(w).toBeLessThanOrEqual(BOOKCASE_COLUMN_W_MAX + 0.005);
    expect(explainPieceCleanup('BOOKCASE', wide, after).map((n) => n.reason)).toContain('COLUMNS_WIDTH');

    const locked: PieceConfig3d = { ...wide, columns: [{ ...wide.columns[0], widthM: 1 }, wide.columns[1], wide.columns[2]] };
    const fixed = edit('BOOKCASE', locked);
    expect(fixed.columns[0].widthM).toBe(BOOKCASE_COLUMN_W_MAX);
    expect(reasons('BOOKCASE', locked)).toContain('BOOKCASE_COLUMN_WIDTH');
    // butonul "−" nu mai lasa coloane peste 80 cm
    expect(columnWidthMaxFor('BOOKCASE')).toBe(0.8);
    expect(canRemoveColumn('BOOKCASE', after)).toBe(false);
    expect(columnWidthMaxFor('WARDROBE')).toBe(1);
  });

  it('comoda TV: cel putin 35 cm inaltime', () => {
    const low: PieceConfig3d = { ...initialPieceConfig('TV_UNIT'), heightM: 0.25 };
    const after = edit('TV_UNIT', low);
    expect(after.heightM).toBe(TV_UNIT_HEIGHT_MIN);
    expect(reasons('TV_UNIT', low)).toEqual(['TV_UNIT_HEIGHT']);
    expect(pieceHeightMinFor('TV_UNIT')).toBe(0.35);
    expect(pieceHeightMinFor('WARDROBE')).toBe(PIECE3D_RULES.WARDROBE.height.min);
  });
});

describe('masa (l1-3 + diametru pe tip + persoane)', () => {
  const table = (patch: Partial<NonNullable<PieceConfig3d['table']>>, widthM: number): PieceConfig3d => {
    const base = defaultPieceConfig('TABLE');
    return { ...base, widthM, depthM: widthM, table: { ...base.table!, ...patch } };
  };

  it('masa de cafea rotunda nu accepta 180 cm la editare (se opreste la 100 cm)', () => {
    const after = edit('TABLE', table({ type: 'COFFEE', shape: 'ROUND' }, 1.8));
    expect(after.widthM).toBe(1);
    expect(after.depthM).toBe(1);
    expect(edit('TABLE', table({ type: 'COFFEE', shape: 'ROUND' }, 0.5)).widthM).toBe(0.5);
    expect(edit('TABLE', table({ type: 'DINING', shape: 'ROUND', seats: 'SIX' }, 1.8)).widthM).toBe(1.6);
    expect(pieceConfig3dSchema('TABLE').safeParse(edit('TABLE', table({ type: 'COFFEE', shape: 'ROUND' }, 0.5))).success).toBe(true);
  });

  it('6 persoane la 120 cm: avertisment; la 180 cm nu', () => {
    const base = defaultPieceConfig('TABLE');
    expect(tableSeatsShortfall({ ...base, widthM: 1.2, table: { type: 'DINING', shape: 'RECTANGULAR', seats: 'SIX' } })).toEqual({ seats: 'SIX', minM: 1.6 });
    expect(tableSeatsShortfall({ ...base, widthM: 1.8, table: { type: 'DINING', shape: 'RECTANGULAR', seats: 'SIX' } })).toBeNull();
    expect(tableSeatsShortfall({ ...base, widthM: 1.2, table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'SIX' } })).not.toBeNull();
    expect(tableSeatsShortfall({ ...base, widthM: 0.6, table: { type: 'COFFEE', shape: 'RECTANGULAR' } })).toBeNull();
  });

  it('trecerea inapoi la dreptunghi nu mai pune adancimea pe maxim', () => {
    expect(tableDepthAfterRound('DINING')).toBe(0.9);
    expect(tableDepthAfterRound('DINING', 0.8)).toBe(0.8);
    expect(tableDepthAfterRound('CONSOLE')).toBe(0.4);
  });
});

describe('masa extensibila noua pe fluxul v4 (precizarea coordonatorului)', () => {
  it('"Extensibilă: da" se salveaza ca shape EXTENDABLE: punctul TABLE_EXTENDABLE si textul raman', () => {
    const base = initialPieceConfig('TABLE');
    // comutatorul din interfata: dreptunghi + da → shape EXTENDABLE
    const config = editPieceConfig('TABLE', { ...base, widthM: 1.8, table: { ...base.table!, shape: 'EXTENDABLE' } });
    expect(config.table?.shape).toBe('EXTENDABLE');
    const answers = { config3d: config, material: 'OAK' };
    expect(collectScoreEntries('PIECE_TABLE', answers, 4)).toContainEqual({ category: 'TABLE_EXTENDABLE', optionKey: 'YES' });
    const derived = getFlow('PIECE_TABLE', 4).deriveRoom(answers);
    expect(derived.items.map((i) => i.description).join(' ')).toContain('extensibilă');
    // si "nu" → dreptunghiulara, fara punct
    const plain = editPieceConfig('TABLE', { ...config, table: { ...config.table!, shape: 'RECTANGULAR' } });
    expect(collectScoreEntries('PIECE_TABLE', { config3d: plain, material: 'OAK' }, 4)).not.toContainEqual({ category: 'TABLE_EXTENDABLE', optionKey: 'YES' });
  });
});

describe('configuratiile vechi raman valide si neschimbate', () => {
  it('EXTENDABLE, coloana de 100 cm, comoda TV de 25 cm, sertare inalte: trec validarea', () => {
    const extendable: PieceConfig3d = { ...defaultPieceConfig('TABLE'), widthM: 2, depthM: 1, table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'EIGHT_PLUS' } };
    const column100: PieceConfig3d = { ...defaultPieceConfig('BOOKCASE'), widthM: 1.035, columns: [PIECE3D_RULES.BOOKCASE.defaultColumn()] };
    expect(resolveColumnWidths('BOOKCASE', column100)[0]).toBeGreaterThan(0.99);
    const tv25: PieceConfig3d = { ...defaultPieceConfig('TV_UNIT'), heightM: 0.25 };
    const tallDrawers = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), heightM: 2.8 });
    const coffee180: PieceConfig3d = { ...defaultPieceConfig('TABLE'), widthM: 1.8, depthM: 1.8, heightM: 0.45, table: { type: 'COFFEE', shape: 'ROUND' } };
    for (const [kind, config] of [['TABLE', extendable], ['BOOKCASE', column100], ['TV_UNIT', tv25], ['WARDROBE', tallDrawers], ['TABLE', coffee180]] as const) {
      const parsed = pieceConfig3dSchema(kind).safeParse(JSON.parse(JSON.stringify(config)));
      expect(parsed.success, kind).toBe(true);
      if (parsed.success) expect(parsed.data, kind).toEqual(config);
      // curatarea veche (folosita de Studio si la citire) nu aplica regulile noi
      expect(normalizePieceConfig(kind, config), kind).toEqual(config);
    }
  });
});

describe('applyPieceEditRules', () => {
  it('e idempotent si intoarce acelasi obiect cand nu are ce schimba', () => {
    for (const kind of PIECE3D_KINDS) {
      const rules = PIECE3D_RULES[kind];
      const variants: PieceConfig3d[] = [initialPieceConfig(kind)];
      if (!isFurnitureKind(kind)) {
        for (const size of ['min', 'max'] as const) {
          variants.push(normalizePieceConfig(kind, { ...initialPieceConfig(kind), widthM: rules.width[size], heightM: rules.height[size], depthM: rules.depth[size] }));
        }
      }
      for (const v of variants) {
        const once = applyPieceEditRules(kind, v);
        expect(applyPieceEditRules(kind, once), kind).toBe(once);
        expect(pieceConfig3dSchema(kind).safeParse(once).success, kind).toBe(true);
      }
      // initialPieceConfig are deja regulile aplicate
      const init = initialPieceConfig(kind);
      expect(applyPieceEditRules(kind, init), kind).toBe(init);
    }
  });
});
