import { BadRequestException } from '@nestjs/common';
import type { ProcessedRoom } from './configurator.service';
import {
  assertInspirationRooms,
  inspirationNotesForScreening,
  inspirationRows,
  readInspirationSelection,
} from './inspiration-selection';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function room(roomType: ProcessedRoom['roomType'], sourceLocalId?: string): ProcessedRoom {
  return {
    sourceLocalId,
    roomType,
    flowVersion: 1,
    answers: {},
    derived: { lengthM: 1, widthM: 1, heightM: 2.6, items: [] },
    scoreEntries: [],
  };
}

describe('readInspirationSelection', () => {
  it('returns undefined when neither field is sent (existing rows untouched)', () => {
    expect(readInspirationSelection({})).toBeUndefined();
  });

  it('rejects both fields at once with VALIDATION_ERROR', () => {
    try {
      readInspirationSelection({ inspirationPhotoIds: [P1], inspirationPhotos: [{ photoId: P1 }] });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });

  it('maps legacy ids to null note and null room', () => {
    expect(readInspirationSelection({ inspirationPhotoIds: [P1, P2] })).toEqual([
      { photoId: P1, note: null, roomLocalId: null },
      { photoId: P2, note: null, roomLocalId: null },
    ]);
  });

  it('trims notes, turns blanks into null and dedupes keeping the first', () => {
    expect(
      readInspirationSelection({
        inspirationPhotos: [
          { photoId: P1, note: '  matte fronts  ', roomLocalId: ' r1 ' },
          { photoId: P2, note: '   ', roomLocalId: '' },
          { photoId: P1, note: 'duplicate' },
        ],
      }),
    ).toEqual([
      { photoId: P1, note: 'matte fronts', roomLocalId: 'r1' },
      { photoId: P2, note: null, roomLocalId: null },
    ]);
  });

  it('an empty list means replace with nothing', () => {
    expect(readInspirationSelection({ inspirationPhotos: [] })).toEqual([]);
  });
});

describe('assertInspirationRooms', () => {
  const rooms = [room('KITCHEN', 'k1'), room('LIVING', 'l1')];

  it('passes for known room local ids and for no room', () => {
    expect(() =>
      assertInspirationRooms(
        [{ photoId: P1, note: null, roomLocalId: 'k1' }, { photoId: P2, note: null, roomLocalId: null }],
        rooms,
      ),
    ).not.toThrow();
    expect(() => assertInspirationRooms(undefined, rooms)).not.toThrow();
  });

  it('rejects an unknown room local id with the photo in details', () => {
    try {
      assertInspirationRooms([{ photoId: P1, note: null, roomLocalId: 'zzz' }], rooms);
      throw new Error('should have thrown');
    } catch (e) {
      const body = (e as BadRequestException).getResponse() as { code: string; details: Record<string, string>[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details[0]).toMatchObject({
        field: 'inspirationPhotos',
        photoId: P1,
        messageKey: 'validation.inspirationRoomUnknown',
      });
    }
  });
});

describe('inspirationRows', () => {
  it('maps room local ids through the persisted-id map', () => {
    const rows = inspirationRows(
      'req1',
      [
        { photoId: P1, note: 'nota', roomLocalId: 'k1' },
        { photoId: P2, note: null, roomLocalId: null },
      ],
      new Map([['k1', 'room-uuid']]),
    );
    expect(rows).toEqual([
      { requestId: 'req1', photoId: P1, note: 'nota', requestRoomId: 'room-uuid' },
      { requestId: 'req1', photoId: P2, note: null, requestRoomId: null },
    ]);
  });

  it('falls back to null when the map has no entry', () => {
    const [row] = inspirationRows('req1', [{ photoId: P1, note: null, roomLocalId: 'gone' }], new Map());
    expect(row.requestRoomId).toBeNull();
  });
});

describe('inspirationNotesForScreening', () => {
  it('keeps only non-null notes with the linked room type', () => {
    const out = inspirationNotesForScreening(
      [
        { photoId: P1, note: 'nota', roomLocalId: 'k1' },
        { photoId: P2, note: null, roomLocalId: 'k1' },
      ],
      [room('KITCHEN', 'k1')],
    );
    expect(out).toEqual([{ photoId: P1, note: 'nota', roomType: 'KITCHEN' }]);
    expect(inspirationNotesForScreening(undefined, [])).toEqual([]);
  });
});
