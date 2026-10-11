import { ERROR_CODES, MAX_STUDIO_DRAFT_BYTES, REQUEST_STUDIO_SCENES_MAX, houseLayoutErrors, readRequestStudioSceneData, studioScenePlacementIssues, type RequestStudioSceneData } from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { ProcessedRoom } from './configurator.service';

function invalid(message: string): never {
  throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message });
}

// Nu trunchiaza scene sau referinte: publicarea esueaza fara a modifica draftul.
export function parsePublicationScenes(raw: unknown): RequestStudioSceneData[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > REQUEST_STUDIO_SCENES_MAX) invalid('Invalid studio scene count');
  let bytes: number;
  try { bytes = Buffer.byteLength(JSON.stringify(raw), 'utf8'); } catch { invalid('Invalid studio scene data'); }
  if (bytes > MAX_STUDIO_DRAFT_BYTES) invalid('Studio scenes exceed the publication size limit');
  const scenes = raw.map((entry) => {
    try { return readRequestStudioSceneData(entry); } catch { invalid('Invalid studio scene'); }
  });
  if (new Set(scenes.map((s) => s.scene.id)).size !== scenes.length) invalid('Duplicate studio scene identity');
  for (const snapshot of scenes) {
    if (!snapshot.house) continue;
    const members = scenes.filter((s) => Object.hasOwn(snapshot.house!.roomTransforms, s.scene.id));
    if (members.some((s) => !isDeepStrictEqual(s.house, snapshot.house)) || houseLayoutErrors(snapshot.house, members.map((s) => s.scene)).length) invalid('Invalid published house references or geometry');
  }
  return scenes;
}

export function resolvePublicationScenes(scenes: RequestStudioSceneData[], rooms: ProcessedRoom[], persistentIds: Map<string, string>): RequestStudioSceneData[] {
  const bySource = new Map(rooms.filter((r) => r.sourceLocalId).map((r) => [r.sourceLocalId!, r]));
  const usedEntries = new Set<string>();
  return scenes.map((snapshot) => {
    if (!snapshot.requestEntryIds && !snapshot.requestEntryIdKind) {
      if (snapshot.house) invalid('House snapshot is missing its furniture entry mapping');
      return snapshot; // Scene legacy, fara legaturi fabricate la cereri istorice.
    }
    if (!snapshot.requestEntryIds || !snapshot.requestEntryIdKind) invalid('Incomplete studio entry mapping');
    const layoutIssues = studioScenePlacementIssues(snapshot.scene, snapshot.pieces);
    if (layoutIssues.length) throw new BadRequestException({ code: ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID, message: 'Furniture no longer fits the studio room',
      details: layoutIssues.map(issue => ({ roomIndex: rooms.findIndex(room => room.sourceLocalId === snapshot.requestEntryIds?.[issue.placementId]), stepId: 'config3d', messageKey: 'validation.studioPieceDoesNotFit' })) });
    if (Object.keys(snapshot.requestEntryIds).length !== snapshot.scene.placements.length) invalid('Studio entry mapping does not cover its placements');
    const requestEntryIds: Record<string, string> = {};
    for (const placement of snapshot.scene.placements) {
      const sourceId = snapshot.requestEntryIds[placement.id];
      const room = bySource.get(sourceId);
      const piece = snapshot.pieces[placement.pieceId];
      const persistentId = persistentIds.get(sourceId);
      if (!room || !persistentId || usedEntries.has(sourceId) || room.roomType !== `PIECE_${piece.kind}` || !isDeepStrictEqual(room.answers.config3d, piece.config)) invalid('Studio placement does not match its furniture request entry');
      if (piece.kind === 'NIGHTSTAND' && room.answers.count !== 'ONE') invalid('A placed nightstand must represent one furniture item');
      usedEntries.add(sourceId);
      requestEntryIds[placement.id] = persistentId;
    }
    return { ...snapshot, requestEntryIds, requestEntryIdKind: 'PERSISTED' };
  });
}

// Pre-verificare in AFARA tranzactiei (E-client-2): o noptiera asezata in Studio
// = o singura piesa (count ONE). Eroarea poarta camera si pasul, ca sumarul din
// FE sa poata trimite clientul direct la intrebarea gresita. Verificarea din
// resolvePublicationScenes ramane (aparare in adancime).
export function assertStudioNightstands(scenes: RequestStudioSceneData[], rooms: ProcessedRoom[]): void {
  for (const snapshot of scenes) {
    if (!snapshot.requestEntryIds) continue;
    for (const placement of snapshot.scene.placements) {
      if (snapshot.pieces[placement.pieceId]?.kind !== 'NIGHTSTAND') continue;
      const sourceId = snapshot.requestEntryIds[placement.id];
      const room = sourceId ? rooms.find((r) => r.sourceLocalId === sourceId) : undefined;
      if (room && room.answers.count !== 'ONE') {
        throw new BadRequestException({
          code: ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID,
          message: 'A placed nightstand must represent one furniture item',
          details: [{ roomIndex: rooms.indexOf(room), stepId: 'count', messageKey: 'validation.studioNightstandSingle' }],
        });
      }
    }
  }
}
