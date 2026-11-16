import { describe, expect, it } from 'vitest';
import type { ChoiceOption, SingleChoiceStep } from '../types';
import {
  BODY_NOTE,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  finishDescription,
  INTEGRAL_MDF_NOTE,
  kitchenCountertopOptionsV4,
  materialSetOptions,
  NO_FRONTS_NOTE,
  openingOptions,
  PISTONS_NOTE,
  resolveMaterial,
  resolveOpening,
} from './finish-sets';
import { kitchenFlowV2 } from './kitchen.v2';

const values = (opts: ChoiceOption[]) => opts.map((o) => o.value);
const byValue = (opts: ChoiceOption[], v: string) => opts.find((o) => o.value === v)!;

describe('etapa 6 — seturile de material (DESIGN 2.2)', () => {
  it('BODY: fronturile + Altul + decide firma; integral MDF doar la cerere', () => {
    expect(values(materialSetOptions('BODY'))).toEqual(['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL', 'FIRM_DECIDES']);
    expect(values(materialSetOptions('BODY', { integralMdf: true }))).toEqual([
      'PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'MDF_INTEGRAL', 'ALTUL', 'FIRM_DECIDES',
    ]);
    // pretul pe metru liniar ramane la corpuri (cheile existente)
    expect(byValue(materialSetOptions('BODY'), 'PAL').info?.priceHintKey).toBe('common.materials.PAL.info.price');
    const firm = byValue(materialSetOptions('BODY'), 'FIRM_DECIDES');
    expect(firm.labelKey).toBe('common.finish.firmDecides.label');
    expect(firm.exclusive).toBeUndefined();
  });

  it('PANEL: ca BODY, fara integral MDF chiar daca e cerut', () => {
    expect(values(materialSetOptions('PANEL', { integralMdf: true }))).toEqual(values(materialSetOptions('BODY')));
  });

  it('WOOD: lemn masiv / furnir / PAL cu decor lemn / decide firma, fara Altul si fara pret', () => {
    const opts = materialSetOptions('WOOD');
    expect(values(opts)).toEqual(['LEMN_MASIV', 'MDF_FURNIR', 'PAL', 'FIRM_DECIDES']);
    expect(byValue(opts, 'PAL').labelKey).toBe('common.finish.wood.PAL.label');
    expect(byValue(opts, 'PAL').info?.titleKey).toBe('common.materials.PAL.info.title');
    for (const o of opts) expect(o.info && 'priceHintKey' in o.info, o.value).toBeFalsy();
  });

  it('MIRROR si WORKTOP: setul propriu, fara pret pe metru', () => {
    expect(values(materialSetOptions('MIRROR'))).toEqual(['MIRROR_FRAMELESS', 'MIRROR_FRAME_WOOD', 'MIRROR_FRAME_MDF', 'MIRROR_FRAME_METAL', 'FIRM_DECIDES']);
    expect(values(materialSetOptions('WORKTOP'))).toEqual([
      'WORKTOP_PAL_POSTFORMED', 'WORKTOP_HPL', 'WORKTOP_HPL_COMPACT', 'WORKTOP_QUARTZ', 'WORKTOP_SOLID_WOOD', 'FIRM_DECIDES',
    ]);
    for (const o of [...materialSetOptions('MIRROR'), ...materialSetOptions('WORKTOP')]) {
      expect(o.info?.priceHintKey, o.value).toBeUndefined();
    }
  });

  it('blatul bucatariei v4 = optiunile din v2 + decide firma cu rand de scor propriu', () => {
    const v2 = (kitchenFlowV2.steps.find((s) => s.id === 'countertop') as SingleChoiceStep).options;
    const v4 = kitchenCountertopOptionsV4();
    expect(v4.slice(0, -1)).toEqual(v2);
    expect(v4.at(-1)).toMatchObject({ value: 'FIRM_DECIDES', scoring: { category: 'KITCHEN_COUNTERTOP', optionKey: 'FIRM_DECIDES' } });
  });
});

describe('etapa 6 — lista unica de deschidere (DESIGN 2.3)', () => {
  it('listele pe tipuri, fara glisante; decide firma mereu, exclusiva', () => {
    expect(values(openingOptions('GENERAL'))).toEqual(['MANER', 'PUSH', 'FIRM_DECIDES']);
    expect(values(openingOptions('GENERAL', { pistons: true, noFronts: true }))).toEqual(['MANER', 'PUSH', 'PISTONS', 'NO_FRONTS', 'FIRM_DECIDES']);
    expect(values(openingOptions('KITCHEN_BASE'))).toEqual(['MANER', 'PUSH', 'GOLA', 'FIRM_DECIDES']);
    expect(values(openingOptions('KITCHEN_WALL'))).toEqual(['MANER', 'PUSH', 'GOLA', 'AVENTOS', 'PISTONS', 'FIRM_DECIDES']);
    expect(values(openingOptions('KITCHEN_ISLAND'))).toEqual(['MANER', 'PUSH', 'GOLA', 'FIRM_DECIDES']);
    // pistoanele / "fara usi" nu apar la bucatarie de baza / insula nici cu steagurile puse
    expect(values(openingOptions('KITCHEN_BASE', { pistons: true, noFronts: true }))).toEqual(['MANER', 'PUSH', 'GOLA', 'FIRM_DECIDES']);
    const general = openingOptions('GENERAL', { noFronts: true });
    expect(general.filter((o) => o.exclusive).map((o) => o.value)).toEqual(['NO_FRONTS', 'FIRM_DECIDES']);
    for (const kind of ['GENERAL', 'KITCHEN_BASE', 'KITCHEN_WALL', 'KITCHEN_ISLAND'] as const) {
      expect(values(openingOptions(kind, { pistons: true, noFronts: true }))).not.toContain('GLISANTE');
    }
  });
});

