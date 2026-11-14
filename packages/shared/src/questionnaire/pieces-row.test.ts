import { describe, expect, it } from 'vitest';
import { FIRM_MATERIAL_NOTE, FIRM_OPENING_NOTE, NO_FRONTS_NOTE } from './flows/finish-sets';
import { derivePieceRowsV2, pieceRowDimensionsText, pieceRowV2Schema } from './pieces-row';

const row = { name: 'Dulap hol', material: 'PAL', systems: ['MANER'], quantity: 1 };
const issue = (value: unknown) => {
  const r = pieceRowV2Schema.safeParse(value);
  return r.success ? null : r.error.issues[0].message;
};

describe('etapa 6 — randul "Alta piesa" v2', () => {
  it('schema: dimensiuni intregi 1–600, decide firma, fara usi, deschidere obligatorie Maner / Push', () => {
    expect(issue({ ...row, widthCm: 120, heightCm: 80, depthCm: 40, description: 'cu blat' })).toBeNull();
    expect(issue({ ...row, widthCm: 0 })).toBe('validation.dimensionOutOfRange');
    expect(issue({ ...row, widthCm: 601 })).toBe('validation.dimensionOutOfRange');
    expect(issue({ ...row, depthCm: 40.5 })).toBe('validation.dimensionOutOfRange');
    expect(issue({ ...row, material: 'ALTUL', materialChoice: 'FIRM_DECIDES' })).toBeNull();
    expect(issue({ ...row, materialChoice: 'FIRM_DECIDES' })).toBe('validation.answerInvalid');
    expect(issue({ ...row, systems: [], openingChoice: 'NO_FRONTS' })).toBeNull();
    expect(issue({ ...row, systems: [], openingChoice: 'FIRM_DECIDES' })).toBeNull();
    expect(issue({ ...row, openingChoice: 'NO_FRONTS' })).toBe('validation.exclusiveOption');
    expect(issue({ ...row, systems: [] })).toBe('validation.minOneOption');
    expect(issue({ ...row, systems: ['GLISANTE'] })).toBe('validation.optionInvalid');
    expect(issue({ ...row, systems: ['MANER', 'PUSH'] })).toBeNull();
    expect(issue({ ...row, description: 'x'.repeat(1801) })).toBe('validation.textTooLong');
    expect(issue({ ...row, foo: 1 })).toBe('validation.unknownAnswer');
  });

  it('textul dimensiunilor: toate trei, partial, niciuna', () => {
    expect(pieceRowDimensionsText({ widthCm: 120, heightCm: 80, depthCm: 40 })).toBe('Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)');
    expect(pieceRowDimensionsText({ widthCm: 120, depthCm: 40 })).toBe('Lățime 120 cm, adâncime 40 cm');
    expect(pieceRowDimensionsText({ heightCm: 80 })).toBe('Înălțime 80 cm');
    expect(pieceRowDimensionsText({})).toBeUndefined();
  });

  it('derivarea: campurile noi trec in descriere, piesa ramane in forma veche', () => {
    const { items, firmRecommendations } = derivePieceRowsV2([
      { ...row, description: 'cu oglindă', widthCm: 120, heightCm: 80, depthCm: 40 },
      { name: 'Raft', material: 'ALTUL', materialChoice: 'FIRM_DECIDES', systems: [], openingChoice: 'NO_FRONTS', quantity: 2 },
      { name: 'Comodă', material: 'MDF_VOPSIT', systems: [], openingChoice: 'FIRM_DECIDES', quantity: 1 },
      { ...row, name: 'Simplu' },
    ]);
    expect(items).toEqual([
      { name: 'Dulap hol', material: 'PAL', systems: ['MANER'], quantity: 1, description: 'cu oglindă; Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)' },
      { name: 'Raft', material: 'ALTUL', systems: [], quantity: 2, description: `${FIRM_MATERIAL_NOTE}; ${NO_FRONTS_NOTE}` },
      { name: 'Comodă', material: 'MDF_VOPSIT', systems: [], quantity: 1, description: FIRM_OPENING_NOTE },
      { name: 'Simplu', material: 'PAL', systems: ['MANER'], quantity: 1 },
    ]);
    expect(firmRecommendations).toEqual([
      { itemName: 'Raft', material: true, opening: false },
      { itemName: 'Comodă', material: false, opening: true },
    ]);
    expect(derivePieceRowsV2(undefined)).toEqual({ items: [], firmRecommendations: [] });
    // revizuire M1: "Alta piesa" nu pune nota corpului nici la fara usi / sertare
    expect(derivePieceRowsV2([{ name: 'Bancă', material: 'MDF_VOPSIT', systems: [], openingChoice: 'NO_FRONTS', quantity: 1 }]).items[0].description).toBe(NO_FRONTS_NOTE);
  });
});
