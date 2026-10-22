import { describe, expect, it } from 'vitest';
import { CONTACT_MASK_TOKEN } from '../contact-detection';
import { collectFreeTextAnswers, maskRoomAnswers } from './free-text';
import { defaultPieceConfig } from './piece3d';
import type { AnswerMap } from './types';

const UPLOAD_ID = '3f2a1b4c-1234-4567-8901-426614174000';

function kitchenV1Answers(): AnswerMap {
  return {
    layout: 'L_SHAPE',
    hasIsland: false,
    dimensions: { runA: 2.4, runB: 1.8, ceilingHeight: 2.6 },
    frontMaterial: 'MDF',
    extraPieces: [
      {
        name: 'Vitrina 0722 123 456',
        material: 'PAL',
        systems: [],
        description: 'culoare #A0B0C0, 240 x 60 cm',
        quantity: 1,
      },
    ],
    notes: 'Sunati la 0722123456. Blat 38 mm.',
  };
}

describe('collectFreeTextAnswers', () => {
  it('collects text steps and piece name/description', () => {
    const out = collectFreeTextAnswers('KITCHEN', 1, kitchenV1Answers());
    expect(out).toEqual([
      { stepId: 'extraPieces', path: 'extraPieces[0].name', value: 'Vitrina 0722 123 456' },
      {
        stepId: 'extraPieces',
        path: 'extraPieces[0].description',
        value: 'culoare #A0B0C0, 240 x 60 cm',
      },
      { stepId: 'notes', path: 'notes', value: 'Sunati la 0722123456. Blat 38 mm.' },
    ]);
  });

  it('walks every string leaf for an unregistered flow version', () => {
    const out = collectFreeTextAnswers('KITCHEN', 999, { a: 'x', b: { c: 'y' }, d: 3 });
    expect(out.map((o) => o.path)).toEqual(['a', 'b.c']);
  });
});

describe('maskRoomAnswers', () => {
  it('masks kitchen text and pieces, keeps the rest identical', () => {
    const answers = kitchenV1Answers();
    const masked = maskRoomAnswers('KITCHEN', 1, answers);
    expect(masked.notes).toBe(`Sunati la ${CONTACT_MASK_TOKEN}. Blat 38 mm.`);
    const pieces = masked.extraPieces as { name: string; description: string }[];
    expect(pieces[0].name).toBe(`Vitrina ${CONTACT_MASK_TOKEN}`);
    expect(pieces[0].description).toBe('culoare #A0B0C0, 240 x 60 cm');
    expect(masked.dimensions).toBe(answers.dimensions);
    // sursa nu e modificata
    expect(answers.notes).toBe('Sunati la 0722123456. Blat 38 mm.');
  });

  it('masks PIECES pieces and keeps upload UUIDs', () => {
    const answers: AnswerMap = {
      pieces: [
        {
          name: 'Dulap',
          material: 'PAL',
          systems: [],
          description: 'detalii pe ana@example.com',
          quantity: 2,
        },
      ],
      sketch: [UPLOAD_ID],
    };
    const masked = maskRoomAnswers('PIECES', 1, answers);
    const pieces = masked.pieces as { name: string; description: string }[];
    expect(pieces[0]).toMatchObject({ name: 'Dulap', description: `detalii pe ${CONTACT_MASK_TOKEN}` });
    expect(masked.sketch).toEqual([UPLOAD_ID]);
  });

  it('deep fallback leaves UUIDs, hex colours and config3d untouched', () => {
    const config = defaultPieceConfig('WARDROBE');
    const answers: AnswerMap = {
      sketch: [UPLOAD_ID],
      color: '#A0B0C0',
      config: config,
      notes: 'tel +40722123456',
    };
    const masked = maskRoomAnswers('PIECES', 999, answers);
    expect(masked.sketch).toEqual([UPLOAD_ID]);
    expect(masked.color).toBe('#A0B0C0');
    expect(masked.config).toEqual(config);
    expect(masked.notes).toBe(`tel ${CONTACT_MASK_TOKEN}`);
  });
});