describe('etapa 6 — rezolvarea (DESIGN 2.4)', () => {
  it('resolveMaterial pe toate valorile', () => {
    for (const m of ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV'] as const) {
      expect(resolveMaterial(m, 'BODY')).toEqual({ material: m, notes: [], firmDecides: false });
    }
    expect(resolveMaterial(undefined, 'BODY')).toEqual({ material: 'ALTUL', notes: [], firmDecides: false });
    expect(resolveMaterial('MDF_INTEGRAL', 'BODY')).toEqual({ material: 'MDF', notes: [INTEGRAL_MDF_NOTE], firmDecides: false });
    expect(resolveMaterial('ALTUL', 'BODY', '  stejar  ')).toEqual({ material: 'ALTUL', notes: ['Material dorit: stejar'], firmDecides: false });
    expect(resolveMaterial('ALTUL', 'PANEL', '   ')).toEqual({ material: 'ALTUL', notes: [], firmDecides: false });
    expect(resolveMaterial('FIRM_DECIDES', 'BODY')).toEqual({ material: 'ALTUL', notes: [FIRM_MATERIAL_NOTE], firmDecides: true });
    expect(resolveMaterial('FIRM_DECIDES', 'WOOD')).toEqual({ material: 'ALTUL', notes: [FIRM_MATERIAL_NOTE], firmDecides: true });
    expect(resolveMaterial('FIRM_DECIDES', 'MIRROR')).toEqual({ material: 'ALTUL', notes: ['Ramă: clientul vrea recomandarea firmei'], firmDecides: true });
    expect(resolveMaterial('FIRM_DECIDES', 'WORKTOP')).toEqual({ material: 'ALTUL', notes: ['Blat: clientul vrea recomandarea firmei'], firmDecides: true });
    const mirror: [string, string, string][] = [
      ['MIRROR_FRAMELESS', 'ALTUL', 'Ramă: fără ramă'],
      ['MIRROR_FRAME_WOOD', 'LEMN_MASIV', 'Ramă: lemn'],
      ['MIRROR_FRAME_MDF', 'MDF_VOPSIT', 'Ramă: MDF vopsit'],
      ['MIRROR_FRAME_METAL', 'ALTUL', 'Ramă: metal'],
    ];
    const worktop: [string, string, string][] = [
      ['WORKTOP_PAL_POSTFORMED', 'PAL', 'Blat: PAL postformat'],
      ['WORKTOP_HPL', 'ALTUL', 'Blat: HPL'],
      ['WORKTOP_HPL_COMPACT', 'ALTUL', 'Blat: HPL compact'],
      ['WORKTOP_QUARTZ', 'ALTUL', 'Blat: cuarț'],
      ['WORKTOP_SOLID_WOOD', 'LEMN_MASIV', 'Blat: lemn masiv'],
    ];
    for (const [v, material, note] of mirror) expect(resolveMaterial(v, 'MIRROR')).toEqual({ material, notes: [note], firmDecides: false });
    for (const [v, material, note] of worktop) expect(resolveMaterial(v, 'WORKTOP')).toEqual({ material, notes: [note], firmDecides: false });
    // o valoare necunoscuta nu ajunge bruta la firma
    expect(resolveMaterial('NECUNOSCUT', 'BODY')).toEqual({ material: 'ALTUL', notes: [], firmDecides: false });
  });

  it('resolveOpening pe toate valorile', () => {
    expect(resolveOpening(undefined)).toEqual({ systems: [], notes: [], firmDecides: false });
    expect(resolveOpening(['MANER', 'PUSH', 'MANER'])).toEqual({ systems: ['MANER', 'PUSH'], notes: [], firmDecides: false });
    expect(resolveOpening(['GOLA', 'AVENTOS'])).toEqual({ systems: ['GOLA', 'AVENTOS'], notes: [], firmDecides: false });
    expect(resolveOpening(['MANER', 'PISTONS'], { pistons: true })).toEqual({ systems: ['MANER', 'AVENTOS'], notes: [PISTONS_NOTE], firmDecides: false });
    // PISTONS fara steag: ignorat
    expect(resolveOpening(['MANER', 'PISTONS'])).toEqual({ systems: ['MANER'], notes: [], firmDecides: false });
    // bucataria suspendata: Aventos + pistoane → un singur AVENTOS
    expect(resolveOpening(['AVENTOS', 'PISTONS'], { pistons: true }).systems).toEqual(['AVENTOS']);
    expect(resolveOpening(['NO_FRONTS'])).toEqual({ systems: [], notes: [NO_FRONTS_NOTE], firmDecides: false });
    expect(resolveOpening(['FIRM_DECIDES'])).toEqual({ systems: [], notes: [FIRM_OPENING_NOTE], firmDecides: true });
    expect(resolveOpening(['NECUNOSCUT'])).toEqual({ systems: [], notes: [], firmDecides: false });
  });

  it('notele sunt texte pentru firma, fara coduri interne', () => {
    for (const note of [BODY_NOTE, INTEGRAL_MDF_NOTE, FIRM_MATERIAL_NOTE, FIRM_OPENING_NOTE, NO_FRONTS_NOTE, PISTONS_NOTE]) {
      expect(note).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/);
    }
    expect(finishDescription([undefined, ' a ', '', 'b'])).toBe('a; b');
    expect(finishDescription([])).toBeUndefined();
    expect(finishDescription(['x'.repeat(2500)])).toHaveLength(2000);
  });
});
