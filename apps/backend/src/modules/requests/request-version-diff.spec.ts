import { diffRequestVersions } from './request-version-diff';

// e3 (etapa 9): „ce s-a schimbat” intre ultimele doua copii ale cererii.

function snap(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Vreau o bucatarie luminoasa',
    budgetRange: 'B_20_40K',
    budgetEstimateRon: 30000,
    budgetDeclared: true,
    deadlineBucket: 'ONE_TO_THREE_MONTHS',
    includesPaidDesign: false,
    hasOwnProject: false,
    addressText: 'Str. Lalelelor 3',
    addressDetails: 'Bl. A, ap. 4',
    city: 'Cluj-Napoca',
    county: 'Cluj',
    country: 'RO',
    contactPreferences: [{ channel: 'EMAIL', value: 'ana@example.com' }],
    inspirationPhotos: [{ photoId: 'p1', note: 'asa', roomLocalId: 'local-1' }],
    rooms: [
      { sourceLocalId: 'local-1', roomType: 'KITCHEN', flowVersion: 3, answers: { material: 'MDF_VOPSIT', length: 3.2, snapshot3d: ['img-1'] } },
      { sourceLocalId: 'local-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
    ],
    ...overrides,
  };
}

describe('diffRequestVersions', () => {
  it('copii identice → lista goala', () => {
    expect(diffRequestVersions(snap(), snap())).toEqual({ comparable: true, fields: [], rooms: [] });
  });

  it('ordinea cheilor si imaginea 3D regenerata nu sunt modificari', () => {
    const next = snap({
      rooms: [
        { roomType: 'KITCHEN', sourceLocalId: 'local-1', flowVersion: 3, answers: { snapshot3d: ['img-2'], length: 3.2, material: 'MDF_VOPSIT' } },
        { sourceLocalId: 'local-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
    });
    expect(diffRequestVersions(snap(), next).rooms).toEqual([]);
  });

  it('material diferit → camera modificata (raspunsurile), cu detalii', () => {
    const next = snap({
      rooms: [
        { sourceLocalId: 'local-1', roomType: 'KITCHEN', flowVersion: 3, answers: { material: 'PAL', length: 3.2 } },
        { sourceLocalId: 'local-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
    });
    const diff = diffRequestVersions(snap(), next);
    expect(diff.fields).toEqual([]);
    expect(diff.rooms).toEqual([
      { change: 'MODIFIED', roomType: 'KITCHEN', ordinal: 1, ofType: 1, detailed: true, aspects: ['answers'] },
    ]);
  });

  it('camera adaugata, camera scoasa si buget schimbat', () => {
    const next = snap({
      budgetEstimateRon: 45000,
      budgetRange: 'B_40_70K',
      rooms: [
        { sourceLocalId: 'local-1', roomType: 'KITCHEN', flowVersion: 3, answers: { material: 'MDF_VOPSIT', length: 3.2 } },
        { sourceLocalId: 'local-3', roomType: 'LIVING', flowVersion: 1, answers: { tv: true } },
      ],
    });
    const diff = diffRequestVersions(snap(), next);
    expect(diff.comparable).toBe(true);
    expect(diff.fields).toEqual(['budget']);
    expect(diff.rooms).toEqual([
      { change: 'ADDED', roomType: 'LIVING', ordinal: 1, ofType: 1, detailed: true, aspects: [] },
      { change: 'REMOVED', roomType: 'BEDROOM', ordinal: 1, ofType: 1, detailed: true, aspects: [] },
    ]);
  });

  it('prima editare: id-urile locale de la publicare devin id-uri salvate → potrivire dupa tip', () => {
    const next = snap({
      rooms: [
        { sourceLocalId: 'db-room-1', roomType: 'KITCHEN', flowVersion: 3, answers: { material: 'MDF_VOPSIT', length: 3.2 } },
        { sourceLocalId: 'db-room-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
      inspirationPhotos: [{ photoId: 'p1', note: 'asa', roomLocalId: 'db-room-1' }],
    });
    expect(diffRequestVersions(snap(), next)).toEqual({ comparable: true, fields: [], rooms: [] });
  });

  it('m3: versiune de chestionar diferita, dar copia bruta identica → nu e „modificata”', () => {
    const next = snap({
      rooms: [
        { sourceLocalId: 'local-1', roomType: 'KITCHEN', flowVersion: 4, answers: { material: 'MDF_VOPSIT', length: 3.2, snapshot3d: ['img-9'] } },
        { sourceLocalId: 'local-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
    });
    expect(diffRequestVersions(snap(), next).rooms).toEqual([]);
  });

  it('m3: la prima editare (id-uri locale vs salvate), scos primul din doua dulapuri → „Dulap 1 scos”, nu pe dos', () => {
    const prev = snap({
      rooms: [
        { sourceLocalId: 'local-a', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 1.2 } },
        { sourceLocalId: 'local-b', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 2.4 } },
      ],
    });
    const next = snap({
      rooms: [{ sourceLocalId: 'db-b', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 2.4 } }],
    });
    expect(diffRequestVersions(prev, next).rooms).toEqual([
      { change: 'REMOVED', roomType: 'PIECE_WARDROBE', ordinal: 1, ofType: 2, detailed: true, aspects: [] },
    ]);
  });

  it('m3: perechile cu continut identic primesc intaietate, restul se potrivesc dupa tip', () => {
    const prev = snap({
      rooms: [
        { sourceLocalId: 'local-a', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 1.2 } },
        { sourceLocalId: 'local-b', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 2.4 } },
      ],
    });
    // al doilea neatins, primul modificat
    const next = snap({
      rooms: [
        { sourceLocalId: 'db-a', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 1.5 } },
        { sourceLocalId: 'db-b', roomType: 'PIECE_WARDROBE', flowVersion: 1, answers: { width: 2.4 } },
      ],
    });
    expect(diffRequestVersions(prev, next).rooms).toEqual([
      { change: 'MODIFIED', roomType: 'PIECE_WARDROBE', ordinal: 1, ofType: 2, detailed: true, aspects: ['answers'] },
    ]);
  });

  it('versiuni de chestionar diferite si raspunsuri schimbate → „camera modificata” fara detalii inventate', () => {
    const next = snap({
      rooms: [
        { sourceLocalId: 'local-1', roomType: 'KITCHEN', flowVersion: 4, answers: { material: 'PAL', length: 3.2 } },
        { sourceLocalId: 'local-2', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
    });
    expect(diffRequestVersions(snap(), next).rooms).toEqual([
      { change: 'MODIFIED', roomType: 'KITCHEN', ordinal: 1, ofType: 1, detailed: false, aspects: [] },
    ]);
  });

  it('campurile generale: termen, mesaj, localitate, proiectare, proiect propriu, inspiratie', () => {
    const next = snap({
      deadlineBucket: 'ASAP',
      description: 'Alt mesaj',
      city: 'Floresti',
      includesPaidDesign: true,
      hasOwnProject: true,
      inspirationPhotos: [],
    });
    expect(diffRequestVersions(snap(), next).fields).toEqual([
      'deadline',
      'description',
      'location',
      'designHelp',
      'ownProject',
      'inspiration',
    ]);
  });

  it('strada, blocul si contactele NU apar niciodata (confidentialitate)', () => {
    const next = snap({
      addressText: 'Str. Alta 99',
      addressDetails: 'Bl. Z',
      contactPreferences: [{ channel: 'PHONE', value: '0722000000' }],
    });
    expect(diffRequestVersions(snap(), next)).toEqual({ comparable: true, fields: [], rooms: [] });
  });

  it('mesaj gol vs lipsa si spatii in plus nu sunt modificari', () => {
    expect(diffRequestVersions(snap({ description: '' }), snap({ description: undefined })).fields).toEqual([]);
    expect(diffRequestVersions(snap(), snap({ description: '  Vreau o bucatarie luminoasa ' })).fields).toEqual([]);
  });

  it('doua camere de acelasi tip: numarul camerei din copia noua', () => {
    const prev = snap({
      rooms: [
        { sourceLocalId: 'a', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
        { sourceLocalId: 'b', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: false } },
      ],
    });
    const next = snap({
      rooms: [
        { sourceLocalId: 'a', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
        { sourceLocalId: 'b', roomType: 'BEDROOM', flowVersion: 2, answers: { wardrobe: true } },
      ],
    });
    expect(diffRequestVersions(prev, next).rooms).toEqual([
      { change: 'MODIFIED', roomType: 'BEDROOM', ordinal: 2, ofType: 2, detailed: true, aspects: ['answers'] },
    ]);
  });

  it('format necunoscut → necomparabil', () => {
    expect(diffRequestVersions(null, snap()).comparable).toBe(false);
    expect(diffRequestVersions(snap({ rooms: 'x' }), snap()).comparable).toBe(false);
  });
});
