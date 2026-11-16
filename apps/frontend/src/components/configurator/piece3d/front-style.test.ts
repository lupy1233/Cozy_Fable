import { defaultPieceConfig, initialPieceConfig, normalizePieceConfig, type PieceConfig3d } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import { configHasDoors, withFrontStyleRule, withHingedDoors } from './front-style';

// Etapa 8 (d2, D5): deschiderea scrisa de interfata doar cand piesa are fronturi.

const openTv = (): PieceConfig3d => defaultPieceConfig('TV_UNIT'); // doar zone deschise

describe('withFrontStyleRule', () => {
  it('piesa cu fronturi fara deschidere aleasa → PUSH', () => {
    const dresser = defaultPieceConfig('DRESSER');
    expect(dresser.frontStyle).toBeUndefined();
    expect(withFrontStyleRule('DRESSER', dresser).frontStyle).toBe('PUSH');
  });

  it('alegerea clientului ramane (HANDLE nu devine PUSH)', () => {
    const dresser = { ...defaultPieceConfig('DRESSER'), frontStyle: 'HANDLE' as const };
    expect(withFrontStyleRule('DRESSER', dresser)).toBe(dresser);
  });

  it('piesa fara fronturi → deschiderea scoasa din ce se salveaza', () => {
    const tv = { ...openTv(), frontStyle: 'HANDLE' as const };
    const saved = withFrontStyleRule('TV_UNIT', tv);
    expect(saved.frontStyle).toBeUndefined();
    expect('frontStyle' in saved).toBe(false);
    // fara nimic de schimbat → acelasi obiect (efectul de montare nu buclează)
    expect(withFrontStyleRule('TV_UNIT', openTv())).toEqual(openTv());
    const clean = openTv();
    expect(withFrontStyleRule('TV_UNIT', clean)).toBe(clean);
  });

  it('intentia readuce alegerea cand fronturile revin', () => {
    const intent: PieceConfig3d = {
      ...openTv(),
      frontStyle: 'HANDLE',
      columns: [{ zones: [{ type: 'DRAWERS', count: 1 }] }, { zones: [{ type: 'OPEN' }] }],
    };
    // curatarea pastreaza zonele, deci are fronturi; deschiderea vine din intentie
    const cleaned = { ...normalizePieceConfig('TV_UNIT', intent) };
    delete cleaned.frontStyle;
    expect(withFrontStyleRule('TV_UNIT', cleaned, intent).frontStyle).toBe('HANDLE');
  });

  it('mobilierul (pat, lavoar) ramane neatins', () => {
    const vanity = defaultPieceConfig('BATHROOM_VANITY');
    expect(withFrontStyleRule('BATHROOM_VANITY', vanity)).toBe(vanity);
    const bed = defaultPieceConfig('BED');
    expect(withFrontStyleRule('BED', bed)).toBe(bed);
  });
});

describe('usile dulapului (D4b)', () => {
  it('dulapul implicit vechi nu are usi; cel nou are', () => {
    expect(configHasDoors(defaultPieceConfig('WARDROBE'))).toBe(false);
    expect(configHasDoors(initialPieceConfig('WARDROBE'))).toBe(true);
  });

  it('"Batante" pe un dulap fara usi pune usi pe zonele deschise, cu acelasi interior', () => {
    const old = defaultPieceConfig('WARDROBE');
    const next = withHingedDoors(old);
    expect(configHasDoors(next)).toBe(true);
    next.columns.forEach((c, ci) => {
      expect(c.zones[0]).toEqual({ ...old.columns[ci].zones[0], type: 'DOOR' });
      expect(c.zones[1]).toEqual(old.columns[ci].zones[1]);
    });
  });

  it('"Batante" dupa glisante scoate doorMode si pastreaza usile existente', () => {
    const sliding: PieceConfig3d = { ...initialPieceConfig('WARDROBE'), doorMode: 'SLIDING' };
    const next = withHingedDoors(sliding);
    expect(next.doorMode).toBeUndefined();
    expect(next.columns).toEqual(sliding.columns);
  });
});
