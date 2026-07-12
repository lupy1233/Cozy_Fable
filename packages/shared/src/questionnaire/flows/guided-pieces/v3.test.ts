import { describe, expect, it } from 'vitest';
import {
  collectScoreEntries,
  summarizeAnswers,
  validateRoomAnswers,
} from '../../engine';
import { defaultPieceConfig, type PieceConfig3d } from '../../piece3d';
import type { AnswerMap } from '../../types';
import { CURRENT_FLOW_VERSION } from '../index';
import { pieceBookcaseFlowV3, pieceNightstandFlowV3, pieceWardrobeFlowV3 } from './v3';

// Flow-urile v3 (configurator 3D, docs/10 R3): validare completa la publish,
// derivare in request_items si scoring — identic FE/BE.

function bookcaseAnswers(overrides: Partial<AnswerMap> = {}): AnswerMap {
  const config: PieceConfig3d = {
    widthM: 1.6,
    heightM: 2,
    depthM: 0.35,
    columns: [
      { zones: [{ type: 'OPEN', fill: 'SHELVES', count: 3 }, { type: 'DRAWERS', count: 2 }] },
      { zones: [{ type: 'OPEN' }, { type: 'DOOR' }] },
    ],
    finish: 'STEJAR',
  };
  return { config3d: config, material: 'PAL', ...overrides };
}

describe('piesele-carcasa pornesc pe v3', () => {
  it('CURRENT_FLOW_VERSION e 3 pentru cele 7 piese si 2 pentru pat/masa/bancuta', () => {
    for (const rt of [
      'PIECE_BOOKCASE',
      'PIECE_WARDROBE',
      'PIECE_TV_UNIT',
      'PIECE_SHOE_CABINET',
      'PIECE_DRESSER',
      'PIECE_NIGHTSTAND',
      'PIECE_DESK',
    ] as const) {
      expect(CURRENT_FLOW_VERSION[rt], rt).toBe(3);
    }
    expect(CURRENT_FLOW_VERSION.PIECE_BED).toBe(2);
    expect(CURRENT_FLOW_VERSION.PIECE_TABLE).toBe(2);
    expect(CURRENT_FLOW_VERSION.PIECE_BENCH).toBe(2);
  });
});

describe('validateRoomAnswers pe v3', () => {
  it('accepta raspunsuri complete de biblioteca (config + material)', () => {
    const res = validateRoomAnswers('PIECE_BOOKCASE', bookcaseAnswers(), {
      partial: false,
      version: 3,
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);
  });

  it('respinge config cu zona nepermisa si cere config-ul la publish', () => {
    const bad = bookcaseAnswers();
    (bad.config3d as PieceConfig3d).columns[0].zones[0] = { type: 'HANGING' } as never;
    expect(validateRoomAnswers('PIECE_BOOKCASE', bad, { partial: false, version: 3 }).ok).toBe(
      false,
    );
    expect(
      validateRoomAnswers('PIECE_BOOKCASE', { material: 'PAL' }, { partial: false, version: 3 })
        .ok,
    ).toBe(false);
  });

  it('accepta snapshot3d (uuid) si il respinge daca nu e uuid', () => {
    const withSnap = bookcaseAnswers({
      snapshot3d: ['0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e'],
    });
    expect(
      validateRoomAnswers('PIECE_BOOKCASE', withSnap, { partial: false, version: 3 }).ok,
    ).toBe(true);
    const badSnap = bookcaseAnswers({ snapshot3d: ['nu-e-uuid'] });
    expect(
      validateRoomAnswers('PIECE_BOOKCASE', badSnap, { partial: false, version: 3 }).ok,
    ).toBe(false);
  });
});

describe('deriveRoom pe v3', () => {
  it('biblioteca: gabaritul vine din config, descrierea e generata + "alt material"', () => {
    const derived = pieceBookcaseFlowV3.deriveRoom(
      bookcaseAnswers({ material: 'ALTUL', materialOther: 'bambus' }),
    );
    expect(derived.lengthM).toBe(1.6);
    expect(derived.widthM).toBe(0.35);
    expect(derived.heightM).toBe(2);
    expect(derived.items[0].name).toBe('Biblioteca');
    expect(derived.items[0].description).toContain('Configurat 3D: 160 x 200 x 35 cm');
    expect(derived.items[0].description).toContain('Material dorit: bambus');
  });

  it('dulapul glisant primeste sistemul GLISANTE si numele dupa inaltime', () => {
    const config = { ...defaultPieceConfig('WARDROBE'), heightM: 2.6 };
    const derived = pieceWardrobeFlowV3.deriveRoom({
      config3d: config,
      doorType: 'SLIDING',
      material: 'PAL',
    });
    expect(derived.items[0].systems).toEqual(['GLISANTE']);
    expect(derived.items[0].name).toBe('Dulap pana in tavan (tip dressing)');
  });

  it('noptierele pereche dubleaza cantitatea si metrii liniari', () => {
    const config = defaultPieceConfig('NIGHTSTAND');
    const derived = pieceNightstandFlowV3.deriveRoom({
      config3d: config,
      count: 'TWO',
      material: 'MDF_VOPSIT',
    });
    expect(derived.items[0].quantity).toBe(2);
    expect(derived.lengthM).toBeCloseTo(config.widthM * 2, 6);
  });
});

describe('scoring si rezumat pe v3', () => {
  it('dulapul >=2.5m emite WARDROBE_TO_CEILING, cel scund nu', () => {
    const tall = {
      config3d: { ...defaultPieceConfig('WARDROBE'), heightM: 2.6 },
      doorType: 'HINGED',
      material: 'PAL',
    };
    const short = {
      config3d: { ...defaultPieceConfig('WARDROBE'), heightM: 2.2 },
      doorType: 'HINGED',
      material: 'PAL',
    };
    const has = (answers: AnswerMap) =>
      collectScoreEntries('PIECE_WARDROBE', answers, 3).some(
        (e) => 'optionKey' in e && e.category === 'WARDROBE_TO_CEILING',
      );
    expect(has(tall)).toBe(true);
    expect(has(short)).toBe(false);
  });

  it('rezumatul contine intrarea config3d si NU expune snapshot3d', () => {
    const entries = summarizeAnswers(
      'PIECE_BOOKCASE',
      bookcaseAnswers({ snapshot3d: ['0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e'] }),
      3,
    );
    const config3d = entries.find((e) => e.kind === 'config3d');
    expect(config3d).toBeDefined();
    expect(entries.some((e) => e.stepId === 'snapshot3d')).toBe(false);
  });
});
