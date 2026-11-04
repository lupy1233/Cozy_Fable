import type { ProcessedRoom } from './configurator.service';
import { MAX_CONTACT_DETECTION_ROWS, screenRequestText } from './contact-screening';

function room(roomType: ProcessedRoom['roomType'], flowVersion: number, answers: ProcessedRoom['answers']): ProcessedRoom {
  return {
    roomType,
    flowVersion,
    answers,
    derived: { lengthM: 1, widthM: 0.6, heightM: 2.6, items: [] },
    scoreEntries: [],
  };
}

describe('screenRequestText', () => {
  it('logs description, title and answers with redacted excerpts', () => {
    const res = screenRequestText({
      manualTitle: 'Bucatarie 0722123456',
      description: 'Sunati la 0722 123 456 sau ana@example.com',
      rooms: [
        room('KITCHEN', 1, { notes: 'detalii pe www.mobila-ana.ro' }),
        room('PIECES', 1, {
          pieces: [{ name: 'Dulap', material: 'PAL', systems: [], description: 'insta @ana.design', quantity: 1 }],
        }),
      ],
    });
    expect(res.titleHasContact).toBe(true);
    expect(res.rows.map((r) => [r.field, r.roomType, r.stepId, r.kinds])).toEqual([
      ['TITLE', null, null, ['PHONE']],
      ['DESCRIPTION', null, null, ['PHONE', 'EMAIL']],
      ['ANSWER', 'KITCHEN', 'notes', ['URL']],
      ['ANSWER', 'PIECES', 'pieces', ['MESSENGER', 'HANDLE']],
    ]);
    const description = res.rows[1];
    expect(description.excerpt).not.toContain('0722 123 456');
    expect(description.excerpt).not.toContain('ana@example.com');
    expect(description.excerpt).toContain('07');
    expect(res.blockingDetails).toEqual([
      { field: 'description', messageKey: 'validation.contactInText' },
      { roomIndex: 0, stepId: 'notes', messageKey: 'validation.contactInText' },
      { roomIndex: 1, stepId: 'pieces', messageKey: 'validation.contactInText' },
    ]);
  });

  it('a messenger mention alone is logged as not hideable and never blocks', () => {
    const res = screenRequestText({ description: 'Prefer sa vorbim pe WhatsApp', rooms: [] });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ field: 'DESCRIPTION', kinds: ['MESSENGER'], hideable: false });
    expect(res.blockingDetails).toEqual([]);
    expect(res.titleHasContact).toBe(false);
  });

  it('dimensions, dates and budgets produce no rows', () => {
    const res = screenRequestText({
      manualTitle: 'Bucatarie 240 x 60 cm',
      description: 'Corp 240 x 60 cm, 2400 x 600 x 350 mm, livrare 02.10.2026-15.10.2026, buget 15000-20000 lei',
      rooms: [room('KITCHEN', 1, { notes: 'blat 38 mm, 3 sertare de 60, H=2.6m' })],
    });
    expect(res).toEqual({ rows: [], titleHasContact: false, blockingDetails: [] });
  });

  it('caps the rows but still reports every blocking step', () => {
    const pieces = Array.from({ length: 10 }, (_, i) => ({
      name: `Piesa ${i} 0722123456`,
      material: 'PAL' as const,
      systems: [],
      description: `tel 07221234${String(i).padStart(2, '0')}`,
      quantity: 1,
    }));
    const res = screenRequestText({
      description: 'tel 0722123456',
      rooms: [room('PIECES', 1, { pieces }), room('KITCHEN', 1, { notes: 'ana@example.com' })],
    });
    expect(res.rows).toHaveLength(MAX_CONTACT_DETECTION_ROWS);
    expect(res.blockingDetails).toEqual([
      { field: 'description', messageKey: 'validation.contactInText' },
      { roomIndex: 0, stepId: 'pieces', messageKey: 'validation.contactInText' },
      { roomIndex: 1, stepId: 'notes', messageKey: 'validation.contactInText' },
    ]);
  });

  // E-client-34: notitele pozelor de inspiratie
  it('logs a phone in an inspiration note as PHOTO_NOTE and blocks per photo', () => {
    const res = screenRequestText({
      rooms: [],
      inspirationNotes: [
        { photoId: 'p1', note: 'imi place, suna la 0722 123 456', roomType: 'KITCHEN' },
        { photoId: 'p2', note: 'fronturile mate', roomType: null },
      ],
    });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ field: 'PHOTO_NOTE', roomType: 'KITCHEN', stepId: null, kinds: ['PHONE'], hideable: true });
    expect(res.rows[0].excerpt).not.toContain('0722 123 456');
    expect(res.blockingDetails).toEqual([
      { field: 'inspirationNote', photoId: 'p1', messageKey: 'validation.contactInText' },
    ]);
  });

  it('a messenger mention alone in a note is FLAGGED (not hideable) and never blocks', () => {
    const res = screenRequestText({
      rooms: [],
      inspirationNotes: [{ photoId: 'p1', note: 'prefer WhatsApp', roomType: null }],
    });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ field: 'PHOTO_NOTE', hideable: false });
    expect(res.blockingDetails).toEqual([]);
  });

  it('keeps the row cap with notes but still reports every blocking note', () => {
    const inspirationNotes = Array.from({ length: 10 }, (_, i) => ({
      photoId: `p${i}`,
      note: `tel 07221234${String(i).padStart(2, '0')}`,
      roomType: null,
    }));
    const res = screenRequestText({
      description: 'tel 0722123456',
      rooms: [room('PIECES', 1, {
        pieces: Array.from({ length: 12 }, (_, i) => ({
          name: `Piesa ${i} 0722123456`, material: 'PAL' as const, systems: [], description: 'x', quantity: 1,
        })),
      })],
      inspirationNotes,
    });
    expect(res.rows).toHaveLength(MAX_CONTACT_DETECTION_ROWS);
    expect(res.blockingDetails.filter((d) => 'photoId' in d)).toHaveLength(10);
  });
});
