import { describe, expect, it } from 'vitest';
import { defaultPieceConfig, deskMaxColumns, normalizePieceConfig, type PieceConfig3d } from './config';
import { columnStepperLimits, DESK_TWO_PEDESTALS_FROM_W, explainPieceCleanup } from './cleanup-notes';

// b7: ce scoate curatarea si de ce; intentia (config-ul necuratat) readuce
// elementele cand regula nu mai e incalcata.
const reasons = (kind: Parameters<typeof explainPieceCleanup>[0], before: PieceConfig3d) =>
  explainPieceCleanup(kind, before, normalizePieceConfig(kind, before)).map((n) => n.reason);

describe('explainPieceCleanup', () => {
  it('config-ul implicit nu pierde nimic', () => {
    for (const kind of ['WARDROBE', 'BOOKCASE', 'DESK', 'NIGHTSTAND', 'DRESSER'] as const) {
      expect(reasons(kind, defaultPieceConfig(kind))).toEqual([]);
    }
  });

  it('dulap 40 cm: barele de haine scoase din cauza adancimii; la 60 cm revin din intentie', () => {
    const intent = { ...defaultPieceConfig('WARDROBE'), depthM: 0.4 };
    const cleaned = normalizePieceConfig('WARDROBE', intent);
    expect(cleaned.columns.every((c) => c.zones[0].fill === undefined)).toBe(true);
    const notes = explainPieceCleanup('WARDROBE', intent, cleaned);
    expect(notes).toEqual(
      cleaned.columns.map((_, col) => ({ reason: 'HANGING_DEPTH', col, zone: 0 })),
    );
    // dus-intors: aceeasi schimbare aplicata peste intentie
    const back = normalizePieceConfig('WARDROBE', { ...intent, depthM: 0.6 });
    expect(back).toEqual(normalizePieceConfig('WARDROBE', defaultPieceConfig('WARDROBE')));
  });

  it('sertarele urcate peste 160 cm → DRAWERS_TOO_HIGH', () => {
    const intent: PieceConfig3d = {
      ...defaultPieceConfig('WARDROBE'),
      widthM: 1.6,
      columns: [{ zones: [{ type: 'DRAWERS', count: 2 }, { type: 'OPEN' }] }, { zones: [{ type: 'OPEN' }] }],
    };
    expect(reasons('WARDROBE', intent)).toEqual(['DRAWERS_TOO_HIGH']);
  });

  it('noptiera de 30 cm: sertarul nu mai are 15 cm → DRAWERS_TOO_SHORT', () => {
    const intent = { ...defaultPieceConfig('NIGHTSTAND'), heightM: 0.3 };
    expect(explainPieceCleanup('NIGHTSTAND', intent, normalizePieceConfig('NIGHTSTAND', intent))).toEqual([
      { reason: 'DRAWERS_TOO_SHORT', col: 0, zone: 0 },
    ]);
    const back = normalizePieceConfig('NIGHTSTAND', { ...intent, heightM: 0.55 });
    expect(back.columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 1 });
  });

  it('polite fara 10 cm de spatiu → SHELVES_SPACE', () => {
    const z = { type: 'OPEN' as const, fill: 'SHELVES' as const, count: 1 };
    const intent: PieceConfig3d = {
      ...defaultPieceConfig('BOOKCASE'),
      widthM: 0.6,
      heightM: 0.8,
      columns: [{ zones: [z, z, z, z] }],
    };
    expect(reasons('BOOKCASE', intent)).toEqual(Array(4).fill('SHELVES_SPACE'));
  });

  it('birou 160 → 100 cm: a doua casetiera iese → PEDESTALS_WIDTH; la 160 revine', () => {
    const two = normalizePieceConfig('DESK', {
      ...defaultPieceConfig('DESK'),
      widthM: 1.6,
      columns: [{ zones: [{ type: 'DRAWERS', count: 3 }] }, { zones: [{ type: 'DRAWERS', count: 3 }] }],
    });
    expect(two.columns).toHaveLength(2);
    const intent = { ...two, widthM: 1.0 };
    const cleaned = normalizePieceConfig('DESK', intent);
    expect(cleaned.columns).toHaveLength(1);
    expect(explainPieceCleanup('DESK', intent, cleaned)).toEqual([{ reason: 'PEDESTALS_WIDTH' }]);
    expect(normalizePieceConfig('DESK', { ...intent, widthM: 1.6 }).columns).toHaveLength(2);
  });

  it('dulap cu usi glisante largit la 6 m (6 coloane) → COLUMNS_WIDTH + SLIDING_COLUMNS', () => {
    const base = defaultPieceConfig('WARDROBE');
    const intent: PieceConfig3d = { ...base, doorMode: 'SLIDING', widthM: 6 };
    expect(base.columns).toHaveLength(3);
    expect(reasons('WARDROBE', intent)).toEqual(['COLUMNS_WIDTH', 'SLIDING_COLUMNS']);
    expect(normalizePieceConfig('WARDROBE', { ...intent, widthM: 2.4 }).doorMode).toBe('SLIDING');
  });

  it('numere micsorate (nu scoase): bare, polite, sertare → *_COUNT cu cate au ramas', () => {
    const wardrobe: PieceConfig3d = {
      ...defaultPieceConfig('WARDROBE'),
      widthM: 0.8,
      heightM: 1.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 3 }] }],
    };
    expect(explainPieceCleanup('WARDROBE', wardrobe, normalizePieceConfig('WARDROBE', wardrobe))).toEqual([
      { reason: 'HANGING_COUNT', col: 0, zone: 0, kept: 2 },
    ]);
    const bookcase: PieceConfig3d = {
      ...defaultPieceConfig('BOOKCASE'),
      widthM: 0.6,
      heightM: 0.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'SHELVES', count: 8 }] }],
    };
    expect(explainPieceCleanup('BOOKCASE', bookcase, normalizePieceConfig('BOOKCASE', bookcase))).toEqual([
      { reason: 'SHELVES_COUNT', col: 0, zone: 0, kept: 6 },
    ]);
    const dresser: PieceConfig3d = {
      ...defaultPieceConfig('DRESSER'),
      widthM: 0.6,
      heightM: 0.5,
      columns: [{ zones: [{ type: 'DRAWERS', count: 3 }] }],
    };
    expect(explainPieceCleanup('DRESSER', dresser, normalizePieceConfig('DRESSER', dresser))).toEqual([
      { reason: 'DRAWERS_COUNT', col: 0, zone: 0, kept: 2 },
    ]);
  });

  it('pragul afisat al casetierei e cel real (cu toleranta)', () => {
    expect(deskMaxColumns(DESK_TWO_PEDESTALS_FROM_W)).toBe(2);
    expect(deskMaxColumns(DESK_TWO_PEDESTALS_FROM_W - 0.001)).toBe(1);
  });

  it('nu schimba rezultatul curatarii (functie pura)', () => {
    const intent = { ...defaultPieceConfig('WARDROBE'), depthM: 0.4 };
    const snapshot = JSON.stringify(intent);
    const cleaned = normalizePieceConfig('WARDROBE', intent);
    const cleanedSnapshot = JSON.stringify(cleaned);
    explainPieceCleanup('WARDROBE', intent, cleaned);
    expect(JSON.stringify(intent)).toBe(snapshot);
    expect(JSON.stringify(cleaned)).toBe(cleanedSnapshot);
  });
});

