import { describe, expect, it } from 'vitest';
import { stepAnswerSchema, visibleOptions } from '../engine';
import { linearMeters } from '../mapping';
import type { DimensionGroupStep, MultiChoiceStep, SingleChoiceStep } from '../types';
import { ceilingHeightSlot, linearSlot } from './common';
import { FIRM_DECIDES } from './finish-sets';
import {
  ceilingIfTall,
  FIRM_DECIDES_NOTE_TEXT,
  informativeSlot,
  noteFor,
  optionalChoiceStep,
  optionalHeightSlot,
  pieceWidthSlot,
  TALL_PIECE_SUBTITLE_NOTE,
} from './measure-sets';

const K = 'flows.TOY.v9';

describe('etapa 10 — measure-sets: sloturile de dimensiuni', () => {
  it('pieceWidthSlot = linearSlot (obligatoriu, intra in metri liniari)', () => {
    const slot = pieceWidthSlot('wardrobeWidth', `${K}.slots.wardrobeWidth`, { min: 0.6, max: 5 });
    expect(slot).toEqual(linearSlot('wardrobeWidth', `${K}.slots.wardrobeWidth`, { min: 0.6, max: 5 }));
    expect(slot).toMatchObject({ unit: 'm', min: 0.6, max: 5, step: 0.1, countsTowardLinear: true });
    expect(slot.optional).toBeUndefined();
  });

  it('optionalHeightSlot: optional, pas 0,05, fara metri liniari; typicalM doar cand e dat', () => {
    expect(optionalHeightSlot('wardrobeHeight', 'l', { min: 1.8, max: 3.2 }, 2.4)).toEqual({
      id: 'wardrobeHeight', labelKey: 'l', unit: 'm', min: 1.8, max: 3.2, step: 0.05, optional: true, typicalM: 2.4,
    });
    const noTypical = optionalHeightSlot('storageHeight', 'l', { min: 0.6, max: 2.6 });
    expect('typicalM' in noTypical).toBe(false);
    expect(noTypical.countsTowardLinear).toBeUndefined();
  });

  it('informativeSlot: obligatoriu, pas 0,1, NU da marimea', () => {
    const slot = informativeSlot('runA', 'l', { min: 0.8, max: 6 });
    expect(slot).toEqual({ id: 'runA', labelKey: 'l', unit: 'm', min: 0.8, max: 6, step: 0.1 });
  });

  it('ceilingIfTall: tavanul doar cu o piesa inalta bifata', () => {
    const tall = ['WARDROBE', 'BOOKSHELF'];
    expect(ceilingIfTall(['BED_FRAME'], tall)).toEqual([]);
    expect(ceilingIfTall([], tall)).toEqual([]);
    expect(ceilingIfTall(['BED_FRAME', 'WARDROBE'], tall)).toEqual([ceilingHeightSlot()]);
  });

  it('un pas cu latime + inaltime optionala + perete informativ: marimea = doar latimea; inaltimea goala e acceptata', () => {
    const step: DimensionGroupStep = {
      id: 'dimensions', type: 'dimension-group', titleKey: 't',
      slots: () => [
        informativeSlot('runA', 'a', { min: 0.8, max: 6 }),
        pieceWidthSlot('shelvesWidth', 'w', { min: 0.4, max: 4 }),
        optionalHeightSlot('tallCabinetHeight', 'h', { min: 1.2, max: 2.6 }, 2),
        ...ceilingIfTall(['TALL_CABINET'], ['TALL_CABINET']),
      ],
    };
    expect(linearMeters(step, { dimensions: { runA: 6, shelvesWidth: 1, ceilingHeight: 2.5 } })).toBe(1);
    const schema = stepAnswerSchema(step, {});
    expect(schema.safeParse({ runA: 6, shelvesWidth: 1, ceilingHeight: 2.5 }).success).toBe(true);
    expect(schema.safeParse({ runA: 6, shelvesWidth: 1, ceilingHeight: 2.5, tallCabinetHeight: 2.1 }).success).toBe(true);
    const missingWall = schema.safeParse({ shelvesWidth: 1, ceilingHeight: 2.5 });
    expect(missingWall.success ? null : missingWall.error.issues[0].message).toBe('validation.dimensionRequired');
    expect(TALL_PIECE_SUBTITLE_NOTE.length).toBeGreaterThan(0);
  });
});

