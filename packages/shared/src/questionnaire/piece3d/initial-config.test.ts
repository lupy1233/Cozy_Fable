import { describe, expect, it } from 'vitest';
import {
  configHasFronts,
  defaultPieceConfig,
  initialPieceConfig,
  normalizePieceConfig,
  PIECE3D_KINDS,
  pieceConfigTotals,
} from './config';
import { isFurnitureKind } from './furniture-config';
import { explainPieceCleanup } from './cleanup-notes';

// Etapa 8 (d2-2, d2-3): pornirea pieselor noi in interfata. defaultPieceConfig ramane
// neschimbat (fixturile si instantaneele il folosesc).

describe('initialPieceConfig', () => {
  it('dulap: usi batante pe toate coloanele, cu acelasi interior; sertarele raman; Push explicit', () => {
    const def = defaultPieceConfig('WARDROBE');
    const init = initialPieceConfig('WARDROBE');
    expect(init.columns).toHaveLength(def.columns.length);
    init.columns.forEach((column, ci) => {
      expect(column.zones[0]).toMatchObject({ type: 'DOOR', fill: def.columns[ci].zones[0].fill });
      expect(column.zones[1]).toMatchObject({ type: 'DRAWERS', count: 2 });
    });
    expect(init.doorMode).toBeUndefined();
    expect(pieceConfigTotals(init).doors).toBeGreaterThan(0);
    expect(init.frontStyle).toBe('PUSH');
  });

  it('comoda TV: un rand de sertare pe fiecare coloana, deci are fronturi si Push', () => {
    const def = defaultPieceConfig('TV_UNIT');
    const init = initialPieceConfig('TV_UNIT');
    expect(init.columns).toHaveLength(def.columns.length);
    for (const column of init.columns) expect(column.zones).toEqual([{ type: 'DRAWERS', count: 1 }]);
    expect(configHasFronts('TV_UNIT', init)).toBe(true);
    expect(init.frontStyle).toBe('PUSH');
  });

  it('biblioteca fara fronturi nu primeste deschidere', () => {
    const init = initialPieceConfig('BOOKCASE');
    expect(configHasFronts('BOOKCASE', init)).toBe(false);
    expect(init.frontStyle).toBeUndefined();
  });

  it('pe toate piesele: curatarea nu scoate nimic, fronturi ⇔ Push, dimensiunile sunt cele implicite', () => {
    for (const kind of PIECE3D_KINDS) {
      const init = initialPieceConfig(kind);
      expect(normalizePieceConfig(kind, init), kind).toEqual(init);
      expect(explainPieceCleanup(kind, init, normalizePieceConfig(kind, init)), kind).toEqual([]);
      const def = defaultPieceConfig(kind);
      expect([init.widthM, init.heightM, init.depthM], kind).toEqual([def.widthM, def.heightM, def.depthM]);
      if (isFurnitureKind(kind)) {
        expect(init.frontStyle, kind).toBeUndefined();
      } else {
        expect(init.frontStyle, kind).toBe(configHasFronts(kind, init) ? 'PUSH' : undefined);
      }
    }
  });

  it('defaultPieceConfig ramane neschimbat (dulap cu zone deschise, comoda TV doar deschisa, fara Push)', () => {
    const wardrobe = defaultPieceConfig('WARDROBE');
    expect(wardrobe.columns.every((c) => c.zones[0].type === 'OPEN')).toBe(true);
    expect(wardrobe.frontStyle).toBeUndefined();
    const tv = defaultPieceConfig('TV_UNIT');
    expect(tv.columns.every((c) => c.zones.every((z) => z.type === 'OPEN'))).toBe(true);
    expect(tv.frontStyle).toBeUndefined();
    // obiect nou la fiecare apel (initialPieceConfig nu modifica implicitul)
    initialPieceConfig('WARDROBE');
    expect(defaultPieceConfig('WARDROBE')).toEqual(wardrobe);
  });
});