describe('columnStepperLimits', () => {
  it('noptiera: maximul de coloane', () => {
    expect(columnStepperLimits('NIGHTSTAND', defaultPieceConfig('NIGHTSTAND'))).toEqual({
      add: 'MAX_COLUMNS',
      remove: null,
    });
  });

  it('birou ingust: a doua casetiera nu incape', () => {
    const desk = normalizePieceConfig('DESK', { ...defaultPieceConfig('DESK'), widthM: 1.0 });
    expect(columnStepperLimits('DESK', desk).add).toBe('PEDESTALS_WIDTH');
  });

  it('usi glisante: doar 2-3 coloane', () => {
    const three = normalizePieceConfig('WARDROBE', {
      ...defaultPieceConfig('WARDROBE'),
      widthM: 1.6,
      doorMode: 'SLIDING',
    });
    expect(three.columns).toHaveLength(3);
    expect(columnStepperLimits('WARDROBE', three).add).toBe('SLIDING_COLUMNS');
    const two = normalizePieceConfig('WARDROBE', { ...three, columns: three.columns.slice(0, 2) });
    expect(columnStepperLimits('WARDROBE', two).remove).toBe('SLIDING_COLUMNS');
  });

  it('latimea coloanei: 22-100 cm', () => {
    const narrow = normalizePieceConfig('BOOKCASE', { ...defaultPieceConfig('BOOKCASE'), widthM: 0.4 });
    expect(narrow.columns).toHaveLength(1);
    expect(columnStepperLimits('BOOKCASE', narrow).add).toBe('COLUMN_WIDTH');
    const col = defaultPieceConfig('WARDROBE').columns[0];
    const wide = normalizePieceConfig('WARDROBE', {
      ...defaultPieceConfig('WARDROBE'),
      widthM: 6,
      columns: Array.from({ length: 6 }, () => col),
    });
    expect(wide.columns).toHaveLength(6);
    expect(columnStepperLimits('WARDROBE', wide).remove).toBe('COLUMN_WIDTH');
  });
});