describe('etapa 10 — measure-sets: intrebarile optionale cu "Nu stiu"', () => {
  const single = optionalChoiceStep({
    id: 'sinkMounting',
    titleKey: `${K}.sinkMounting.title`,
    screenGroup: 'countertopScreen',
    category: 'KITCHEN_SINK_MOUNTING',
    keyPrefix: `${K}.sinkMounting`,
    options: [{ value: 'INSET', icon: 'square' }, { value: 'UNDERMOUNT', visibleIf: { questionId: 'layout', equals: 'L_SHAPE' } }],
  });

  it('single-choice optional, chei pe keyPrefix, scor pe categorie, FIRM_DECIDES ultimul (neexclusiv)', () => {
    expect(single.type).toBe('single-choice');
    expect(single.optional).toBe(true);
    expect(single.screenGroup).toBe('countertopScreen');
    expect(single.options.map((o) => o.value)).toEqual(['INSET', 'UNDERMOUNT', FIRM_DECIDES]);
    expect(single.options[0]).toEqual({
      value: 'INSET',
      labelKey: `${K}.sinkMounting.options.INSET.label`,
      descriptionKey: `${K}.sinkMounting.options.INSET.description`,
      icon: 'square',
      scoring: { category: 'KITCHEN_SINK_MOUNTING', optionKey: 'INSET' },
    });
    const firm = single.options[2];
    expect(firm.labelKey).toBe('common.finish.firmDecides.label');
    expect(firm.scoring).toEqual({ category: 'KITCHEN_SINK_MOUNTING', optionKey: FIRM_DECIDES });
    expect(firm.exclusive).toBeUndefined();
    // visibleIf pe optiune trece neschimbat
    expect(visibleOptions(single, { layout: 'STRAIGHT' }).map((o) => o.value)).toEqual(['INSET', FIRM_DECIDES]);
    expect(stepAnswerSchema(single, { layout: 'STRAIGHT' }).safeParse('UNDERMOUNT').success).toBe(false);
    expect(stepAnswerSchema(single, { layout: 'L_SHAPE' }).safeParse('UNDERMOUNT').success).toBe(true);
  });

  it('multi-choice: FIRM_DECIDES exclusiv; raspunsul gol e acceptat (optional)', () => {
    const multi: MultiChoiceStep = optionalChoiceStep({
      id: 'wardrobeInterior',
      titleKey: `${K}.wardrobeInterior.title`,
      category: 'WARDROBE_INTERIOR',
      keyPrefix: `${K}.wardrobeInterior`,
      options: [{ value: 'HANGING_RODS' }, { value: 'SHELVES' }],
      multi: true,
    });
    expect(multi.type).toBe('multi-choice');
    expect(multi.options[multi.options.length - 1]).toMatchObject({ value: FIRM_DECIDES, exclusive: true });
    const schema = stepAnswerSchema(multi, {});
    expect(schema.safeParse(['HANGING_RODS', 'SHELVES']).success).toBe(true);
    expect(schema.safeParse([FIRM_DECIDES]).success).toBe(true);
    expect(schema.safeParse([]).success).toBe(true);
    const mixed = schema.safeParse(['SHELVES', FIRM_DECIDES]);
    expect(mixed.success ? null : mixed.error.issues[0].message).toBe('validation.exclusiveOption');
  });

  it('firmDecidesLabelKey: eticheta proprie pentru "Nu stiu" (holul, E10-N15)', () => {
    const hall: SingleChoiceStep = optionalChoiceStep({
      id: 'hallWidth', titleKey: 't', category: 'HALLWAY_WIDTH', keyPrefix: 'flows.HALLWAY.v3.hallWidth',
      options: [{ value: 'NARROW' }, { value: 'WIDE' }],
      firmDecidesLabelKey: 'flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label',
    });
    expect(hall.options[hall.options.length - 1]).toMatchObject({
      value: FIRM_DECIDES,
      labelKey: 'flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label',
      scoring: { category: 'HALLWAY_WIDTH', optionKey: FIRM_DECIDES },
    });
  });

  it('noteFor: text, "recomandarea firmei", lipsa → nimic', () => {
    const texts = { UNDERMOUNT: 'montată sub blat' };
    expect(noteFor('Chiuvetă', 'UNDERMOUNT', texts)).toBe('Chiuvetă: montată sub blat');
    expect(noteFor('Chiuvetă', FIRM_DECIDES, texts)).toBe(`Chiuvetă: ${FIRM_DECIDES_NOTE_TEXT}`);
    expect(noteFor('Chiuvetă', FIRM_DECIDES, texts)).toBe('Chiuvetă: clientul vrea recomandarea firmei');
    expect(noteFor('Chiuvetă', undefined, texts)).toBeUndefined();
    // fara text: nu ajunge codul brut la firma
    expect(noteFor('Chiuvetă', 'SOME_VALUE', texts)).toBe('Chiuvetă: some value');
  });
});
