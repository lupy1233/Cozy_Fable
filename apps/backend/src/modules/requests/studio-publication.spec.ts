import { CURRENT_FLOW_VERSION, ERROR_CODES, NEW_PIECE_KINDS, defaultPieceConfig, defaultStudioHouse, type RequestStudioSceneData } from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
import type { ProcessedRoom } from './configurator.service';
import { assertStudioNightstands, parsePublicationScenes, resolvePublicationScenes } from './studio-publication';

function fixture() {
  const config = defaultPieceConfig('BED');
  const snapshot: RequestStudioSceneData = {
    scene: { id: 'bedroom', name: 'Bedroom', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: '#ffffff', floorColor: '#dddddd' }, openings: [], placements: [{ id: 'placement', pieceId: 'bed', x: 0, z: 0, rotation: 0 }] },
    pieces: { bed: { id: 'bed', name: 'Bed', kind: 'BED', config, updatedAt: 1 } },
    requestEntryIds: { placement: 'local' }, requestEntryIdKind: 'LOCAL',
  };
  const room = { sourceLocalId: 'local', roomType: 'PIECE_BED', flowVersion: 3, answers: { config3d: config }, scoreEntries: [], derived: { lengthM: 2, widthM: 2, heightM: 1, items: [] } } as ProcessedRoom;
  return { snapshot, room };
}

describe('Studio publication contract', () => {
  it.each(NEW_PIECE_KINDS)('publishes %s with exact configuration and matching type', (kind) => {
    const { snapshot, room } = fixture();
    const config = defaultPieceConfig(kind);
    snapshot.pieces.bed = { ...snapshot.pieces.bed, kind, config };
    room.roomType = `PIECE_${kind}`; room.flowVersion = 1; room.answers = { config3d: config };
    const result = resolvePublicationScenes(parsePublicationScenes([snapshot]), [room], new Map([['local', 'persisted']]));
    expect(result[0].pieces.bed.config).toEqual(config);
    expect(result[0].requestEntryIds).toEqual({ placement: 'persisted' });
  });
  it('rejects a questionnaire edit that moves a wall cabinet through the room ceiling', () => {
    const { snapshot, room } = fixture();
    const config = { ...defaultPieceConfig('WALL_CABINET'), mountingHeightM: 2.2 };
    snapshot.pieces.bed = { ...snapshot.pieces.bed, kind: 'WALL_CABINET', config };
    room.roomType = 'PIECE_WALL_CABINET'; room.flowVersion = 1; room.answers = { config3d: config };
    expect(() => resolvePublicationScenes(parsePublicationScenes([snapshot]), [room], new Map([['local', 'persisted']]))).toThrow('Furniture no longer fits');
  });
  it('resolves quotation identities without altering furniture or physical-room identities', () => {
    const { snapshot, room } = fixture();
    const [result] = resolvePublicationScenes(parsePublicationScenes([snapshot]), [room], new Map([['local', 'persisted']]));
    expect(result.requestEntryIds).toEqual({ placement: 'persisted' });
    expect(result.requestEntryIdKind).toBe('PERSISTED');
    expect(result.scene).toEqual(snapshot.scene);
    expect(snapshot.requestEntryIds).toEqual({ placement: 'local' });
  });
  it('rejects missing, stale or duplicate furniture mappings', () => {
    const { snapshot, room } = fixture();
    const ids = new Map([['local', 'persisted']]);
    expect(() => resolvePublicationScenes([snapshot], [], ids)).toThrow();
    expect(() => resolvePublicationScenes([snapshot], [{ ...room, answers: {} }], ids)).toThrow();
    expect(() => resolvePublicationScenes([snapshot, snapshot], [room], ids)).toThrow();
  });
  it('does not silently truncate invalid scenes or over-limit collections', () => {
    const { snapshot } = fixture();
    expect(() => parsePublicationScenes(Array.from({ length: 13 }, () => snapshot))).toThrow();
    expect(() => parsePublicationScenes([snapshot, { invalid: true }])).toThrow();
    expect(() => parsePublicationScenes(null)).toThrow();
    expect(() => parsePublicationScenes([snapshot, snapshot])).toThrow();
  });
  it('keeps legacy snapshots readable without inventing a quotation mapping', () => {
    const { snapshot } = fixture();
    delete snapshot.requestEntryIds; delete snapshot.requestEntryIdKind;
    expect(resolvePublicationScenes(parsePublicationScenes([snapshot]), [], new Map())).toEqual([snapshot]);
  });
  it('requires complete, consistent house members and rejects foreign references', () => {
    const { snapshot } = fixture();
    snapshot.house = defaultStudioHouse([snapshot.scene]);
    expect(parsePublicationScenes([snapshot])).toHaveLength(1);
    snapshot.house.roomTransforms.foreign = { ...snapshot.house.roomTransforms.bedroom };
    expect(() => parsePublicationScenes([snapshot])).toThrow();
  });
  it('refuses a house without authoritative quotation mapping', () => {
    const { snapshot } = fixture();
    snapshot.house = defaultStudioHouse([snapshot.scene]);
    delete snapshot.requestEntryIds; delete snapshot.requestEntryIdKind;
    expect(() => resolvePublicationScenes([snapshot], [], new Map())).toThrow();
  });
});

function nightstandFixture(count: string) {
  const config = defaultPieceConfig('NIGHTSTAND');
  const snapshot: RequestStudioSceneData = {
    scene: { id: 'bedroom', name: 'Bedroom', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: '#ffffff', floorColor: '#dddddd' }, openings: [], placements: [{ id: 'placement', pieceId: 'ns', x: 0, z: 0, rotation: 0 }] },
    pieces: { ns: { id: 'ns', name: 'Nightstand', kind: 'NIGHTSTAND', config, updatedAt: 1 } },
    requestEntryIds: { placement: 'local' }, requestEntryIdKind: 'LOCAL',
  };
  const room = { sourceLocalId: 'local', roomType: 'PIECE_NIGHTSTAND', flowVersion: CURRENT_FLOW_VERSION.PIECE_NIGHTSTAND, answers: { config3d: config, count }, scoreEntries: [], derived: { lengthM: 0.5, widthM: 0.4, heightM: 0.5, items: [] } } as ProcessedRoom;
  return { snapshot, room };
}

describe('Studio nightstand pre-check (E-client-2)', () => {
  it('points at the count step of the room when a placed nightstand counts two', () => {
    const { snapshot, room } = nightstandFixture('TWO');
    let response: { code?: string; details?: { roomIndex: number; stepId: string }[] } = {};
    try {
      assertStudioNightstands([snapshot], [room]);
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      response = (err as BadRequestException).getResponse() as typeof response;
    }
    expect(response.code).toBe(ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID);
    expect(response.details?.[0]).toMatchObject({ roomIndex: 0, stepId: 'count' });
  });
  it('accepts a placed nightstand that counts one', () => {
    const { snapshot, room } = nightstandFixture('ONE');
    expect(() => assertStudioNightstands([snapshot], [room])).not.toThrow();
  });
});
