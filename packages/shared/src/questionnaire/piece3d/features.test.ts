import { describe, expect, it } from 'vitest';
import { validateRoomAnswers } from '../engine';
import { sofaSchema } from './catalog-config';
import { defaultPieceConfig, PIECE3D_KINDS, pieceConfig3dSchema, type PieceConfig3d } from './config';
import { PIECE3D_FEATURES, piece3dFeaturesUsed } from './features';
import { bedOptionsSchema, benchOptionsSchema, tableOptionsSchema } from './furniture-config';

describe('etapa 10 — campurile 3D noi (features)', () => {
  it('lista functiilor e cea din proiect', () => {
    expect([...PIECE3D_FEATURES]).toEqual([
      'SOFA_SLEEPER', 'SOFA_STORAGE', 'BED_CUSTOM_SIZE', 'TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT', 'BENCH_CUSTOM_HEIGHT',
    ]);
  });

  it('configuratiile implicite (de azi) nu folosesc nicio functie noua', () => {
    for (const kind of PIECE3D_KINDS) expect(piece3dFeaturesUsed(defaultPieceConfig(kind)), kind).toEqual([]);
  });

  it('fiecare camp nou → functia lui; `false` conteaza tot ca folosit', () => {
    const sofa = defaultPieceConfig('SOFA');
    expect(piece3dFeaturesUsed({ ...sofa, sofa: { ...sofa.sofa!, sleeper: true } })).toEqual(['SOFA_SLEEPER']);
    expect(piece3dFeaturesUsed({ ...sofa, sofa: { ...sofa.sofa!, sleeper: false, storage: true } })).toEqual(['SOFA_SLEEPER', 'SOFA_STORAGE']);
    const bed = defaultPieceConfig('BED');
    expect(piece3dFeaturesUsed({ ...bed, bed: { ...bed.bed!, customSize: { widthM: 1.2, lengthM: 1.9 } } })).toEqual(['BED_CUSTOM_SIZE']);
    const table = defaultPieceConfig('TABLE');
    const t: PieceConfig3d = { ...table, table: { ...table.table!, shape: 'EXTENDABLE', openLengthM: 2.4, customHeightM: 0.72 } };
    expect(piece3dFeaturesUsed(t)).toEqual(['TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT']);
    const bench = defaultPieceConfig('BENCH');
    expect(piece3dFeaturesUsed({ ...bench, bench: { ...bench.bench!, customHeightM: 0.48 } })).toEqual(['BENCH_CUSTOM_HEIGHT']);
  });
});

describe('etapa 10 — schemele primesc campurile noi doar ca optionale', () => {
  it('canapea: sleeper / storage boolean optionale', () => {
    const base = defaultPieceConfig('SOFA').sofa!;
    expect(sofaSchema.safeParse(base).success).toBe(true);
    expect(sofaSchema.safeParse({ ...base, sleeper: true, storage: false }).success).toBe(true);
    expect(sofaSchema.safeParse({ ...base, sleeper: 'yes' }).success).toBe(false);
    expect(sofaSchema.safeParse({ ...base, cover: true }).success).toBe(false);
  });

  it('pat: customSize 0,7–2,2 × 1,6–2,4, strict', () => {
    const base = defaultPieceConfig('BED').bed!;
    expect(bedOptionsSchema.safeParse(base).success).toBe(true);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 0.7, lengthM: 1.6 } }).success).toBe(true);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 2.2, lengthM: 2.4 } }).success).toBe(true);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 0.69, lengthM: 2 } }).success).toBe(false);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 1.2, lengthM: 2.41 } }).success).toBe(false);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 1.2 } }).success).toBe(false);
    expect(bedOptionsSchema.safeParse({ ...base, customSize: { widthM: 1.2, lengthM: 2, extra: 1 } }).success).toBe(false);
  });

  it('masa: openLengthM 1,5–4 si customHeightM 0,3–0,9 (plaja schemei; regulile pe tip / latime = e10-3d)', () => {
    const base = defaultPieceConfig('TABLE').table!;
    expect(tableOptionsSchema.safeParse(base).success).toBe(true);
    expect(tableOptionsSchema.safeParse({ ...base, openLengthM: 1.5, customHeightM: 0.3 }).success).toBe(true);
    expect(tableOptionsSchema.safeParse({ ...base, openLengthM: 4, customHeightM: 0.9 }).success).toBe(true);
    expect(tableOptionsSchema.safeParse({ ...base, openLengthM: 1.49 }).success).toBe(false);
    expect(tableOptionsSchema.safeParse({ ...base, openLengthM: 4.01 }).success).toBe(false);
    expect(tableOptionsSchema.safeParse({ ...base, customHeightM: 0.29 }).success).toBe(false);
    expect(tableOptionsSchema.safeParse({ ...base, customHeightM: 0.91 }).success).toBe(false);
  });

  it('bancuta: customHeightM 0,35–0,55', () => {
    const base = defaultPieceConfig('BENCH').bench!;
    expect(benchOptionsSchema.safeParse({ ...base, customHeightM: 0.35 }).success).toBe(true);
    expect(benchOptionsSchema.safeParse({ ...base, customHeightM: 0.55 }).success).toBe(true);
    expect(benchOptionsSchema.safeParse({ ...base, customHeightM: 0.34 }).success).toBe(false);
    expect(benchOptionsSchema.safeParse({ ...base, customHeightM: 0.56 }).success).toBe(false);
  });
});

// Revizuire 3D (m6): schema Studio valideaza piesa doar cu pieceConfig3dSchema (fara `features`). Inofensiv:
// scenele Studio se salveaza si se afiseaza read-only; o piesa ajunge in cerere doar ca answers.config3d al
// unei camere, validat la publicare de motor pe versiunea camerei (studio-publication.ts cere config identic).
describe('etapa 10 — Studio: campurile noi trec de schema piesei, dar intra in cerere doar prin `features`', () => {
  it('canapea extensibila: acceptata de pieceConfig3dSchema; in cerere respinsa pe v2, primita pe v3', () => {
    const sofa = defaultPieceConfig('SOFA');
    const sleeper: PieceConfig3d = { ...sofa, sofa: { ...sofa.sofa!, sleeper: true, storage: true } };
    expect(pieceConfig3dSchema('SOFA').safeParse(sleeper).success).toBe(true);
    expect(validateRoomAnswers('PIECE_SOFA', { config3d: sleeper }, { partial: true, version: 2 })).toEqual({
      ok: false, errors: [{ stepId: 'config3d', messageKey: 'validation.unknownAnswer' }],
    });
    expect(validateRoomAnswers('PIECE_SOFA', { config3d: sleeper }, { partial: true, version: 3 })).toEqual({ ok: true });
  });
});
